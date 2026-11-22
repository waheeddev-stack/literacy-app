// Users, platform settings and the audit log (FR-13).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { dbAll, dbGet, dbRun, isDuplicateError, setSetting } from '../config/db.js';
import { audit, authRequired } from '../middleware/auth.js';
import { assertInstitution, requireRole } from '../middleware/rbac.js';
import { idSchema, pageSchema, validate } from '../middleware/validate.js';
import { bad, conflict, created, forbidden, notFound, ok, wrap } from '../middleware/errorHandler.js';
import { clearWeightCache, getWeights } from '../services/gapEngine.js';

const router = Router();
router.use(authRequired);
const ROLES = ['student', 'teacher', 'inst_admin', 'regional_admin', 'super_admin'];

// ------------------------------------------------------------------ users ---
router.get('/users', requireRole('inst_admin', 'super_admin'), validate({ query: z.object({
  ...pageSchema, role: z.enum(ROLES).optional(), pending: z.enum(['true', 'false']).optional(), q: z.string().trim().max(100).optional(), institution_id: idSchema.optional(),
}) }), wrap(async (req, res) => {
  const { page, limit, role, pending, q, institution_id } = req.query;
  const where = []; const params = [];
  if (req.user.role === 'inst_admin') { where.push('u.institution_id=?'); params.push(req.user.institution_id); }
  else if (institution_id) { where.push('u.institution_id=?'); params.push(institution_id); }
  if (role) { where.push('u.role=?'); params.push(role); }
  if (pending === 'true') where.push('u.is_active=0');
  if (q) { where.push('(u.name LIKE ? OR u.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((await dbGet(`SELECT COUNT(*) AS n FROM users u ${w}`, params)).n);
  const rows = await dbAll(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.institution_id, u.created_at, i.name AS institution_name
       FROM users u LEFT JOIN institutions i ON i.id=u.institution_id ${w} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
  ok(res, rows.map(r => ({ ...r, is_active: !!r.is_active })), { page, limit, total });
}));

router.post('/users', requireRole('inst_admin', 'super_admin'), validate({ body: z.object({
  name: z.string().trim().min(2).max(150), email: z.string().trim().toLowerCase().email().max(190), password: z.string().min(8).max(100),
  role: z.enum(['teacher', 'inst_admin', 'regional_admin', 'super_admin']), institution_id: idSchema.optional(),
}) }), wrap(async (req, res) => {
  const b = req.body;
  let institutionId = null;
  if (req.user.role === 'inst_admin') {
    if (b.role !== 'teacher') throw forbidden('Institution admins can only add teachers');
    institutionId = req.user.institution_id;
  } else if (['teacher', 'inst_admin'].includes(b.role)) {
    if (!b.institution_id) throw bad('institution_id is required for this role');
    if (!(await dbGet('SELECT 1 AS x FROM institutions WHERE id=?', [b.institution_id]))) throw notFound('Institution not found');
    institutionId = b.institution_id;
  }
  try {
    const r = await dbRun('INSERT INTO users(institution_id,role,name,email,password_hash,is_active) VALUES(?,?,?,?,?,1)',
      [institutionId, b.role, b.name, b.email, await bcrypt.hash(b.password, env.bcryptRounds)]);
    await audit(req, 'user.create', 'user', r.insertId);
    created(res, { id: r.insertId });
  } catch (e) { if (isDuplicateError(e)) throw conflict('Email already registered'); throw e; }
}));

// Approve a pending teacher, deactivate or reactivate an account.
router.patch('/users/:id', requireRole('inst_admin', 'super_admin'), validate({
  params: z.object({ id: idSchema }), body: z.object({ is_active: z.boolean().optional(), name: z.string().trim().min(2).max(150).optional() }).refine(o => Object.keys(o).length > 0, 'Nothing to update'),
}), wrap(async (req, res) => {
  const target = await dbGet('SELECT id, role, institution_id FROM users WHERE id=?', [req.params.id]);
  if (!target) throw notFound('User not found');
  if (req.user.role === 'inst_admin') {
    assertInstitution(req.user, target.institution_id);
    if (!['teacher', 'student'].includes(target.role)) throw forbidden('You can only manage teachers and students');
  }
  if (String(target.id) === String(req.user.id) && req.body.is_active === false) throw bad('You cannot deactivate your own account');
  const sets = []; const params = [];
  if (req.body.is_active !== undefined) { sets.push('is_active=?'); params.push(req.body.is_active); }
  if (req.body.name) { sets.push('name=?'); params.push(req.body.name); }
  await dbRun(`UPDATE users SET ${sets.join(', ')} WHERE id=?`, [...params, target.id]);
  await audit(req, req.body.is_active === false ? 'user.deactivate' : req.body.is_active ? 'user.activate' : 'user.update', 'user', target.id);
  ok(res, { id: target.id, updated: true });
}));

// --------------------------------------------------------------- settings ---
router.get('/settings', wrap(async (req, res) => {
  const w = await getWeights();
  ok(res, { weight_knowledge: w.wK, weight_practice: w.wP, min_group_size: env.minGroupSize });
}));

router.put('/settings', requireRole('super_admin'), validate({ body: z.object({
  weight_knowledge: z.number().min(0).max(1), weight_practice: z.number().min(0).max(1),
}).refine(o => Math.abs(o.weight_knowledge + o.weight_practice - 1) < 0.001, 'Weights must add up to 1') }), wrap(async (req, res) => {
  await setSetting('weight_knowledge', req.body.weight_knowledge);
  await setSetting('weight_practice', req.body.weight_practice);
  clearWeightCache();
  await audit(req, 'settings.weights', 'settings', null);
  ok(res, { weight_knowledge: req.body.weight_knowledge, weight_practice: req.body.weight_practice, note: 'Applies to new calculations; snapshots refresh nightly.' });
}));

// -------------------------------------------------------------- audit log ---
router.get('/audit-logs', requireRole('super_admin'), validate({ query: z.object({ ...pageSchema, action: z.string().max(80).optional() }) }), wrap(async (req, res) => {
  const { page, limit, action } = req.query;
  const w = action ? 'WHERE l.action=?' : ''; const p = action ? [action] : [];
  const total = Number((await dbGet(`SELECT COUNT(*) AS n FROM audit_logs l ${w}`, p)).n);
  const rows = await dbAll(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.created_at, u.name AS user_name, u.role AS user_role
       FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id ${w} ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`, [...p, limit, (page - 1) * limit]);
  ok(res, rows, { page, limit, total });
}));

export default router;
