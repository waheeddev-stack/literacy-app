import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { dbGet, dbRun } from '../config/db.js';
import { HttpError } from './errorHandler.js';

export const signAccess = u => jwt.sign({ uid: String(u.id), role: u.role, typ: 'access' }, env.jwtSecret, { expiresIn: env.accessTtl });
export const signRefresh = u => jwt.sign({ uid: String(u.id), typ: 'refresh' }, env.jwtRefreshSecret, { expiresIn: env.refreshTtl });
export const verifyRefresh = t => {
  const p = jwt.verify(t, env.jwtRefreshSecret);
  if (p.typ !== 'refresh') throw new Error('wrong token type');
  return p;
};
// Single-use reset token: signed with the current password hash, so it dies once the password changes.
export const signReset = u => jwt.sign({ uid: String(u.id), typ: 'reset' }, env.jwtSecret + u.password_hash, { expiresIn: '1h' });
export const verifyReset = (token, user) => {
  const p = jwt.verify(token, env.jwtSecret + user.password_hash);
  if (p.typ !== 'reset') throw new Error('wrong token type');
  return p;
};
export const decodeUnverified = t => jwt.decode(t);

export const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, institution_id: u.institution_id ?? null });

export async function authRequired(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!tok) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in');
    let payload;
    try { payload = jwt.verify(tok, env.jwtSecret); } catch { throw new HttpError(401, 'TOKEN_EXPIRED', 'Session expired, please log in again'); }
    if (payload.typ !== 'access') throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid token');
    const user = await dbGet('SELECT id, institution_id, role, name, email, is_active FROM users WHERE id=?', [payload.uid]);
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Account not found');
    if (!user.is_active) throw new HttpError(403, 'INACTIVE', 'Account is not active');
    req.user = user;
    next();
  } catch (e) { next(e); }
}

export async function audit(req, action, entity, entityId) {
  try {
    await dbRun('INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES(?,?,?,?)', [req?.user?.id ?? null, action, entity, entityId ?? null]);
  } catch { /* auditing must never break the request */ }
}
