// Übungstexte aus Wortliste, Lektion und Schwächen.
// Reine Funktionen; der Zufall kommt von außen (rng), damit Tests reproduzierbar sind.

import { getLesson, newChars, knownChars, shiftUnlocked, isTypeable, SHIFT } from './lessons.js';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü']);

/** Zahl der Zeichen je Schritt, abhängig von der Altersgruppe. */
export const STEP_LENGTHS = {
  vorschule: { sequences: 24, syllables: 24, words: 30, sentences: 0 },
  kind: { sequences: 40, syllables: 45, words: 80, sentences: 70 },
  erwachsen: { sequences: 50, syllables: 55, words: 120, sentences: 120 },
};

/** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32). */
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const capitalize = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/** Tokens mit Leerzeichen verbinden, bis mindestens `target` Zeichen erreicht sind. */
function fill(nextToken, target) {
  const out = [];
  let len = 0;
  let last = null;
  let guard = 0;
  while (len < target && guard++ < 1000) {
    let tok = nextToken();
    if (tok === last) tok = nextToken();
    out.push(tok);
    len += tok.length + 1;
    last = tok;
  }
  return out.join(' ');
}

/** Tastenfolgen: fff jjj fjf jfj, dann die neuen Tasten mit bekannten gemischt. */
export function sequences(nr, target, rng) {
  const lesson = getLesson(nr);
  const known = [...knownChars(nr)].filter((c) => c !== ' ');
  if (lesson.keys.includes(SHIFT)) {
    const letters = known.filter((c) => c.toUpperCase() !== c);
    return fill(() => {
      const c = pick(letters, rng);
      return rng() < 0.5 ? `${c.toUpperCase()}${c}` : `${c.toUpperCase()}${c}${c}`;
    }, target);
  }
  const fresh = newChars(lesson);
  const base = [];
  for (const c of fresh) base.push(c.repeat(3));
  // Spiegelpaare: f–j, d–k, s–l, a–ö bzw. e–i
  for (let i = 0; i < Math.floor(fresh.length / 2); i++) {
    const a = fresh[i];
    const b = fresh[fresh.length - 1 - i];
    base.push(a + b + a, b + a + b);
  }
  let i = 0;
  return fill(() => {
    if (i < base.length) return base[i++];
    const n = pick(fresh, rng);
    const k = pick(known, rng);
    return rng() < 0.5 ? n + k + n : k + n + k;
  }, target);
}

/** Silben und Wortbausteine aus allen bekannten Tasten; meist mit einer neuen Taste. */
export function syllables(nr, target, rng) {
  const lesson = getLesson(nr);
  const known = [...knownChars(nr)].filter((c) => c !== ' ');
  const vowels = known.filter((c) => VOWELS.has(c));
  const consonants = known.filter((c) => !VOWELS.has(c) && /\p{L}/u.test(c));
  const fresh = newChars(lesson).filter((c) => /\p{L}/u.test(c));
  const shift = lesson.keys.includes(SHIFT);
  if (!vowels.length || !consonants.length) return sequences(nr, target, rng);
  return fill(() => {
    const preferFresh = fresh.length && rng() < 0.7;
    const f = preferFresh ? pick(fresh, rng) : null;
    const c = f && !VOWELS.has(f) ? f : pick(consonants, rng);
    const v = f && VOWELS.has(f) ? f : pick(vowels, rng);
    const c2 = pick(consonants, rng);
    const forms = [c + v, v + c, c + v + c2, c + v + c2 + v];
    let s = pick(forms, rng);
    if (shift && rng() < 0.6) s = capitalize(s);
    return s;
  }, target);
}

/** Echte Wörter, die nur freigeschaltete Zeichen enthalten. Vor der Umschalttaste alles klein. */
export function filterWords(words, nr, ageGroup) {
  const shift = shiftUnlocked(nr);
  const seen = new Set();
  const out = [];
  for (const entry of words) {
    if (ageGroup !== 'erwachsen' && entry.g === 'erwachsen') continue;
    const w = shift ? entry.w : entry.w.toLowerCase();
    if (seen.has(w) || !isTypeable(w, nr)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

export function wordsStep(words, nr, ageGroup, target, rng) {
  const pool = filterWords(words, nr, ageGroup);
  if (pool.length < 5) return syllables(nr, target, rng);
  const fresh = newChars(getLesson(nr));
  const withFresh = pool.filter((w) => [...w.toLowerCase()].some((c) => fresh.includes(c)));
  const capitals = pool.filter((w) => w[0] !== w[0].toLowerCase());
  const lessonIsShift = getLesson(nr).keys.includes(SHIFT);
  return fill(() => {
    if (lessonIsShift && capitals.length && rng() < 0.7) return pick(capitals, rng);
    if (withFresh.length && rng() < 0.7) return pick(withFresh, rng);
    return pick(pool, rng);
  }, target);
}

/** Sätze, deren Zeichen alle bekannt sind. Ohne Punkt-Taste wird der Schlusspunkt weggelassen. */
export function filterSentences(sentences, nr) {
  const known = knownChars(nr);
  const out = [];
  for (const s of sentences) {
    const t = !known.has('.') && s.endsWith('.') ? s.slice(0, -1) : s;
    if (isTypeable(t, nr)) out.push(t);
  }
  return out;
}

export function sentencesStep(sentences, nr, target, rng) {
  const pool = filterSentences(sentences, nr);
  if (!pool.length) return '';
  return fill(() => pick(pool, rng), target);
}

/**
 * Alle Schritte einer Lektion. Vorstellen übernimmt die Ansicht; hier entstehen die Texte.
 * @returns {{id: string, title: string, text: string}[]}
 */
export function generateLesson(nr, { words = [], sentences = { kids: [], adults: [] }, ageGroup = 'kind', rng = createRng() } = {}) {
  const len = STEP_LENGTHS[ageGroup] ?? STEP_LENGTHS.kind;
  const steps = [
    { id: 'sequences', title: 'Tastenfolgen', text: sequences(nr, len.sequences, rng) },
    { id: 'syllables', title: 'Silben', text: syllables(nr, len.syllables, rng) },
    { id: 'words', title: 'Wörter', text: wordsStep(words, nr, ageGroup, len.words, rng) },
  ];
  if (nr >= 6 && len.sentences > 0) {
    const list = ageGroup === 'erwachsen' ? sentences.adults : sentences.kids;
    const text = sentencesStep(list, nr, len.sentences, rng);
    if (text) steps.push({ id: 'sentences', title: 'Sätze', text });
  }
  return steps.filter((s) => s.text.length > 0);
}

/** Text an Wortgrenzen in Zeilen umbrechen; Leerzeichen bleiben am Zeilenende erhalten. */
export function wrapText(text, maxLen = 40) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i] + (i < words.length - 1 ? ' ' : '');
    if (line && (line + w).trimEnd().length > maxLen) {
      lines.push(line);
      line = '';
    }
    line += w;
  }
  if (line) lines.push(line);
  return lines;
}
