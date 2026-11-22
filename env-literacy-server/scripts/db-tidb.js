// npm run db:tidb — creates the NEW TiDB Cloud database (TIDB_DATABASE, default env_literacy),
// applies migrations/*.tidb.sql, loads reference content, and prints a health report.
// Modelled on Jarvis 3.0's db:fix. Safe to re-run: tables are IF NOT EXISTS, content seeds only into empty tables.
import '../src/config/env.js'; // loads .env
process.env.DB_DRIVER = 'tidb';

const { tidbConfig, dbAll, dbGet, pingDb } = await import('../src/config/db.js');
const { runMigrations } = await import('../src/config/migrate.js');
const { seedReference } = await import('../seeds/reference.js');

let cfg;
try { cfg = tidbConfig(); } catch (e) {
  console.error(`\n${e.message}\nFill TIDB_HOST, TIDB_USER and TIDB_PASSWORD in env-literacy-server/.env, then run: npm run db:tidb\n`);
  process.exit(1);
}
console.log(`Connecting to ${cfg.host}:${cfg.port} as ${cfg.user} (TLS ${cfg.ssl ? 'on' : 'off'}) …`);

try {
  const ping = await pingDb(); // first query creates the database if it does not exist
  console.log(`connected, ${ping.latency_ms} ms. database "${cfg.database}" is ready`);
  const applied = await runMigrations();
  console.log(applied.length ? `migrations applied: ${applied.join(', ')}` : 'migrations: already up to date');
  await seedReference();

  const tables = (await dbAll('SHOW TABLES')).map(r => Object.values(r)[0]).sort();
  console.log(`\nHealth report: ${tables.length} tables`);
  for (const t of tables) console.log(`  ${t.padEnd(24)} ${(await dbGet(`SELECT COUNT(*) AS n FROM \`${t}\``)).n} rows`);
  console.log('\nDone. Set DB_DRIVER=tidb in .env to run the API on TiDB, then `npm start`.');
  console.log('Demo data (optional): DB_DRIVER=tidb npm run seed  (the Super Admin comes from SUPER_ADMIN_* in .env on first boot).');
  process.exit(0);
} catch (e) {
  console.error(`\nTiDB setup failed: ${e.message}`);
  console.error('Check host/user/password, that your IP is allowed in TiDB Cloud → cluster → Security, and that TLS is on.');
  process.exit(1);
}
