import { useEffect, useState } from 'react';

export const Button = ({ variant = 'primary', big, className = '', ...p }) =>
  <button type="button" className={`btn ${variant === 'primary' ? '' : variant} ${big ? 'big' : ''} ${className}`} {...p} />;

export const Card = ({ className = '', ...p }) => <section className={`card ${className}`} {...p} />;

export const Field = ({ label, hint, children }) => (
  <label className="field"><span>{label}</span>{children}{hint && <span className="muted xs">{hint}</span>}</label>
);

export const Stat = ({ label, value, hint }) => (
  <Card className="stat"><div className="v">{value ?? '–'}</div><div className="l">{label}</div>{hint && <div className="xs muted">{hint}</div>}</Card>
);

export const PageHeader = ({ title, sub, actions }) => (
  <div className="row between" style={{ marginBottom: 'var(--s3)' }}>
    <div><h1>{title}</h1>{sub && <p className="muted" style={{ margin: 0 }}>{sub}</p>}</div>
    <div className="row">{actions}</div>
  </div>
);

export const Loading = ({ text = 'Loading…' }) => <p className="muted" role="status">{text}</p>;
export const ErrorBox = ({ error }) => error ? <p className="err" role="alert">{error.message || String(error)}</p> : null;
export const Empty = ({ children }) => <p className="muted">{children}</p>;

// Render a query's states, then its data.
export function Async({ q, children }) {
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  return children(q.data);
}

export const GAP_LABEL = { aligned: 'Aligned', knowledge_heavy: 'Knows more than acts', practice_heavy: 'Acts more than knows' };
export const GapTag = ({ type }) => type ? <span className={`tag ${type}`}>{GAP_LABEL[type]}</span> : <span className="muted">–</span>;

export const fmt = n => (n == null ? '–' : Math.round(Number(n)));
export const fmtGap = n => (n == null ? '–' : `${n > 0 ? '+' : ''}${Math.round(n)}`);

// Aggregate cell that may be hidden by the small-group rule.
export const Hidden = ({ min = 5 }) => <span className="muted xs" title={`Hidden to protect privacy (fewer than ${min} students)`}>hidden</span>;

export function Bar({ value }) {
  return <div className="bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} /></div>;
}

export function useDebounced(v, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export const fmtDate = s => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
