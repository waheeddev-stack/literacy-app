// Practice tracker: short weekly check-ins mapped to the same topics as the quizzes (FR-5).
import { Router } from 'express';
import { z } from 'zod';
import { dbAll, dbGet, dbTx } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { bad, created, ok, wrap } from '../middleware/errorHandler.js';
import { weekStart } from '../utils/dates.js';
import { recomputeStudent } from '../services/gapEngine.js';
import { streakOf } from '../services/analyticsService.js';

const router = Router();
router.use(authRequired);

export const SCALE_LABELS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];
const MAX = { yes_no: 1, freq_0_4: 4 };

async function itemsFor(user) {
  const inst = user.institution_id != null ? await dbGet('SELECT type FROM institutions WHERE id=?', [user.institution_id]) : null;
  const rows = await dbAll(
    `SELECT i.id, i.topic_id, t.name AS topic_name, i.prompt, i.scale
       FROM practice_items i JOIN topics t ON t.id=i.topic_id
      WHERE i.grade_band='all' OR i.grade_band=? ORDER BY i.topic_id, i.id`, [inst?.type ?? 'all']);
  return rows;
}

router.get('/items', wrap(async (req, res) => {
  const items = await itemsFor(req.user);
  const wk = weekStart();
  let existing = null;
  if (req.user.role === 'student') {
    const c = await dbGet('SELECT id FROM practice_checkins WHERE student_id=? AND week_start=?', [req.user.id, wk]);
    if (c) existing = Object.fromEntries((await dbAll('SELECT item_id, value FROM practice_responses WHERE checkin_id=?', [c.id])).map(r => [String(r.item_id), r.value]));
  }
  ok(res, { week_start: wk, scale_labels: SCALE_LABELS, items, existing });
}));

// One check-in per student per week; submitting again in the same week replaces it.
router.post('/checkins', requireRole('student'), validate({ body: z.object({
  responses: z.array(z.object({ item_id: z.number().int().positive(), value: z.number().int().min(0).max(4) })).min(1).max(80),
}) }), wrap(async (req, res) => {
  const items = new Map((await itemsFor(req.user)).map(i => [i.id, i]));
  const seen = new Set();
  for (const r of req.body.responses) {
    const item = items.get(r.item_id);
    if (!item) throw bad(`Unknown practice item ${r.item_id}`);
    if (seen.has(r.item_id)) throw bad('Each item can be answered once');
    seen.add(r.item_id);
    if (r.value > MAX[item.scale]) throw bad(`Value out of range for "${item.prompt}"`);
  }
  const wk = weekStart();
  const id = await dbTx(async tx => {
    let c = await tx.get('SELECT id FROM practice_checkins WHERE student_id=? AND week_start=?', [req.user.id, wk]);
    if (c) await tx.run('DELETE FROM practice_responses WHERE checkin_id=?', [c.id]);
    else c = { id: (await tx.run('INSERT INTO practice_checkins(student_id,week_start) VALUES(?,?)', [req.user.id, wk])).insertId };
    for (const r of req.body.responses) await tx.run('INSERT INTO practice_responses(checkin_id,item_id,value) VALUES(?,?,?)', [c.id, r.item_id, r.value]);
    return c.id;
  });
  recomputeStudent(req.user.id).catch(e => console.error('snapshot failed', e.message));
  created(res, { id, week_start: wk, answered: req.body.responses.length });
}));

router.get('/history', requireRole('student'), wrap(async (req, res) => {
  const rows = await dbAll(
    `SELECT ch.id, ch.week_start, ch.submitted_at, COUNT(r.item_id) AS answered
       FROM practice_checkins ch LEFT JOIN practice_responses r ON r.checkin_id=ch.id
      WHERE ch.student_id=? GROUP BY ch.id, ch.week_start, ch.submitted_at ORDER BY ch.week_start DESC LIMIT 26`, [req.user.id]);
  const weeks = rows.map(r => String(r.week_start).slice(0, 10));
  ok(res, { streak_weeks: streakOf(weeks), checkins: rows.map(r => ({ id: r.id, week_start: String(r.week_start).slice(0, 10), answered: Number(r.answered) })) });
}));

export default router;
