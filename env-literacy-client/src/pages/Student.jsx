import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client.js';
import { Async, Bar, Button, Card, Empty, ErrorBox, GapTag, PageHeader, Stat, fmt, fmtDate, fmtGap } from '../components/ui.jsx';
import { KPBars, TrendLine } from '../components/charts.jsx';
import { AnnouncementsFeed, BadgesStrip } from './More.jsx';

// ----------------------------------------------------------------- home ---
export function StudentHome() {
  const me = useQuery({ queryKey: ['student-me'], queryFn: () => get('/analytics/student/me') });
  const recs = useQuery({ queryKey: ['recs'], queryFn: () => get('/recommendations/me') });
  const quizzes = useQuery({ queryKey: ['assigned'], queryFn: () => get('/quizzes/assigned') });

  return (
    <Async q={me}>{a => {
      const open = (quizzes.data || []).filter(q => q.status === 'open');
      const o = a.overall;
      let cta = null; // one primary action per screen
      if (open.length) cta = <Link to={`/quizzes/${open[0].id}`}><Button big>Take quiz: {open[0].title}</Button></Link>;
      else if (!a.checked_in_this_week) cta = <Link to="/checkin"><Button big>Do this week's check-in</Button></Link>;
      return (<>
        <PageHeader title="Your scores" sub={o.type ? 'How much you know compared with what you do.' : 'Take a quiz and do a check-in to see your scores.'} />
        <div className="grid g3">
          <Stat label="Knowledge (0–100)" value={fmt(o.K)} hint={a.quizzes_taken ? `${a.quizzes_taken} quiz${a.quizzes_taken > 1 ? 'zes' : ''}` : 'No quiz yet'} />
          <Stat label="Practice (0–100)" value={fmt(o.P)} hint={a.checkins_done ? `${a.checkins_done} check-in${a.checkins_done > 1 ? 's' : ''}` : 'No check-in yet'} />
          <Stat label="Gap (knowledge − practice)" value={fmtGap(o.gap)} hint={<GapTag type={o.type} />} />
        </div>
        <div className="mt3">{cta}</div>
        {a.streak_weeks > 1 && <p className="muted small mt1">{a.streak_weeks}-week check-in streak.</p>}

        <AnnouncementsFeed />
        <h2>By topic</h2>
        <Card><KPBars rows={a.topics} /></Card>
        <Card className="scroll-x"><table className="tbl">
          <thead><tr><th>Topic</th><th className="num">Knowledge</th><th className="num">Practice</th><th className="num">Gap</th><th>Status</th></tr></thead>
          <tbody>{a.topics.map(t => <tr key={t.topic_id}><td>{t.name}</td><td className="num">{fmt(t.K)}</td><td className="num">{fmt(t.P)}</td><td className="num">{fmtGap(t.gap)}</td><td><GapTag type={t.type} /></td></tr>)}</tbody>
        </table></Card>

        <h2>Suggested actions</h2>
        <Async q={recs}>{r => r.cards.length
          ? <div className="grid g2">{r.cards.map(c => <Card key={c.id}><span className="tag">{c.topic_name}</span><h3 className="mt1">{c.title}</h3><p className="small muted" style={{ margin: 0 }}>{c.body}</p></Card>)}</div>
          : <Empty>Suggestions appear once you have a quiz and a check-in.</Empty>}</Async>

        <div className="row mt2"><Link to="/challenges"><Button variant="outline">Try an eco-challenge</Button></Link><Link to="/practice"><Button variant="outline">Practice mode</Button></Link></div>
        <BadgesStrip />
        {a.history.length > 1 && <><h2>Progress over time</h2><Card><TrendLine rows={a.history} /></Card></>}
      </>);
    }}</Async>
  );
}

// -------------------------------------------------------------- quiz list ---
export function QuizListPage() {
  const q = useQuery({ queryKey: ['assigned'], queryFn: () => get('/quizzes/assigned') });
  const label = { open: 'Open', upcoming: 'Not open yet', closed: 'Closed', done: 'Completed' };
  return (<>
    <PageHeader title="Quizzes" />
    <Async q={q}>{rows => rows.length ? rows.map(z => (
      <Card key={z.id}><div className="row between">
        <div><h3>{z.title}</h3><div className="muted small">{z.question_count} questions · {label[z.status]}{z.closes_at ? ` · closes ${fmtDate(z.closes_at)}` : ''}</div></div>
        {z.status === 'done' ? <Link to={`/quizzes/${z.id}/result`}>{Math.round(z.score_pct)}% · View result</Link>
          : z.status === 'open' ? <Link to={`/quizzes/${z.id}`}><Button>Start</Button></Link> : <span className="muted small">{label[z.status]}</span>}
      </div></Card>
    )) : <Empty>No quizzes assigned yet.</Empty>}</Async>
  </>);
}

