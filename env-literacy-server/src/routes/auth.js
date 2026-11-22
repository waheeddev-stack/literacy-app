import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { dbGet, dbRun, dbTx, isDuplicateError } from '../config/db.js';
import { authRequired, publicUser, signAccess, signRefresh, verifyRefresh, signReset, verifyReset, decodeUnverified } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bad, conflict, created, forbidden, HttpError, ok, wrap } from '../middleware/errorHandler.js';
import { uniqueCode } from '../utils/codes.js';
import { GLOBAL_ROLES } from '../middleware/rbac.js';

const router = Router();
export const SCHOOL_BANDS = ['6-8', '9-10', '11-12'];
export const COLLEGE_BANDS = ['undergrad', 'postgrad'];

const password = z.string().min(8, 'Password must be at least 8 characters').max(100);
const base = { name: z.string().trim().min(2).max(150), email: z.string().trim().toLowerCase().email().max(190), password };
const registerSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('student'), ...base, institution_code: z.string().trim().toUpperCase().min(4).max(12), class_code: z.string().trim().toUpperCase().min(4).max(12), guardian_consent: z.boolean().optional() }),
  z.object({ role: z.literal('teacher'), ...base, institution_code: z.string().trim().toUpperCase().min(4).max(12) }),
  z.object({ role: z.literal('inst_admin'), ...base, institution: z.object({
    name: z.string().trim().min(3).max(200), type: z.enum(['school', 'college']),
    board_or_university: z.string().trim().max(120).optional(), ward_or_area: z.string().trim().max(120).optional(),
  }) }),
]);

const hash = pw => bcrypt.hash(pw, env.bcryptRounds);
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.bcryptRounds);

async function activeInstitutionByCode(code) {
  const inst = await dbGet('SELECT id, name, type, status FROM institutions WHERE join_code=?', [code]);
  if (!inst || inst.status !== 'active') throw bad('Institution code not found or the institution is not active yet');
  return inst;
}

// FR-1 / §5.1 — students join with institution + class code; teachers wait for approval;
// institution admins sign up an institution that the Super Admin approves.
router.post('/register', validate({ body: registerSchema }), wrap(async (req, res) => {
  const b = req.body;
  if (await dbGet('SELECT 1 AS x FROM users WHERE email=?', [b.email])) throw conflict('An account with this email already exists');
  const password_hash = await hash(b.password);
  try {
    if (b.role === 'student') {
      const inst = await activeInstitutionByCode(b.institution_code);
      const cls = await dbGet('SELECT id, grade_band FROM classes WHERE join_code=? AND institution_id=?', [b.class_code, inst.id]);
      if (!cls) throw bad('Class code not found in this institution');
      // Under-18 learners (school) need a guardian consent — wording to be confirmed with legal review (DPDP Act).
      if (SCHOOL_BANDS.includes(cls.grade_band) && !b.guardian_consent) throw bad('Guardian consent is required for school students');
      const id = await dbTx(async tx => {
        const r = await tx.run('INSERT INTO users(institution_id,role,name,email,password_hash,is_active,consent_at) VALUES(?,?,?,?,?,1,?)',
          [inst.id, 'student', b.name, b.email, password_hash, b.guardian_consent ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null]);
        await tx.run('INSERT INTO class_members(class_id,student_id) VALUES(?,?)', [cls.id, r.insertId]);
        return r.insertId;
      });
      return created(res, { id, status: 'active', message: 'Account created. You can log in now.' });
    }
    if (b.role === 'teacher') {
      const inst = await activeInstitutionByCode(b.institution_code);
      const r = await dbTx(tx => tx.run('INSERT INTO users(institution_id,role,name,email,password_hash,is_active) VALUES(?,?,?,?,?,0)', [inst.id, 'teacher', b.name, b.email, password_hash]));
      return created(res, { id: r.insertId, status: 'pending', message: 'Request sent. Your institution admin must approve your account before you can log in.' });
    }
    const join_code = await uniqueCode('institutions');
    const id = await dbTx(async tx => {
      const inst = await tx.run('INSERT INTO institutions(name,type,board_or_university,ward_or_area,join_code,status) VALUES(?,?,?,?,?,?)',
        [b.institution.name, b.institution.type, b.institution.board_or_university ?? null, b.institution.ward_or_area ?? null, join_code, 'pending']);
      const u = await tx.run('INSERT INTO users(institution_id,role,name,email,password_hash,is_active) VALUES(?,?,?,?,?,0)', [inst.insertId, 'inst_admin', b.name, b.email, password_hash]);
      return u.insertId;
    });
    return created(res, { id, status: 'pending', message: 'Institution submitted. You can log in once the platform team approves it.' });
  } catch (e) {
    if (isDuplicateError(e)) throw conflict('An account with this email already exists');
    throw e;
  }
}));

