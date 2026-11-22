// Keyword-matching chatbot (no AI service). Scores every knowledge-base entry against the user's message.
//   phrase keyword (e.g. "save water")  : contiguous match in order  -> 4 + words
//   single keyword (e.g. "compost")      : any inflected form         -> 3
//   canonical-question word overlap      : +1 per shared content word
import { KB, TOPIC_LABELS } from '../data/knowledgeBase.js';

const STOP = new Set('a an the is are was were be been am what whats how do does did i my me mine to of in on for and or can could would should it its this that these those why with you your yours about tell please which there get make some any at as by from if so we our us they them than then also just very more most'.split(' '));
const KEEP_SHORT = new Set(['ev', 'led', 'cfl', 'aqi', 'epr', 'crz', 'bee', 'hi', 'bye', 'co2', 'si', 'cop', 'gap']);

export const normalize = s => String(s).toLowerCase().replace(/(\d)\.(\d)/g, '$1$2').replace(/[-_/]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function stem(w) {
  if (w.length <= 3 || /^\d+$/.test(w)) return w;
  for (const suf of ['ing', 'ed', 'es', 's']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3 && !(suf === 's' && (w.endsWith('ss') || w.endsWith('us')))) return w.slice(0, -suf.length);
  }
  return w;
}
const tokens = s => normalize(s).split(' ').filter(Boolean).map(stem);

// Pre-compute the index once at startup.
const INDEX = KB.map(([topic, question, keywords, answerText], id) => ({
  id, topic, question, answer: answerText,
  // A phrase is matched without filler words when 2+ content words remain ("what is the environment" = "what is environment");
  // otherwise it must match literally, filler included, and is worth less.
  phrases: keywords.filter(k => k.includes(' ')).map(k => {
    const full = tokens(k), content = full.filter(w => !STOP.has(w));
    return content.length >= 2 ? { seq: content, ns: true, weight: content.length } : { seq: full, ns: false, weight: content.length };
  }),
  singles: keywords.filter(k => !k.includes(' ')).map(k => stem(normalize(k))),
  qWords: new Set(tokens(question).filter(w => !STOP.has(w) && w.length > 2)),
}));

const hasSeq = (toks, seq) => {
  if (seq.length > toks.length) return false;
  for (let i = 0; i <= toks.length - seq.length; i++) if (seq.every((w, j) => toks[i + j] === w)) return true;
  return false;
};

export function scoreEntry(entry, toks, tokSet) {
  let score = 0, hits = 0;
  const content = toks.filter(w => !STOP.has(w));
  for (const p of entry.phrases) if (hasSeq(p.ns ? content : toks, p.seq)) { score += 4 + p.weight; hits++; }
  for (const k of entry.singles) if (tokSet.has(k) && !STOP.has(k) && (k.length > 3 || KEEP_SHORT.has(k))) { score += 3; hits++; }
  let overlap = 0;
  for (const w of entry.qWords) if (tokSet.has(w)) overlap++;
  score += overlap;
  return { score, hits, overlap };
}

export const STARTERS = [
  'How do I segregate waste?', 'How can I save water?', 'What is the knowledge-practice gap?',
  'Why are mangroves important?', 'What is climate change?', 'How can I save electricity?',
];
export const topicList = () => Object.entries(TOPIC_LABELS).filter(([k]) => k !== 'general').map(([key, label]) => ({ key, label, example: KB.find(e => e[0] === key)?.[1] }));

const relatedQuestions = (topic, exceptId, n = 3) => INDEX.filter(e => e.topic === topic && e.id !== exceptId).map(e => e.question).slice(0, n);

export function answer(message) {
  const toks = tokens(message);
  if (!toks.length) return { matched: false, answer: 'Please type a question, for example "How do I segregate waste?"', suggestions: STARTERS.slice(0, 3) };
  const tokSet = new Set(toks);
  const ranked = INDEX.map(e => ({ e, ...scoreEntry(e, toks, tokSet) })).filter(r => r.score > 0).sort((a, b) => b.score - a.score || b.hits - a.hits);
  const best = ranked[0];

  if (best && best.score >= 3 && (best.hits > 0 || best.overlap >= 2)) {
    // Suggest same-topic questions first, then runners-up.
    const sugg = relatedQuestions(best.e.topic, best.e.id, 3);
    for (const r of ranked.slice(1)) if (sugg.length < 3 && r.score >= 3 && !sugg.includes(r.e.question)) sugg.push(r.e.question);
    return { matched: true, answer: best.e.answer, topic: best.e.topic, topic_label: TOPIC_LABELS[best.e.topic], question: best.e.question, confidence: Math.min(1, best.score / 10), suggestions: sugg };
  }

  // Fallback: if a topic word was mentioned, offer that topic's questions.
  const mentioned = Object.keys(TOPIC_LABELS).find(k => k !== 'general' && (tokSet.has(stem(k)) || tokSet.has(stem(normalize(TOPIC_LABELS[k])))));
  if (mentioned) {
    return { matched: false, topic: mentioned, topic_label: TOPIC_LABELS[mentioned], answer: `I do not have a ready answer for that, but I know a lot about ${TOPIC_LABELS[mentioned].toLowerCase()}. Try one of these:`, suggestions: relatedQuestions(mentioned, -1, 4) };
  }
  return { matched: false, answer: 'Sorry, I do not know that one yet. I can help with waste, water, energy, biodiversity, climate, air quality, transport, local issues in Mira-Bhayandar and how this platform works. Try one of these:', suggestions: STARTERS.slice(0, 4) };
}

export const kbSize = () => KB.length;
