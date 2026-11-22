// My account: profile, change password, and a full export of my own data (privacy / DPDP-friendly).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { dbAll, dbGet, dbRun } from '../config/db.js';
import { audit, authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bad, ok, wrap } from '../middleware/errorHandler.js';

const router = Router();
router.use(authRequired);

router.patch('/profile', validate({ body: z.object({ name: z.string().trim().min(2).max(150) }) }), wrap(async (req, res) => {
  await dbRun('UPDATE users SET name=? WHERE id=?', [req.body.name, req.user.id]);
  ok(res, { name: req.body.name });
}));

router.post('/password', validate({ body: z.object({ current_password: z.string().min(1).max(100), new_password: z.string().min(8).max(100) }) }), wrap(async (req, res) => {
  const u = await dbGet('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
  if (!(await bcrypt.compare(req.body.current_password, u.password_hash))) throw bad('Current password is incorrect');
  if (req.body.current_password === req.body.new_password) throw bad('Choose a different password');
  await dbRun('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.new_password, env.bcryptRounds), req.user.id]);
  await audit(req, 'account.password', 'user', req.user.id);
  ok(res, { message: 'Password changed' });
}));

router.get('/export', wrap(async (req, res) => {
  const id = req.user.id;
  const profile = await dbGet('SELECT id, name, email, role, institution_id, consent_at, created_at FROM users WHERE id=?', [id]);
  const data = { exported_at: new Date().toISOString(), profile };
  if (req.user.role === 'student') {
    data.classes = await dbAll('SELECT c.name, c.grade_band FROM class_members cm JOIN classes c ON c.id=cm.class_id WHERE cm.student_id=?', [id]);
    data.quiz_attempts = await dbAll('SELECT qz.title, a.score_pct, a.submitted_at FROM quiz_attempts a JOIN quizzes qz ON qz.id=a.quiz_id WHERE a.student_id=? ORDER BY a.submitted_at', [id]);
    data.weekly_checkins = await dbAll('SELECT week_start, submitted_at FROM practice_checkins WHERE student_id=? ORDER BY week_start', [id]);
    data.score_snapshots = await dbAll("SELECT period_label, topic_id, knowledge_score, practice_score, gap, sustainability_index FROM score_snapshots WHERE scope='student' AND scope_id=? ORDER BY period_label", [id]);
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
  res.send(JSON.stringify({ success: true, data, error: null }, null, 2));
}));

export default router;
