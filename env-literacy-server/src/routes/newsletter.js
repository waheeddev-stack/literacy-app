// Public newsletter signup for the landing page footer. Idempotent: never reveals whether an email was already subscribed.
import { Router } from 'express';
import { z } from 'zod';
import { dbGet, dbRun, isDuplicateError } from '../config/db.js';
import { validate } from '../middleware/validate.js';
import { ok, wrap } from '../middleware/errorHandler.js';

const router = Router();
router.post('/', validate({ body: z.object({ email: z.string().trim().toLowerCase().email().max(190) }) }), wrap(async (req, res) => {
  const { email } = req.body;
  if (!(await dbGet('SELECT 1 AS x FROM newsletter_subscribers WHERE email=?', [email]))) {
    try { await dbRun('INSERT INTO newsletter_subscribers(email) VALUES(?)', [email]); }
    catch (e) { if (!isDuplicateError(e)) throw e; }
  }
  ok(res, { message: 'Thank you. You are on the list.' });
}));
export default router;
