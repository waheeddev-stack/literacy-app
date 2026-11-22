import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, getPage, patch, post, put } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { Async, Button, Card, Empty, ErrorBox, Field, PageHeader, fmtDate, useDebounced } from '../components/ui.jsx';

const BANDS = ['6-8', '9-10', '11-12', 'undergrad', 'postgrad'];

function Pager({ meta, page, setPage }) {
  if (!meta || meta.total <= meta.limit) return null;
  const pages = Math.ceil(meta.total / meta.limit);
  return <div className="row between mt2"><Button variant="text" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
    <span className="small muted">Page {page} of {pages} · {meta.total} total</span><Button variant="text" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>;
}

// --------------------------------------------------------- question bank ---
const blank = { topic: 'waste', grade_band: '6-8', difficulty: 2, text: '', explanation: '', options: [{ text: '', is_correct: true }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }] };

function QuestionForm({ initial, topics, onDone }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial ? { ...initial, topic: initial.topic_slug, explanation: initial.explanation || '' } : blank);
  const save = useMutation({
    mutationFn: () => {
      const body = { topic: f.topic, grade_band: f.grade_band, difficulty: Number(f.difficulty), text: f.text, explanation: f.explanation || null,
        options: f.options.filter(o => o.text.trim()).map(o => ({ ...(o.id ? { id: String(o.id) } : {}), text: o.text, is_correct: o.is_correct })) };
      return initial ? patch(`/questions/${initial.id}`, body) : post('/questions', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['questions'] }); onDone(); },
  });
  const setOpt = (i, v) => setF({ ...f, options: f.options.map((o, j) => j === i ? { ...o, ...v } : v.is_correct ? { ...o, is_correct: false } : o) });
  return (
    <Card><form onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="grid g3">
        <Field label="Topic"><select className="input" value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })}>{topics.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select></Field>
        <Field label="Grade band"><select className="input" value={f.grade_band} onChange={e => setF({ ...f, grade_band: e.target.value })}>{BANDS.map(b => <option key={b}>{b}</option>)}</select></Field>
        <Field label="Difficulty (1–5)"><input className="input" type="number" min={1} max={5} value={f.difficulty} onChange={e => setF({ ...f, difficulty: e.target.value })} /></Field>
      </div>
      <Field label="Question"><textarea className="input" required minLength={5} value={f.text} onChange={e => setF({ ...f, text: e.target.value })} /></Field>
      <fieldset style={{ border: 0, padding: 0 }}><legend className="small">Options (mark the correct one)</legend>
        {f.options.map((o, i) => <div className="row" key={i} style={{ marginBottom: 8 }}>
          <input type="radio" name="correct" aria-label={`Option ${i + 1} is correct`} checked={o.is_correct} onChange={() => setOpt(i, { is_correct: true })} />
          <input className="input" style={{ flex: 1 }} placeholder={`Option ${i + 1}`} value={o.text} onChange={e => setOpt(i, { text: e.target.value })} /></div>)}</fieldset>
      <Field label="Explanation shown after submission"><textarea className="input" value={f.explanation} onChange={e => setF({ ...f, explanation: e.target.value })} /></Field>
      <ErrorBox error={save.error} />
      <div className="row"><Button type="submit" disabled={save.isPending}>{initial ? 'Save changes' : 'Add question'}</Button><Button variant="text" onClick={onDone}>Cancel</Button></div>
    </form></Card>
  );
}

const CSV_HELP = 'topic,grade_band,difficulty,text,explanation,option_a,option_b,option_c,option_d,correct\nwaste,6-8,1,"Which bin is for wet waste?","Green is for wet waste.",Green,Blue,Red,Black,A';

