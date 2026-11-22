// Applies migrations/NNN_name.<driver>.sql in order; tracked in schema_migrations.
// Runs on every boot (idempotent) or manually: npm run migrate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dbAll, dbExec, dbRun, dbDriver } from './db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

export async function runMigrations() {
  await dbExec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(120) PRIMARY KEY)');
  const done = new Set((await dbAll('SELECT name FROM schema_migrations')).map(r => r.name));
  const files = fs.readdirSync(dir).filter(f => f.endsWith(`.${dbDriver}.sql`)).sort();
  const applied = [];
  for (const f of files) {
    if (done.has(f)) continue;
    await dbExec(fs.readFileSync(path.join(dir, f), 'utf8'));
    await dbRun('INSERT INTO schema_migrations(name) VALUES(?)', [f]);
    applied.push(f);
  }
  return applied;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const applied = await runMigrations();
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'database already up to date');
  process.exit(0);
}
