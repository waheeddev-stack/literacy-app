import { Router } from 'express';
import { z } from 'zod';
import { dbAll, dbGet, dbRun, isDuplicateError } from '../config/db.js';
import { audit, authRequired } from '../middleware/auth.js';
import { assertInstitution, requireRole } from '../middleware/rbac.js';
import { idSchema, validate } from '../middleware/validate.js';
import { bad, conflict, created, forbidden, notFound, ok, wrap } from '../middleware/errorHandler.js';
import { uniqueCode } from '../utils/codes.js';
import { COLLEGE_BANDS, SCHOOL_BANDS } from './auth.js';

const router = Router();
router.use(authRequired);

const BANDS = ['6-8', '9-10', '11-12', 'undergrad', 'postgrad'];

// A teacher may only touch their own classes; an institution admin any class of their institution.
export async function loadClassFor(user, classId) {
  const cls = await dbGet('SELECT * FROM classes WHERE id=?', [classId]);
  if (!cls) throw notFound('Class not found');
  assertInstitution(user, cls.institution_id);
  if (user.role === 'teacher' && String(cls.teacher_id) !== String(user.id)) throw forbidden('This is not your class');
  return cls;
}

router.post('/', requireRole('teacher', 'inst_admin'), validate({ body: z.object({
  name: z.string().trim().min(2).max(100), grade_band: z.enum(BANDS), teacher_id: idSchema.optional(),
}) }), wrap(async (req, res) => {
  const { name, grade_band } = req.body;
  const inst = await dbGet('SELECT type FROM institutions WHERE id=?', [req.user.institution_id]);
  const allowed = inst.type === 'school' ? SCHOOL_BANDS : COLLEGE_BANDS;
  if (!allowed.includes(grade_band)) throw bad(`A ${inst.type} can only use grade bands: ${allowed.join(', ')}`);
  let teacherId = req.user.id;
  if (req.user.role === 'inst_admin') {
    if (!req.body.teacher_id) throw bad('Choose a teacher for this class');
    const t = await dbGet("SELECT id FROM users WHERE id=? AND role='teacher' AND institution_id=? AND is_active=1", [req.body.teacher_id, req.user.institution_id]);
    if (!t) throw bad('Teacher not found in your institution');
    teacherId = t.id;
  }
  const join_code = await uniqueCode('classes');
  const r = await dbRun('INSERT INTO classes(institution_id,teacher_id,name,grade_band,join_code) VALUES(?,?,?,?,?)', [req.user.institution_id, teacherId, name, grade_band, join_code]);
  await audit(req, 'class.create', 'class', r.insertId);
  created(res, { id: r.insertId, name, grade_band, join_code });
}));

router.get('/', wrap(async (req, res) => {
  const u = req.user;
  let where = 'c.institution_id=?'; const params = [u.institution_id];
  if (u.role === 'teacher') { where += ' AND c.teacher_id=?'; params.push(u.id); }
  else if (u.role === 'student') { where += ' AND c.id IN (SELECT class_id FROM class_members WHERE student_id=?)'; params.push(u.id); }
  else if (!['inst_admin'].includes(u.role)) throw forbidden();
  const rows = await dbAll(
    `SELECT c.id, c.name, c.grade_band, c.join_code, c.teacher_id, t.name AS teacher_name,
            (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id=c.id) AS student_count
       FROM classes c JOIN users t ON t.id=c.teacher_id WHERE ${where} ORDER BY c.name`, params);
  ok(res, rows.map(r => ({ ...r, student_count: Number(r.student_count), join_code: u.role === 'student' ? undefined : r.join_code })));
}));

router.post('/join', requireRole('student'), validate({ body: z.object({ class_code: z.string().trim().toUpperCase().min(4).max(12) }) }), wrap(async (req, res) => {
  const cls = await dbGet('SELECT id, name, grade_band FROM classes WHERE join_code=? AND institution_id=?', [req.body.class_code, req.user.institution_id]);
  if (!cls) throw bad('Class code not found in your institution');
  try { await dbRun('INSERT INTO class_members(class_id,student_id) VALUES(?,?)', [cls.id, req.user.id]); }
  catch (e) { if (isDuplicateError(e)) throw conflict('You are already in this class'); throw e; }
  ok(res, { id: cls.id, name: cls.name, grade_band: cls.grade_band });
}));

router.get('/:id', validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const u = req.user;
  const cls = await dbGet('SELECT c.id, c.institution_id, c.teacher_id, c.name, c.grade_band, c.join_code, t.name AS teacher_name FROM classes c JOIN users t ON t.id=c.teacher_id WHERE c.id=?', [req.params.id]);
  if (!cls) throw notFound('Class not found');
  assertInstitution(u, cls.institution_id);
  if (u.role === 'student') {
    if (!(await dbGet('SELECT 1 AS x FROM class_members WHERE class_id=? AND student_id=?', [cls.id, u.id]))) throw forbidden();
    return ok(res, { id: cls.id, name: cls.name, grade_band: cls.grade_band, teacher_name: cls.teacher_name });
  }
  if (u.role === 'teacher' && String(cls.teacher_id) !== String(u.id)) throw forbidden('This is not your class');
  if (!['teacher', 'inst_admin', 'super_admin'].includes(u.role)) throw forbidden();
  const members = await dbAll('SELECT u.id, u.name, u.email FROM class_members cm JOIN users u ON u.id=cm.student_id WHERE cm.class_id=? ORDER BY u.name', [cls.id]);
  ok(res, { ...cls, members });
}));

export default router;
