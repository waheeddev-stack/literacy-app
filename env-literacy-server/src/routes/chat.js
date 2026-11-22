// Public chatbot endpoint: keyword matching over a predefined knowledge base.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ok, wrap } from '../middleware/errorHandler.js';
import { STARTERS, answer, kbSize, topicList } from '../services/chatbot.js';

const router = Router();
router.use(rateLimit({
  windowMs: 10 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false,
  message: { success: false, data: null, error: { code: 'RATE_LIMITED', message: 'You are chatting very fast. Please wait a moment.' } },
}));

router.get('/starters', (req, res) => ok(res, { starters: STARTERS, topics: topicList(), answers_known: kbSize() }));
router.post('/', validate({ body: z.object({ message: z.string().trim().min(1).max(300) }) }), wrap(async (req, res) => ok(res, answer(req.body.message))));

export default router;
