import React, { useState, useRef, useEffect } from 'react';
import { url, authFetch } from './apiClient';

const COMPLAINT_HINT = /complain|not working|broken|leak|problem|issue|repair|noise|dirty|no water|no power|power cut|bad smell|damage/i;

// "I paid but it still shows unpaid" style messages
const PAYMENT_DISPUTE = /(paid|payment|deducted|debited).*(not|still|unpaid|pending|showing|failed|missing)|(not|still|unpaid|pending).*(paid|payment|deducted|debited)/i;

const WITHDRAW_HINT = /(withdraw|cancel|delete|remove|take back|close).*complain|complain.*(withdraw|cancel|delete|remove|take back|close)/i;

// "I want to raise a complaint" with no actual problem described yet
const GENERIC_WORDS = new Set('i want need would like to a an my the raise file register make submit lodge give post send create new complaint complaints please can could how do you me let want'.split(' '));
const isGenericComplaint = (t) => {
  const words = t.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  return words.includes('complaint') || words.includes('complain')
    ? words.every(w => GENERIC_WORDS.has(w) || w === 'complain')
    : false;
};

// "my complaint(s)", "open complaints", "complaint status" -> show them, don't start a new one
const RAISE_WORDS = /\b(raise|file|register|make|submit|lodge|new|give|post|create|another)\b/i;
const VIEW_COMPLAINTS = /\b(my|open|pending|show|view|list|check|see|track)\b(\s+\w+){0,2}\s+complaints?\b|\bcomplaints?\s+(status|list|history)\b/i;
const isViewComplaints = (t) => !RAISE_WORDS.test(t) && VIEW_COMPLAINTS.test(t) && !/\b(about|regarding|because|since)\b/i.test(t);

// Tolerate typos like "compalint", "complant", "compliant" when matching intent
const normalizeComplaintWord = (t) => t.replace(/\bcomp[a-z]{2,5}nts?\b/gi, 'complaint');

