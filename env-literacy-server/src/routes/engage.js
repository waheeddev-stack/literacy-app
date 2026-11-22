// Student engagement (personal only, no leaderboards): eco-challenges, practice mode, badges.
import { Router } from 'express';
import { z } from 'zod';
import { dbAll, dbGet, dbRun, placeholders } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { idSchema, validate } from '../middleware/validate.js';
import { bad, conflict, created, notFound, ok, wrap } from '../middleware/errorHandler.js';
import { addDays, isoDate } from '../utils/dates.js';
import { getTopics } from '../services/scoring.js';
import { recommendationsFor, studentAnalytics } from '../services/analyticsService.js';
import { SCHOOL_BANDS, COLLEGE_BANDS } from './auth.js';

export const challengesRouter = Router();
export const learnRouter = Router();
export const achievementsRouter = Router();
for (const r of [challengesRouter, learnRouter, achievementsRouter]) r.use(authRequired, requireRole('student'));

// ------------------------------------------------------------ challenges ---
export const CHALLENGE_DAYS = 7;
export const CHALLENGE_TARGET = 5; // log 5 of 7 days to complete

function shape(e, logs, today) {
  const days = logs.map(l => String(l.log_date).slice(0, 10));
  const end = addDays(String(e.start_date).slice(0, 10), CHALLENGE_DAYS - 1);
  let status = e.status;
  if (status === 'active' && today > end) status = 'expired';
  return {
    id: e.id, card_id: e.card_id, title: e.title, body: e.body, topic_name: e.topic_name,
    start_date: String(e.start_date).slice(0, 10), ends: end, status, logged_days: days, progress: days.length, target: CHALLENGE_TARGET,
    days_left: status === 'active' ? Math.max(0, Math.round((new Date(end) - new Date(today)) / 86400000) + 1) : 0,
    logged_today: days.includes(today),
  };
}

async function myEnrollments(studentId) {
  const rows = await dbAll(
    `SELECT e.id, e.card_id, e.start_date, e.status, c.title, c.body, t.name AS topic_name
       FROM challenge_enrollments e JOIN action_cards c ON c.id=e.card_id JOIN topics t ON t.id=c.topic_id
      WHERE e.student_id=? AND e.status <> 'dropped' ORDER BY e.start_date DESC, e.id DESC LIMIT 50`, [studentId]);
  const logs = rows.length ? await dbAll(`SELECT enrollment_id, log_date FROM challenge_logs WHERE enrollment_id IN (${placeholders(rows)})`, rows.map(r => r.id)) : [];
  const today = isoDate();
  return rows.map(r => shape(r, logs.filter(l => String(l.enrollment_id) === String(r.id)), today));
}

challengesRouter.get('/', wrap(async (req, res) => {
  const mine = await myEnrollments(req.user.id);
  const taken = new Set(mine.filter(m => m.status === 'active').map(m => String(m.card_id)));
  const a = await studentAnalytics(req.user.id);
  let cards = await recommendationsFor(a.topics);
  if (!cards.length) { // no data yet: offer starter challenges
    cards = await dbAll("SELECT c.id, c.topic_id, c.gap_type, c.title, c.body, t.name AS topic_name FROM action_cards c JOIN topics t ON t.id=c.topic_id WHERE c.gap_type='knowledge_heavy' ORDER BY c.id LIMIT 6");
  }
  ok(res, {
    days: CHALLENGE_DAYS, target: CHALLENGE_TARGET,
    active: mine.filter(m => m.status === 'active'),
    finished: mine.filter(m => m.status !== 'active'),
    suggestions: cards.filter(c => !taken.has(String(c.id))).map(c => ({ card_id: c.id, title: c.title, body: c.body, topic_name: c.topic_name })),
  });
}));

challengesRouter.post('/', validate({ body: z.object({ card_id: z.number().int().positive() }) }), wrap(async (req, res) => {
  if (!(await dbGet('SELECT id FROM action_cards WHERE id=?', [req.body.card_id]))) throw notFound('Challenge not found');
  const active = (await myEnrollments(req.user.id)).find(m => m.status === 'active' && m.card_id === req.body.card_id);
  if (active) throw conflict('You are already doing this challenge');
  const r = await dbRun('INSERT INTO challenge_enrollments(student_id,card_id,start_date,status) VALUES(?,?,?,?)', [req.user.id, req.body.card_id, isoDate(), 'active']);
  created(res, { id: r.insertId });
}));

async function ownEnrollment(req) {
  const e = await dbGet('SELECT id, start_date, status FROM challenge_enrollments WHERE id=? AND student_id=?', [req.params.id, req.user.id]);
  if (!e) throw notFound('Challenge not found');
  return e;
}

