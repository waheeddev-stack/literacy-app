import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { dbInfo, pingDb } from './config/db.js';
import { errorHandler, notFoundHandler, ok, wrap } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import institutionRoutes from './routes/institutions.js';
import classRoutes from './routes/classes.js';
import questionRoutes from './routes/questions.js';
import quizRoutes from './routes/quizzes.js';
import practiceRoutes from './routes/practice.js';
import auditRoutes from './routes/audits.js';
import adminRoutes from './routes/admin.js';
import reportRoutes from './routes/reports.js';
import { analyticsRouter, recommendationsRouter } from './routes/analytics.js';
import { achievementsRouter, challengesRouter, learnRouter } from './routes/engage.js';
import announcementRoutes from './routes/announcements.js';
import accountRoutes from './routes/account.js';
import newsletterRoutes from './routes/newsletter.js';
import chatRoutes from './routes/chat.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render/Railway/Cloudflare
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)), credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: env.rateLimitMax, standardHeaders: true, legacyHeaders: false,
    message: { success: false, data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down a little' } } }));

  app.get('/api/v1/health', wrap(async (req, res) => {
    let db = { ok: false };
    try { db = await pingDb(); } catch (e) { db = { ok: false, error: e.message }; }
    ok(res, { server: 'ok', db: db.ok ? 'ok' : 'down', db_latency_ms: db.latency_ms ?? null, db_info: dbInfo(), time: new Date().toISOString() });
  }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false,
    message: { success: false, data: null, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again in a few minutes' } } });
  const v1 = express.Router();
  v1.use('/auth', authLimiter, authRoutes);
  v1.use('/institutions', institutionRoutes);
  v1.use('/classes', classRoutes);
  v1.use('/questions', questionRoutes);
  v1.use('/quizzes', quizRoutes);
  v1.use('/practice', practiceRoutes);
  v1.use('/audits', auditRoutes);
  v1.use('/analytics', analyticsRouter);
  v1.use('/reports', reportRoutes);
  v1.use('/recommendations', recommendationsRouter);
  v1.use('/admin', adminRoutes);
  v1.use('/challenges', challengesRouter);
  v1.use('/learn', learnRouter);
  v1.use('/achievements', achievementsRouter);
  v1.use('/announcements', announcementRoutes);
  v1.use('/account', accountRoutes);
  v1.use('/newsletter', authLimiter, newsletterRoutes);
  v1.use('/chat', chatRoutes);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
