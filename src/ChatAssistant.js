import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { url, authFetch } from './apiClient';
import './ChatAssistant.css';

// Tolerate typos / voice-typing slips like "compalint", "complant", "compliance"
const normalizeComplaintWord = (t) => t
  .replace(/\bcomp[a-z]{2,5}nts?\b/gi, 'complaint')
  .replace(/\bcompl[a-z]{2,4}nces?\b/gi, 'complaint');

// Anything complaint-related is answered here with a pointer to the Complaints
// page, where raising, tracking and withdrawing all already live. The chat
// never files or changes a complaint itself.
const COMPLAINT_WORD = /complain/i;
const COMPLAINT_PROBLEM = /not working|broken|leak|problem|issue|repair|noise|dirty|no water|no power|power cut|bad smell|damage/i;
const WITHDRAW_WORDS = /\b(withdraw|cancel|delete|remove|take back|close|undo)\b/i;
const RAISE_WORDS = /\b(raise|file|register|make|submit|lodge|new|give|post|create|another)\b/i;
const VIEW_WORDS = /\b(my|open|pending|status|track|show|view|see|check|list|history|reply|resolution)\b/i;

// Uploading ID / KYC documents -> point the tenant to the Occupants page
const DOCUMENT_HINT = /upload|documents?|aadhaa?r|passport|photo ?id|id ?(proof|card)|kyc|driving ?licen[cs]e|voter ?id|pan ?card|address ?proof/i;

// "I paid but it still shows unpaid" style messages
const PAYMENT_DISPUTE = /(paid|payment|deducted|debited).*(not|still|unpaid|pending|showing|failed|missing)|(not|still|unpaid|pending).*(paid|payment|deducted|debited)/i;

const complaintReply = (intentText) => {
  if (/^\W*complaints?\W*$/i.test(intentText)) {
    return 'On the Complaints page you can raise a new complaint, check the status of your complaints, or withdraw one.';
  }
  if (COMPLAINT_WORD.test(intentText)) {
    if (WITHDRAW_WORDS.test(intentText)) {
      return 'To withdraw a complaint, open the Complaints page and tap Withdraw next to the open complaint.';
    }
    if (!RAISE_WORDS.test(intentText) && VIEW_WORDS.test(intentText)) {
      return 'Your complaints, their status (Open or Closed) and the owner\'s reply are all on the Complaints page.';
    }
  }
  return 'To raise a complaint, open the Complaints page, describe the problem in the box and tap Submit Complaint. You can track its status there too.';
};

// Debug view (local only): set REACT_APP_CHAT_DEBUG=true in frontend/.env
const DEBUG = process.env.REACT_APP_CHAT_DEBUG === 'true';

