// Raw data access for K (knowledge) and P (practice). Pure SQL, portable across SQLite and TiDB.
//   K(topic) = correct / total answers over each student's latest LATEST_ATTEMPTS attempts, ×100
//   P(topic) = mean of normalised responses over the last PRACTICE_WEEKS weeks, ×100
import { dbAll, dbGet, placeholders } from '../config/db.js';
import { addDays, isoDate } from '../utils/dates.js';

export const LATEST_ATTEMPTS = 3;
export const PRACTICE_WEEKS = 4;

let topicCache = null;
export async function getTopics() {
  if (!topicCache) topicCache = await dbAll('SELECT id, slug, name FROM topics ORDER BY id');
  return topicCache;
}
export const invalidateTopics = () => { topicCache = null; };

// Build the student filter. Alias `u` = users.
function studentCond(f) {
  const parts = ["u.role='student'"]; const params = [];
  if (f.studentId != null) { parts.push('u.id=?'); params.push(f.studentId); }
  if (f.studentIds?.length) { parts.push(`u.id IN (${placeholders(f.studentIds)})`); params.push(...f.studentIds); }
  if (f.institutionId != null) { parts.push('u.institution_id=?'); params.push(f.institutionId); }
  if (f.classId != null) { parts.push('u.id IN (SELECT student_id FROM class_members WHERE class_id=?)'); params.push(f.classId); }
  return { sql: parts.join(' AND '), params };
}

// -> Map<studentId(string), { institution_id, topics: Map<topicId, {correct,total,psum,pn}> }>
// filter {} = every student (region-wide).
export async function loadRawScores(filter = {}) {
  const c = studentCond(filter);
  const kRows = await dbAll(
    `SELECT t.student_id, u.institution_id, q.topic_id, SUM(aa.is_correct) AS correct, COUNT(*) AS total
       FROM (SELECT a.id AS attempt_id, a.student_id,
                    ROW_NUMBER() OVER (PARTITION BY a.student_id ORDER BY a.submitted_at DESC, a.id DESC) AS rn
               FROM quiz_attempts a JOIN users u ON u.id = a.student_id WHERE ${c.sql}) t
       JOIN users u ON u.id = t.student_id
       JOIN attempt_answers aa ON aa.attempt_id = t.attempt_id
       JOIN questions q ON q.id = aa.question_id
      WHERE t.rn <= ?
      GROUP BY t.student_id, u.institution_id, q.topic_id`,
    [...c.params, LATEST_ATTEMPTS]);

  const cutoff = addDays(isoDate(), -7 * PRACTICE_WEEKS);
  const pRows = await dbAll(
    `SELECT ch.student_id, u.institution_id, i.topic_id,
            SUM(CASE WHEN i.scale = 'yes_no' THEN r.value * 100.0 ELSE r.value * 25.0 END) AS psum, COUNT(*) AS pn
       FROM practice_checkins ch
       JOIN users u ON u.id = ch.student_id
       JOIN practice_responses r ON r.checkin_id = ch.id
       JOIN practice_items i ON i.id = r.item_id
      WHERE ch.week_start >= ? AND ${c.sql}
      GROUP BY ch.student_id, u.institution_id, i.topic_id`,
    [cutoff, ...c.params]);

  const out = new Map();
  const slot = (sid, inst, tid) => {
    const key = String(sid);
    if (!out.has(key)) out.set(key, { institution_id: inst, topics: new Map() });
    const topics = out.get(key).topics;
    if (!topics.has(tid)) topics.set(tid, { correct: 0, total: 0, psum: 0, pn: 0 });
    return topics.get(tid);
  };
  for (const r of kRows) { const s = slot(r.student_id, r.institution_id, r.topic_id); s.correct += Number(r.correct); s.total += Number(r.total); }
  for (const r of pRows) { const s = slot(r.student_id, r.institution_id, r.topic_id); s.psum += Number(r.psum); s.pn += Number(r.pn); }
  return out;
}

// Grade band per student (first class membership) — used for grade comparisons.
export async function loadStudentBands(institutionId) {
  const rows = await dbAll(
    `SELECT cm.student_id, MIN(c.grade_band) AS grade_band
       FROM class_members cm JOIN classes c ON c.id = cm.class_id
      WHERE c.institution_id = ? GROUP BY cm.student_id`, [institutionId]);
  return new Map(rows.map(r => [String(r.student_id), r.grade_band]));
}

export async function latestAudit(institutionId) {
  return dbGet('SELECT id, term_label, total_score, created_at FROM campus_audits WHERE institution_id=? ORDER BY created_at DESC, id DESC LIMIT 1', [institutionId]);
}
