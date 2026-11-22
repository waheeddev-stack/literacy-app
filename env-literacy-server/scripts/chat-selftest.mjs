// node scripts/chat-selftest.mjs : every canonical question must return its own entry, plus sample free-text queries.
import { answer, kbSize } from '../src/services/chatbot.js';
import { KB } from '../src/data/knowledgeBase.js';

let bad = 0;
for (const [, q] of KB) {
  const r = answer(q);
  if (!r.matched || r.question !== q) { bad++; console.log('SELF-MISS:', q, '->', r.matched ? r.question : 'no match'); }
}
console.log(`entries: ${kbSize()}, self-test misses: ${bad}`);

const tests = ['hello', 'how do i separate my garbage', 'ways to conserve water at home', 'tell me about solar panels', 'what is global warming?', 'is plastic bad',
  'pm2.5 meaning', 'why mangroves matter', 'how to register as a student', 'what is my gap score', 'who won the cricket match', 'tell me about waste',
  'thanks a lot!', 'electric cars good?', 'i forgot my password', 'can i see other students scores', 'bhayandar flood'];
for (const m of tests) {
  const r = answer(m);
  console.log(`\n> ${m}\n  [${r.matched ? r.topic : 'NO MATCH'}] ${r.matched ? r.question : ''}\n  ${r.answer.slice(0, 90)}...`);
}
process.exit(bad ? 1 : 0);
