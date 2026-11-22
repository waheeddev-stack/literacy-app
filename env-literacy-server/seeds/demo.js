// Demo data: npm run seed. Safe to re-run (skips if demo institutions exist).
// All demo logins use the password below. Never use in production.
import '../src/config/env.js'; // load .env before the DB layer picks its driver
import bcrypt from 'bcryptjs';
import { dbAll, dbGet, dbRun, dbTx, placeholders } from '../src/config/db.js';
import { runMigrations } from '../src/config/migrate.js';
import { seedReference } from './reference.js';
import { recomputeAll } from '../src/services/gapEngine.js';
import { addDays, isoDate, prevTerm, termLabel, weekStart } from '../src/utils/dates.js';
import { uniqueCode } from '../src/utils/codes.js';

export const DEMO_PASSWORD = 'Demo@1234';
let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

await runMigrations();
await seedReference();
const hash = await bcrypt.hash(DEMO_PASSWORD, 8);

async function user(inst, role, name, email) {
  const ex = await dbGet('SELECT id FROM users WHERE email=?', [email]);
  if (ex) return ex.id;
  return (await dbRun('INSERT INTO users(institution_id,role,name,email,password_hash,is_active,consent_at) VALUES(?,?,?,?,?,1,?)',
    [inst, role, name, email, hash, role === 'student' ? '2026-06-20 10:00:00' : null])).insertId;
}

await user(null, 'super_admin', 'Platform Owner', 'admin@envliteracy.local');
await user(null, 'regional_admin', 'MBMC Education Officer', 'regional@envliteracy.local');

const INSTS = [
  { name: 'Bhayandar Vidya Mandir', type: 'school', board: 'Maharashtra State Board', area: 'Bhayandar West', slug: 'bvm', k: 0.78, p: 0.62, classes: [['Grade 8 A', '6-8'], ['Grade 10 B', '9-10']] },
  { name: 'Mira Road Public School', type: 'school', board: 'CBSE', area: 'Mira Road East', slug: 'mrps', k: 0.62, p: 0.7, classes: [['Grade 7 A', '6-8'], ['Grade 11 Science', '11-12']] },
  { name: 'Mira-Bhayandar Arts & Science College', type: 'college', board: 'University of Mumbai', area: 'Bhayandar East', slug: 'mbasc', k: 0.8, p: 0.45, classes: [['FY BSc', 'undergrad'], ['MSc Env. Science', 'postgrad']] },
];
const FIRST = ['Aarav', 'Diya', 'Kabir', 'Ananya', 'Rohan', 'Isha', 'Vivaan', 'Meera', 'Arjun', 'Saanvi', 'Neel', 'Kavya', 'Yash', 'Riya', 'Dev', 'Tara', 'Om', 'Nisha', 'Aditya', 'Pooja', 'Karan', 'Sneha', 'Harsh', 'Jiya'];

const terms = [termLabel()]; terms.unshift(prevTerm(terms[0])); terms.unshift(prevTerm(terms[0]));
const items = await dbAll('SELECT id, scale FROM practice_items');
const auditItems = await dbAll('SELECT id FROM audit_items');
const cur = termLabel();