export function QuestionBankPage() {
  const { user } = useAuth(); const qc = useQueryClient();
  const canWrite = true; // regional + super admin only reach this route
  const topics = useQuery({ queryKey: ['topics'], queryFn: () => get('/questions/topics') });
  const [flt, setFlt] = useState({ topic: '', grade_band: '', q: '' }); const [page, setPage] = useState(1);
  const dq = useDebounced(flt.q);
  const list = useQuery({ queryKey: ['questions', flt.topic, flt.grade_band, dq, page], queryFn: () => getPage('/questions', { page, limit: 10, topic: flt.topic || undefined, grade_band: flt.grade_band || undefined, q: dq || undefined }) });
  const [editing, setEditing] = useState(null); const [csv, setCsv] = useState(''); const [showImport, setShowImport] = useState(false);
  const toggle = useMutation({ mutationFn: q => patch(`/questions/${q.id}`, { is_active: !q.is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }) });
  const imp = useMutation({ mutationFn: () => post('/questions/import', { csv }), onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }) });
  const onFile = async e => { const file = e.target.files?.[0]; if (file) setCsv(await file.text()); };
  const tl = topics.data || [];

  return (<>
    <PageHeader title="Question bank" sub={`Signed in as ${user.role.replace('_', ' ')}. Have environmental educators review new questions.`}
      actions={canWrite && <><Button variant="outline" onClick={() => setShowImport(!showImport)}>Import CSV</Button><Button onClick={() => setEditing('new')}>Add question</Button></>} />
    {editing && <QuestionForm key={editing.id || 'new'} initial={editing === 'new' ? null : editing} topics={tl} onDone={() => setEditing(null)} />}
    {showImport && <Card>
      <p className="small">Columns: topic, grade_band, difficulty, text, explanation, option_a … option_f, correct (letter). Topic can be the slug or name.</p>
      <pre className="xs muted scroll-x" style={{ margin: '0 0 var(--s1)' }}>{CSV_HELP}</pre>
      <input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="CSV file" />
      <textarea className="input mt1" placeholder="…or paste CSV here" value={csv} onChange={e => setCsv(e.target.value)} />
      <ErrorBox error={imp.error} />
      {imp.data && <div className="small mt1"><p className="ok">Imported {imp.data.imported}, skipped {imp.data.skipped}.</p>{imp.data.errors.map(x => <p className="err" key={x.row}>Row {x.row}: {x.message}</p>)}</div>}
      <Button className="mt1" disabled={imp.isPending || csv.length < 10} onClick={() => imp.mutate()}>{imp.isPending ? 'Importing…' : 'Import'}</Button>
    </Card>}
    <div className="row" style={{ margin: 'var(--s2) 0' }}>
      <select className="input" style={{ width: 'auto' }} aria-label="Topic filter" value={flt.topic} onChange={e => { setFlt({ ...flt, topic: e.target.value }); setPage(1); }}><option value="">All topics</option>{tl.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select>
      <select className="input" style={{ width: 'auto' }} aria-label="Grade band filter" value={flt.grade_band} onChange={e => { setFlt({ ...flt, grade_band: e.target.value }); setPage(1); }}><option value="">All bands</option>{BANDS.map(b => <option key={b}>{b}</option>)}</select>
      <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Search questions" aria-label="Search" value={flt.q} onChange={e => { setFlt({ ...flt, q: e.target.value }); setPage(1); }} />
    </div>
    <Async q={list}>{({ data, meta }) => (<>
      {data.length ? data.map(q => (
        <Card key={q.id} style={q.is_active ? undefined : { opacity: .6 }}>
          <div className="row between"><div className="row"><span className="tag">{q.topic_name}</span><span className="tag">{q.grade_band}</span><span className="tag">Level {q.difficulty}</span>{!q.is_active && <span className="tag warn">Inactive</span>}{q.pct_correct != null ? <span className="tag">{q.pct_correct}% correct ({q.answers})</span> : <span className="tag">{q.answers} answers</span>}{q.flag && <span className="tag warn">{q.flag === 'too_easy' ? 'Too easy: review' : 'Too hard: review'}</span>}</div>
            <div className="row"><Button variant="text" onClick={() => setEditing(q)}>Edit</Button><Button variant="text" onClick={() => toggle.mutate(q)}>{q.is_active ? 'Deactivate' : 'Activate'}</Button></div></div>
          <h3 className="mt1">{q.text}</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>{q.options.map(o => <li key={o.id} style={o.is_correct ? { color: 'var(--accent)', fontWeight: 600 } : undefined}>{o.text}{o.is_correct ? ' ✓' : ''}</li>)}</ul>
        </Card>
      )) : <Empty>No questions match.</Empty>}
      <Pager meta={meta} page={page} setPage={setPage} />
    </>)}</Async>
  </>);
}

