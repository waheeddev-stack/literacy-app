import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, download, get, patch, post } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { Async, Bar, Button, Card, Empty, ErrorBox, Field, PageHeader, Stat, fmt, fmtDate } from '../components/ui.jsx';

// ------------------------------------------------------- shared widgets ---
export function AnnouncementsFeed({ limit = 3 }) {
  const q = useQuery({ queryKey: ['announcements'], queryFn: () => get('/announcements') });
  if (!q.data?.length) return null;
  return (<>
    <h2>Announcements</h2>
    {q.data.slice(0, limit).map(a => (
      <Card key={a.id}><div className="row between"><h3>{a.title}</h3><span className="tag">{a.class_name || 'Everyone'}</span></div>
        <p className="small" style={{ margin: 0 }}>{a.body}</p><p className="xs muted" style={{ margin: '4px 0 0' }}>{a.author_name} · {fmtDate(a.created_at)}</p></Card>
    ))}
  </>);
}

export function BadgesStrip() {
  const q = useQuery({ queryKey: ['badges'], queryFn: () => get('/achievements/me') });
  return (<Async q={q}>{d => (<>
    <h2>Your badges <span className="muted small" style={{ textTransform: 'none', letterSpacing: 0 }}>{d.earned}/{d.total}</span></h2>
    <div className="grid g3">{d.badges.map(b => (
      <Card key={b.id} style={b.earned ? { borderColor: 'var(--ok)' } : { opacity: .55 }}>
        <span className={`tag ${b.earned ? 'aligned' : ''}`}>{b.earned ? 'Earned' : 'Locked'}</span>
        <h3 className="mt1">{b.title}</h3><p className="xs muted" style={{ margin: 0 }}>{b.description}</p>
      </Card>))}</div>
  </>)}</Async>);
}

// ------------------------------------------------------------ challenges ---
export function ChallengesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['challenges'], queryFn: () => get('/challenges'), staleTime: 0 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['challenges'] }); qc.invalidateQueries({ queryKey: ['badges'] }); };
  const start = useMutation({ mutationFn: card_id => post('/challenges', { card_id }), onSuccess: refresh });
  const logIt = useMutation({ mutationFn: id => post(`/challenges/${id}/log`), onSuccess: refresh });
  const drop = useMutation({ mutationFn: id => post(`/challenges/${id}/drop`), onSuccess: refresh });
  return (<Async q={q}>{d => (<>
    <PageHeader title="Eco-challenges" sub={`Small ${d.days}-day habits. Do it on ${d.target} of ${d.days} days to complete one. Personal only; no rankings.`} />
    <ErrorBox error={start.error || logIt.error || drop.error} />
    <h2>Active</h2>
    {d.active.length ? d.active.map(c => (
      <Card key={c.id}>
        <div className="row between"><span className="tag">{c.topic_name}</span><span className="xs muted">{c.days_left} day{c.days_left === 1 ? '' : 's'} left</span></div>
        <h3 className="mt1">{c.title}</h3><p className="small muted">{c.body}</p>
        <Bar value={(c.progress / c.target) * 100} /><p className="xs muted mt1">{c.progress} of {c.target} days done</p>
        <div className="row"><Button disabled={c.logged_today || logIt.isPending} onClick={() => logIt.mutate(c.id)}>{c.logged_today ? 'Done for today' : 'I did it today'}</Button>
          <Button variant="danger" onClick={() => confirm('Drop this challenge?') && drop.mutate(c.id)}>Drop</Button></div>
      </Card>)) : <Empty>No active challenge. Pick one below.</Empty>}
    <h2>Pick a challenge</h2>
    {d.suggestions.length ? <div className="grid g2">{d.suggestions.map(s => (
      <Card key={s.card_id}><span className="tag">{s.topic_name}</span><h3 className="mt1">{s.title}</h3><p className="small muted">{s.body}</p>
        <Button disabled={start.isPending} onClick={() => start.mutate(s.card_id)}>Start</Button></Card>))}</div> : <Empty>You're already on every suggested challenge.</Empty>}
    {d.finished.length > 0 && <><h2>History</h2><Card className="scroll-x"><table className="tbl"><tbody>{d.finished.map(c => (
      <tr key={c.id}><td>{c.title}</td><td className="muted">{fmtDate(c.start_date)}</td><td><span className={`tag ${c.status === 'done' ? 'aligned' : 'warn'}`}>{c.status === 'done' ? 'Completed' : 'Expired'}</span></td><td className="num">{c.progress}/{c.target}</td></tr>))}</tbody></table></Card></>}
  </>)}</Async>);
}

