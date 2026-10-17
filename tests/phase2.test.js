import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createRng, generateLesson, drill, warmupText, weaknessSteps, raceText, rainWords,
  normalizeCustomText, chunkText, filterWords, filterSentences,
} from '../js/generator.js';
import { isTypeable, knownChars, LESSONS } from '../js/lessons.js';
import {
  recordSession, applyResult, weakKeys, encodeTimeline, ghostPosition, applyRace, applyRain,
  minutesLastWeek, dailyGoal, trend,
} from '../js/stats.js';
import { normalizeProfile } from '../js/storage.js';
import { explorerTargets } from '../js/views/explorer.js';
import { chooseTarget } from '../js/views/games.js';
import { isBlind } from '../js/views/exercise.js';
import { createEngine } from '../js/engine.js';

const words = JSON.parse(readFileSync(new URL('../data/words-de.json', import.meta.url)));
const kids = JSON.parse(readFileSync(new URL('../data/sentences-kids.json', import.meta.url)));
const adults = JSON.parse(readFileSync(new URL('../data/sentences-adults.json', import.meta.url)));
const profile = (extra = {}) => normalizeProfile({ id: 'p_1', name: 'Moritz', ...extra });
const result = (accuracy = 97, apm = 80, extra = {}) => ({
  hits: 100, errors: 3, accuracy, apm, seconds: 60, activeMs: 60000,
  keyStats: { f: { hits: 10, errors: 1, totalMs: 3000, timed: 10 } }, ...extra,
});

test('Wortliste: rund 3.000 Einträge, keine Dubletten, gültiges Format', () => {
  assert.ok(words.length >= 2500, `nur ${words.length} Wörter`);
  const set = new Set(words.map((w) => w.w));
  assert.equal(set.size, words.length);
  for (const w of words) {
    assert.ok(['alle', 'erwachsen'].includes(w.g));
    assert.match(w.w, /^[A-Za-zÄÖÜäöüß]+$/, w.w);
  }
});

