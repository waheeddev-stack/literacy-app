import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { download, get, post } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { Async, Button, Card, Empty, ErrorBox, Field, GapTag, PageHeader, Stat, fmt, fmtDate, fmtGap } from '../components/ui.jsx';
import { KPBars } from '../components/charts.jsx';

const SCHOOL = [['6-8', 'Grades 6–8'], ['9-10', 'Grades 9–10'], ['11-12', 'Grades 11–12']];
const COLLEGE = [['undergrad', 'Undergraduate'], ['postgrad', 'Postgraduate']];

export function ClassesPage() {
  const { user } = useAuth(); const qc = useQueryClient();
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => get('/classes') });
  const inst = useQuery({ queryKey: ['inst-type', user.institution_id], queryFn: () => get(`/institutions/${user.institution_id}/summary`) });
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: () => get('/admin/users', { role: 'teacher', limit: 100 }).catch(() => []), enabled: user.role === 'inst_admin' });
  const [f, setF] = useState({ name: '', grade_band: '', teacher_id: '' });
  const create = useMutation({
    mutationFn: () => post('/classes', { name: f.name, grade_band: f.grade_band || bands[0][0], ...(user.role === 'inst_admin' ? { teacher_id: f.teacher_id } : {}) }),
    onSuccess: () => { setF({ name: '', grade_band: '', teacher_id: '' }); qc.invalidateQueries({ queryKey: ['classes'] }); },
  });
  const bands = inst.data?.type === 'college' ? COLLEGE : SCHOOL;
  const activeTeachers = (teachers.data || []).filter?.(t => t.is_active && t.role === 'teacher') || [];

  return (<>
    <PageHeader title="Classes" sub="Share a class code so students can join." />
    <Async q={classes}>{rows => rows.length ? (
      <Card className="scroll-x"><table className="tbl"><thead><tr><th>Class</th><th>Grade band</th>{user.role === 'inst_admin' && <th>Teacher</th>}<th>Students</th><th>Class code</th><th /></tr></thead>
        <tbody>{rows.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.grade_band}</td>{user.role === 'inst_admin' && <td>{c.teacher_name}</td>}<td className="num">{c.student_count}</td>
          <td><code>{c.join_code}</code></td><td><Link to={`/classes/${c.id}`}>Open</Link></td></tr>)}</tbody></table></Card>
    ) : <Empty>No classes yet. Create your first one below.</Empty>}</Async>
    {inst.data?.join_code && <p className="small muted mt1">Institution code for student sign-up: <code>{inst.data.join_code}</code></p>}

    <h2>New class</h2>
    <Card>
      <form onSubmit={e => { e.preventDefault(); create.mutate(); }}>
        <div className="grid g2">
          <Field label="Class name"><input className="input" required minLength={2} placeholder="e.g. Grade 8 A" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Grade band"><select className="input" value={f.grade_band || bands[0][0]} onChange={e => setF({ ...f, grade_band: e.target.value })}>{bands.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          {user.role === 'inst_admin' && <Field label="Teacher"><select className="input" required value={f.teacher_id} onChange={e => setF({ ...f, teacher_id: e.target.value })}>
            <option value="">Choose…</option>{activeTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
        </div>
        <ErrorBox error={create.error} /><Button type="submit" disabled={create.isPending}>Create class</Button>
      </form>
    </Card>
  </>);
}

export function ClassOverviewPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['class', id], queryFn: () => get(`/analytics/class/${id}`) });
  const [err, setErr] = useState(null);
  const dl = format => download(`/reports/class/${id}`, { format }, `class-report.${format}`).catch(setErr);
  return (<Async q={q}>{d => (<>
    <PageHeader title={d.class.name} sub={`Grade band ${d.class.grade_band} · ${d.student_count} students · class code ${d.class.join_code}`}
      actions={<><Button variant="outline" onClick={() => dl('csv')}>Export CSV</Button><Button variant="outline" onClick={() => dl('pdf')}>Export PDF</Button></>} />
    <ErrorBox error={err} />
    <div className="grid g3">
      <Stat label="Average knowledge" value={fmt(d.overall.K)} />
      <Stat label="Average practice" value={fmt(d.overall.P)} />
      <Stat label="Class gap" value={fmtGap(d.overall.gap)} hint={<GapTag type={d.overall.type} />} />
    </div>
    <h2>Participation</h2>
    <div className="grid g3">
      <Stat label="Took a quiz" value={d.participation.quiz_rate != null ? `${d.participation.quiz_rate}%` : '–'} />
      <Stat label="Checked in this week" value={d.participation.checkin_rate_this_week != null ? `${d.participation.checkin_rate_this_week}%` : '–'} hint={d.participation.not_checked_in ? `${d.participation.not_checked_in} still to go` : 'Everyone is in'} />
    </div>
    {d.pending_checkin.length > 0 && <Card className="mt2"><h3>Nudge these students: no check-in this week</h3><p className="small muted" style={{ margin: 0 }}>{d.pending_checkin.map(s => s.name).join(', ')}</p></Card>}
    {d.weakest_topics.length > 0 && <><h2>Weakest topics</h2><Card>{d.weakest_topics.map(t => <div key={t.topic_id} className="row between small"><span>{t.name}</span><span className="muted">Knowledge {fmt(t.K)} · Practice {fmt(t.P)}</span></div>)}</Card></>}
    <h2>Topics</h2><Card><KPBars rows={d.topics} /></Card>
    <h2>Students needing support</h2>
    {d.needs_support.length ? <Card className="scroll-x"><table className="tbl"><thead><tr><th>Student</th><th>Why</th><th className="num">Knowledge</th><th className="num">Practice</th></tr></thead>
      <tbody>{d.needs_support.map(s => <tr key={s.id}><td>{s.name}</td><td><span className="tag warn">{s.support_reason}</span></td><td className="num">{fmt(s.K)}</td><td className="num">{fmt(s.P)}</td></tr>)}</tbody></table></Card>
      : <Empty>Nobody flagged right now.</Empty>}
    <h2>All students</h2>
    <Card className="scroll-x"><table className="tbl"><thead><tr><th>Name</th><th className="num">K</th><th className="num">P</th><th className="num">Gap</th><th className="num">SI</th><th>Status</th></tr></thead>
      <tbody>{d.students.map(s => <tr key={s.id}><td>{s.name}</td><td className="num">{fmt(s.K)}</td><td className="num">{fmt(s.P)}</td><td className="num">{fmtGap(s.gap)}</td><td className="num">{fmt(s.SI)}</td><td><GapTag type={s.type} /></td></tr>)}</tbody></table></Card>
  </>)}</Async>);
}

