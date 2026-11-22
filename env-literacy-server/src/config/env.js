import 'dotenv/config';

const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const bool = (v, d) => (v === undefined || v === '' ? d : !['false', '0', 'no'].includes(String(v).toLowerCase()));

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 4100),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5174').split(',').map(s => s.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-only-refresh-secret',
  accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),
  superAdmin: {
    name: process.env.SUPER_ADMIN_NAME || 'Platform Owner',
    email: (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase(),
    password: process.env.SUPER_ADMIN_PASSWORD || '',
  },
  minGroupSize: num(process.env.MIN_GROUP_SIZE, 5),
  snapshotJob: bool(process.env.SNAPSHOT_JOB, true),
  rateLimitMax: num(process.env.RATE_LIMIT_MAX, 600),
};
env.isProd = env.nodeEnv === 'production';

if (env.isProd && /dev-only|change-me/.test(env.jwtSecret + env.jwtRefreshSecret)) {
  throw new Error('Set strong JWT_SECRET and JWT_REFRESH_SECRET before running in production.');
}
