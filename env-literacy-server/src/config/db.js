// Dual-driver database layer (same idea as Jarvis 3.0):
//   DB_DRIVER=sqlite -> local file via node:sqlite (dev, zero setup)
//   DB_DRIVER=tidb   -> TiDB Cloud via mysql2 pool (TLS required)
// App SQL is written to run unchanged on both: `?` placeholders, no dialect-specific functions.
//
//   dbGet(sql, params)  -> row | undefined
//   dbAll(sql, params)  -> rows[]
//   dbRun(sql, params)  -> { changes, insertId }
//   dbTx(async tx => …) -> atomic; tx has the same get/all/run
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = String(process.env.DB_DRIVER || (process.env.TIDB_HOST ? 'tidb' : 'sqlite')).toLowerCase();
export const dbDriver = raw === 'mysql' ? 'tidb' : raw;
export const isTidb = dbDriver === 'tidb';
if (!['sqlite', 'tidb'].includes(dbDriver)) throw new Error(`Bad DB_DRIVER=${raw} — use "sqlite" or "tidb".`);

// ---------------------------------------------------------------- sqlite ---
let sqlite = null;
if (!isTidb) {
  const file = path.resolve(path.join(__dirname, '..', '..'), process.env.DB_FILE || './data/env.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
}
const sqlArgs = params => params.map(p => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

let txChain = Promise.resolve(); // serialises sqlite transactions (single connection)

// ------------------------------------------------------------------ tidb ---
let pool = null;
export function tidbConfig() {
  const { TIDB_HOST: host, TIDB_USER: user, TIDB_PASSWORD: password } = process.env;
  const missing = [['TIDB_HOST', host], ['TIDB_USER', user], ['TIDB_PASSWORD', password]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`TiDB credentials incomplete — missing ${missing.join(', ')} (TiDB Cloud → cluster → Connect).`);
  const ssl = !['false', '0', 'no'].includes(String(process.env.TIDB_SSL ?? 'true').toLowerCase());
  return { host, port: Number(process.env.TIDB_PORT || 4000), user, password, database: process.env.TIDB_DATABASE || 'env_literacy', ssl };
}

async function getPool() {
  if (pool) return pool;
  const mysql = await import('mysql2/promise');
  const { database, ssl, ...rest } = tidbConfig();
  const sslOpt = ssl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined;
  const admin = await mysql.createConnection({ ...rest, ssl: sslOpt, connectTimeout: 10000 });
  try { await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '')}\` DEFAULT CHARACTER SET utf8mb4`); }
  finally { await admin.end(); }
  pool = mysql.createPool({
    ...rest, database, ssl: sslOpt,
    waitForConnections: true, connectionLimit: 8, connectTimeout: 10000,
    dateStrings: true, decimalNumbers: true,
    supportBigNumbers: true, bigNumberStrings: false, // AUTO_RANDOM ids can exceed 2^53 -> returned as strings only when needed
    timezone: 'Z',
  });
  pool.on('connection', c => c.query("SET time_zone='+00:00'"));
  return pool;
}

// ------------------------------------------------------------- primitives ---
const sqliteRun = (sql, params) => {
  const r = sqlite.prepare(sql).run(...sqlArgs(params));
  return { changes: Number(r.changes ?? 0), insertId: r.lastInsertRowid != null ? Number(r.lastInsertRowid) : null };
};
const mysqlRun = async (conn, sql, params) => {
  const [res] = await conn.query(sql, params);
  return { changes: Number(res?.affectedRows ?? 0), insertId: res?.insertId ?? null };
};

export async function dbGet(sql, params = []) {
  if (!isTidb) return sqlite.prepare(sql).get(...sqlArgs(params));
  const [rows] = await (await getPool()).query(sql, params);
  return rows[0];
}
export async function dbAll(sql, params = []) {
  if (!isTidb) return sqlite.prepare(sql).all(...sqlArgs(params));
  const [rows] = await (await getPool()).query(sql, params);
  return rows;
}
export async function dbRun(sql, params = []) {
  if (!isTidb) return sqliteRun(sql, params);
  return mysqlRun(await getPool(), sql, params);
}
export async function dbExec(script) {
  if (!isTidb) { sqlite.exec(script); return; }
  const p = await getPool();
  for (const s of String(script).split(';')) if (s.trim()) await p.query(s);
}

export async function dbTx(fn) {
  if (!isTidb) {
    const prev = txChain;
    let release;
    txChain = new Promise(r => (release = r));
    await prev;
    try {
      sqlite.exec('BEGIN IMMEDIATE');
      const tx = {
        get: async (s, p = []) => sqlite.prepare(s).get(...sqlArgs(p)),
        all: async (s, p = []) => sqlite.prepare(s).all(...sqlArgs(p)),
        run: async (s, p = []) => sqliteRun(s, p),
      };
      const out = await fn(tx);
      sqlite.exec('COMMIT');
      return out;
    } catch (e) {
      try { sqlite.exec('ROLLBACK'); } catch { /* already closed */ }
      throw e;
    } finally { release(); }
  }
  const conn = await (await getPool()).getConnection();
  try {
    await conn.beginTransaction();
    const tx = {
      get: async (s, p = []) => (await conn.query(s, p))[0][0],
      all: async (s, p = []) => (await conn.query(s, p))[0],
      run: (s, p = []) => mysqlRun(conn, s, p),
    };
    const out = await fn(tx);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}

export const placeholders = arr => arr.map(() => '?').join(',');
export const isDuplicateError = e => /UNIQUE constraint|Duplicate entry|ER_DUP_ENTRY/i.test(String(e?.message || '')) || e?.code === 'ER_DUP_ENTRY';

export async function pingDb() {
  const t = Date.now();
  await dbGet('SELECT 1 AS ok');
  return { ok: true, latency_ms: Date.now() - t };
}

export function dbInfo() {
  if (!isTidb) return { driver: 'sqlite', file: process.env.DB_FILE || './data/env.db' };
  try { const c = tidbConfig(); return { driver: 'tidb', host: c.host, port: c.port, database: c.database, ssl: c.ssl }; }
  catch (e) { return { driver: 'tidb', configured: false, error: e.message }; }
}

export async function getSetting(key) {
  return (await dbGet('SELECT svalue FROM app_settings WHERE skey=?', [key]))?.svalue ?? null;
}
export async function setSetting(key, value) {
  const r = await dbRun('UPDATE app_settings SET svalue=? WHERE skey=?', [String(value), key]);
  if (!r.changes) await dbRun('INSERT INTO app_settings(skey,svalue) VALUES(?,?)', [key, String(value)]);
}
