import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../api/client.js';
import { HOME, useAuth } from '../hooks/useAuth.jsx';
import { Button, Card, ErrorBox, Field } from '../components/ui.jsx';

const Shell = ({ title, children }) => (
  <div className="auth"><div className="media" aria-hidden="true" /><h1>{title}</h1><Card>{children}</Card></div>
);

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const u = await login(f.email.trim(), f.password); nav(HOME[u.role], { replace: true }); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Shell title="Log in">
      <form onSubmit={submit}>
        <Field label="Email"><input className="input" type="email" autoComplete="username" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>
        <ErrorBox error={err} />
        <button className="btn big" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="small mt2"><Link to="/forgot">Forgot password?</Link> · <Link to="/register">Create an account</Link></p>
    </Shell>
  );
}

export function RegisterPage() {
  const [role, setRole] = useState('student');
  const [f, setF] = useState({ name: '', email: '', password: '', institution_code: '', class_code: '', guardian_consent: false, inst_name: '', inst_type: 'school', board: '', area: '' });
  const [err, setErr] = useState(null); const [done, setDone] = useState(null); const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr(null);
    const base = { role, name: f.name, email: f.email, password: f.password };
    const body = role === 'student' ? { ...base, institution_code: f.institution_code, class_code: f.class_code, guardian_consent: f.guardian_consent }
      : role === 'teacher' ? { ...base, institution_code: f.institution_code }
      : { ...base, institution: { name: f.inst_name, type: f.inst_type, board_or_university: f.board || undefined, ward_or_area: f.area || undefined } };
    try { setDone(await post('/auth/register', body)); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  if (done) return <Shell title="Almost there"><p>{done.message}</p><Link to="/login">Go to log in</Link></Shell>;
  return (
    <Shell title="Create an account">
      <div className="seg" role="group" aria-label="I am a" style={{ marginBottom: 'var(--s2)' }}>
        {[['student', 'Student'], ['teacher', 'Teacher'], ['inst_admin', 'Institution']].map(([v, l]) =>
          <button key={v} type="button" className={role === v ? 'on' : ''} aria-pressed={role === v} onClick={() => setRole(v)}>{l}</button>)}
      </div>
      <form onSubmit={submit}>
        <Field label="Full name"><input className="input" required minLength={2} value={f.name} onChange={set('name')} /></Field>
        <Field label="Email"><input className="input" type="email" autoComplete="username" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={set('password')} /></Field>
        {role !== 'inst_admin' && <Field label="Institution code" hint="Ask your teacher or institution"><input className="input" required value={f.institution_code} onChange={set('institution_code')} style={{ textTransform: 'uppercase' }} /></Field>}
        {role === 'student' && <>
          <Field label="Class code"><input className="input" required value={f.class_code} onChange={set('class_code')} style={{ textTransform: 'uppercase' }} /></Field>
          <label className="small" style={{ display: 'flex', gap: 8, marginBottom: 'var(--s2)' }}>
            <input type="checkbox" checked={f.guardian_consent} onChange={set('guardian_consent')} />
            <span>I am 18 or older, or my parent/guardian agrees to my use of this platform. We store only my name, email and class.</span>
          </label>
        </>}
        {role === 'teacher' && <p className="muted small">Your institution admin approves teacher accounts before you can log in.</p>}
        {role === 'inst_admin' && <>
          <Field label="Institution name"><input className="input" required minLength={3} value={f.inst_name} onChange={set('inst_name')} /></Field>
          <Field label="Type"><select className="input" value={f.inst_type} onChange={set('inst_type')}><option value="school">School</option><option value="college">College</option></select></Field>
          <Field label="Board or university"><input className="input" value={f.board} onChange={set('board')} /></Field>
          <Field label="Ward or area"><input className="input" value={f.area} onChange={set('area')} /></Field>
          <p className="muted small">New institutions are reviewed by the platform team before you can log in.</p>
        </>}
        <ErrorBox error={err} />
        <button className="btn big" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="small mt2">Already have an account? <Link to="/login">Log in</Link></p>
    </Shell>
  );
}

export function ForgotPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(params.get('token') || '');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null); const [err, setErr] = useState(null); const [stage, setStage] = useState(params.get('token') ? 'reset' : 'ask');
  const ask = async e => {
    e.preventDefault(); setErr(null);
    try { const d = await post('/auth/forgot', { email }); setMsg(d.message); if (d.reset_token) setToken(d.reset_token); setStage('reset'); } catch (x) { setErr(x); }
  };
  const reset = async e => {
    e.preventDefault(); setErr(null);
    try { const d = await post('/auth/reset', { token, password: pw }); setMsg(d.message); setStage('done'); } catch (x) { setErr(x); }
  };
  return (
    <Shell title="Reset password">
      {stage === 'ask' && <form onSubmit={ask}>
        <Field label="Email"><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <ErrorBox error={err} /><Button big type="submit">Send reset link</Button>
      </form>}
      {stage === 'reset' && <form onSubmit={reset}>
        {msg && <p className="notice">{msg}</p>}
        <Field label="Reset code"><input className="input" required value={token} onChange={e => setToken(e.target.value)} /></Field>
        <Field label="New password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <ErrorBox error={err} /><Button big type="submit">Set new password</Button>
      </form>}
      {stage === 'done' && <><p className="ok">{msg}</p><Link to="/login">Log in</Link></>}
      <p className="small mt2"><Link to="/login">Back to log in</Link></p>
    </Shell>
  );
}