export function QuizManagerPage() {
  const { user } = useAuth(); const qc = useQueryClient();
  const quizzes = useQuery({ queryKey: ['quizzes-staff'], queryFn: () => get('/quizzes') });
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => get('/classes') });
  const topics = useQuery({ queryKey: ['topics'], queryFn: () => get('/questions/topics') });
  const [f, setF] = useState({ title: '', type: 'assigned', class_id: '', closes_at: '', count: 10, topics: [] });
  const create = useMutation({
    mutationFn: () => post('/quizzes', {
      title: f.title, type: f.type, class_id: f.class_id || null, count: Number(f.count),
      closes_at: f.closes_at ? new Date(f.closes_at + 'T23:59:00').toISOString() : null, ...(f.topics.length ? { topics: f.topics } : {}),
    }),
    onSuccess: () => { setF({ ...f, title: '' }); qc.invalidateQueries({ queryKey: ['quizzes-staff'] }); },
  });
  const toggle = slug => setF({ ...f, topics: f.topics.includes(slug) ? f.topics.filter(s => s !== slug) : [...f.topics, slug] });
  return (<>
    <PageHeader title="Quizzes" sub="Questions are picked from the question bank for the class's grade band." />
    <Async q={quizzes}>{rows => rows.length ? <Card className="scroll-x"><table className="tbl"><thead><tr><th>Title</th><th>Type</th><th>For</th><th className="num">Questions</th><th className="num">Taken</th><th className="num">Avg %</th><th>Closes</th></tr></thead>
      <tbody>{rows.map(z => <tr key={z.id}><td><Link to={`/quizzes/${z.id}/results`}>{z.title}</Link></td><td>{z.type}</td><td>{z.class_name || 'Whole institution'}</td><td className="num">{z.question_count}</td><td className="num">{z.attempts}</td><td className="num">{fmt(z.avg_score)}</td><td>{z.closes_at ? fmtDate(z.closes_at) : 'No end date'}</td></tr>)}</tbody></table></Card>
      : <Empty>No quizzes yet.</Empty>}</Async>

    <h2>Create a quiz</h2>
    <Card><form onSubmit={e => { e.preventDefault(); create.mutate(); }}>
      <div className="grid g2">
        <Field label="Title"><input className="input" required minLength={3} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
          <option value="assigned">Teacher-assigned</option><option value="baseline">Baseline</option><option value="periodic">Periodic</option></select></Field>
        <Field label="Class"><select className="input" required={user.role === 'teacher'} value={f.class_id} onChange={e => setF({ ...f, class_id: e.target.value })}>
          {user.role === 'inst_admin' && <option value="">Whole institution</option>}{user.role === 'teacher' && <option value="">Choose…</option>}
          {(classes.data || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Closes on (optional)"><input className="input" type="date" value={f.closes_at} onChange={e => setF({ ...f, closes_at: e.target.value })} /></Field>
        <Field label="Number of questions"><input className="input" type="number" min={3} max={30} value={f.count} onChange={e => setF({ ...f, count: e.target.value })} /></Field>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 var(--s2)' }}><legend className="small">Topics (none selected = all)</legend>
        <div className="row">{(topics.data || []).map(t => <label key={t.slug} className="small" style={{ display: 'flex', gap: 4 }}><input type="checkbox" checked={f.topics.includes(t.slug)} onChange={() => toggle(t.slug)} />{t.name}</label>)}</div></fieldset>
      <ErrorBox error={create.error} />{create.isSuccess && <p className="ok">Quiz created. Students in the class can see it now.</p>}
      <Button type="submit" disabled={create.isPending}>Create quiz</Button>
    </form></Card>
  </>);
}
