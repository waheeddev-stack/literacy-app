// Uniform response envelope: { success, data, error, meta? }
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status; this.code = code; this.details = details;
  }
}
export const bad = (msg, details) => new HttpError(400, 'BAD_REQUEST', msg, details);
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found') => new HttpError(404, 'NOT_FOUND', msg);
export const conflict = (msg) => new HttpError(409, 'CONFLICT', msg);

export const ok = (res, data, meta) => res.json({ success: true, data, error: null, ...(meta ? { meta } : {}) });
export const created = (res, data) => res.status(201).json({ success: true, data, error: null });

// Express 4 doesn't catch async rejections by itself.
export const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: `No route ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, data: null, error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, data: null, error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, data: null, error: { code: 'TOO_LARGE', message: 'Request body too large' } });
  }
  console.error(err);
  res.status(500).json({ success: false, data: null, error: { code: 'INTERNAL', message: 'Something went wrong on our side' } });
}
