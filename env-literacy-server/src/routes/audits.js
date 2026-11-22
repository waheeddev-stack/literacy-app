// Campus sustainability audit (FR-8): checklist items scored 0–5 with optional evidence URL.
import { Router } from 'express';
import { z } from 'zod';
import { dbAll, dbGet, dbTx } from '../config/db.js';
import { audit, authRequired } from '../middleware/auth.js';
import { assertInstitution, isGlobal, requireRole } from '../middleware/rbac.js';
import { idSchema, validate } from '../middleware/validate.js';
import { bad, created, forbidden, notFound, ok, wrap } from '../middleware/errorHandler.js';
import { termLabel } from '../utils/dates.js';

const router = Router();
router.use(authRequired, requireRole('inst_admin', 'regional_admin', 'super_admin'));

router.get('/items', wrap(async (req, res) => ok(res, await dbAll('SELECT id, category, label, max_score FROM audit_items ORDER BY id'))));

router.get('/', wrap(async (req, res) => {
  if (isGlobal(req.user)) throw forbidden('Open an institution to see its audits');
  const rows = await dbAll('SELECT id, term_label, total_score, created_at FROM campus_audits WHERE institution_id=? ORDER BY term_label DESC', [req.user.institution_id]);
  ok(res, rows.map(r => ({ ...r, total_score: Number(r.total_score) })));
}));

router.post('/', requireRole('inst_admin'), validate({ body: z.object({
  term_label: z.string().regex(/^\d{4}-\d{2}-T[1-3]$/, 'Use a term like 2026-27-T2').optional(),
  scores: z.array(z.object({
    item_id: z.number().int().positive(), score: z.number().int().min(0).max(5),
    evidence_url: z.string().trim().url().max(500).regex(/^https?:\/\//i, 'Evidence must be an http(s) link').nullable().optional(),
  })).min(1).max(60),
}) }), wrap(async (req, res) => {
  const items = await dbAll('SELECT id, max_score FROM audit_items');
  const byId = new Map(items.map(i => [i.id, i]));
  const given = new Map();
  for (const s of req.body.scores) {
    const item = byId.get(s.item_id);
    if (!item) throw bad(`Unknown audit item ${s.item_id}`);
    if (s.score > item.max_score) throw bad(`Score for item ${s.item_id} exceeds ${item.max_score}`);
    if (given.has(s.item_id)) throw bad('Each item can be scored once');
    given.set(s.item_id, s);
  }
  if (items.some(i => !given.has(i.id))) throw bad('Score every checklist item (use 0 where it does not exist)');
  const maxTotal = items.reduce((a, i) => a + i.max_score, 0);
  const total = Math.round((req.body.scores.reduce((a, s) => a + s.score, 0) / maxTotal) * 10000) / 100;
  const term = req.body.term_label || termLabel();

  const id = await dbTx(async tx => {
    let a = await tx.get('SELECT id FROM campus_audits WHERE institution_id=? AND term_label=?', [req.user.institution_id, term]);
    if (a) { await tx.run('UPDATE campus_audits SET total_score=?, submitted_by=? WHERE id=?', [total, req.user.id, a.id]); await tx.run('DELETE FROM campus_audit_scores WHERE audit_id=?', [a.id]); }
    else a = { id: (await tx.run('INSERT INTO campus_audits(institution_id,term_label,submitted_by,total_score) VALUES(?,?,?,?)', [req.user.institution_id, term, req.user.id, total])).insertId };
    for (const s of req.body.scores) await tx.run('INSERT INTO campus_audit_scores(audit_id,item_id,score,evidence_url) VALUES(?,?,?,?)', [a.id, s.item_id, s.score, s.evidence_url ?? null]);
    return a.id;
  });
  await audit(req, 'audit.submit', 'campus_audit', id);
  created(res, { id, term_label: term, total_score: total });
}));

router.get('/:id', validate({ params: z.object({ id: idSchema }) }), wrap(async (req, res) => {
  const a = await dbGet('SELECT id, institution_id, term_label, total_score, created_at FROM campus_audits WHERE id=?', [req.params.id]);
  if (!a) throw notFound('Audit not found');
  assertInstitution(req.user, a.institution_id);
  const scores = await dbAll(
    `SELECT i.id AS item_id, i.category, i.label, i.max_score, s.score, s.evidence_url
       FROM campus_audit_scores s JOIN audit_items i ON i.id=s.item_id WHERE s.audit_id=? ORDER BY i.id`, [a.id]);
  ok(res, { ...a, total_score: Number(a.total_score), scores });
}));

export default router;
