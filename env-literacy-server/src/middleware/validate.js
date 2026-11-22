import { z } from 'zod';
import { HttpError } from './errorHandler.js';

// Ids stay strings end-to-end (TiDB AUTO_RANDOM ids can exceed Number.MAX_SAFE_INTEGER).
export const idSchema = z.string().regex(/^\d{1,19}$/, 'Invalid id');
export const pageSchema = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

// validate({ body, query, params }) — parsed values replace the originals.
export const validate = (shape) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!shape[part]) continue;
    const r = shape[part].safeParse(req[part] ?? {});
    if (!r.success) {
      const issue = r.error.issues[0];
      const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return next(new HttpError(400, 'VALIDATION', `${where}${issue.message}`, r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))));
    }
    Object.defineProperty(req, part, { value: r.data, writable: true, configurable: true });
  }
  next();
};
