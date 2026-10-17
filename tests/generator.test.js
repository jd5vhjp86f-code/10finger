import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createRng, generateLesson, filterWords, filterSentences, sequences, syllables, wrapText,
} from '../js/generator.js';
import { isTypeable, knownChars, AVAILABLE_LESSONS } from '../js/lessons.js';

const words = JSON.parse(readFileSync(new URL('../data/words-de.json', import.meta.url)));
const kids = JSON.parse(readFileSync(new URL('../data/sentences-kids.json', import.meta.url)));
const adults = JSON.parse(readFileSync(new URL('../data/sentences-adults.json', import.meta.url)));

test('der Zufall ist reproduzierbar', () => {
  const a = createRng(42);
  const b = createRng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('jede Lektion enthält nur freigeschaltete Zeichen', () => {
  for (let nr = 1; nr <= AVAILABLE_LESSONS; nr++) {
    for (const ageGroup of ['vorschule', 'kind', 'erwachsen']) {
      for (let seed = 1; seed <= 20; seed++) {
        const steps = generateLesson(nr, { words, sentences: { kids, adults }, ageGroup, rng: createRng(seed) });
        assert.ok(steps.length >= 3, `Lektion ${nr} hat zu wenige Schritte`);
        for (const s of steps) {
          assert.ok(isTypeable(s.text, nr), `Lektion ${nr}/${s.id}: unerlaubtes Zeichen in "${s.text}"`);
          assert.ok(!s.text.includes('  '), 'keine doppelten Leerzeichen');
          assert.equal(s.text, s.text.trim());
        }
      }
    }
  }
});

test('Lektion 1 beginnt mit den Grundstellungs-Folgen', () => {
  const text = sequences(1, 60, createRng(1));
  assert.match(text, /^aaa sss ddd fff jjj kkk lll ööö/);
  assert.ok(text.includes('fjf'));
});

test('vor Lektion 6 nur Kleinbuchstaben, ab Lektion 6 Großschreibung', () => {
  const before = filterWords(words, 5, 'kind');
  assert.ok(before.every((w) => w === w.toLowerCase()));
  assert.ok(before.includes('hund'));
  const after = filterWords(words, 6, 'kind');
  assert.ok(after.includes('Hund'));
  const steps = generateLesson(6, { words, sentences: { kids, adults }, ageGroup: 'kind', rng: createRng(3) });
  assert.ok(/[A-ZÄÖÜ]/.test(steps[0].text), 'Tastenfolgen in Lektion 6 üben Großbuchstaben');
  assert.ok(steps.some((s) => s.id === 'sentences'), 'ab Lektion 6 gibt es Sätze');
});

test('jede Lektion 1–6 findet echte Wörter', () => {
  for (let nr = 1; nr <= AVAILABLE_LESSONS; nr++) {
    assert.ok(filterWords(words, nr, 'kind').length >= 5, `Lektion ${nr}: zu wenige Wörter`);
  }
});

test('Erwachsenenwörter erscheinen nicht bei Kindern', () => {
  assert.ok(!filterWords(words, 16, 'kind').includes('Vertrag'));
  assert.ok(filterWords(words, 16, 'erwachsen').includes('Vertrag'));
});

test('Sätze ohne Punkt-Taste verlieren den Schlusspunkt', () => {
  const s = filterSentences(['Der Hund ist gut.'], 6);
  assert.deepEqual(s, ['Der Hund ist gut']);
  assert.ok(filterSentences(kids, 6).length >= 5);
  assert.ok(filterSentences(adults, 6).length >= 5);
});

test('Silben nutzen nur bekannte Zeichen', () => {
  const known = knownChars(2);
  const text = syllables(2, 200, createRng(9));
  for (const ch of text) assert.ok(known.has(ch), ch);
});

test('Vorschule bekommt kürzere Texte und keine Sätze', () => {
  const kid = generateLesson(6, { words, sentences: { kids, adults }, ageGroup: 'kind', rng: createRng(1) });
  const pre = generateLesson(6, { words, sentences: { kids, adults }, ageGroup: 'vorschule', rng: createRng(1) });
  const len = (steps) => steps.reduce((a, s) => a + s.text.length, 0);
  assert.ok(len(pre) < len(kid));
  assert.ok(!pre.some((s) => s.id === 'sentences'));
});

test('Zeilenumbruch an Wortgrenzen erhält den Text', () => {
  const text = 'das als all fall lass das als all fall lass das als';
  const lines = wrapText(text, 20);
  assert.equal(lines.join(''), text);
  assert.ok(lines.every((l) => l.trimEnd().length <= 20));
});