// ----------------------------------------------------------- practice mode ---
export function LearnPage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: () => get('/questions/topics') });
  const [topic, setTopic] = useState(''); const [run, setRun] = useState(0);
  const qs = useQuery({ queryKey: ['learn', topic, run], queryFn: () => get('/learn/questions', { topic: topic || undefined, count: 5 }), staleTime: Infinity });
  const [i, setI] = useState(0); const [res, setRes] = useState({}); const [score, setScore] = useState(0);
  const check = useMutation({
    mutationFn: ({ q, o }) => post('/learn/check', { question_id: String(q.id), option_id: String(o) }),
    onSuccess: (d, { q, o }) => { setRes({ ...res, [q.id]: { ...d, picked: o } }); if (d.is_correct) setScore(s => s + 1); },
  });
  const again = () => { setI(0); setRes({}); setScore(0); setRun(r => r + 1); };
  return (<>
    <PageHeader title="Practice mode" sub="Instant feedback. These questions don't count toward your scores, so try freely." />
    <div className="row" style={{ marginBottom: 'var(--s2)' }}>
      <select className="input" style={{ width: 'auto' }} aria-label="Topic" value={topic} onChange={e => { setTopic(e.target.value); setI(0); setRes({}); setScore(0); }}>
        <option value="">All topics</option>{(topics.data || []).map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select>
    </div>
    <Async q={qs}>{list => {
      if (!list.length) return <Empty>No questions available for that topic yet.</Empty>;
      if (i >= list.length) return (<Card><h2 style={{ marginTop: 0 }}>Round done</h2><p>You got {score} of {list.length}.</p><Button onClick={again}>Another round</Button></Card>);
      const q = list[i], r = res[q.id];
      return (<>
        <p className="muted small">Question {i + 1} of {list.length} · {q.topic_name}</p>
        <h1 style={{ fontSize: 20 }}>{q.text}</h1>
        <div className="mt2">{q.options.map(o => {
          const cls = r ? (o.id === r.correct_option_id ? 'right' : o.id === r.picked ? 'wrong' : '') : '';
          return <button key={o.id} className={`choice ${cls}`} disabled={!!r || check.isPending} onClick={() => check.mutate({ q, o: o.id })}>{o.text}</button>;
        })}</div>
        <ErrorBox error={check.error} />
        {r && <><p className={r.is_correct ? 'ok' : 'err'}>{r.is_correct ? 'Correct!' : 'Not quite.'}</p>{r.explanation && <p className="small muted">{r.explanation}</p>}
          <Button big onClick={() => setI(i + 1)}>{i === list.length - 1 ? 'Finish' : 'Next'}</Button></>}
      </>);
    }}</Async>
  </>);
}

