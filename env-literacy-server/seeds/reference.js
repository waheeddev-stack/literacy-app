// Seeds reference content on boot, but only into empty tables (safe to run every start).
import { dbAll, dbGet, dbTx, getSetting, setSetting } from '../src/config/db.js';
import { invalidateTopics } from '../src/services/scoring.js';
import { ACTION_CARDS, AUDIT_ITEMS, PRACTICE_ITEMS, QUESTIONS, TOPICS } from './reference-data.js';

const empty = async table => Number((await dbGet(`SELECT COUNT(*) AS n FROM ${table}`)).n) === 0;

export async function seedReference() {
  if (await empty('topics')) {
    await dbTx(async tx => { for (const [slug, name] of TOPICS) await tx.run('INSERT INTO topics(slug,name) VALUES(?,?)', [slug, name]); });
    invalidateTopics();
  }
  const topics = Object.fromEntries((await dbAll('SELECT id, slug FROM topics')).map(t => [t.slug, t.id]));

  if (await empty('questions')) {
    await dbTx(async tx => {
      for (const [topic, band, diff, text, options, correct, explanation] of QUESTIONS) {
        const q = await tx.run('INSERT INTO questions(topic_id,grade_band,difficulty,text,explanation,is_active) VALUES(?,?,?,?,?,1)', [topics[topic], band, diff, text, explanation]);
        for (let i = 0; i < options.length; i++) await tx.run('INSERT INTO question_options(question_id,text,is_correct) VALUES(?,?,?)', [q.insertId, options[i], i === correct]);
      }
    });
  }
  if (await empty('practice_items')) {
    await dbTx(async tx => { for (const [t, prompt, scale, band] of PRACTICE_ITEMS) await tx.run('INSERT INTO practice_items(topic_id,prompt,scale,grade_band) VALUES(?,?,?,?)', [topics[t], prompt, scale, band]); });
  }
  if (await empty('audit_items')) {
    await dbTx(async tx => { for (const [cat, label] of AUDIT_ITEMS) await tx.run('INSERT INTO audit_items(category,label,max_score) VALUES(?,?,5)', [cat, label]); });
  }
  if (await empty('action_cards')) {
    await dbTx(async tx => {
      for (const [t, kt, kb, pt, pb, at, ab] of ACTION_CARDS) {
        for (const [type, title, body] of [['knowledge_heavy', kt, kb], ['practice_heavy', pt, pb], ['aligned', at, ab]]) {
          await tx.run('INSERT INTO action_cards(topic_id,gap_type,title,body) VALUES(?,?,?,?)', [topics[t], type, title, body]);
        }
      }
    });
  }
  if ((await getSetting('weight_knowledge')) == null) { await setSetting('weight_knowledge', 0.4); await setSetting('weight_practice', 0.6); }
}
