// Quizzes: create/assign (teacher, institution admin), take once per assignment (student), results (FR-4, FR-7).
import { Router } from 'express';
import { z } from 'zod';
import { dbAll, dbGet, dbTx, isDuplicateError, placeholders } from '../config/db.js';
import { audit, authRequired } from '../middleware/auth.js';
import { assertInstitution, requireRole } from '../middleware/rbac.js';
import { idSchema, validate } from '../middleware/validate.js';
import { bad, conflict, created, forbidden, notFound, ok, wrap } from '../middleware/errorHandler.js';
import { fromSqlDateTime, toSqlDateTime } from '../utils/dates.js';
import { getTopics } from '../services/scoring.js';
import { recomputeStudent } from '../services/gapEngine.js';
import { loadClassFor } from './classes.js';
import { COLLEGE_BANDS, SCHOOL_BANDS } from './auth.js';

const router = Router();
router.use(authRequired);

const quizOut = q => ({ ...q, opens_at: fromSqlDateTime(q.opens_at), closes_at: fromSqlDateTime(q.closes_at) });
function windowState(q, now = Date.now()) {
  const o = q.opens_at ? new Date(fromSqlDateTime(q.opens_at)).getTime() : null;
  const c = q.closes_at ? new Date(fromSqlDateTime(q.closes_at)).getTime() : null;
  if (o && now < o) return 'upcoming';
  if (c && now > c) return 'closed';
  return 'open';
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Can this student take/see this quiz? (own institution, and class quizzes only for members)
async function loadQuizForStudent(user, quizId) {
  const quiz = await dbGet('SELECT * FROM quizzes WHERE id=?', [quizId]);
  if (!quiz) throw notFound('Quiz not found');
  assertInstitution(user, quiz.institution_id);
  if (quiz.class_id != null && !(await dbGet('SELECT 1 AS x FROM class_members WHERE class_id=? AND student_id=?', [quiz.class_id, user.id]))) {
    throw forbidden('This quiz was assigned to another class');
  }
  return quiz;
}

// ---------------------------------------------------------------- create ---
router.post('/', requireRole('teacher', 'inst_admin'), validate({ body: z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(['baseline', 'periodic', 'assigned']),
  class_id: idSchema.nullable().optional(),
  opens_at: z.string().datetime({ offset: true }).nullable().optional(),
  closes_at: z.string().datetime({ offset: true }).nullable().optional(),
  question_ids: z.array(idSchema).min(1).max(50).optional(),
  topics: z.array(z.string().max(60)).max(12).optional(),
  count: z.number().int().min(3).max(30).default(10),
}) }), wrap(async (req, res) => {
  const u = req.user; const b = req.body;
  const opens = toSqlDateTime(b.opens_at ?? new Date());
  const closes = toSqlDateTime(b.closes_at);
  if (closes && closes <= opens) throw bad('closes_at must be after opens_at');

  // Pool = every band of this institution type; questions from the class's own band are preferred.
  let classBand = null;
  if (b.class_id) classBand = (await loadClassFor(u, b.class_id)).grade_band;
  else if (u.role === 'teacher') throw bad('Choose a class for this quiz');
  const inst = await dbGet('SELECT type FROM institutions WHERE id=?', [u.institution_id]);
  const bands = inst.type === 'school' ? SCHOOL_BANDS : COLLEGE_BANDS;

  let questionIds;
  if (b.question_ids) {
    const found = await dbAll(`SELECT id FROM questions WHERE is_active=1 AND id IN (${placeholders(b.question_ids)})`, b.question_ids);
    if (found.length !== new Set(b.question_ids).size) throw bad('Some questions do not exist or are inactive');
    questionIds = found.map(f => f.id);
  } else {
    // Auto-pick: round-robin across topics, preferring the class's exact grade band.
    const all = await getTopics();
    let topicIds = all.map(t => t.id);
    if (b.topics?.length) {
      topicIds = all.filter(t => b.topics.includes(t.slug)).map(t => t.id);
      if (!topicIds.length) throw bad('None of those topics exist');
    }
    const pool = await dbAll(
      `SELECT id, topic_id, grade_band FROM questions WHERE is_active=1 AND grade_band IN (${placeholders(bands)}) AND topic_id IN (${placeholders(topicIds)})`, [...bands, ...topicIds]);
    const byTopic = new Map(topicIds.map(t => [t, []]));
    for (const q of shuffle(pool)) byTopic.get(q.topic_id)?.push(q);
    for (const list of byTopic.values()) list.sort((a, c) => (c.grade_band === classBand) - (a.grade_band === classBand));
    questionIds = [];
    const lists = shuffle([...byTopic.values()]);
    while (questionIds.length < b.count && lists.some(l => l.length)) {
      for (const l of lists) if (l.length && questionIds.length < b.count) questionIds.push(l.shift().id);
    }
    if (questionIds.length < 3) throw bad('Not enough questions in the bank for this grade band and topics. Ask the content team to add more.');
  }

  const quizId = await dbTx(async tx => {
    const r = await tx.run('INSERT INTO quizzes(institution_id,class_id,created_by,title,type,opens_at,closes_at) VALUES(?,?,?,?,?,?,?)',
      [u.institution_id, b.class_id ?? null, u.id, b.title, b.type, opens, closes]);
    for (const qid of questionIds) await tx.run('INSERT INTO quiz_questions(quiz_id,question_id) VALUES(?,?)', [r.insertId, qid]);
    return r.insertId;
  });
  await audit(req, 'quiz.create', 'quiz', quizId);
  created(res, { id: quizId, question_count: questionIds.length });
}));

