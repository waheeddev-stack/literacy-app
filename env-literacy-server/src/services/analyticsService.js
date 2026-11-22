// Read-side aggregation for the five dashboards. All group results honour the small-group rule.
import { dbAll, dbGet, placeholders } from '../config/db.js';
import { notFound } from '../middleware/errorHandler.js';
import { termLabel, weekStart, addDays } from '../utils/dates.js';
import { getTopics, loadStudentBands, latestAudit } from './scoring.js';
import { aggregateOver, getWeights, guard, institutionScore, makeScore, scoreMany } from './gapEngine.js';
import { env } from '../config/env.js';

const num = v => (v == null ? null : Number(v));
const snapOut = r => ({ period: r.period_label, K: num(r.knowledge_score), P: num(r.practice_score), gap: num(r.gap), SI: num(r.sustainability_index) });

async function history(scope, scopeId) {
  const rows = await dbAll(
    'SELECT period_label, knowledge_score, practice_score, gap, sustainability_index FROM score_snapshots WHERE scope=? AND scope_id=? AND topic_id IS NULL ORDER BY period_label',
    [scope, scopeId]);
  return rows.map(snapOut);
}
const withCurrent = (hist, period, agg) => {
  if (hist.some(h => h.period === period) || agg.hidden || (agg.K == null && agg.P == null)) return hist;
  return [...hist, { period, K: agg.K, P: agg.P, gap: agg.gap, SI: agg.SI }];
};

async function topicRowsFor(results, ids, w, { guarded }) {
  const topics = await getTopics();
  return topics.map(t => {
    const a = aggregateOver(results, ids, w, t.id);
    return { topic_id: t.id, slug: t.slug, name: t.name, ...(guarded ? guard(a) : { ...a, hidden: false }) };
  });
}

// Consecutive weekly check-ins ending this week or last week.
export function streakOf(weeks) {
  const set = new Set(weeks);
  let cursor = weekStart();
  if (!set.has(cursor)) cursor = addDays(cursor, -7);
  let n = 0;
  while (set.has(cursor)) { n++; cursor = addDays(cursor, -7); }
  return n;
}

// Participation (PRD success metrics): % who took a quiz, % who checked in this week.
export async function participation({ classId, institutionId }) {
  const cond = classId != null ? 'u.id IN (SELECT student_id FROM class_members WHERE class_id=?)' : 'u.institution_id=?';
  const p = [classId ?? institutionId];
  const wk = weekStart();
  const total = Number((await dbGet(`SELECT COUNT(*) AS n FROM users u WHERE u.role='student' AND ${cond}`, p)).n);
  const quiz = Number((await dbGet(`SELECT COUNT(DISTINCT a.student_id) AS n FROM quiz_attempts a JOIN users u ON u.id=a.student_id WHERE u.role='student' AND ${cond}`, p)).n);
  const week = Number((await dbGet(`SELECT COUNT(DISTINCT c.student_id) AS n FROM practice_checkins c JOIN users u ON u.id=c.student_id WHERE c.week_start=? AND u.role='student' AND ${cond}`, [wk, ...p])).n);
  const pct = n => (total ? Math.round((n / total) * 100) : null);
  return { students: total, quiz_rate: pct(quiz), checkin_rate_this_week: pct(week), not_checked_in: total - week };
}

// -------------------------------------------------------------- student ---
export async function studentAnalytics(studentId) {
  const w = await getWeights();
  const topics = await getTopics();
  const res = (await scoreMany({ studentId })).get(String(studentId));
  const empty = makeScore(null, null, w);
  const attempts = await dbGet('SELECT COUNT(*) AS n FROM quiz_attempts WHERE student_id=?', [studentId]);
  const checkins = await dbAll('SELECT week_start FROM practice_checkins WHERE student_id=? ORDER BY week_start DESC', [studentId]);
  const rows = topics.map(t => ({ topic_id: t.id, slug: t.slug, name: t.name, ...(res?.topics[t.id] || empty) }));
  return {
    weights: w,
    overall: res?.overall || empty,
    topics: rows,
    history: await history('student', studentId),
    quizzes_taken: Number(attempts?.n || 0),
    checkins_done: checkins.length,
    streak_weeks: streakOf(checkins.map(c => String(c.week_start).slice(0, 10))),
    checked_in_this_week: checkins.some(c => String(c.week_start).slice(0, 10) === weekStart()),
  };
}

