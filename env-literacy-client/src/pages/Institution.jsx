import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { download, get, post } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { Async, Button, Card, ErrorBox, GapTag, Hidden, PageHeader, Stat, fmt, fmtGap } from '../components/ui.jsx';
import { KPBars, TrendLine } from '../components/charts.jsx';

export const ScoreCells = ({ a }) => a.hidden
  ? <><td colSpan={4}><Hidden /></td></>
  : <><td className="num">{fmt(a.K)}</td><td className="num">{fmt(a.P)}</td><td className="num">{fmtGap(a.gap)}</td><td><GapTag type={a.type} /></td></>;

export function InstitutionDashboard() {
  const { user } = useAuth();
  const id = user.institution_id;
  const q = useQuery({ queryKey: ['inst', id], queryFn: () => get(`/analytics/institution/${id}`) });
  const sum = useQuery({ queryKey: ['inst-sum', id], queryFn: () => get(`/institutions/${id}/summary`) });
  const [err, setErr] = useState(null);
  const dl = format => download(`/reports/institution/${id}`, { format }, `institution-report.${format}`).catch(setErr);

  return (<Async q={q}>{d => (<>
    <PageHeader title={d.institution.name} sub={`${d.institution.type === 'school' ? 'School' : 'College'} · ${d.counts.students} students · ${d.counts.teachers} teachers`}
      actions={<><Button variant="outline" onClick={() => dl('csv')}>Export CSV</Button><Button variant="outline" onClick={() => dl('pdf')}>Export PDF</Button></>} />
    <ErrorBox error={err} />
    {sum.data?.counts.pending_teachers > 0 && <p className="notice">{sum.data.counts.pending_teachers} teacher request(s) waiting. Open <Link to="/people">People</Link> to approve.</p>}
    {sum.data?.join_code && <p className="small muted">Institution code for sign-up: <code>{sum.data.join_code}</code></p>}
    <div className="grid g3">
      <Stat label="Institution score" value={fmt(d.institution_score.score)} hint="70% student SI + 30% campus audit" />
      <Stat label="Average student SI" value={fmt(d.overall.SI)} hint={<GapTag type={d.overall.type} />} />
      <Stat label="Campus audit" value={d.institution_score.audit_pct != null ? `${fmt(d.institution_score.audit_pct)}%` : '–'} hint={d.institution_score.audit_term || 'Not submitted yet'} />
    </div>
    <div className="grid g3 mt2">
      <Stat label="Took a quiz" value={d.participation.quiz_rate != null ? `${d.participation.quiz_rate}%` : '–'} hint="Target: 70%+" />
      <Stat label="Checked in this week" value={d.participation.checkin_rate_this_week != null ? `${d.participation.checkin_rate_this_week}%` : '–'} hint="Target: 50%+" />
    </div>
    <h2>Trend by term</h2><Card><TrendLine rows={d.trend} /></Card>
    <h2>By topic</h2><Card><KPBars rows={d.topics.filter(t => !t.hidden)} /></Card>
    <h2>Grade comparison</h2>
    <Card className="scroll-x"><table className="tbl"><thead><tr><th>Grade band</th><th className="num">Students</th><th className="num">K</th><th className="num">P</th><th className="num">Gap</th><th>Status</th></tr></thead>
      <tbody>{d.grade_bands.map(g => <tr key={g.grade_band}><td>{g.grade_band}</td><td className="num">{g.n}</td><ScoreCells a={g} /></tr>)}</tbody></table></Card>
    <h2>Classes</h2>
    <Card className="scroll-x"><table className="tbl"><thead><tr><th>Class</th><th>Teacher</th><th className="num">Students</th><th className="num">K</th><th className="num">P</th><th className="num">Gap</th><th>Status</th></tr></thead>
      <tbody>{d.classes.map(c => <tr key={c.id}><td><Link to={`/classes/${c.id}`}>{c.name}</Link></td><td>{c.teacher_name}</td><td className="num">{c.student_count}</td><ScoreCells a={c} /></tr>)}</tbody></table></Card>
  </>)}</Async>);
}

// ------------------------------------------------------------------ audit ---
export function AuditPage() {
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ['audit-items'], queryFn: () => get('/audits/items') });
  const list = useQuery({ queryKey: ['audits'], queryFn: () => get('/audits') });
  const [scores, setScores] = useState({}); const [ev, setEv] = useState({});
  const latest = list.data?.[0];
  const detail = useQuery({ queryKey: ['audit', latest?.id], queryFn: () => get(`/audits/${latest.id}`), enabled: !!latest });
  useEffect(() => {
    if (!detail.data) return;
    setScores(Object.fromEntries(detail.data.scores.map(s => [s.item_id, s.score])));
    setEv(Object.fromEntries(detail.data.scores.filter(s => s.evidence_url).map(s => [s.item_id, s.evidence_url])));
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () => post('/audits', { scores: items.data.map(i => ({ item_id: i.id, score: scores[i.id] ?? 0, evidence_url: ev[i.id]?.trim() || null })) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audits'] }),
  });
  const groups = {};
  for (const i of items.data || []) (groups[i.category] ||= []).push(i);
  const answered = (items.data || []).filter(i => scores[i.id] != null).length;

  return (<Async q={items}>{all => (<>
    <PageHeader title="Campus sustainability audit" sub="Score each item 0 (not present) to 5 (excellent). Saving again in the same term updates your audit." />
    {latest && <p className="notice">Latest audit: {latest.term_label}, score {fmt(latest.total_score)}%. Saving below updates the current term.</p>}
    {Object.entries(groups).map(([cat, its]) => (
      <Card key={cat}><h3>{cat}</h3>
        {its.map(i => (
          <div className="item" key={i.id}>
            <span id={`a${i.id}`}>{i.label}</span>
            <div className="row">
              <div className="seg" role="group" aria-labelledby={`a${i.id}`}>
                {[0, 1, 2, 3, 4, 5].map(v => <button key={v} type="button" className={scores[i.id] === v ? 'on' : ''} aria-pressed={scores[i.id] === v} onClick={() => setScores({ ...scores, [i.id]: v })}>{v}</button>)}
              </div>
              <input className="input" style={{ flex: 1, minWidth: 180 }} type="url" placeholder="Evidence image link (optional)" aria-label={`Evidence link for ${i.label}`} value={ev[i.id] || ''} onChange={e => setEv({ ...ev, [i.id]: e.target.value })} />
            </div>
          </div>
        ))}
      </Card>
    ))}
    <ErrorBox error={save.error} />
    {save.isSuccess && <p className="ok">Saved. Your institution score will update with tonight's refresh (or sooner after new quiz or check-in activity).</p>}
    <Button big disabled={save.isPending || answered < all.length} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : `Save audit (${answered}/${all.length} scored)`}</Button>
  </>)}</Async>);
}