for (const spec of INSTS) {
  if (await dbGet('SELECT id FROM institutions WHERE name=?', [spec.name])) { console.log('exists:', spec.name); continue; }
  const inst = (await dbRun('INSERT INTO institutions(name,type,board_or_university,ward_or_area,join_code,status) VALUES(?,?,?,?,?,?)',
    [spec.name, spec.type, spec.board, spec.area, await uniqueCode('institutions'), 'active'])).insertId;
  const admin = await user(inst, 'inst_admin', `${spec.slug.toUpperCase()} Coordinator`, `admin.${spec.slug}@envliteracy.local`);

  let n = 0;
  for (let ci = 0; ci < spec.classes.length; ci++) {
    const [cname, band] = spec.classes[ci];
    const teacher = await user(inst, 'teacher', `${cname.split(' ')[0]} Teacher ${spec.slug}`, `teacher${ci + 1}.${spec.slug}@envliteracy.local`);
    const cls = (await dbRun('INSERT INTO classes(institution_id,teacher_id,name,grade_band,join_code) VALUES(?,?,?,?,?)', [inst, teacher, cname, band, await uniqueCode('classes')])).insertId;
    const quiz = (await dbRun('INSERT INTO quizzes(institution_id,class_id,created_by,title,type,opens_at,closes_at) VALUES(?,?,?,?,?,?,NULL)',
      [inst, cls, teacher, `Baseline - ${cname}`, 'baseline', '2026-06-15 00:00:00'])).insertId;
    const qs = await dbAll('SELECT id FROM questions WHERE grade_band=? AND is_active=1', [band]);
    for (const q of qs) await dbRun('INSERT INTO quiz_questions(quiz_id,question_id) VALUES(?,?)', [quiz, q.id]);
    const opts = qs.length ? await dbAll(`SELECT id, question_id, is_correct FROM question_options WHERE question_id IN (${placeholders(qs)})`, qs.map(q => q.id)) : [];

    for (let s = 0; s < 7; s++) {
      n++;
      const name = `${FIRST[(n * 5 + ci) % FIRST.length]} ${['Shah', 'Patil', 'Mehta', 'Singh', 'Joshi', 'Desai', 'Nair'][s]}`;
      const sid = await user(inst, 'student', name, `student${n}.${spec.slug}@envliteracy.local`);
      await dbRun('INSERT INTO class_members(class_id,student_id) VALUES(?,?)', [cls, sid]);
      const k = Math.min(0.98, Math.max(0.15, spec.k + (rnd() - 0.5) * 0.35));
      const p = Math.min(0.98, Math.max(0.1, spec.p + (rnd() - 0.5) * 0.45));
      await dbTx(async tx => {
        let correct = 0;
        const att = await tx.run('INSERT INTO quiz_attempts(quiz_id,student_id,score_pct) VALUES(?,?,0)', [quiz, sid]);
        for (const q of qs) {
          const os = opts.filter(o => String(o.question_id) === String(q.id));
          const right = os.find(o => o.is_correct), wrong = os.filter(o => !o.is_correct);
          const ok = rnd() < k; if (ok) correct++;
          const pick = ok ? right : wrong[Math.floor(rnd() * wrong.length)];
          await tx.run('INSERT INTO attempt_answers(attempt_id,question_id,option_id,is_correct) VALUES(?,?,?,?)', [att.insertId, q.id, pick.id, ok]);
        }
        await tx.run('UPDATE quiz_attempts SET score_pct=? WHERE id=?', [Math.round((correct / qs.length) * 10000) / 100, att.insertId]);
        for (let w = 0; w < 3; w++) {
          const ch = await tx.run('INSERT INTO practice_checkins(student_id,week_start) VALUES(?,?)', [sid, addDays(weekStart(), -7 * w)]);
          for (const it of items) {
            const v = it.scale === 'yes_no' ? (rnd() < p ? 1 : 0) : Math.max(0, Math.min(4, Math.round(p * 4 + (rnd() - 0.5) * 2)));
            await tx.run('INSERT INTO practice_responses(checkin_id,item_id,value) VALUES(?,?,?)', [ch.insertId, it.id, v]);
          }
        }
      });
    }
  }

  // Campus audits: previous term lower, current term higher (shows improvement).
  for (const [i, term] of terms.entries()) {
    const base = 2 + i * 0.7 + (spec.type === 'college' ? 0.3 : 0);
    const scores = auditItems.map(a => Math.max(0, Math.min(5, Math.round(base + (rnd() - 0.5) * 2))));
    const total = Math.round((scores.reduce((a, b) => a + b, 0) / (auditItems.length * 5)) * 10000) / 100;
    const a = (await dbRun('INSERT INTO campus_audits(institution_id,term_label,submitted_by,total_score) VALUES(?,?,?,?)', [inst, term, admin, total])).insertId;
    for (const [j, it] of auditItems.entries()) await dbRun('INSERT INTO campus_audit_scores(audit_id,item_id,score) VALUES(?,?,?)', [a, it.id, scores[j]]);
  }

  // Past-term snapshots so the institution trend chart has history.
  const past = terms.slice(0, 2);
  for (const [i, term] of past.entries()) {
    const f = 0.78 + i * 0.1;
    const K = Math.round(spec.k * 100 * f * 100) / 100, P = Math.round(spec.p * 100 * f * 100) / 100;
    await dbRun('INSERT INTO score_snapshots(scope,scope_id,topic_id,period_label,knowledge_score,practice_score,gap,sustainability_index) VALUES(?,?,NULL,?,?,?,?,?)',
      ['institution', inst, term, K, P, Math.round((K - P) * 100) / 100, Math.round((0.4 * K + 0.6 * P) * 100) / 100]);
  }
  console.log('seeded:', spec.name);
}

console.log('snapshots:', await recomputeAll(cur));
console.log(`\nDemo logins (password: ${DEMO_PASSWORD})`);
console.log('  super admin   admin@envliteracy.local');
console.log('  regional      regional@envliteracy.local');
console.log('  inst admin    admin.bvm@envliteracy.local');
console.log('  teacher       teacher1.bvm@envliteracy.local');
console.log('  student       student1.bvm@envliteracy.local');
process.exit(0);
