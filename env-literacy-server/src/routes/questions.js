// Question bank (FR-3): list, create, edit, CSV import. Read for staff; write for platform content owners.
import { Router } from 'express';
import { z } from 'zod';
import { dbAll, dbGet, dbTx, placeholders } from '../config/db.js';
import { audit, authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { idSchema, pageSchema, validate } from '../middleware/validate.js';
import { bad, created, notFound, ok, wrap } from '../middleware/errorHandler.js';
import { getTopics } from '../services/scoring.js';
import { parseCsv } from '../utils/csv.js';

const router = Router();
router.use(authRequired);
const BANDS = ['6-8', '9-10', '11-12', 'undergrad', 'postgrad'];
const WRITERS = ['super_admin', 'regional_admin'];

const optionSchema = z.object({ id: idSchema.optional(), text: z.string().trim().min(1).max(500), is_correct: z.boolean() });
const optionsRule = opts => opts.length >= 2 && opts.length <= 6 && opts.filter(o => o.is_correct).length === 1;
const OPTIONS_MSG = 'Provide 2–6 options with exactly one correct answer';
const questionFields = {
  topic_id: z.number().int().positive().optional(), topic: z.string().trim().max(100).optional(),
  grade_band: z.enum(BANDS), difficulty: z.number().int().min(1).max(5),
  text: z.string().trim().min(5).max(2000), explanation: z.string().trim().max(2000).nullable().optional(),
};

async function resolveTopic(b) {
  const topics = await getTopics();
  const key = String(b.topic ?? '').trim().toLowerCase();
  const t = b.topic_id ? topics.find(x => x.id === b.topic_id) : topics.find(x => x.slug === key || x.name.toLowerCase() === key);
  if (!t) throw bad(`Unknown topic "${b.topic ?? b.topic_id}". Use one of: ${topics.map(x => x.slug).join(', ')}`);
  return t;
}

async function withOptions(rows) {
  if (!rows.length) return [];
  const opts = await dbAll(`SELECT id, question_id, text, is_correct FROM question_options WHERE question_id IN (${placeholders(rows)}) ORDER BY id`, rows.map(r => r.id));
  const by = new Map();
  for (const o of opts) { const k = String(o.question_id); (by.get(k) || by.set(k, []).get(k)).push({ id: o.id, text: o.text, is_correct: !!o.is_correct }); }
  // Item statistics (PRD risk: question quality): % correct once enough students answered.
  return rows.map(r => {
    const answers = Number(r.answers || 0), pct = answers >= 5 ? Math.round((Number(r.correct) / answers) * 100) : null;
    const flag = pct == null ? null : pct >= 95 ? 'too_easy' : pct <= 20 ? 'too_hard' : null;
    return { ...r, answers, correct: undefined, pct_correct: pct, flag, is_active: !!r.is_active, options: by.get(String(r.id)) || [] };
  });
}

router.get('/', requireRole('teacher', 'inst_admin', 'regional_admin', 'super_admin'), validate({ query: z.object({
  ...pageSchema, topic: z.string().max(60).optional(), grade_band: z.enum(BANDS).optional(), q: z.string().trim().max(100).optional(), active: z.enum(['true', 'false']).optional(),
}) }), wrap(async (req, res) => {
  const { page, limit, topic, grade_band, q, active } = req.query;
  const where = []; const params = [];
  if (topic) { where.push('t.slug=?'); params.push(topic); }
  if (grade_band) { where.push('q.grade_band=?'); params.push(grade_band); }
  if (q) { where.push('q.text LIKE ?'); params.push(`%${q}%`); }
  if (active) { where.push('q.is_active=?'); params.push(active === 'true'); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((await dbGet(`SELECT COUNT(*) AS n FROM questions q JOIN topics t ON t.id=q.topic_id ${w}`, params)).n);
  const rows = await dbAll(
    `SELECT q.id, q.topic_id, t.slug AS topic_slug, t.name AS topic_name, q.grade_band, q.difficulty, q.text, q.explanation, q.is_active,
            (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.question_id=q.id) AS answers,
            (SELECT COALESCE(SUM(aa.is_correct), 0) FROM attempt_answers aa WHERE aa.question_id=q.id) AS correct
       FROM questions q JOIN topics t ON t.id=q.topic_id ${w} ORDER BY q.id DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
  ok(res, await withOptions(rows), { page, limit, total });
}));

router.get('/topics', wrap(async (req, res) => ok(res, await getTopics())));

async function insertQuestion(tx, topicId, b) {
  const r = await tx.run('INSERT INTO questions(topic_id,grade_band,difficulty,text,explanation,is_active) VALUES(?,?,?,?,?,1)', [topicId, b.grade_band, b.difficulty, b.text, b.explanation ?? null]);
  for (const o of b.options) await tx.run('INSERT INTO question_options(question_id,text,is_correct) VALUES(?,?,?)', [r.insertId, o.text, o.is_correct]);
  return r.insertId;
}

router.post('/', requireRole(...WRITERS), validate({ body: z.object({ ...questionFields, options: z.array(optionSchema).refine(optionsRule, OPTIONS_MSG) }) }), wrap(async (req, res) => {
  const topic = await resolveTopic(req.body);
  const id = await dbTx(tx => insertQuestion(tx, topic.id, req.body));
  await audit(req, 'question.create', 'question', id);
  created(res, { id });
}));

// CSV columns: topic, grade_band, difficulty, text, explanation, option_a..option_f, correct (A-F)
router.post('/import', requireRole(...WRITERS), validate({ body: z.object({ csv: z.string().min(10).max(1_500_000) }) }), wrap(async (req, res) => {
  const rows = parseCsv(req.body.csv);
  if (rows.length < 2) throw bad('The CSV needs a header row and at least one question');
  if (rows.length > 2001) throw bad('Import at most 2000 questions at a time');
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  for (const need of ['topic', 'grade_band', 'difficulty', 'text', 'option_a', 'option_b', 'correct']) {
    if (!head.includes(need)) throw bad(`Missing column "${need}"`);
  }
  const col = (r, name) => (r[head.indexOf(name)] ?? '').trim();
  const valid = []; const errors = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    try {
      const topic = await resolveTopic({ topic: col(r, 'topic') });
      const options = ['a', 'b', 'c', 'd', 'e', 'f'].map(l => ({ l, text: head.includes(`option_${l}`) ? col(r, `option_${l}`) : '' })).filter(o => o.text);
      const correct = col(r, 'correct').toUpperCase();
      const parsed = z.object({ grade_band: z.enum(BANDS), difficulty: z.coerce.number().int().min(1).max(5), text: z.string().min(5).max(2000) })
        .parse({ grade_band: col(r, 'grade_band'), difficulty: col(r, 'difficulty'), text: col(r, 'text') });
      const opts = options.map(o => ({ text: o.text.slice(0, 500), is_correct: o.l.toUpperCase() === correct }));
      if (!optionsRule(opts)) throw new Error(`${OPTIONS_MSG} (check the "correct" letter)`);
      valid.push({ topicId: topic.id, b: { ...parsed, explanation: col(r, 'explanation') || null, options: opts } });
    } catch (e) {
      errors.push({ row: i + 1, message: e.issues ? `${e.issues[0].path.join('.')}: ${e.issues[0].message}` : e.message });
    }
  }
  if (valid.length) await dbTx(async tx => { for (const v of valid) await insertQuestion(tx, v.topicId, v.b); });
  await audit(req, 'question.import', 'question', null);
  ok(res, { imported: valid.length, skipped: errors.length, errors: errors.slice(0, 50) });
}));

router.patch('/:id', requireRole(...WRITERS), validate({
  params: z.object({ id: idSchema }),
  body: z.object({ ...questionFields, is_active: z.boolean().optional(), options: z.array(optionSchema).refine(optionsRule, OPTIONS_MSG) }).partial(),
}), wrap(async (req, res) => {
  const q = await dbGet('SELECT id FROM questions WHERE id=?', [req.params.id]);
  if (!q) throw notFound('Question not found');
  const b = req.body;
  const topic = b.topic || b.topic_id ? await resolveTopic(b) : null;
  await dbTx(async tx => {
    const sets = []; const params = [];
    const set = (c, v) => { sets.push(`${c}=?`); params.push(v); };
    if (topic) set('topic_id', topic.id);
    for (const c of ['grade_band', 'difficulty', 'text', 'explanation', 'is_active']) if (b[c] !== undefined) set(c, b[c]);
    if (sets.length) await tx.run(`UPDATE questions SET ${sets.join(', ')} WHERE id=?`, [...params, q.id]);
    if (b.options) {
      // Update in place (keeps option ids that past attempts reference); delete removed; insert new.
      const existing = (await tx.all('SELECT id FROM question_options WHERE question_id=?', [q.id])).map(o => String(o.id));
      const keep = new Set(b.options.filter(o => o.id && existing.includes(String(o.id))).map(o => String(o.id)));
      for (const id of existing) if (!keep.has(id)) await tx.run('DELETE FROM question_options WHERE id=?', [id]);
      for (const o of b.options) {
        if (o.id && keep.has(String(o.id))) await tx.run('UPDATE question_options SET text=?, is_correct=? WHERE id=?', [o.text, o.is_correct, o.id]);
        else await tx.run('INSERT INTO question_options(question_id,text,is_correct) VALUES(?,?,?)', [q.id, o.text, o.is_correct]);
      }
    }
  });
  await audit(req, 'question.update', 'question', q.id);
  ok(res, { id: q.id, updated: true });
}));

export default router;
