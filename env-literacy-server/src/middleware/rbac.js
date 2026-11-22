import { forbidden } from './errorHandler.js';

export const GLOBAL_ROLES = ['regional_admin', 'super_admin'];

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden(`Requires role: ${roles.join(' or ')}`));

export const isGlobal = user => GLOBAL_ROLES.includes(user.role);

// FR-2: data is limited to the user's own institution, except Regional and Super Admin.
export const sameInstitution = (user, institutionId) =>
  isGlobal(user) || (user.institution_id != null && String(user.institution_id) === String(institutionId));

export function assertInstitution(user, institutionId) {
  if (!sameInstitution(user, institutionId)) throw forbidden('This belongs to another institution');
}