// Debug walkthrough: reveals the steps one at a time
function TraceView({ trace }) {
  const [shown, setShown] = useState(1);
  const done = shown >= trace.length;
  return (
    <details className="chat-trace">
      <summary>How this was answered ({trace.length} steps)</summary>
      <ol>{trace.slice(0, shown).map((t, k) => <li key={k}>{t}</li>)}</ol>
      <div className="chat-trace-actions">
        {!done && <button type="button" onClick={() => setShown(n => n + 1)}>Next step &#9654;</button>}
        {!done && <button type="button" onClick={() => setShown(trace.length)}>Show all</button>}
        {shown > 1 && <button type="button" onClick={() => setShown(1)}>Restart</button>}
        {done && <span className="chat-trace-done">End of flow</span>}
      </div>
    </details>
  );
}

// Debug: real line-by-line code replay (like an IDE debugger), one line at a time
function CodeTraceView({ events, truncated }) {
  const [shown, setShown] = useState(1);
  const boxRef = useRef(null);
  const done = shown >= events.length;
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [shown]);
  const row = (e, k) => {
    const pad = '  '.repeat(e.depth || 0);
    const where = e.line ? `${e.file}:${e.line}` : e.file;
    const isLast = k === shown - 1;
    let text;
    if (e.type === 'call') text = `${pad}>> ${where}  ${e.func}()`;
    else if (e.type === 'return') text = `${pad}<< return from ${e.func}()`;
    else text = `${pad}${where}   ${e.code}`;
    return <div key={k} className={`code-row ${e.type}${isLast ? ' current' : ''}`}>{text}</div>;
  };
  return (
    <details className="chat-trace">
      <summary>Code walkthrough, line by line ({events.length} lines)</summary>
      <div className="code-box" ref={boxRef}>{events.slice(0, shown).map(row)}</div>
      <div className="chat-trace-actions">
        {!done && <button type="button" onClick={() => setShown(n => n + 1)}>Next line &#9654;</button>}
        {!done && <button type="button" onClick={() => setShown(n => Math.min(n + 10, events.length))}>+10 lines</button>}
        {!done && <button type="button" onClick={() => setShown(events.length)}>Show all</button>}
        {shown > 1 && <button type="button" onClick={() => setShown(1)}>Restart</button>}
        <span className="chat-trace-done">{shown}/{events.length}{done ? (truncated ? ' (cut off at the limit)' : ' - end of flow') : ''}</span>
      </div>
    </details>
  );
}

export default function ChatAssistant({ username }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! How can I help you? You can ask about your bills or deposit, raise a complaint, or ask how to upload your documents.' }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const reply = (msg, trace, codeTrace, codeTraceTruncated) => setMessages(m => [...m, { role: 'assistant', ...msg, trace, codeTrace, codeTraceTruncated }]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    const intentText = normalizeComplaintWord(text);
    setError('');
    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');

    const steps = [`Browser: you typed "${text}"`];
    if (intentText !== text) steps.push(`Browser: spelling fixed for matching -> "${intentText}"`);
    const check = (label, cond) => { steps.push(`Browser check - ${label}: ${cond ? 'YES' : 'no'}`); return cond; };
    const answeredHere = (why) => steps.push(`Browser: ${why} -> answered right here, nothing sent to the server or AI model`);

    if (check('document/ID words (upload, Aadhaar, passport...)', DOCUMENT_HINT.test(text))) {
      answeredHere('shows the upload guide with a Go to Occupants button');
      reply({
        text: [
          'You can upload your documents (Aadhaar, passport, photo ID or other ID proof) on the Occupants page:',
          '1. Tap Go to Occupants below.',
          "2. Enter the person's full name.",
          '3. Choose the file (PDF, JPG or PNG, up to 2 MB).',
          '4. Tap Add.',
          'It shows PENDING until the owner verifies it.'
        ].join('\n'),
        navigateTo: '/occupants',
        navigateLabel: 'Go to Occupants'
      }, steps);
      return;
    }
    if (check('"withdraw"/"refund" alone (no complaint or deposit word)', /\b(withdraw|refund)\b/i.test(text) && !COMPLAINT_WORD.test(intentText) && !/deposit|advance/i.test(text))) {
      answeredHere('asks whether you meant a complaint or the deposit');
      reply({
        text: [
          'Did you mean a complaint or your security deposit?',
          '- Complaint: open the Complaints page and tap Withdraw next to it.',
          '- Deposit: refunds are not done in this app. The owner settles it with you directly when you move out. Ask me "owner details" for their contact.'
        ].join('\n'),
        navigateTo: '/complaints',
        navigateLabel: 'Go to Complaints'
      }, steps);
      return;
    }
    if (check('"I paid but it shows unpaid" pattern', PAYMENT_DISPUTE.test(intentText) && /paid|deducted|debited/i.test(text))) {
      answeredHere('tells you not to pay again and points to Complaints');
      reply({
        text: "Please don't pay again. First refresh the My Bills page - a payment can take a minute to show. If the bill still shows Unpaid, raise a complaint on the Complaints page and include your payment ID (it starts with pay_) from the Razorpay receipt or email.",
        navigateTo: '/complaints',
        navigateLabel: 'Go to Complaints'
      }, steps);
      return;
    }
    if (check('complaint or problem words (complaint, leak, broken...)', COMPLAINT_WORD.test(intentText) || COMPLAINT_PROBLEM.test(intentText))) {
      answeredHere('shows the complaint guide with a Go to Complaints button');
      reply({
        text: complaintReply(intentText),
        navigateTo: '/complaints',
        navigateLabel: 'Go to Complaints'
      }, steps);
      return;
    }

    steps.push('Browser: no browser rule matched -> sending the question to the server (POST /api/assistant/ask)');
    setSending(true);
    try {
      const res = await authFetch(url.assistantAsk(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const browserOut = [
        { type: 'line', file: 'ChatAssistant.js', func: 'send', depth: 0, code: "const res = await authFetch(url.assistantAsk(), { method: 'POST', ... body: JSON.stringify({ message: text }) });" },
        { type: 'call', file: 'apiClient.js', func: 'authFetch', depth: 1 },
        { type: 'line', file: 'apiClient.js', func: 'authFetch', depth: 1, code: 'return fetch(input, { credentials: FETCH_CREDENTIALS, ...init, headers: authHeaders(init.headers || {}) });' },
        { type: 'line', file: 'NETWORK', func: 'fetch', depth: 0, code: 'HTTP POST /api/assistant/ask  (browser -> Flask backend, with the Bearer token)' }
      ];
      const browserIn = [
        { type: 'line', file: 'NETWORK', func: 'fetch', depth: 0, code: 'HTTP 200 response comes back (JSON with the answer)' },
        { type: 'line', file: 'ChatAssistant.js', func: 'send', depth: 0, code: "reply({ text: data.answer || '(no answer)' }, ...);  -> the message appears in the chat" }
      ];
      const serverEvents = data.codeTrace || [];
      reply(
        { text: data.answer || '(no answer)' },
        steps.concat((data.trace || []).map(t => `Server: ${t}`)),
        serverEvents.length ? browserOut.concat(serverEvents, browserIn) : undefined,
        data.codeTraceTruncated
      );
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="chat-fab" title="Ask a question" aria-label="Open chat assistant">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></svg>
      </button>
    );
  }

  return (
    <div className={`chat-panel${DEBUG ? ' debug' : ''}`}>
      <div className="chat-header">
        <div className="chat-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4M9 13h.01M15 13h.01" /></svg>
        </div>
        <div>
          <div className="chat-title">Rent Assistant</div>
          <div className="chat-subtitle"><span className="chat-dot" /> Bills, deposit &amp; complaints</div>
        </div>
        <button onClick={() => setOpen(false)} className="chat-close" aria-label="Close chat">×</button>
      </div>
      <div className="chat-body">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role === 'user' ? 'user' : 'bot'}`}>
            {m.text}
            {DEBUG && m.trace && (
              <TraceView trace={m.trace} />
            )}
            {DEBUG && m.codeTrace && <CodeTraceView events={m.codeTrace} truncated={m.codeTraceTruncated} />}
            {m.navigateTo && (
              <div className="chat-action">
                <button onClick={() => { navigate(m.navigateTo); setOpen(false); }} className="chat-btn">
                  {m.navigateLabel}
                </button>
              </div>
            )}
          </div>
        ))}
        {sending && <div className="chat-msg bot chat-typing"><span /><span /><span /></div>}
        {error && <div className="chat-error">{error}</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="chat-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your question…"
          className="chat-input"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} className="chat-send" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </form>
    </div>
  );
}