// ----------------------------------------------------------- institutions ---
export function InstitutionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['institutions', status, page], queryFn: () => getPage('/institutions', { page, limit: 20, status: status || undefined }) });
  const setS = useMutation({ mutationFn: ({ id, status }) => patch(`/institutions/${id}`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['institutions'] }) });
  const [f, setF] = useState({ name: '', type: 'school', board_or_university: '', ward_or_area: '', adminName: '', adminEmail: '', adminPassword: '' });
  const create = useMutation({
    mutationFn: () => post('/institutions', { name: f.name, type: f.type, board_or_university: f.board_or_university || null, ward_or_area: f.ward_or_area || null,
      ...(f.adminEmail ? { admin: { name: f.adminName, email: f.adminEmail, password: f.adminPassword } } : {}) }),
    onSuccess: () => { setF({ ...f, name: '', adminName: '', adminEmail: '', adminPassword: '' }); qc.invalidateQueries({ queryKey: ['institutions'] }); },
  });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return (<>
    <PageHeader title="Institutions" actions={<select className="input" aria-label="Status filter" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
      <option value="">All statuses</option><option value="pending">Pending approval</option><option value="active">Active</option><option value="suspended">Suspended</option></select>} />
    <ErrorBox error={setS.error} />
    <Async q={list}>{({ data, meta }) => (<>
      <Card className="scroll-x"><table className="tbl"><thead><tr><th>Name</th><th>Type</th><th>Area</th><th className="num">Students</th><th>Code</th><th>Status</th><th /></tr></thead>
        <tbody>{data.map(i => <tr key={i.id}><td>{i.name}</td><td>{i.type}</td><td>{i.ward_or_area || '–'}</td><td className="num">{i.student_count}</td><td><code>{i.join_code}</code></td>
          <td><span className={`tag ${i.status === 'active' ? 'aligned' : 'warn'}`}>{i.status}</span></td>
          <td className="right" style={{ whiteSpace: 'nowrap' }}>
            {i.status !== 'active' && <Button variant="text" onClick={() => setS.mutate({ id: i.id, status: 'active' })}>{i.status === 'pending' ? 'Approve' : 'Reactivate'}</Button>}
            {i.status === 'active' && <Button variant="danger" onClick={() => confirm(`Suspend ${i.name}? Its users will not be able to log in.`) && setS.mutate({ id: i.id, status: 'suspended' })}>Suspend</Button>}</td></tr>)}</tbody></table></Card>
      <Pager meta={meta} page={page} setPage={setPage} />
    </>)}</Async>
    <h2>Add institution</h2>
    <Card><form onSubmit={e => { e.preventDefault(); create.mutate(); }}>
      <div className="grid g2">
        <Field label="Name"><input className="input" required minLength={3} value={f.name} onChange={set('name')} /></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={set('type')}><option value="school">School</option><option value="college">College</option></select></Field>
        <Field label="Board or university"><input className="input" value={f.board_or_university} onChange={set('board_or_university')} /></Field>
        <Field label="Ward or area"><input className="input" value={f.ward_or_area} onChange={set('ward_or_area')} /></Field>
      </div>
      <p className="small muted">Optionally create the institution admin's login now:</p>
      <div className="grid g3">
        <Field label="Admin name"><input className="input" value={f.adminName} required={!!f.adminEmail} onChange={set('adminName')} /></Field>
        <Field label="Admin email"><input className="input" type="email" value={f.adminEmail} onChange={set('adminEmail')} /></Field>
        <Field label="Temporary password"><input className="input" type="password" autoComplete="new-password" minLength={8} required={!!f.adminEmail} value={f.adminPassword} onChange={set('adminPassword')} /></Field>
      </div>
      <ErrorBox error={create.error} />{create.isSuccess && <p className="ok">Created. Institution code: <code>{create.data.join_code}</code></p>}
      <Button type="submit" disabled={create.isPending}>Create institution</Button>
    </form></Card>
  </>);
}

