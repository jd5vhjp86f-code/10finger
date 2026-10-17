// Übungstexte aus Wortliste, Lektion und Schwächen.
// Reine Funktionen; der Zufall kommt von außen (rng), damit Tests reproduzierbar sind.

import { getLesson, newChars, knownChars, shiftUnlocked, isTypeable, SHIFT } from './lessons.js';
import { keyInfo } from './keyboard.js';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü']);
const isLetter = (c) => /\p{L}/u.test(c);
const isDigit = (c) => /\d/.test(c);

/** Zahl der Zeichen je Schritt, abhängig von der Altersgruppe. */
export const STEP_LENGTHS = {
  vorschule: { sequences: 24, syllables: 24, drill: 24, words: 30, sentences: 0 },
  kind: { sequences: 40, syllables: 45, drill: 50, words: 80, sentences: 70 },
  erwachsen: { sequences: 50, syllables: 55, drill: 60, words: 120, sentences: 120 },
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
  const letters = known.filter(isLetter);
  if (lesson.keys.includes(SHIFT)) {
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
  // Neue Satzzeichen/Ziffern werden mit Buchstaben gemischt, nicht untereinander
  const partners = fresh.every(isLetter) ? known : letters;
  let i = 0;
  return fill(() => {
    if (i < base.length) return base[i++];
    const n = pick(fresh, rng);
    const k = pick(partners, rng);
    return rng() < 0.5 ? n + k + n : k + n + k;
  }, target);
}

/** Silben und Wortbausteine aus allen bekannten Buchstaben; meist mit einer neuen Taste. */
export function syllables(nr, target, rng, focus = null) {
  const lesson = getLesson(nr);
  const known = [...knownChars(nr)].filter(isLetter);
  const vowels = known.filter((c) => VOWELS.has(c));
  const consonants = known.filter((c) => !VOWELS.has(c));
  const fresh = (focus ?? newChars(lesson)).filter(isLetter);
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

/** Zahlen und Satzzeichen in Wörter eingebettet: „Haus,“ „(ja)“ „Fußball-Tor“ „12 Katzen“. */
export function drill(nr, words, ageGroup, target, rng, focus = null) {
  const lesson = getLesson(nr);
  const symbols = (focus ?? newChars(lesson)).filter((c) => !isLetter(c));
  if (!symbols.length) return '';
  let pool = filterWords(words, nr, ageGroup).filter((w) => [...w].every(isLetter));
  if (pool.length < 5) pool = syllables(nr, 120, rng).split(' ');
  const short = pool.filter((w) => w.length <= 7);
  const list = short.length >= 5 ? short : pool;
  const capitals = list.filter((w) => w[0] !== w[0].toLowerCase());
  const digits = [...knownChars(nr)].filter(isDigit);
  const number = (must) => {
    let s = must;
    const len = 1 + Math.floor(rng() * 3);
    const nonZero = digits.filter((d) => d !== '0');
    while (s.length < len) s = rng() < 0.5 ? s + pick(digits, rng) : pick(nonZero, rng) + s;
    return s.length > 1 && s[0] === '0' ? pick(nonZero, rng) + s : s;
  };
  return fill(() => {
    const sym = pick(symbols, rng);
    const w = pick(list, rng);
    if (isDigit(sym)) return rng() < 0.5 ? number(sym) : `${number(sym)} ${w}`;
    switch (sym) {
      case '-': return `${pick(capitals.length ? capitals : list, rng)}-${pick(capitals.length ? capitals : list, rng)}`;
      case '"': return `"${w}"`;
      case '(': case ')': return `(${w})`;
      default: return `${w}${sym}`;
    }
  }, target);
}

export function wordsStep(words, nr, ageGroup, target, rng, focus = null) {
  const pool = filterWords(words, nr, ageGroup);
  if (pool.length < 5) return syllables(nr, target, rng);
  const fresh = (focus ?? newChars(getLesson(nr))).map((c) => c.toLowerCase());
  const withFresh = pool.filter((w) => [...w.toLowerCase()].some((c) => fresh.includes(c)));
  const capitals = pool.filter((w) => w[0] !== w[0].toLowerCase());
  const lessonIsShift = !focus && getLesson(nr).keys.includes(SHIFT);
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

function sentenceList(sentences, ageGroup) {
  return ageGroup === 'erwachsen' ? sentences.adults : sentences.kids;
}

/**
 * Alle Schritte einer Lektion. Vorstellen übernimmt die Ansicht; hier entstehen die Texte.
 * @returns {{id: string, title: string, text: string}[]}
 */
export function generateLesson(nr, { words = [], sentences = { kids: [], adults: [] }, ageGroup = 'kind', rng = createRng() } = {}) {
  const len = STEP_LENGTHS[ageGroup] ?? STEP_LENGTHS.kind;
  const fresh = newChars(getLesson(nr));
  const hasLetters = fresh.some(isLetter) || getLesson(nr).keys.includes(SHIFT);
  const hasSymbols = fresh.some((c) => !isLetter(c));
  const steps = [{ id: 'sequences', title: 'Tastenfolgen', text: sequences(nr, len.sequences, rng) }];
  if (hasLetters) steps.push({ id: 'syllables', title: 'Silben', text: syllables(nr, len.syllables, rng) });
  if (hasSymbols) {
    steps.push({
      id: 'drill',
      title: fresh.some(isDigit) ? 'Zahlen' : 'Satzzeichen',
      text: drill(nr, words, ageGroup, len.drill, rng),
    });
  }
  steps.push({ id: 'words', title: 'Wörter', text: wordsStep(words, nr, ageGroup, len.words, rng) });
  if (nr >= 6 && len.sentences > 0) {
    const text = sentencesStep(sentenceList(sentences, ageGroup), nr, len.sentences, rng);
    if (text) steps.push({ id: 'sentences', title: 'Sätze', text });
  }
  return steps.filter((s) => s.text.length > 0);
}

/** Aufwärmen: bekannte Tasten in echten Wörtern (Länge reicht für etwa eine Minute). */
export function warmupText(nr, { words = [], ageGroup = 'kind', chars = 200, rng = createRng() } = {}) {
  const pool = filterWords(words, nr, ageGroup);
  if (pool.length < 5) return syllables(nr, chars, rng, [...knownChars(nr)].filter(isLetter));
  return fill(() => pick(pool, rng), chars);
}

/**
 * Schwächentraining aus den schwächsten Tasten (siehe stats.weakKeys).
 * @param {string[]} weak schwache Zeichen, die in Lektion `nr` bekannt sind
 */
export function weaknessSteps(nr, weak, { words = [], ageGroup = 'kind', rng = createRng() } = {}) {
  if (!weak.length) return [];
  const len = STEP_LENGTHS[ageGroup] ?? STEP_LENGTHS.kind;
  const known = [...knownChars(nr)].filter(isLetter);
  const seq = fill(() => {
    const w = pick(weak, rng);
    const k = pick(known, rng);
    return pick([w.repeat(3), w + k + w, k + w + k, w + w + k], rng);
  }, len.sequences);
  const steps = [{ id: 'weak-seq', title: 'Schwache Tasten', text: seq }];
  const letters = weak.filter(isLetter);
  const symbols = weak.filter((c) => !isLetter(c) && c !== ' ');
  if (symbols.length) steps.push({ id: 'weak-drill', title: 'Zeichen', text: drill(nr, words, ageGroup, len.drill, rng, symbols) });
  steps.push({ id: 'weak-words', title: 'Wörter', text: wordsStep(words, nr, ageGroup, len.words, rng, letters.length ? letters : weak) });
  return steps.filter((s) => s.text.length > 0);
}

/** Fester Text für das Rennen gegen den Geist: gleiche Lektion = gleicher Text. */
export function raceText(nr, { words = [], ageGroup = 'kind' } = {}) {
  const rng = createRng(1000 + nr * 7 + (ageGroup === 'erwachsen' ? 1 : 0));
  const len = ageGroup === 'erwachsen' ? 140 : ageGroup === 'vorschule' ? 50 : 100;
  return wordsStep(words, nr, ageGroup, len, rng, [...knownChars(nr)].filter((c) => c !== ' '));
}

/** Wörter für den Wörterregen: kurz genug, um sie im Fallen zu tippen. */
export function rainWords(words, nr, ageGroup) {
  const max = ageGroup === 'erwachsen' ? 12 : ageGroup === 'vorschule' ? 4 : 8;
  const pool = filterWords(words, nr, ageGroup).filter((w) => w.length <= max && [...w].every(isLetter));
  if (pool.length >= 10) return pool;
  return [...new Set(syllables(nr, 300, createRng(nr)).split(' '))];
}

const REPLACEMENTS = [
  [/[„“”«»‟]/g, '"'], [/[‚‘’‹›`´]/g, "'"], [/[–—‒−]/g, '-'], [/…/g, '...'],
  [/[  -​ ]/g, ' '], [/\s+/g, ' '],
];

/**
 * Eigene Texte bereinigen: typografische Zeichen ersetzen, nicht tippbare Zeichen entfernen.
 * @returns {{text: string, removed: string[]}}
 */
export function normalizeCustomText(raw) {
  let text = raw.normalize('NFC');
  for (const [re, rep] of REPLACEMENTS) text = text.replace(re, rep);
  const removed = new Set();
  let out = '';
  for (const ch of text) {
    const info = keyInfo(ch);
    if (info && !info.dead) out += ch;
    else removed.add(ch);
  }
  return { text: out.replace(/ +/g, ' ').trim(), removed: [...removed] };
}

/** Langen Text in Abschnitte teilen (an Wortgrenzen), damit Schritte überschaubar bleiben. */
export function chunkText(text, size = 300) {
  const words = text.split(' ');
  const chunks = [];
  let cur = '';
  for (const w of words) {
    if (cur && cur.length + w.length + 1 > size) {
      chunks.push(cur);
      cur = '';
    }
    cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) chunks.push(cur);
  return chunks;
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