router.post('/login', validate({ body: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) }) }), wrap(async (req, res) => {
  const { email, password: pw } = req.body;
  const user = await dbGet('SELECT * FROM users WHERE email=?', [email]);
  const match = await bcrypt.compare(pw, user ? user.password_hash : DUMMY_HASH);
  if (!user || !match) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  if (!user.is_active) {
    const waiting = ['teacher', 'inst_admin'].includes(user.role);
    throw forbidden(waiting ? 'Your account is waiting for approval' : 'This account has been deactivated');
  }
  if (!GLOBAL_ROLES.includes(user.role) && user.institution_id != null) {
    const inst = await dbGet('SELECT status FROM institutions WHERE id=?', [user.institution_id]);
    if (inst?.status === 'suspended') throw forbidden('Your institution is suspended. Contact the platform team.');
  }
  ok(res, { access_token: signAccess(user), refresh_token: signRefresh(user), user: publicUser(user) });
}));

router.post('/refresh', validate({ body: z.object({ refresh_token: z.string().min(10) }) }), wrap(async (req, res) => {
  let p;
  try { p = verifyRefresh(req.body.refresh_token); } catch { throw new HttpError(401, 'UNAUTHENTICATED', 'Session expired, please log in again'); }
  const user = await dbGet('SELECT * FROM users WHERE id=?', [p.uid]);
  if (!user || !user.is_active) throw new HttpError(401, 'UNAUTHENTICATED', 'Account not available');
  ok(res, { access_token: signAccess(user), refresh_token: signRefresh(user), user: publicUser(user) });
}));

// No email service in v1: in development the reset token is returned (and logged); in production it is only logged.
router.post('/forgot', validate({ body: z.object({ email: z.string().trim().toLowerCase().email() }) }), wrap(async (req, res) => {
  const user = await dbGet('SELECT * FROM users WHERE email=? AND is_active=1', [req.body.email]);
  const out = { message: 'If that email is registered, a reset link has been prepared.' };
  if (user) {
    const token = signReset(user);
    console.log(`[password reset] ${user.email}: ${token}`);
    if (!env.isProd) out.reset_token = token;
  }
  ok(res, out);
}));

router.post('/reset', validate({ body: z.object({ token: z.string().min(10), password }) }), wrap(async (req, res) => {
  const claims = decodeUnverified(req.body.token);
  const user = claims?.uid ? await dbGet('SELECT * FROM users WHERE id=?', [claims.uid]) : null;
  try { if (!user) throw new Error('no user'); verifyReset(req.body.token, user); }
  catch { throw bad('This reset link is invalid or has expired'); }
  await dbRun('UPDATE users SET password_hash=? WHERE id=?', [await hash(req.body.password), user.id]);
  ok(res, { message: 'Password updated. You can log in now.' });
}));

router.get('/me', authRequired, wrap(async (req, res) => {
  const u = req.user;
  const inst = u.institution_id != null ? await dbGet('SELECT id, name, type, ward_or_area, status FROM institutions WHERE id=?', [u.institution_id]) : null;
  ok(res, { ...publicUser(u), institution: inst });
}));

export default router;
