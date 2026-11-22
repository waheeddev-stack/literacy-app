// Announcements: teachers post to their classes; institution admins to a class or the whole institution.
import { Router } from 'express';
import { z } from 'zod';
import { dbAll, dbGet, dbRun } from '../config/db.js';
import { audit, authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { idSchema, validate } from '../middleware/validate.js';
import { bad, created, forbidden, notFound, ok, wrap } from '../middleware/errorHandler.js';
import { fromSqlDateTime } from '../utils/dates.js';
import { loadClassFor } from './classes.js';

const router = Router();
router.use(authRequired);

router.get('/', wrap(async (req, res) => {
  const u = req.user;
  if (u.institution_id == null) return ok(res, []);
  let where = 'a.institution_id=?'; const params = [u.institution_id];
  if (u.role === 'student') { where += ' AND (a.class_id IS NULL OR a.class_id IN (SELECT class_id FROM class_members WHERE student_id=?))'; params.push(u.id); }
  else if (u.role === 'teacher') { where += ' AND (a.class_id IS NULL OR a.author_id=?)'; params.push(u.id); }
  else if (!['inst_admin'].includes(u.role)) throw forbidden();
  const rows = await dbAll(
    `SELECT a.id, a.title, a.body, a.class_id, a.created_at, a.author_id, c.name AS class_name, u.name AS author_name
       FROM announcements a LEFT JOIN classes c ON c.id=a.class_id JOIN users u ON u.id=a.author_id
      WHERE ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT 30`, params);
  ok(res, rows.map(r => ({ ...r, created_at: fromSqlDateTime(r.created_at), mine: String(r.author_id) === String(u.id) })));
}));

router.post('/', requireRole('teacher', 'inst_admin'), validate({ body: z.object({
  title: z.string().trim().min(3).max(150), body: z.string().trim().min(3).max(2000), class_id: idSchema.nullable().optional(),
}) }), wrap(async (req, res) => {
  const { title, body, class_id } = req.body;
  if (class_id) await loadClassFor(req.user, class_id);
  else if (req.user.role === 'teacher') throw bad('Choose a class for this announcement');
  const r = await dbRun('INSERT INTO announcements(institution_id,class_id,author_id,title,body) VALUES(?,?,?,?,?)', [req.user.institution_id, class_id ?? null, req.user.id, title, body]);
  await audit(req, 'announcement.create', 'announcement', r.insertId);
  created(res, { id: r.insertId });
}));

router.delete('/:id', requireRole('teacher', 'inst_admin'), validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const a = await dbGet('SELECT id, author_id, institution_id FROM announcements WHERE id=?', [req.params.id]);
  if (!a || String(a.institution_id) !== String(req.user.institution_id)) throw notFound('Announcement not found');
  if (req.user.role === 'teacher' && String(a.author_id) !== String(req.user.id)) throw forbidden('You can only delete your own announcements');
  await dbRun('DELETE FROM announcements WHERE id=?', [a.id]);
  ok(res, { deleted: true });
}));

export default router;