// ----------------------------------------------------------------- people ---
export function PeoplePage() {
  const { user } = useAuth(); const qc = useQueryClient();
  const [role, setRole] = useState(''); const [pending, setPending] = useState(false); const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useQuery({ queryKey: ['users', role, pending, dq, page], queryFn: () => getPage('/admin/users', { page, limit: 20, role: role || undefined, pending: pending ? 'true' : undefined, q: dq || undefined }) });
  const toggle = useMutation({ mutationFn: ({ id, is_active }) => patch(`/admin/users/${id}`, { is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const add = useMutation({ mutationFn: () => post('/admin/users', { ...f, role: 'teacher' }), onSuccess: () => { setF({ name: '', email: '', password: '' }); qc.invalidateQueries({ queryKey: ['users'] }); } });
  return (<>
    <PageHeader title="People" sub={user.role === 'inst_admin' ? 'Approve teacher requests and manage accounts in your institution.' : 'All platform users.'} />
    <div className="row" style={{ marginBottom: 'var(--s2)' }}>
      <select className="input" style={{ width: 'auto' }} aria-label="Role filter" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}>
        <option value="">All roles</option><option value="student">Students</option><option value="teacher">Teachers</option><option value="inst_admin">Institution admins</option><option value="regional_admin">Regional admins</option></select>
      <label className="small row"><input type="checkbox" checked={pending} onChange={e => { setPending(e.target.checked); setPage(1); }} /> Waiting for approval</label>
      <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Search name or email" aria-label="Search" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
    </div>
    <ErrorBox error={toggle.error} />
    <Async q={list}>{({ data, meta }) => (<>
      {data.length ? <Card className="scroll-x"><table className="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th>{user.role === 'super_admin' && <th>Institution</th>}<th>Joined</th><th /></tr></thead>
        <tbody>{data.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role.replace('_', ' ')}</td>{user.role === 'super_admin' && <td>{u.institution_name || '–'}</td>}<td>{fmtDate(u.created_at)}</td>
          <td className="right" style={{ whiteSpace: 'nowrap' }}>{String(u.id) === String(user.id) ? <span className="muted xs">You</span> : u.is_active
            ? <Button variant="danger" onClick={() => toggle.mutate({ id: u.id, is_active: false })}>Deactivate</Button>
            : <Button variant="text" onClick={() => toggle.mutate({ id: u.id, is_active: true })}>Approve / activate</Button>}</td></tr>)}</tbody></table></Card>
        : <Empty>No users match.</Empty>}
      <Pager meta={meta} page={page} setPage={setPage} />
    </>)}</Async>
    {user.role === 'inst_admin' && <><h2>Add a teacher</h2><Card><form onSubmit={e => { e.preventDefault(); add.mutate(); }}>
      <div className="grid g3">
        <Field label="Name"><input className="input" required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Temporary password"><input className="input" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>
      </div>
      <ErrorBox error={add.error} />{add.isSuccess && <p className="ok">Teacher added.</p>}<Button type="submit" disabled={add.isPending}>Add teacher</Button>
    </form></Card></>}
  </>);
}

// --------------------------------------------------------------- settings ---
export function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => get('/admin/settings') });
  const [k, setK] = useState(null);
  const save = useMutation({ mutationFn: () => put('/admin/settings', { weight_knowledge: k, weight_practice: Math.round((1 - k) * 100) / 100 }), onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }) });
  return (<Async q={q}>{s => {
    const kv = k ?? s.weight_knowledge;
    return (<>
      <PageHeader title="Settings" />
      <Card><h3>Sustainability Index weights</h3>
        <p className="small muted">SI = knowledge weight × K + practice weight × P. Weights always add up to 1.</p>
        <Field label={`Knowledge weight: ${kv} · Practice weight: ${Math.round((1 - kv) * 100) / 100}`}>
          <input type="range" min="0" max="1" step="0.05" value={kv} onChange={e => setK(Number(e.target.value))} style={{ width: '100%' }} /></Field>
        <ErrorBox error={save.error} />{save.isSuccess && <p className="ok">Saved. {save.data.note}</p>}
        <Button disabled={save.isPending} onClick={() => save.mutate()}>Save weights</Button></Card>
      <p className="small muted mt2">Groups smaller than {s.min_group_size} students are hidden from aggregate views (set MIN_GROUP_SIZE on the server).</p>
    </>);
  }}</Async>);
}

export function ActivityPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['logs', page], queryFn: () => getPage('/admin/audit-logs', { page, limit: 25 }) });
  return (<><PageHeader title="Activity log" sub="Administrative actions on the platform." />
    <Async q={q}>{({ data, meta }) => (<>
      {data.length ? <Card className="scroll-x"><table className="tbl"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th></tr></thead>
        <tbody>{data.map(l => <tr key={l.id}><td>{new Date(l.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</td><td>{l.user_name || '–'}<div className="xs muted">{l.user_role}</div></td><td>{l.action}</td><td className="muted">{l.entity}{l.entity_id ? ` #${l.entity_id}` : ''}</td></tr>)}</tbody></table></Card> : <Empty>Nothing logged yet.</Empty>}
      <Pager meta={meta} page={page} setPage={setPage} />
    </>)}</Async></>);
}
