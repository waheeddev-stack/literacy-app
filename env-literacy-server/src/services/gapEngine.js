// Knowledge–Practice Gap engine (PRD §5.4 and §12).
//   Gap = K − P        SI = wK·K + wP·P (defaults 0.4 / 0.6)
//   Aligned |gap| ≤ 10 · Knowledge-heavy gap > 10 · Practice-heavy gap < −10
//   Institution Score = 0.7 × avg student SI + 0.3 × campus audit %
import { dbAll, dbTx, getSetting, placeholders } from '../config/db.js';
import { env } from '../config/env.js';
import { termLabel } from '../utils/dates.js';
import { getTopics, loadRawScores, latestAudit } from './scoring.js';


export const ALIGNED_BAND = 10;
export const INSTITUTION_WEIGHTS = { students: 0.7, audit: 0.3 };
const r2 = n => (n == null || Number.isNaN(n) ? null : Math.round(n * 100) / 100);

let wCache = { at: 0, v: { wK: 0.4, wP: 0.6 } };
export async function getWeights() {
  if (Date.now() - wCache.at < 15000) return wCache.v;
  const wK = Number(await getSetting('weight_knowledge'));
  const wP = Number(await getSetting('weight_practice'));
  wCache = { at: Date.now(), v: Number.isFinite(wK) && Number.isFinite(wP) && wK + wP > 0 ? { wK, wP } : { wK: 0.4, wP: 0.6 } };
  return wCache.v;
}
export const clearWeightCache = () => { wCache.at = 0; };

export function classify(gap) {
  if (gap == null) return null;
  if (Math.abs(gap) <= ALIGNED_BAND) return 'aligned';
  return gap > 0 ? 'knowledge_heavy' : 'practice_heavy';
}

export function makeScore(K, P, w) {
  const both = K != null && P != null;
  const gap = both ? K - P : null;
  return { K: r2(K), P: r2(P), gap: r2(gap), SI: both ? r2(w.wK * K + w.wP * P) : null, type: classify(gap) };
}

// One student's raw entry -> { overall, topics: { [topicId]: Score } }
export function scoreStudent(entry, w) {
  const topics = {};
  let c = 0, t = 0, ps = 0, pn = 0;
  for (const [tid, s] of entry.topics) {
    topics[tid] = makeScore(s.total ? (s.correct / s.total) * 100 : null, s.pn ? s.psum / s.pn : null, w);
    c += s.correct; t += s.total; ps += s.psum; pn += s.pn;
  }
  return { institution_id: entry.institution_id, overall: makeScore(t ? (c / t) * 100 : null, pn ? ps / pn : null, w), topics };
}

export async function scoreMany(filter) {
  const w = await getWeights();
  const raw = await loadRawScores(filter);
  const out = new Map();
  for (const [sid, entry] of raw) out.set(sid, scoreStudent(entry, w));
  return out;
}

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Aggregate a list of Score objects (one per student) into a group score.
// n = students contributing any data; the small-group rule uses n.
export function aggregate(scores, w) {
  const have = scores.filter(s => s && (s.K != null || s.P != null));
  const K = mean(have.filter(s => s.K != null).map(s => s.K));
  const P = mean(have.filter(s => s.P != null).map(s => s.P));
  const agg = makeScore(K, P, w);
  const si = mean(have.filter(s => s.SI != null).map(s => s.SI)); // avg of student SIs
  agg.SI = r2(si);
  return { ...agg, n: have.length };
}

// Privacy: hide aggregates for groups under MIN_GROUP_SIZE students.
export const small = n => n < env.minGroupSize;
export const guard = agg => (small(agg.n) ? { n: agg.n, hidden: true, K: null, P: null, gap: null, SI: null, type: null } : { ...agg, hidden: false });

export function aggregateOver(resultsMap, ids, w, topicId = null) {
  const list = [];
  for (const id of ids) {
    const r = resultsMap.get(String(id));
    if (!r) continue;
    list.push(topicId == null ? r.overall : r.topics[topicId]);
  }
  return aggregate(list, w);
}