// ---------------------------------------------------------------- class ---
export async function classAnalytics(classId) {
  const cls = await dbGet(
    'SELECT c.id, c.institution_id, c.teacher_id, c.name, c.grade_band, c.join_code, u.name AS teacher_name FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.id=?', [classId]);
  if (!cls) throw notFound('Class not found');
  const w = await getWeights();
  const members = await dbAll('SELECT u.id, u.name, u.email FROM class_members cm JOIN users u ON u.id = cm.student_id WHERE cm.class_id=? ORDER BY u.name', [classId]);
  const results = await scoreMany({ classId });
  const ids = members.map(m => m.id);

  const students = members.map(m => {
    const r = results.get(String(m.id));
    const o = r?.overall || makeScore(null, null, w);
    let support = null;
    if (!r || (o.K == null && o.P == null)) support = 'No quiz or check-in yet';
    else if (o.K == null) support = 'No quiz taken yet';
    else if (o.P == null) support = 'No check-in in the last 4 weeks';
    else if (o.SI < 50) support = 'Low sustainability index';
    else if (Math.abs(o.gap) > 20) support = o.gap > 0 ? 'Knows but rarely acts' : 'Acts without much knowledge';
    return { id: m.id, name: m.name, email: m.email, ...o, support_reason: support };
  });

  const topics = await topicRowsFor(results, ids, w, { guarded: false });
  const scored = topics.filter(t => t.K != null).sort((a, b) => a.K - b.K);
  return {
    class: cls,
    student_count: members.length,
    participation: await participation({ classId }),
    pending_checkin: await dbAll(
      `SELECT u.id, u.name FROM class_members cm JOIN users u ON u.id=cm.student_id
        WHERE cm.class_id=? AND u.id NOT IN (SELECT student_id FROM practice_checkins WHERE week_start=?) ORDER BY u.name`, [classId, weekStart()]),
    overall: { ...aggregateOver(results, ids, w), hidden: false },
    topics,
    weakest_topics: scored.slice(0, 3).map(t => ({ topic_id: t.topic_id, name: t.name, K: t.K, P: t.P, gap: t.gap })),
    students,
    needs_support: students.filter(s => s.support_reason),
    history: await history('class', classId),
  };
}

// ---------------------------------------------------------- institution ---
export async function institutionAnalytics(institutionId, { viewerGlobal = false } = {}) {
  const inst = await dbGet('SELECT id, name, type, board_or_university, ward_or_area, status FROM institutions WHERE id=?', [institutionId]);
  if (!inst) throw notFound('Institution not found');
  const w = await getWeights();
  const results = await scoreMany({ institutionId });
  const ids = [...results.keys()];
  const overallRaw = aggregateOver(results, ids, w);
  const overall = viewerGlobal ? guard(overallRaw) : { ...overallRaw, hidden: false };

  const bands = await loadStudentBands(institutionId);
  const byBand = new Map();
  for (const id of ids) { const b = bands.get(id) || 'unassigned'; (byBand.get(b) || byBand.set(b, []).get(b)).push(id); }
  const grade_bands = [...byBand].map(([band, list]) => ({ grade_band: band, ...guard(aggregateOver(results, list, w)) }));

  const classes = await dbAll('SELECT c.id, c.name, c.grade_band, u.name AS teacher_name FROM classes c JOIN users u ON u.id=c.teacher_id WHERE c.institution_id=? ORDER BY c.name', [institutionId]);
  const classRows = [];
  for (const c of classes) {
    const m = await dbAll('SELECT student_id FROM class_members WHERE class_id=?', [c.id]);
    classRows.push({ ...c, student_count: m.length, ...guard(aggregateOver(results, m.map(x => x.student_id), w)) });
  }

  const period = termLabel();
  const audit = await latestAudit(institutionId);
  const audits = await dbAll('SELECT id, term_label, total_score, created_at FROM campus_audits WHERE institution_id=? ORDER BY term_label', [institutionId]);
  const counts = await dbGet(
    `SELECT (SELECT COUNT(*) FROM users WHERE institution_id=? AND role='student') AS students,
            (SELECT COUNT(*) FROM users WHERE institution_id=? AND role='teacher') AS teachers,
            (SELECT COUNT(*) FROM classes WHERE institution_id=?) AS classes,
            (SELECT COUNT(*) FROM quizzes WHERE institution_id=?) AS quizzes`, [institutionId, institutionId, institutionId, institutionId]);
  return {
    institution: inst,
    counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])),
    overall,
    participation: await participation({ institutionId }),
    institution_score: await institutionScore(institutionId, overallRaw),
    topics: await topicRowsFor(results, ids, w, { guarded: true }),
    grade_bands,
    classes: classRows,
    trend: withCurrent(await history('institution', institutionId), period, overallRaw),
    audit: audit ? { latest: { term_label: audit.term_label, total_score: num(audit.total_score) }, history: audits.map(a => ({ term_label: a.term_label, total_score: num(a.total_score) })) } : null,
  };
}

