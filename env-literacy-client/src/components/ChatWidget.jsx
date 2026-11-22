import { useEffect, useRef, useState } from 'react';
import { get, post } from '../api/client.js';

const WELCOME = { from: 'bot', text: 'Hi! I am the Eco Helper. Ask me about waste, water, energy, climate, air, transport, local issues or how this platform works.' };

// Floating keyword-matching chatbot. Answers come from a predefined knowledge base on the server.
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([WELCOME]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [starters, setStarters] = useState([]);
  const [known, setKnown] = useState(null);
  const endRef = useRef(null); const inputRef = useRef(null); const btnRef = useRef(null);

  useEffect(() => {
    if (!open || starters.length) return;
    get('/chat/starters').then(d => { setStarters(d.starters); setKnown(d.answers_known); }).catch(() => {});
  }, [open, starters.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const close = () => { setOpen(false); btnRef.current?.focus(); };
  const ask = async raw => {
    const q = raw.trim(); if (!q || busy) return;
    setMsgs(m => [...m, { from: 'me', text: q }]); setText(''); setBusy(true);
    try {
      const [r] = await Promise.all([post('/chat', { message: q }), new Promise(res => setTimeout(res, 350))]); // brief "typing" pause
      setMsgs(m => [...m, { from: 'bot', text: r.answer, topic: r.topic_label, suggestions: r.suggestions }]);
    } catch (e) {
      setMsgs(m => [...m, { from: 'bot', text: e.offline ? 'I cannot reach the server right now. Please check your connection and try again.' : e.message }]);
    } finally { setBusy(false); }
  };

  return (<>
    {!open && <button ref={btnRef} className="chat-fab" aria-label="Open Eco Helper chat" onClick={() => setOpen(true)}>
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="9" cy="10.500" r="1.100" fill="currentColor" /><circle cx="13" cy="10.500" r="1.100" fill="currentColor" /><circle cx="17" cy="10.500" r=".01" fill="currentColor" /></svg>
    </button>}
    {open && (
      <div className="chat" role="dialog" aria-label="Eco Helper chat" onKeyDown={e => e.key === 'Escape' && close()}>
        <header className="chat-head">
          <div><strong>Eco Helper</strong><div className="xs">{known ? `${known} ready answers` : 'Ask me anything eco'}</div></div>
          <button className="chat-x" aria-label="Close chat" onClick={close}>×</button>
        </header>
        <div className="chat-body" role="log" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.from}`}>
              {m.topic && <span className="tag">{m.topic}</span>}
              <p>{m.text}</p>
              {m.suggestions?.length > 0 && i === msgs.length - 1 && !busy && (
                <div className="chips">{m.suggestions.map(s => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
              )}
            </div>
          ))}
          {msgs.length === 1 && starters.length > 0 && <div className="chips">{starters.map(s => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>}
          {busy && <div className="bubble bot typing" aria-label="Eco Helper is typing"><i /><i /><i /></div>}
          <div ref={endRef} />
        </div>
        <form className="chat-form" onSubmit={e => { e.preventDefault(); ask(text); }}>
          <label className="sr-only" htmlFor="chat-input">Your question</label>
          <input id="chat-input" ref={inputRef} className="input" maxLength={300} placeholder="Ask a question…" value={text} onChange={e => setText(e.target.value)} autoComplete="off" />
          <button className="btn" disabled={busy || !text.trim()}>Send</button>
        </form>
      </div>
    )}
  </>);
}