// Mark today as done. Completing CHALLENGE_TARGET days inside the window finishes it.
challengesRouter.post('/:id/log', validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const e = await ownEnrollment(req);
  const today = isoDate();
  if (e.status !== 'active') throw bad('This challenge is finished');
  if (today > addDays(String(e.start_date).slice(0, 10), CHALLENGE_DAYS - 1)) throw bad('This challenge window has ended');
  if (!(await dbGet('SELECT 1 AS x FROM challenge_logs WHERE enrollment_id=? AND log_date=?', [e.id, today]))) {
    await dbRun('INSERT INTO challenge_logs(enrollment_id,log_date) VALUES(?,?)', [e.id, today]);
  }
  const n = Number((await dbGet('SELECT COUNT(*) AS n FROM challenge_logs WHERE enrollment_id=?', [e.id])).n);
  const done = n >= CHALLENGE_TARGET;
  if (done) await dbRun("UPDATE challenge_enrollments SET status='done' WHERE id=?", [e.id]);
  ok(res, { progress: n, target: CHALLENGE_TARGET, done });
}));

challengesRouter.post('/:id/drop', validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const e = await ownEnrollment(req);
  await dbRun("UPDATE challenge_enrollments SET status='dropped' WHERE id=? AND status='active'", [e.id]);
  ok(res, { dropped: true });
}));

// ---------------------------------------------------------- practice mode ---
// Unscored practice: never touches quiz attempts, so it does not change K.
learnRouter.get('/questions', validate({ query: z.object({ topic: z.string().max(60).optional(), count: z.coerce.number().int().min(3).max(15).default(5) }) }), wrap(async (req, res) => {
  const inst = await dbGet('SELECT type FROM institutions WHERE id=?', [req.user.institution_id]);
  const bands = inst.type === 'school' ? SCHOOL_BANDS : COLLEGE_BANDS;
  const params = [...bands]; let topicSql = '';
  if (req.query.topic) {
    const t = (await getTopics()).find(x => x.slug === req.query.topic);
    if (!t) throw bad('Unknown topic');
    topicSql = 'AND q.topic_id=?'; params.push(t.id);
  }
  const pool = await dbAll(`SELECT q.id, q.text, t.name AS topic_name FROM questions q JOIN topics t ON t.id=q.topic_id WHERE q.is_active=1 AND q.grade_band IN (${placeholders(bands)}) ${topicSql}`, params);
  const picked = pool.sort(() => Math.random() - 0.5).slice(0, req.query.count);
  const opts = picked.length ? await dbAll(`SELECT id, question_id, text FROM question_options WHERE question_id IN (${placeholders(picked)}) ORDER BY id`, picked.map(p => p.id)) : [];
  ok(res, picked.map(p => ({ ...p, options: opts.filter(o => String(o.question_id) === String(p.id)).map(o => ({ id: o.id, text: o.text })) })));
}));

learnRouter.post('/check', validate({ body: z.object({ question_id: idSchema, option_id: idSchema }) }), wrap(async (req, res) => {
  const q = await dbGet('SELECT id, explanation FROM questions WHERE id=? AND is_active=1', [req.body.question_id]);
  if (!q) throw notFound('Question not found');
  const opts = await dbAll('SELECT id, is_correct FROM question_options WHERE question_id=?', [q.id]);
  const chosen = opts.find(o => String(o.id) === req.body.option_id);
  if (!chosen) throw bad('That option does not belong to this question');
  ok(res, { is_correct: !!chosen.is_correct, correct_option_id: opts.find(o => o.is_correct)?.id, explanation: q.explanation });
}));

// ------------------------------------------------------------------ badges ---
const BADGES = [
  ['first_quiz', 'First quiz', 'Finish your first quiz'],
  ['sharp_mind', 'Sharp mind', 'Score 80% or more on a quiz'],
  ['first_checkin', 'Habit starter', 'Submit your first weekly check-in'],
  ['streak_4', 'Four-week streak', 'Check in four weeks in a row'],
  ['in_sync', 'In sync', 'Have a topic where knowledge and practice are aligned'],
  ['all_topics', 'Well-rounded', 'Take quiz questions in all topics'],
  ['challenger', 'Challenger', 'Complete an eco-challenge'],
  ['improver', 'On the rise', 'Raise your sustainability index by 5+ points since an earlier term'],
];

achievementsRouter.get('/me', wrap(async (req, res) => {
  const a = await studentAnalytics(req.user.id);
  const best = await dbGet('SELECT MAX(score_pct) AS m FROM quiz_attempts WHERE student_id=?', [req.user.id]);
  const done = await dbGet("SELECT COUNT(*) AS n FROM challenge_enrollments WHERE student_id=? AND status='done'", [req.user.id]);
  const topicsTotal = (await getTopics()).length;
  const h = a.history.filter(x => x.SI != null);
  const earned = {
    first_quiz: a.quizzes_taken >= 1,
    sharp_mind: Number(best?.m || 0) >= 80,
    first_checkin: a.checkins_done >= 1,
    streak_4: a.streak_weeks >= 4,
    in_sync: a.topics.some(t => t.type === 'aligned'),
    all_topics: a.topics.filter(t => t.K != null).length >= topicsTotal,
    challenger: Number(done.n) >= 1,
    improver: h.length >= 2 && h[h.length - 1].SI - h[0].SI >= 5,
  };
  const badges = BADGES.map(([id, title, description]) => ({ id, title, description, earned: !!earned[id] }));
  ok(res, { earned: badges.filter(b => b.earned).length, total: badges.length, badges });
}));