test('Lektionen 7–16: jede Lektion übt ihre neuen Zeichen', () => {
  for (const nr of [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
    const lesson = LESSONS[nr - 1];
    for (const ageGroup of ['kind', 'erwachsen']) {
      const steps = generateLesson(nr, { words, sentences: { kids, adults }, ageGroup, rng: createRng(nr) });
      const all = steps.map((s) => s.text).join(' ');
      for (const k of lesson.keys) assert.ok(all.includes(k), `Lektion ${nr} (${ageGroup}) übt „${k}“ nicht`);
      for (const s of steps) assert.ok(isTypeable(s.text, nr), `Lektion ${nr}/${s.id}: ${s.text}`);
    }
  }
});

test('Zahlen- und Satzzeichen-Schritte', () => {
  const z = drill(15, words, 'kind', 200, createRng(1));
  assert.match(z, /\d/);
  assert.ok(!/(^| )0\d/.test(z), 'keine führenden Nullen');
  const p = drill(16, words, 'kind', 200, createRng(2));
  assert.match(p, /[!?:"()]/);
  const h = drill(13, words, 'kind', 200, createRng(3));
  assert.match(h, /[A-ZÄÖÜ][a-zäöüß]+-[A-ZÄÖÜ]/);
  const steps = generateLesson(15, { words, sentences: { kids, adults }, ageGroup: 'kind', rng: createRng(4) });
  assert.ok(steps.some((s) => s.title === 'Zahlen'));
});

test('Sätze gibt es für jede Lektion ab 6', () => {
  for (let nr = 6; nr <= 16; nr++) {
    assert.ok(filterSentences(kids, nr).length >= 5, `Kinder, Lektion ${nr}`);
    assert.ok(filterSentences(adults, nr).length >= 5, `Erwachsene, Lektion ${nr}`);
  }
  assert.ok(filterSentences(kids, 16).length >= kids.length * 0.95, 'am Ende sind fast alle Sätze tippbar');
});

test('Aufwärmen nutzt nur bekannte Tasten', () => {
  const t = warmupText(3, { words, ageGroup: 'kind', chars: 150, rng: createRng(5) });
  assert.ok(t.length >= 150);
  assert.ok(isTypeable(t, 3));
});

test('Schwächentraining übt die schwachen Tasten', () => {
  const steps = weaknessSteps(8, ['o', 'w'], { words, ageGroup: 'kind', rng: createRng(6) });
  assert.ok(steps.length >= 2);
  for (const s of steps) assert.ok(isTypeable(s.text, 8));
  assert.ok(steps[0].text.includes('o') && steps[0].text.includes('w'));
  assert.deepEqual(weaknessSteps(8, [], { words }), []);
});

test('weakKeys findet Fehler- und Tempo-Schwächen', () => {
  const stats = {
    a: { hits: 100, errors: 1, avgMs: 300 },
    s: { hits: 50, errors: 20, avgMs: 320 },
    d: { hits: 60, errors: 0, avgMs: 900 },
    f: { hits: 3, errors: 3, avgMs: 300 }, // zu wenig Daten
    x: { hits: 50, errors: 30, avgMs: 300 }, // noch nicht bekannt
    ' ': { hits: 500, errors: 50, avgMs: 200 },
  };
  assert.deepEqual(weakKeys(stats, knownChars(2)), ['s', 'd']);
  assert.deepEqual(weakKeys({}, knownChars(2)), []);
});

test('Renntext ist pro Lektion fest, Wörterregen hat genug Wörter', () => {
  assert.equal(raceText(5, { words }), raceText(5, { words }));
  assert.notEqual(raceText(5, { words }), raceText(6, { words }));
  assert.ok(isTypeable(raceText(5, { words }), 5));
  assert.ok(rainWords(words, 3, 'kind').length >= 10);
  assert.ok(rainWords(words, 1, 'vorschule').every((w) => isTypeable(w, 1)));
});

test('Eigene Texte: typografische Zeichen werden tippbar, AltGr-Zeichen entfernt', () => {
  const { text, removed } = normalizeCustomText('„Hallo“ – sagte\tsie…  Mail: a@b.de für 5 €\n');
  assert.equal(text, '"Hallo" - sagte sie... Mail: ab.de für 5');
  assert.deepEqual(removed.sort(), ['@', '€'].sort());
  assert.equal(normalizeCustomText('Füße ’s').text, "Füße 's");
});

test('Lange Texte werden in Abschnitte geteilt', () => {
  const text = Array.from({ length: 200 }, (_, i) => `wort${i}`).join(' ');
  const chunks = chunkText(text, 300);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(' '), text);
  assert.ok(chunks.every((c) => c.length <= 300));
});

test('Sitzungsarten werden gespeichert, Tagesziel-Abzeichen', () => {
  const p = profile({ ageGroup: 'kind' });
  assert.equal(dailyGoal(p), 7);
  const now = new Date(2026, 9, 17, 10);
  recordSession(p, 'warmup', 3, result(97, 80, { seconds: 240 }), now);
  const r = recordSession(p, 'custom', 0, result(97, 80, { seconds: 240 }), now);
  assert.equal(r.goalReached, true);
  assert.ok(p.badges.includes('tagesziel'));
  assert.deepEqual(p.sessions.map((s) => s.kind), ['warmup', 'custom']);
  assert.equal(minutesLastWeek(p, '2026-10-17'), 8);
  p.settings.dailyGoal = 20;
  assert.equal(dailyGoal(p), 20);
});

test('Lektions-Abzeichen und Tempo-Abzeichen', () => {
  const p = profile();
  applyResult(p, 1, result(98, 120));
  assert.ok(p.badges.includes('grundreihe'));
  assert.ok(p.badges.includes('tempo-100'));
  assert.ok(!p.badges.includes('tempo-200'));
});

test('Geist: Zeitverlauf kodieren und Position berechnen', () => {
  const e = createEngine('abcd');
  e.input('a', 0); e.input('b', 100); e.input('c', 300); e.input('d', 600);
  const deltas = encodeTimeline(e.timeline);
  assert.deepEqual(deltas, [0, 100, 200, 300]);
  assert.equal(ghostPosition(deltas, 0), 1);
  assert.equal(ghostPosition(deltas, 150), 2);
  assert.equal(ghostPosition(deltas, 10_000), 4);
});

test('Rennen: neuer Geist nur bei ≥ 95 % und schneller', () => {
  const p = profile();
  const text = 'abc abc';
  const first = applyRace(p, 2, text, result(96, 60, { activeMs: 6000 }), [0, 1000, 2000, 3000, 4000, 5000, 6000]);
  assert.equal(first.newGhost, true);
  assert.equal(first.hadGhost, false);
  const slower = applyRace(p, 2, text, result(99, 50, { activeMs: 8000 }), [0, 8000]);
  assert.equal(slower.beatGhost, false);
  const sloppy = applyRace(p, 2, text, result(80, 90, { activeMs: 3000 }), [0, 3000]);
  assert.equal(sloppy.newGhost, false);
  const faster = applyRace(p, 2, text, result(97, 90, { activeMs: 4000 }), [0, 4000]);
  assert.equal(faster.beatGhost, true);
  assert.ok(p.badges.includes('geist-besiegt'));
  assert.equal(p.sessions.length, 4);
});

test('Wörterregen: Rekord und Zielwort', () => {
  const p = profile();
  assert.equal(applyRain(p, 3, 40, result()).newBest, true);
  assert.equal(applyRain(p, 3, 30, result()).newBest, false);
  assert.equal(p.games.rainBest, 40);
  applyRain(p, 3, 55, result());
  assert.ok(p.badges.includes('regenmacher'));
  const drops = [{ word: 'hund', y: 10 }, { word: 'haus', y: 200 }, { word: 'kind', y: 300 }];
  assert.equal(chooseTarget(drops, 'h').word, 'haus');
  assert.equal(chooseTarget(drops, 'x'), null);
});

test('Entdecker: Grundstellung beginnt mit F und J, Namensbuchstaben', () => {
  const p = profile({ name: 'Anna' });
  const g = explorerTargets('grund', p, createRng(1));
  assert.deepEqual(g.slice(0, 2), ['f', 'j']);
  assert.equal(g.length, 10);
  const n = explorerTargets('name', p, createRng(2));
  assert.ok(n.every((c) => c === 'a' || c === 'n'));
});

test('Blindmodus: automatisch erst, wenn die Lektion sicher sitzt', () => {
  const p = profile();
  assert.equal(isBlind(p, 1), false);
  p.progress.lessons['1'] = { done: true, bestAccuracy: 96, bestApm: 50, attempts: 1 };
  assert.equal(isBlind(p, 1), false);
  p.progress.lessons['1'].bestAccuracy = 98;
  assert.equal(isBlind(p, 1), true);
  p.settings.blindMode = 'aus';
  assert.equal(isBlind(p, 1), false);
  p.settings.blindMode = 'immer';
  assert.equal(isBlind(p, 2), true);
});

test('Verlauf blendet Entdecker-Sitzungen aus', () => {
  const p = profile();
  recordSession(p, 'explorer', 0, result(100, 0));
  recordSession(p, 'lesson', 1, result(97, 70));
  assert.equal(trend(p).length, 1);
});

test('alte Sicherungen ohne neue Felder bleiben lesbar', () => {
  const p = normalizeProfile({ id: 'p_9', name: 'Alt', settings: { sound: false } });
  assert.equal(p.settings.sound, false);
  assert.equal(p.settings.blindMode, 'auto');
  assert.deepEqual(p.explorer, { stars: 0 });
  assert.deepEqual(p.customTexts, []);
  assert.equal(p.flags.ergonomicsSeen, false);
  assert.ok(filterWords(words, 16, 'kind').length > 1500);
});