// ------------------------------------------------------------------ lists ---
router.get('/assigned', requireRole('student'), wrap(async (req, res) => {
  const u = req.user;
  const rows = await dbAll(
    `SELECT qz.id, qz.title, qz.type, qz.class_id, qz.opens_at, qz.closes_at,
            (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id=qz.id) AS question_count,
            att.id AS attempt_id, att.score_pct, att.submitted_at
       FROM quizzes qz LEFT JOIN quiz_attempts att ON att.quiz_id=qz.id AND att.student_id=?
      WHERE qz.institution_id=? AND (qz.class_id IS NULL OR qz.class_id IN (SELECT class_id FROM class_members WHERE student_id=?))
      ORDER BY qz.opens_at DESC, qz.id DESC`, [u.id, u.institution_id, u.id]);
  ok(res, rows.map(r => ({
    ...quizOut(r), question_count: Number(r.question_count), score_pct: r.score_pct == null ? null : Number(r.score_pct),
    status: r.attempt_id ? 'done' : windowState(r),
  })));
}));

router.get('/', requireRole('teacher', 'inst_admin'), wrap(async (req, res) => {
  const u = req.user;
  const where = u.role === 'teacher' ? 'qz.institution_id=? AND qz.created_by=?' : 'qz.institution_id=?';
  const rows = await dbAll(
    `SELECT qz.id, qz.title, qz.type, qz.class_id, c.name AS class_name, qz.opens_at, qz.closes_at,
            (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id=qz.id) AS question_count,
            (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id=qz.id) AS attempts,
            (SELECT AVG(a.score_pct) FROM quiz_attempts a WHERE a.quiz_id=qz.id) AS avg_score
       FROM quizzes qz LEFT JOIN classes c ON c.id=qz.class_id WHERE ${where} ORDER BY qz.opens_at DESC, qz.id DESC`,
    u.role === 'teacher' ? [u.institution_id, u.id] : [u.institution_id]);
  ok(res, rows.map(r => ({ ...quizOut(r), question_count: Number(r.question_count), attempts: Number(r.attempts), avg_score: r.avg_score == null ? null : Math.round(Number(r.avg_score) * 10) / 10, status: windowState(r) })));
}));

