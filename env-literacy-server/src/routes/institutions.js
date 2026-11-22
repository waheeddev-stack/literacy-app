import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { dbAll, dbGet, dbRun, dbTx, isDuplicateError } from '../config/db.js';
import { audit, authRequired } from '../middleware/auth.js';
import { assertInstitution, isGlobal, requireRole } from '../middleware/rbac.js';
import { idSchema, pageSchema, validate } from '../middleware/validate.js';
import { conflict, created, notFound, ok, wrap } from '../middleware/errorHandler.js';
import { uniqueCode } from '../utils/codes.js';

const router = Router();
router.use(authRequired);

const fields = {
  name: z.string().trim().min(3).max(200),
  type: z.enum(['school', 'college']),
  board_or_university: z.string().trim().max(120).nullable().optional(),
  ward_or_area: z.string().trim().max(120).nullable().optional(),
};
const canSeeCode = u => ['inst_admin', 'super_admin'].includes(u.role);

router.get('/', validate({ query: z.object({ ...pageSchema, status: z.enum(['pending', 'active', 'suspended']).optional(), type: z.enum(['school', 'college']).optional(), q: z.string().trim().max(100).optional() }) }), wrap(async (req, res) => {
  const { page, limit, status, type, q } = req.query;
  const where = []; const params = [];
  if (!isGlobal(req.user)) { where.push('i.id=?'); params.push(req.user.institution_id); }
  else if (req.user.role === 'regional_admin') where.push("i.status='active'");
  if (status) { where.push('i.status=?'); params.push(status); }
  if (type) { where.push('i.type=?'); params.push(type); }
  if (q) { where.push('i.name LIKE ?'); params.push(`%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((await dbGet(`SELECT COUNT(*) AS n FROM institutions i ${w}`, params)).n);
  const rows = await dbAll(
    `SELECT i.id, i.name, i.type, i.board_or_university, i.ward_or_area, i.join_code, i.status, i.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.institution_id=i.id AND u.role='student') AS student_count
       FROM institutions i ${w} ORDER BY i.name LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
  ok(res, rows.map(r => ({ ...r, student_count: Number(r.student_count), join_code: canSeeCode(req.user) ? r.join_code : undefined })), { page, limit, total });
}));

router.post('/', requireRole('super_admin'), validate({ body: z.object({
  ...fields,
  admin: z.object({ name: z.string().trim().min(2).max(150), email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(100) }).optional(),
}) }), wrap(async (req, res) => {
  const b = req.body;
  const join_code = await uniqueCode('institutions');
  try {
    const out = await dbTx(async tx => {
      const r = await tx.run('INSERT INTO institutions(name,type,board_or_university,ward_or_area,join_code,status) VALUES(?,?,?,?,?,?)',
        [b.name, b.type, b.board_or_university ?? null, b.ward_or_area ?? null, join_code, 'active']);
      if (b.admin) {
        await tx.run('INSERT INTO users(institution_id,role,name,email,password_hash,is_active) VALUES(?,?,?,?,?,1)',
          [r.insertId, 'inst_admin', b.admin.name, b.admin.email, await bcrypt.hash(b.admin.password, env.bcryptRounds)]);
      }
      return r.insertId;
    });
    await audit(req, 'institution.create', 'institution', out);
    created(res, { id: out, join_code, status: 'active' });
  } catch (e) {
    if (isDuplicateError(e)) throw conflict('That admin email is already registered');
    throw e;
  }
}));

router.patch('/:id', validate({ params: z.object({ id: idSchema }), body: z.object({
  name: fields.name.optional(), type: fields.type.optional(), board_or_university: fields.board_or_university, ward_or_area: fields.ward_or_area,
  status: z.enum(['pending', 'active', 'suspended']).optional(),
}).refine(o => Object.keys(o).length > 0, 'Nothing to update') }), requireRole('super_admin', 'inst_admin'), wrap(async (req, res) => {
  const { id } = req.params;
  assertInstitution(req.user, id);
  const inst = await dbGet('SELECT id FROM institutions WHERE id=?', [id]);
  if (!inst) throw notFound('Institution not found');
  const b = { ...req.body };
  if (req.user.role !== 'super_admin') { delete b.status; delete b.type; } // only the platform owner approves or retypes
  const keys = Object.keys(b);
  if (keys.length) await dbRun(`UPDATE institutions SET ${keys.map(k => `${k}=?`).join(', ')} WHERE id=?`, [...keys.map(k => b[k]), id]);
  if (b.status === 'active') await dbRun("UPDATE users SET is_active=1 WHERE institution_id=? AND role='inst_admin'", [id]); // approval activates the applicant admin
  await audit(req, 'institution.update', 'institution', id);
  ok(res, { id, updated: keys });
}));

router.get('/:id/summary', validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const { id } = req.params;
  assertInstitution(req.user, id);
  const inst = await dbGet('SELECT id, name, type, board_or_university, ward_or_area, join_code, status, created_at FROM institutions WHERE id=?', [id]);
  if (!inst) throw notFound('Institution not found');
  const c = await dbGet(
    `SELECT (SELECT COUNT(*) FROM users WHERE institution_id=? AND role='student') AS students,
            (SELECT COUNT(*) FROM users WHERE institution_id=? AND role='teacher' AND is_active=1) AS teachers,
            (SELECT COUNT(*) FROM users WHERE institution_id=? AND role='teacher' AND is_active=0) AS pending_teachers,
            (SELECT COUNT(*) FROM classes WHERE institution_id=?) AS classes,
            (SELECT COUNT(*) FROM quizzes WHERE institution_id=?) AS quizzes`, [id, id, id, id, id]);
  ok(res, { ...inst, join_code: canSeeCode(req.user) ? inst.join_code : undefined, counts: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)])) });
}));

export default router;
