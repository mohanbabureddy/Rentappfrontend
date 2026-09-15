import React, { useState, useRef, useEffect } from 'react';
import { url, authFetch } from './apiClient';

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Ask me things like "who do I pay rent to" or "what do I owe this month".' }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setError('');
    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const res = await authFetch(url.assistantAsk(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages(m => [...m, { role: 'assistant', text: data.answer || '(no answer)' }]);
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
          <div key={i} style={m.role === 'user' ? bubbleUser : bubbleBot}>{m.text}</div>
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
const sendBtn = { border: 'none', background: '#2563eb', color: '#fff', padding: '0 16px', fontWeight: 'bold', cursor: 'pointer' };
