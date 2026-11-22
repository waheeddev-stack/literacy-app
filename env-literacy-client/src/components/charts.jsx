// Monochrome charts, bar and line only, plus one heatmap (PRD §11).
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const axis = { fontSize: 12, fill: 'var(--muted)' };
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 0, fontSize: 12 }, cursor: { fill: "var(--accent-tint)" } };

export function KPBars({ rows, height = 260 }) {
  const data = rows.filter(r => r.K != null || r.P != null).map(r => ({ name: r.name, Knowledge: r.K, Practice: r.P }));
  if (!data.length) return <p className="muted">No data yet.</p>;
  return (
    <div role="img" aria-label="Knowledge and practice score by topic">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ left: -16, right: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={axis} interval={0} angle={-25} textAnchor="end" height={56} />
          <YAxis domain={[0, 100]} tick={axis} />
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Knowledge" fill="var(--chart-k)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Practice" fill="var(--chart-p)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLine({ rows, height = 240 }) {
  if (!rows || rows.length < 2) return <p className="muted">Trends appear after two terms of data.</p>;
  const data = rows.map(r => ({ name: r.period, Knowledge: r.K, Practice: r.P, 'Sustainability Index': r.SI }));
  return (
    <div role="img" aria-label="Trend by term">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ left: -16, right: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={axis} />
          <YAxis domain={[0, 100]} tick={axis} />
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="Knowledge" stroke="var(--chart-k)" strokeWidth={2} dot />
          <Line dataKey="Practice" stroke="var(--green)" strokeWidth={2} strokeDasharray="4 3" dot />
          <Line dataKey="Sustainability Index" stroke="var(--chart-p)" strokeWidth={2.5} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Gap heatmap: tint strength = |gap|; the number and sign carry the meaning, not colour alone.
export function GapHeatmap({ topics, rows }) {
  const cols = `minmax(120px,1.4fr) repeat(${topics.length}, minmax(52px,1fr))`;
  const tint = g => g == null ? undefined : { background: `color-mix(in srgb, ${g > 0 ? 'var(--info)' : 'var(--warn)'} ${Math.min(55, Math.abs(g) * 1.1)}%, var(--surface))` };
  return (
    <div className="scroll-x">
      <div className="heat" style={{ gridTemplateColumns: cols, minWidth: 560 }} role="table" aria-label="Gap by institution and topic">
        <div className="h nm" />
        {topics.map(t => <div key={t.id} className="h" title={t.name}>{t.name.length > 9 ? t.name.slice(0, 8) + '…' : t.name}</div>)}
        {rows.flatMap(r => [
          <div key={`n${r.institution_id}`} className="nm">{r.name}</div>,
          ...r.cells.map(c => <div key={`${r.institution_id}-${c.topic_id}`} style={tint(c.gap)} title={c.hidden ? 'Hidden (small group)' : `K ${c.K ?? '–'} · P ${c.P ?? '–'}`}>{c.hidden || c.gap == null ? '–' : `${c.gap > 0 ? '+' : ''}${Math.round(c.gap)}`}</div>),
        ])}
      </div>
      <p className="muted xs mt1">Gap = Knowledge − Practice. Positive: knows more than acts. Negative: acts more than knows. "–" means fewer than the minimum group size.</p>
    </div>
  );
}
