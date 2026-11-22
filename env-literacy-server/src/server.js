import bcrypt from 'bcryptjs';
import { env } from './config/env.js';
import { dbGet, dbInfo, dbRun } from './config/db.js';
import { runMigrations } from './config/migrate.js';
import { seedReference } from '../seeds/reference.js';
import { createApp } from './app.js';
import { startNightlyJob } from './services/gapEngine.js';

const applied = await runMigrations();
if (applied.length) console.log('migrations applied:', applied.join(', '));
await seedReference(); // topics, question bank, practice items, audit checklist, action cards (only when empty)

// First-run Super Admin from env (no public path creates one).
if (!(await dbGet("SELECT id FROM users WHERE role='super_admin' LIMIT 1"))) {
  if (env.superAdmin.email && env.superAdmin.password) {
    await dbRun('INSERT INTO users(institution_id,role,name,email,password_hash,is_active) VALUES(NULL,?,?,?,?,1)',
      ['super_admin', env.superAdmin.name, env.superAdmin.email, await bcrypt.hash(env.superAdmin.password, env.bcryptRounds)]);
    console.log(`Super Admin created: ${env.superAdmin.email}`);
  } else console.warn('No Super Admin exists. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env, or run: npm run seed');
}

createApp().listen(env.port, () => {
  console.log(`env-literacy-server on :${env.port}  db=${JSON.stringify(dbInfo())}`);
  if (env.snapshotJob) startNightlyJob();
});
