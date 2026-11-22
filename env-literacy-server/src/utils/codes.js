import { randomInt } from 'node:crypto';
import { dbGet } from '../config/db.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

export const randomCode = (len = 8) => Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

// Unique join code for institutions / classes.
export async function uniqueCode(table, len = 8) {
  for (let i = 0; i < 10; i++) {
    const c = randomCode(len);
    if (!(await dbGet(`SELECT 1 AS x FROM ${table} WHERE join_code=?`, [c]))) return c;
  }
  return randomCode(len + 2);
}