// ----------------------------------------------------------- announcements ---
export function AnnouncementsPage() {
  const { user } = useAuth(); const qc = useQueryClient();
  const list = useQuery({ queryKey: ['announcements'], queryFn: () => get('/announcements') });
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => get('/classes') });
  const [f, setF] = useState({ title: '', body: '', class_id: '' });
  const add = useMutation({
    mutationFn: () => post('/announcements', { title: f.title, body: f.body, class_id: f.class_id || null }),
    onSuccess: () => { setF({ ...f, title: '', body: '' }); qc.invalidateQueries({ queryKey: ['announcements'] }); },
  });
  const rm = useMutation({ mutationFn: id => del(`/announcements/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }) });
  return (<>
    <PageHeader title="Announcements" sub="Students see these on their home screen." />
    <Card><form onSubmit={e => { e.preventDefault(); add.mutate(); }}>
      <div className="grid g2">
        <Field label="Title"><input className="input" required minLength={3} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Audience"><select className="input" required={user.role === 'teacher'} value={f.class_id} onChange={e => setF({ ...f, class_id: e.target.value })}>
          {user.role === 'inst_admin' ? <option value="">Whole institution</option> : <option value="">Choose a class…</option>}
          {(classes.data || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <Field label="Message"><textarea className="input" required minLength={3} maxLength={2000} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></Field>
      <ErrorBox error={add.error} /><Button type="submit" disabled={add.isPending}>Post announcement</Button>
    </form></Card>
    <h2>Posted</h2>
    <Async q={list}>{rows => rows.length ? rows.map(a => (
      <Card key={a.id}><div className="row between"><h3>{a.title}</h3><div className="row"><span className="tag">{a.class_name || 'Everyone'}</span>
        {(user.role === 'inst_admin' || a.mine) && <Button variant="danger" aria-label={`Delete announcement ${a.title}`} onClick={() => confirm('Delete this announcement?') && rm.mutate(a.id)}>Delete</Button>}</div></div>
        <p className="small" style={{ margin: 0 }}>{a.body}</p><p className="xs muted" style={{ margin: '4px 0 0' }}>{a.author_name} · {fmtDate(a.created_at)}</p></Card>
    )) : <Empty>Nothing posted yet.</Empty>}</Async>
  </>);
}

// ------------------------------------------------------------ quiz results ---
export function QuizResultsPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['quiz-results', id], queryFn: () => get(`/quizzes/${id}/results`) });
  return (<Async q={q}>{d => (<>
    <PageHeader title={d.quiz.title} sub="Who has taken it, and which questions were hardest." actions={<Link to="/quizzes">Back to quizzes</Link>} />
    <div className="grid g3">
      <Stat label="Completion" value={d.completion_pct != null ? `${d.completion_pct}%` : '–'} hint={`${d.taken} of ${d.eligible} students`} />
      <Stat label="Average score" value={d.average_pct != null ? `${fmt(d.average_pct)}%` : '–'} />
    </div>
    <h2>Questions, hardest first</h2>
    <Card className="scroll-x"><table className="tbl"><thead><tr><th>Question</th><th>Topic</th><th className="num">Answered</th><th className="num">% correct</th></tr></thead>
      <tbody>{[...d.questions].sort((a, b) => (a.pct_correct ?? 101) - (b.pct_correct ?? 101)).map(x => <tr key={x.id}><td>{x.text}</td><td>{x.topic_name}</td><td className="num">{x.answers}</td><td className="num">{x.pct_correct ?? '–'}</td></tr>)}</tbody></table></Card>
    <h2>Students</h2>
    <Card className="scroll-x"><table className="tbl"><thead><tr><th>Name</th><th>Status</th><th className="num">Score</th><th>Submitted</th></tr></thead>
      <tbody>{d.students.map(s => <tr key={s.id}><td>{s.name}</td><td><span className={`tag ${s.taken ? 'aligned' : 'warn'}`}>{s.taken ? 'Done' : 'Not yet'}</span></td><td className="num">{s.score_pct != null ? `${fmt(s.score_pct)}%` : '–'}</td><td>{fmtDate(s.submitted_at)}</td></tr>)}</tbody></table></Card>
  </>)}</Async>);
}

// ----------------------------------------------------------------- account ---
export function AccountPage() {
  const { user } = useAuth(); const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ current_password: '', new_password: '' }); const [err, setErr] = useState(null);
  const saveName = useMutation({ mutationFn: () => patch('/account/profile', { name }), onSuccess: () => qc.invalidateQueries() });
  const savePw = useMutation({ mutationFn: () => post('/account/password', pw), onSuccess: () => setPw({ current_password: '', new_password: '' }) });
  return (<>
    <PageHeader title="My account" sub={`${user.email} · ${user.role.replace('_', ' ')}`} />
    <Card><h3>Profile</h3>
      <form onSubmit={e => { e.preventDefault(); saveName.mutate(); }}>
        <Field label="Display name"><input className="input" required minLength={2} value={name} onChange={e => setName(e.target.value)} /></Field>
        <ErrorBox error={saveName.error} />{saveName.isSuccess && <p className="ok">Saved. Reload to see it everywhere.</p>}
        <Button type="submit" disabled={saveName.isPending}>Save name</Button></form></Card>
    <Card><h3>Change password</h3>
      <form onSubmit={e => { e.preventDefault(); savePw.mutate(); }}>
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" required value={pw.current_password} onChange={e => setPw({ ...pw, current_password: e.target.value })} /></Field>
        <Field label="New password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" required minLength={8} value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} /></Field>
        <ErrorBox error={savePw.error} />{savePw.isSuccess && <p className="ok">Password changed.</p>}
        <Button type="submit" disabled={savePw.isPending}>Change password</Button></form></Card>
    <Card><h3>Your data</h3><p className="small muted">Download everything this platform stores about you as a JSON file.</p>
      <ErrorBox error={err} /><Button variant="outline" onClick={() => download('/account/export', {}, 'my-data.json').catch(setErr)}>Download my data</Button></Card>
  </>);
}
