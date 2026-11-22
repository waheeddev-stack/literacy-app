// Dashboards (FR-9, FR-10) and recommendations (FR-12).
import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { assertInstitution, isGlobal, requireRole } from '../middleware/rbac.js';
import { idSchema, validate } from '../middleware/validate.js';
import { forbidden, ok, wrap } from '../middleware/errorHandler.js';
import { classAnalytics, institutionAnalytics, recommendationsFor, regionAnalytics, studentAnalytics } from '../services/analyticsService.js';
import { loadClassFor } from './classes.js';

export const analyticsRouter = Router();
export const recommendationsRouter = Router();
analyticsRouter.use(authRequired);
recommendationsRouter.use(authRequired);

const idParam = validate({ params: z.object({ id: idSchema }) });

analyticsRouter.get('/student/me', requireRole('student'), wrap(async (req, res) => ok(res, await studentAnalytics(req.user.id))));

analyticsRouter.get('/class/:id', requireRole('teacher', 'inst_admin', 'super_admin'), idParam, wrap(async (req, res) => {
  await loadClassFor(req.user, req.params.id); // teacher: own class; admin: same institution
  ok(res, await classAnalytics(req.params.id));
}));

analyticsRouter.get('/institution/:id', requireRole('inst_admin', 'regional_admin', 'super_admin'), idParam, wrap(async (req, res) => {
  assertInstitution(req.user, req.params.id);
  ok(res, await institutionAnalytics(req.params.id, { viewerGlobal: isGlobal(req.user) }));
}));

analyticsRouter.get('/region', requireRole('regional_admin', 'super_admin'), wrap(async (req, res) => ok(res, await regionAnalytics())));

recommendationsRouter.get('/me', wrap(async (req, res) => {
  if (req.user.role !== 'student') throw forbidden('Recommendations are for students');
  const a = await studentAnalytics(req.user.id);
  ok(res, { cards: await recommendationsFor(a.topics) });
}));