// --------------------------------------------------------------- region ---
export async function regionAnalytics() {
  const w = await getWeights();
  const topics = await getTopics();
  const insts = await dbAll("SELECT id, name, type, ward_or_area FROM institutions WHERE status='active' ORDER BY name");
  const results = await scoreMany({});
  const byInst = new Map();
  for (const [sid, r] of results) { const k = String(r.institution_id); (byInst.get(k) || byInst.set(k, []).get(k)).push(sid); }

  const rows = [];
  const heatmap = [];
  for (const i of insts) {
    const ids = byInst.get(String(i.id)) || [];
    const raw = aggregateOver(results, ids, w);
    const agg = guard(raw);
    const is = agg.hidden ? { score: null, student_si: null, audit_pct: null } : await institutionScore(i.id, raw);
    rows.push({ ...agg, ...is, gap_type: agg.type, id: i.id, name: i.name, type: i.type, ward_or_area: i.ward_or_area });
    heatmap.push({
      institution_id: i.id, name: i.name,
      cells: topics.map(t => { const a = guard(aggregateOver(results, ids, w, t.id)); return { topic_id: t.id, gap: a.gap, K: a.K, P: a.P, hidden: a.hidden }; }),
    });
  }
  // Rank by institution score; those without a score fall back to student SI, then to the bottom.
  const rank = r => (r.score ?? -1) * 1000 + (r.SI ?? -1);
  rows.sort((a, b) => rank(b) - rank(a));
  rows.forEach((r, idx) => { r.rank = r.hidden ? null : idx + 1; });

  const typeOf = new Map(insts.map(i => [String(i.id), i.type]));
  const split = ['school', 'college'].map(type => {
    const ids = [...results].filter(([, r]) => typeOf.get(String(r.institution_id)) === type).map(([sid]) => sid);
    const agg = guard(aggregateOver(results, ids, w));
    return { ...agg, gap_type: agg.type, type, institutions: insts.filter(i => i.type === type).length };
  });
  const allIds = [...results.keys()];
  return {
    weights: w,
    overall: guard(aggregateOver(results, allIds, w)),
    institutions: rows,
    topics: topics.map(t => ({ topic_id: t.id, name: t.name, ...guard(aggregateOver(results, allIds, w, t.id)) })),
    heatmap: { topics: topics.map(t => ({ id: t.id, name: t.name })), rows: heatmap },
    school_vs_college: split,
    min_group_size: env.minGroupSize,
  };
}

// ------------------------------------------------------ recommendations ---
export async function recommendationsFor(topicRows) {
  const scored = topicRows.filter(t => t.type).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  if (!scored.length) return [];
  const cards = await dbAll(
    `SELECT id, topic_id, gap_type, title, body FROM action_cards WHERE topic_id IN (${placeholders(scored)})`, scored.map(t => t.topic_id));
  const out = [];
  for (const t of scored) {
    const hit = cards.filter(c => String(c.topic_id) === String(t.topic_id) && c.gap_type === t.type);
    for (const c of hit) out.push({ ...c, topic_name: t.name, gap: t.gap, gap_type: t.type });
  }
  // Prefer actionable cards (gaps) before "keep going" cards.
  out.sort((a, b) => (a.gap_type === 'aligned') - (b.gap_type === 'aligned'));
  return out.slice(0, 6);
}
