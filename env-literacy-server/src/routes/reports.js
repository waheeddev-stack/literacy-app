// CSV / PDF export (FR-11). Institution reports contain aggregates only.
import { Router } from 'express';
import { z } from 'zod';
import { authRequired, audit } from '../middleware/auth.js';
import { assertInstitution, isGlobal, requireRole } from '../middleware/rbac.js';
import { idSchema, validate } from '../middleware/validate.js';
import { wrap } from '../middleware/errorHandler.js';
import { classReport, institutionReport, reportToCsv, reportToPdf } from '../services/reportService.js';
import { loadClassFor } from './classes.js';

const router = Router();
router.use(authRequired);
const q = validate({ params: z.object({ id: idSchema }), query: z.object({ format: z.enum(['csv', 'pdf']).default('csv') }) });

function send(res, report, format, name) {
  const safe = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}.pdf"`);
    return reportToPdf(report, res);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}.csv"`);
  res.send('﻿' + reportToCsv(report));
}

router.get('/institution/:id', requireRole('inst_admin', 'regional_admin', 'super_admin'), q, wrap(async (req, res) => {
  assertInstitution(req.user, req.params.id);
  const report = await institutionReport(req.params.id, isGlobal(req.user));
  await audit(req, `report.institution.${req.query.format}`, 'institution', req.params.id);
  send(res, report, req.query.format, report.title);
}));

router.get('/class/:id', requireRole('teacher', 'inst_admin'), q, wrap(async (req, res) => {
  await loadClassFor(req.user, req.params.id);
  const report = await classReport(req.params.id);
  await audit(req, `report.class.${req.query.format}`, 'class', req.params.id);
  send(res, report, req.query.format, report.title);
}));

export default router;
