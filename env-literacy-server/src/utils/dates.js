// DB datetimes are UTC strings 'YYYY-MM-DD HH:MM:SS'. These helpers convert both ways.
export const toSqlDateTime = (v) => {
  if (v == null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};
export const fromSqlDateTime = (s) => {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
export const nowSql = () => toSqlDateTime(new Date());
export const isoDate = (d = new Date()) => d.toISOString().slice(0, 10);

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Monday of the week containing `d` (weekly check-in key).
export function weekStart(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Mon=0
  x.setUTCDate(x.getUTCDate() - dow);
  return x.toISOString().slice(0, 10);
}

// Indian academic year starts in June. T1 Jun–Sep, T2 Oct–Jan, T3 Feb–May. e.g. "2026-27-T2"
export function termLabel(d = new Date()) {
  const m = d.getUTCMonth() + 1, y = d.getUTCFullYear();
  const ay = m >= 6 ? y : y - 1;
  const term = m >= 6 && m <= 9 ? 1 : (m >= 10 || m === 1) ? 2 : 3;
  return `${ay}-${String(ay + 1).slice(2)}-T${term}`;
}
// Previous term label (for trend/seed data).
export function prevTerm(label) {
  const [a, , t] = label.match(/^(\d{4})-(\d{2})-T(\d)$/).slice(1);
  let ay = Number(a), term = Number(t) - 1;
  if (term < 1) { term = 3; ay -= 1; }
  return `${ay}-${String(ay + 1).slice(2)}-T${term}`;
}