// -------------------------------------------------------------- take quiz ---
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function QuizTakePage() {
  const { id } = useParams(); const nav = useNavigate(); const qc = useQueryClient();
  const quiz = useQuery({ queryKey: ['quiz', id], queryFn: () => get(`/quizzes/${id}`), staleTime: Infinity, retry: false });
  const [i, setI] = useState(0); const [ans, setAns] = useState({}); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);

  // Failed submissions are retried (poor school connectivity); a 409 means an earlier try already landed.
  const submit = async () => {
    setBusy(true); setErr(null);
    const answers = Object.entries(ans).map(([question_id, option_id]) => ({ question_id, option_id }));
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await post(`/quizzes/${id}/attempt`, { answers }); break; }
      catch (e) {
        if (e.status === 409) break;
        if (e.offline && attempt < 2) { await sleep(1500 * (attempt + 1)); continue; }
        setErr(e); setBusy(false); return;
      }
    }
    qc.invalidateQueries();
    nav(`/quizzes/${id}/result`, { replace: true });
  };

  if (quiz.isLoading) return <p className="muted">Loading…</p>;
  if (quiz.error) return <><ErrorBox error={quiz.error} /><Link to="/quizzes">Back to quizzes</Link></>;
  const qs = quiz.data.questions; const q = qs[i]; const last = i === qs.length - 1;
  return (<>
    <p className="muted small">{quiz.data.title} · Question {i + 1} of {qs.length}</p>
    <div className="progress" aria-hidden="true"><i style={{ width: `${((i + (ans[q.id] ? 1 : 0)) / qs.length) * 100}%` }} /></div>
    <span className="tag">{q.topic_name}</span>
    <h1 className="mt1" style={{ fontSize: 20 }}>{q.text}</h1>
    <div role="radiogroup" aria-label="Answer options" className="mt2">
      {q.options.map(o => <button key={o.id} role="radio" aria-checked={ans[q.id] === String(o.id)} className={`choice ${ans[q.id] === String(o.id) ? 'on' : ''}`}
        onClick={() => setAns({ ...ans, [q.id]: String(o.id) })}>{o.text}</button>)}
    </div>
    <ErrorBox error={err} />
    <div className="row between mt3">
      <Button variant="text" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
      {last ? <Button big disabled={busy || Object.keys(ans).length < qs.length} onClick={submit}>{busy ? 'Submitting…' : 'Submit'}</Button>
        : <Button big disabled={!ans[q.id]} onClick={() => setI(i + 1)}>Next</Button>}
    </div>
    {last && Object.keys(ans).length < qs.length && <p className="muted small mt1">Answer every question to submit ({Object.keys(ans).length}/{qs.length} done).</p>}
  </>);
}

export function QuizResultPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['result', id], queryFn: () => get(`/quizzes/${id}/result`) });
  return (<Async q={q}>{r => (<>
    <PageHeader title={r.quiz.title} sub={`Submitted ${fmtDate(r.submitted_at)}`} actions={<Link to="/">Back to home</Link>} />
    <div className="grid g3"><Stat label="Score" value={`${Math.round(r.score_pct)}%`} hint={`${r.correct} of ${r.total} correct`} /></div>
    <h2>By topic</h2>
    <Card>{r.by_topic.map(t => <div key={t.topic_id} style={{ marginBottom: 'var(--s1)' }}><div className="row between small"><span>{t.name}</span><span className="muted">{t.correct}/{t.total}</span></div><Bar value={t.pct} /></div>)}</Card>
    <h2>Review</h2>
    {r.review.map((x, n) => (
      <Card key={x.question_id}>
        <p className="xs muted">{n + 1}. {x.topic_name}</p><h3>{x.text}</h3>
        {x.options.map(o => <div key={o.id} className={`choice ${o.is_correct ? 'right' : o.id === x.selected_option_id ? 'wrong' : ''}`} style={{ cursor: 'default' }}>
          {o.text}{o.is_correct ? ' ✓ correct answer' : o.id === x.selected_option_id ? ' ✗ your answer' : ''}</div>)}
        {x.explanation && <p className="small muted" style={{ marginTop: 'var(--s1)' }}>{x.explanation}</p>}
      </Card>
    ))}
  </>)}</Async>);
}

// --------------------------------------------------------------- check-in ---
export function CheckInPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['practice-items'], queryFn: () => get('/practice/items'), staleTime: 0 });
  const [vals, setVals] = useState({}); const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data?.existing) setVals(Object.fromEntries(Object.entries(q.data.existing).map(([k, v]) => [k, v]))); }, [q.data]);
  const save = useMutation({
    mutationFn: () => post('/practice/checkins', { responses: Object.entries(vals).map(([item_id, value]) => ({ item_id: Number(item_id), value })) }),
    onSuccess: () => { setSaved(true); qc.invalidateQueries(); },
  });
  const groups = useMemo(() => {
    const m = new Map();
    for (const it of q.data?.items || []) (m.get(it.topic_name) || m.set(it.topic_name, []).get(it.topic_name)).push(it);
    return [...m];
  }, [q.data]);

  return (<Async q={q}>{d => saved ? (
    <><PageHeader title="Thanks, you're done for this week" /><p className="muted">Your check-in updates your practice score. You can change your answers any time this week.</p>
      <div className="row"><Link to="/"><Button>See my scores</Button></Link><Button variant="text" onClick={() => setSaved(false)}>Edit answers</Button></div></>
  ) : (<>
    <PageHeader title="Weekly check-in" sub="Under a minute. Answer honestly; nobody sees your individual answers except you." />
    {groups.map(([topic, items]) => (
      <Card key={topic}><h3>{topic}</h3>
        {items.map(it => (
          <div className="item" key={it.id}>
            <span id={`i${it.id}`}>{it.prompt}</span>
            <div className="seg" role="group" aria-labelledby={`i${it.id}`}>
              {(it.scale === 'yes_no' ? [['No', 0], ['Yes', 1]] : d.scale_labels.map((l, v) => [l, v])).map(([l, v]) =>
                <button key={v} type="button" className={vals[it.id] === v ? 'on' : ''} aria-pressed={vals[it.id] === v} onClick={() => setVals({ ...vals, [it.id]: v })}>{l}</button>)}
            </div>
          </div>
        ))}
      </Card>
    ))}
    <ErrorBox error={save.error} />
    <div className="mt2"><Button big disabled={save.isPending || Object.keys(vals).length === 0} onClick={() => save.mutate()}>
      {save.isPending ? 'Saving…' : `Submit (${Object.keys(vals).length}/${d.items.length} answered)`}</Button></div>
  </>)}</Async>);
}