// ------------------------------------------------------------- take quiz ---
router.get('/:id', validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const u = req.user;
  const quiz = u.role === 'student' ? await loadQuizForStudent(u, req.params.id) : await dbGet('SELECT * FROM quizzes WHERE id=?', [req.params.id]);
  if (!quiz) throw notFound('Quiz not found');
  const staff = ['teacher', 'inst_admin', 'super_admin'].includes(u.role);
  if (!staff && u.role !== 'student') throw forbidden();
  if (staff) assertInstitution(u, quiz.institution_id);

  if (u.role === 'student') {
    if (await dbGet('SELECT 1 AS x FROM quiz_attempts WHERE quiz_id=? AND student_id=?', [quiz.id, u.id])) throw conflict('You have already submitted this quiz. Open your result instead.');
    const state = windowState(quiz);
    if (state !== 'open') throw bad(state === 'upcoming' ? 'This quiz has not opened yet' : 'This quiz is closed');
  }
  const qs = await dbAll(
    `SELECT q.id, q.text, q.difficulty, t.name AS topic_name, q.explanation
       FROM quiz_questions qq JOIN questions q ON q.id=qq.question_id JOIN topics t ON t.id=q.topic_id
      WHERE qq.quiz_id=? ORDER BY q.topic_id, q.id`, [quiz.id]);
  const opts = qs.length ? await dbAll(`SELECT id, question_id, text, is_correct FROM question_options WHERE question_id IN (${placeholders(qs)}) ORDER BY id`, qs.map(q => q.id)) : [];
  const questions = qs.map(q => ({
    id: q.id, text: q.text, topic_name: q.topic_name,
    ...(staff ? { explanation: q.explanation } : {}), // explanations are shown after submission to students
    options: opts.filter(o => String(o.question_id) === String(q.id)).map(o => ({ id: o.id, text: o.text, ...(staff ? { is_correct: !!o.is_correct } : {}) })),
  }));
  ok(res, { ...quizOut(quiz), questions });
}));

router.post('/:id/attempt', requireRole('student'), validate({
  params: z.object({ id: idSchema }),
  body: z.object({ answers: z.array(z.object({ question_id: idSchema, option_id: idSchema })).min(1).max(60) }),
}), wrap(async (req, res) => {
  const u = req.user;
  const quiz = await loadQuizForStudent(u, req.params.id);
  const state = windowState(quiz);
  if (state !== 'open') throw bad(state === 'upcoming' ? 'This quiz has not opened yet' : 'This quiz is closed');

  const qids = (await dbAll('SELECT question_id FROM quiz_questions WHERE quiz_id=?', [quiz.id])).map(r => String(r.question_id));
  const given = new Map(req.body.answers.map(a => [String(a.question_id), String(a.option_id)]));
  if (given.size !== req.body.answers.length) throw bad('Each question can be answered only once');
  if (qids.some(id => !given.has(id)) || [...given.keys()].some(id => !qids.includes(id))) throw bad('Answer every question in this quiz');

  const opts = await dbAll(`SELECT id, question_id, is_correct FROM question_options WHERE question_id IN (${placeholders(qids)})`, qids);
  const graded = qids.map(qid => {
    const opt = opts.find(o => String(o.id) === given.get(qid) && String(o.question_id) === qid);
    if (!opt) throw bad('One of the selected options does not belong to its question');
    return { question_id: qid, option_id: opt.id, is_correct: !!opt.is_correct };
  });
  const correct = graded.filter(g => g.is_correct).length;
  const score = Math.round((correct / graded.length) * 10000) / 100;

  let attemptId;
  try {
    attemptId = await dbTx(async tx => {
      const r = await tx.run('INSERT INTO quiz_attempts(quiz_id,student_id,score_pct) VALUES(?,?,?)', [quiz.id, u.id, score]);
      for (const g of graded) await tx.run('INSERT INTO attempt_answers(attempt_id,question_id,option_id,is_correct) VALUES(?,?,?,?)', [r.insertId, g.question_id, g.option_id, g.is_correct]);
      return r.insertId;
    });
  } catch (e) { if (isDuplicateError(e)) throw conflict('You have already submitted this quiz'); throw e; }

  recomputeStudent(u.id).catch(e => console.error('snapshot failed', e.message)); // on-demand refresh, off the critical path
  created(res, await buildResult(attemptId, quiz.id));
}));