export default function ChatAssistant({ username }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Ask me things like "what do I owe this month" or "how much deposit is left". You can also tell me about a problem and I will file it as a complaint.' }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const [filingIdx, setFilingIdx] = useState(null);
  const [awaitingComplaint, setAwaitingComplaint] = useState(false);

  const withdrawComplaint = async (idx, id) => {
    setFilingIdx(idx);
    setError('');
    try {
      const res = await authFetch(url.complaintsWithdraw(id), { method: 'PUT' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not withdraw the complaint. Please try again.');
      }
      setMessages(m => m.map((x, i) => i === idx
        ? { ...x, openComplaints: x.openComplaints.filter(c => c.id !== id) } : x)
        .concat({ role: 'assistant', text: 'Done - your complaint has been withdrawn.' }));
    } catch (err) {
      setError(err.message || 'Could not withdraw the complaint. Please try again.');
    } finally {
      setFilingIdx(null);
    }
  };

  const loadComplaints = async (forWithdraw) => {
    setSending(true);
    try {
      const res = await authFetch(url.complaintsList(username));
      const list = res.ok ? await res.json() : [];
      const open = Array.isArray(list) ? list.filter(c => c.status === 'OPEN') : [];
      setMessages(m => [...m, open.length === 0
        ? { role: 'assistant', text: forWithdraw ? 'You have no open complaints to withdraw.' : 'You have no open complaints.' }
        : {
            role: 'assistant',
            text: forWithdraw ? 'Which complaint do you want to withdraw?' : `You have ${open.length} open complaint${open.length > 1 ? 's' : ''}:`,
            openComplaints: open
          }]);
    } catch {
      setError('Could not load your complaints. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const fileComplaint = async (idx, description) => {
    setFilingIdx(idx);
    setError('');
    try {
      const res = await authFetch(url.complaintsAdd(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName: username, description })
      });
      if (!res.ok) throw new Error('Could not submit the complaint. Please try again.');
      setMessages(m => m.map((x, i) => i === idx ? { ...x, complaintText: null } : x)
        .concat({ role: 'assistant', text: 'Done - your complaint has been submitted. You can track it under Complaints.' }));
    } catch (err) {
      setError(err.message || 'Could not submit the complaint. Please try again.');
    } finally {
      setFilingIdx(null);
    }
  };

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    const intentText = normalizeComplaintWord(text);
    if (!text || sending) return;
    setError('');
    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');
    if (awaitingComplaint) {
      setAwaitingComplaint(false);
      if (/^(cancel|never ?mind|no|stop)\.?$/i.test(text)) {
        setMessages(m => [...m, { role: 'assistant', text: 'Okay, I have not submitted anything.' }]);
        return;
      }
      setMessages(m => [...m, {
        role: 'assistant',
        text: 'Tap the button to submit this complaint to the property manager, or type "cancel".',
        complaintText: text
      }]);
      return;
    }
    if (!WITHDRAW_HINT.test(intentText) && isViewComplaints(intentText)) {
      loadComplaints(false);
      return;
    }
    if (!WITHDRAW_HINT.test(intentText) && isGenericComplaint(intentText)) {
      setAwaitingComplaint(true);
      setMessages(m => [...m, {
        role: 'assistant',
        text: 'Sure. Please type your complaint in detail (what the problem is and where), and I will show a button to submit it.'
      }]);
      return;
    }
    if (WITHDRAW_HINT.test(intentText)) {
      loadComplaints(true);
      return;
    }
    if (PAYMENT_DISPUTE.test(intentText) && /paid|deducted|debited/i.test(text)) {
      setMessages(m => [...m, {
        role: 'assistant',
        text: "Please don't pay again. First refresh the My Bills page - a payment can take a minute to show. If the bill still shows Unpaid, tap the button below to report it to the property manager, and keep your payment ID (it starts with pay_) from the Razorpay receipt or email.",
        complaintText: 'Payment made but bill still shows unpaid. ' + text
      }]);
      return;
    }
    if (COMPLAINT_HINT.test(intentText)) {
      // Answered locally: a small model tends to claim it already filed the
      // complaint or offer actions it can't perform.
      setMessages(m => [...m, {
        role: 'assistant',
        text: 'Sorry about that. Tap the button below to send this to the property manager as a complaint.',
        complaintText: text
      }]);
      return;
    }
    setSending(true);
    try {
      const res = await authFetch(url.assistantAsk(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages(m => [...m, {
        role: 'assistant',
        text: data.answer || '(no answer)'
      }]);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={fab} title="Ask a question">
        💬
      </button>
    );
  }

  return (
    <div style={panel}>
      <div style={header}>
        <span>Rent Assistant</span>
        <button onClick={() => setOpen(false)} style={closeBtn}>×</button>
      </div>
      <div style={body}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? bubbleUser : bubbleBot}>
            {m.text}
            {m.openComplaints && m.openComplaints.map(c => (
              <div key={c.id} style={{ marginTop: 8, fontSize: 12 }}>
                <div style={{ color: '#64748b' }}>{c.createdDate ? new Date(c.createdDate).toLocaleDateString() : ''}</div>
                <div style={{ marginBottom: 4 }}>"{c.description.length > 80 ? c.description.slice(0, 80) + '…' : c.description}"</div>
                <button onClick={() => withdrawComplaint(i, c.id)} disabled={filingIdx === i} style={complaintBtn}>
                  {filingIdx === i ? 'Withdrawing…' : 'Withdraw this'}
                </button>
              </div>
            ))}
            {m.complaintText && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => fileComplaint(i, m.complaintText)}
                  disabled={filingIdx === i}
                  style={complaintBtn}
                >{filingIdx === i ? 'Submitting…' : 'Submit as complaint'}</button>
              </div>
            )}
          </div>
        ))}
        {sending && <div style={bubbleBot}>Thinking…</div>}
        {error && <div style={{ color: '#b91c1c', fontSize: 12, padding: '4px 0' }}>{error}</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} style={inputRow}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question…"
          style={inputStyle}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} style={sendBtn}>Send</button>
      </form>
    </div>
  );
}

const fab = {
  position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
  background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff', border: 'none',
  fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 1000
};
const panel = {
  position: 'fixed', bottom: 24, right: 24, width: 340, maxHeight: 480, display: 'flex',
  flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  overflow: 'hidden', zIndex: 1000
};
const header = {
  background: 'linear-gradient(90deg,#2563eb,#38bdf8)', color: '#fff', padding: '10px 14px',
  fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
};
const closeBtn = { background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 };
const body = { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc' };
const bubbleUser = { alignSelf: 'flex-end', background: '#2563eb', color: '#fff', padding: '8px 12px', borderRadius: 12, maxWidth: '80%', fontSize: 14 };
const bubbleBot = { alignSelf: 'flex-start', background: '#e2e8f0', color: '#0f172a', padding: '8px 12px', borderRadius: 12, maxWidth: '80%', fontSize: 14, whiteSpace: 'pre-wrap' };
const inputRow = { display: 'flex', borderTop: '1px solid #e2e8f0' };
const inputStyle = { flex: 1, border: 'none', padding: '10px 12px', fontSize: 14, outline: 'none' };
const complaintBtn = { border: 'none', background: '#dc2626', color: '#fff', padding: '6px 12px', borderRadius: 8, fontWeight: 'bold', fontSize: 12, cursor: 'pointer' };
const sendBtn = { border: 'none', background: '#2563eb', color: '#fff', padding: '0 16px', fontWeight: 'bold', cursor: 'pointer' };