export async function institutionScore(institutionId, agg) {
  const audit = await latestAudit(institutionId);
  const auditPct = audit ? Number(audit.total_score) : null;
  const si = agg?.SI ?? null;
  const score = si != null && auditPct != null ? r2(INSTITUTION_WEIGHTS.students * si + INSTITUTION_WEIGHTS.audit * auditPct) : null;
  return { score, student_si: si, audit_pct: auditPct, audit_term: audit?.term_label ?? null };
}

// ------------------------------------------------------------ snapshots ---
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function replaceSnapshots(scope, period, ids, rows) {
  await dbTx(async tx => {
    for (const part of chunk(ids, 400)) {
      await tx.run(`DELETE FROM score_snapshots WHERE scope=? AND period_label=? AND scope_id IN (${placeholders(part)})`, [scope, period, ...part]);
    }
    for (const part of chunk(rows, 200)) {
      await tx.run(
        `INSERT INTO score_snapshots(scope,scope_id,topic_id,period_label,knowledge_score,practice_score,gap,sustainability_index) VALUES ${part.map(() => '(?,?,?,?,?,?,?,?)').join(',')}`,
        part.flatMap(r => [scope, r.scope_id, r.topic_id, period, r.K, r.P, r.gap, r.SI]));
    }
  });
}

const snapRows = (scopeId, result) => [
  { scope_id: scopeId, topic_id: null, ...result.overall },
  ...Object.entries(result.topics).map(([tid, s]) => ({ scope_id: scopeId, topic_id: Number(tid), ...s })),
];

// On-demand after a quiz or check-in: refresh just this student's snapshot.
export async function recomputeStudent(studentId, period = termLabel()) {
  const res = (await scoreMany({ studentId })).get(String(studentId));
  if (!res) return null;
  await replaceSnapshots('student', period, [studentId], snapRows(studentId, res));
  return res;
}

// Nightly job: students, classes, institutions and the region for the current term.
export async function recomputeAll(period = termLabel()) {
  const w = await getWeights();
  const topics = await getTopics();
  const insts = await dbAll('SELECT id FROM institutions');
  const all = new Map();
  for (const inst of insts) {
    const results = await scoreMany({ institutionId: inst.id });
    for (const [k, v] of results) all.set(k, v);
    const ids = [...results.keys()];
    if (ids.length) await replaceSnapshots('student', period, ids, [...results].flatMap(([sid, r]) => snapRows(sid, r)));

    const members = await dbAll('SELECT cm.class_id, cm.student_id FROM class_members cm JOIN classes c ON c.id = cm.class_id WHERE c.institution_id=?', [inst.id]);
    const byClass = new Map();
    for (const m of members) { const k = String(m.class_id); (byClass.get(k) || byClass.set(k, []).get(k)).push(m.student_id); }
    const classRows = [];
    for (const [cid, studs] of byClass) classRows.push(...aggRows(cid, results, studs, topics, w));
    if (byClass.size) await replaceSnapshots('class', period, [...byClass.keys()], classRows);

    await replaceSnapshots('institution', period, [inst.id], aggRows(inst.id, results, ids, topics, w));
  }
  const allIds = [...all.keys()];
  await replaceSnapshots('region', period, [0], aggRows(0, all, allIds, topics, w));
  return { period, institutions: insts.length, students: allIds.length };
}

function aggRows(scopeId, results, ids, topics, w) {
  const rows = [{ scope_id: scopeId, topic_id: null, ...aggregateOver(results, ids, w) }];
  for (const t of topics) {
    const a = aggregateOver(results, ids, w, t.id);
    if (a.n) rows.push({ scope_id: scopeId, topic_id: t.id, ...a });
  }
  return rows;
}

export function startNightlyJob() {
  const run = () => recomputeAll().then(r => console.log('snapshots recomputed', r)).catch(e => console.error('snapshot job failed', e.message));
  const scheduleNext = () => {
    const next = new Date(); next.setHours(2, 0, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    setTimeout(() => { run().finally(scheduleNext); }, next - Date.now()).unref();
  };
  scheduleNext();
}