async function buildResult(attemptId, quizId) {
  const att = await dbGet('SELECT id, quiz_id, score_pct, submitted_at FROM quiz_attempts WHERE id=?', [attemptId]);
  const rows = await dbAll(
    `SELECT aa.question_id, aa.option_id AS selected_option_id, aa.is_correct, q.text, q.explanation, t.name AS topic_name, q.topic_id
       FROM attempt_answers aa JOIN questions q ON q.id=aa.question_id JOIN topics t ON t.id=q.topic_id
      WHERE aa.attempt_id=? ORDER BY q.topic_id, q.id`, [attemptId]);
  const opts = rows.length ? await dbAll(`SELECT id, question_id, text, is_correct FROM question_options WHERE question_id IN (${placeholders(rows)}) ORDER BY id`, rows.map(r => r.question_id)) : [];
  const review = rows.map(r => ({
    question_id: r.question_id, text: r.text, topic_name: r.topic_name, explanation: r.explanation, is_correct: !!r.is_correct, selected_option_id: r.selected_option_id,
    options: opts.filter(o => String(o.question_id) === String(r.question_id)).map(o => ({ id: o.id, text: o.text, is_correct: !!o.is_correct })),
  }));
  const topics = new Map();
  for (const r of rows) {
    const t = topics.get(r.topic_id) || { topic_id: r.topic_id, name: r.topic_name, correct: 0, total: 0 };
    t.total++; if (r.is_correct) t.correct++;
    topics.set(r.topic_id, t);
  }
  const quiz = await dbGet('SELECT id, title, type FROM quizzes WHERE id=?', [quizId]);
  const correct = review.filter(r => r.is_correct).length;
  return {
    attempt_id: att.id, quiz, score_pct: Number(att.score_pct), correct, total: review.length, submitted_at: fromSqlDateTime(att.submitted_at),
    by_topic: [...topics.values()].map(t => ({ ...t, pct: Math.round((t.correct / t.total) * 100) })), review,
  };
}

router.get('/:id/result', requireRole('student'), validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const quiz = await loadQuizForStudent(req.user, req.params.id);
  const att = await dbGet('SELECT id FROM quiz_attempts WHERE quiz_id=? AND student_id=?', [quiz.id, req.user.id]);
  if (!att) throw notFound('You have not taken this quiz yet');
  ok(res, await buildResult(att.id, quiz.id));
}));

// Staff view of one quiz: who took it, and which questions were hardest.
router.get('/:id/results', requireRole('teacher', 'inst_admin'), validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const u = req.user;
  const quiz = await dbGet('SELECT * FROM quizzes WHERE id=?', [req.params.id]);
  if (!quiz) throw notFound('Quiz not found');
  assertInstitution(u, quiz.institution_id);
  if (u.role === 'teacher') {
    const owns = String(quiz.created_by) === String(u.id) || (quiz.class_id != null && (await loadClassFor(u, quiz.class_id).then(() => true, () => false)));
    if (!owns) throw forbidden('This is not your quiz');
  }
  const eligible = quiz.class_id != null
    ? await dbAll('SELECT u.id, u.name FROM class_members cm JOIN users u ON u.id=cm.student_id WHERE cm.class_id=? ORDER BY u.name', [quiz.class_id])
    : await dbAll("SELECT id, name FROM users WHERE institution_id=? AND role='student' ORDER BY name", [quiz.institution_id]);
  const attempts = await dbAll('SELECT student_id, score_pct, submitted_at FROM quiz_attempts WHERE quiz_id=?', [quiz.id]);
  const byStudent = new Map(attempts.map(a => [String(a.student_id), a]));
  const students = eligible.map(s => { const a = byStudent.get(String(s.id)); return { id: s.id, name: s.name, taken: !!a, score_pct: a ? Number(a.score_pct) : null, submitted_at: a ? fromSqlDateTime(a.submitted_at) : null }; });
  const qs = await dbAll(
    `SELECT q.id, q.text, t.name AS topic_name, COUNT(aa.question_id) AS answers, COALESCE(SUM(aa.is_correct), 0) AS correct
       FROM quiz_questions qq JOIN questions q ON q.id=qq.question_id JOIN topics t ON t.id=q.topic_id
       LEFT JOIN quiz_attempts a ON a.quiz_id=qq.quiz_id
       LEFT JOIN attempt_answers aa ON aa.attempt_id=a.id AND aa.question_id=q.id
      WHERE qq.quiz_id=? GROUP BY q.id, q.text, t.name ORDER BY q.id`, [quiz.id]);
  const questions = qs.map(q => ({ id: q.id, text: q.text, topic_name: q.topic_name, answers: Number(q.answers), pct_correct: Number(q.answers) ? Math.round((Number(q.correct) / Number(q.answers)) * 100) : null }));
  const taken = students.filter(s => s.taken);
  ok(res, {
    quiz: quizOut(quiz), eligible: students.length, taken: taken.length,
    completion_pct: students.length ? Math.round((taken.length / students.length) * 100) : null,
    average_pct: taken.length ? Math.round((taken.reduce((a, s) => a + s.score_pct, 0) / taken.length) * 10) / 10 : null,
    students, questions,
  });
}));

export default router;
