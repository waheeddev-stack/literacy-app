import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { download, get } from '../api/client.js';
import { Async, Button, Card, ErrorBox, GapTag, Hidden, PageHeader, Stat, fmt, fmtGap } from '../components/ui.jsx';
import { GapHeatmap, KPBars } from '../components/charts.jsx';

export default function RegionalPage() {
  const q = useQuery({ queryKey: ['region'], queryFn: () => get('/analytics/region') });
  const [err, setErr] = useState(null);
  const dl = (id, format) => download(`/reports/institution/${id}`, { format }, `institution-report.${format}`).catch(setErr);
  return (<Async q={q}>{d => (<>
    <PageHeader title="Regional comparison" sub={`Mira-Bhayandar · aggregates only · groups under ${d.min_group_size} students are hidden`} />
    <ErrorBox error={err} />
    <div className="grid g3">
      <Stat label="Institutions" value={d.institutions.length} />
      <Stat label="Students with data" value={d.overall.n} />
      <Stat label="Regional gap" value={d.overall.hidden ? '–' : fmtGap(d.overall.gap)} hint={<GapTag type={d.overall.type} />} />
    </div>

    <h2>Ranked institutions</h2>
    <Card className="scroll-x"><table className="tbl"><thead><tr><th>#</th><th>Institution</th><th>Type</th><th className="num">Score</th><th className="num">Student SI</th><th className="num">Audit %</th><th className="num">Gap</th><th>Status</th><th /></tr></thead>
      <tbody>{d.institutions.map(r => (
        <tr key={r.id}><td>{r.rank ?? '–'}</td><td>{r.name}<div className="xs muted">{r.ward_or_area}</div></td><td>{r.type}</td>
          {r.hidden ? <td colSpan={5}><Hidden min={d.min_group_size} /></td> : <>
            <td className="num"><strong>{fmt(r.score)}</strong></td><td className="num">{fmt(r.SI)}</td><td className="num">{fmt(r.audit_pct)}</td><td className="num">{fmtGap(r.gap)}</td><td><GapTag type={r.gap_type} /></td></>}
          <td className="right" style={{ whiteSpace: 'nowrap' }}><Button variant="text" onClick={() => dl(r.id, 'csv')}>CSV</Button><Button variant="text" onClick={() => dl(r.id, 'pdf')}>PDF</Button></td></tr>))}</tbody></table></Card>

    <h2>School vs college</h2>
    <div className="grid g2">{d.school_vs_college.map(s => (
      <Card key={s.type}><h3>{s.type === 'school' ? 'Schools' : 'Colleges'} <span className="muted small">({s.institutions})</span></h3>
        {s.hidden ? <Hidden min={d.min_group_size} /> : <div className="row" style={{ gap: 'var(--s3)' }}>
          <div><div className="xs muted">Knowledge</div><strong style={{ fontSize: 28 }}>{fmt(s.K)}</strong></div>
          <div><div className="xs muted">Practice</div><strong style={{ fontSize: 28 }}>{fmt(s.P)}</strong></div>
          <div><div className="xs muted">Gap</div><strong style={{ fontSize: 28 }}>{fmtGap(s.gap)}</strong></div></div>}
      </Card>))}</div>

    <h2>Topic heatmap</h2><Card><GapHeatmap topics={d.heatmap.topics} rows={d.heatmap.rows} /></Card>
    <h2>Region by topic</h2><Card><KPBars rows={d.topics.filter(t => !t.hidden)} /></Card>
  </>)}</Async>);
}
