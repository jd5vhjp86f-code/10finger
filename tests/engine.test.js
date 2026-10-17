import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, accuracy, apm, summarize, PAUSE_MS } from '../js/engine.js';

function typeAll(engine, keys, step = 200) {
  let t = 0;
  const out = [];
  for (const k of keys) out.push(engine.input(k, (t += step)));
  return out;
}

test('richtige Eingabe läuft durch und meldet done', () => {
  const e = createEngine('fj f');
  const res = typeAll(e, ['f', 'j', ' ', 'f']);
  assert.deepEqual(res.map((r) => r.type), ['hit', 'hit', 'hit', 'hit']);
  assert.equal(res.at(-1).done, true);
  assert.equal(e.done, true);
  const r = e.result();
  assert.equal(r.hits, 4);
  assert.equal(r.errors, 0);
  assert.equal(r.accuracy, 100);
});

test('Fehlermodus "wait": Cursor wartet, Zeichen wird als korrigiert markiert', () => {
  const e = createEngine('ab');
  assert.equal(e.input('x', 0).type, 'error');
  assert.equal(e.pos, 0);
  assert.equal(e.status[0], 'error');
  assert.equal(e.input('a', 100).type, 'hit');
  assert.equal(e.status[0], 'fixed');
  e.input('b', 200);
  const r = e.result();
  assert.equal(r.errors, 1);
  assert.equal(r.hits, 2);
  assert.equal(r.accuracy, 66.7);
  assert.equal(r.keyStats.a.errors, 1);
});

test('Fehlermodus "continue": Fehler rückt vor, Rücktaste geht zurück', () => {
  const e = createEngine('ab', { errorMode: 'continue' });
  assert.equal(e.input('x', 0).type, 'error');
  assert.equal(e.pos, 1);
  assert.equal(e.status[0], 'wrong');
  assert.equal(e.input('Backspace', 50).type, 'back');
  assert.equal(e.pos, 0);
  e.input('a', 100);
  assert.equal(e.input('b', 200).done, true);
});

test('Tottasten, Umschalt und andere Sondertasten werden ignoriert', () => {
  const e = createEngine('Aö');
  for (const k of ['Dead', 'Shift', 'CapsLock', 'Enter', 'Tab', 'Backspace']) {
    assert.equal(e.input(k, 0).type, 'ignored');
  }
  assert.equal(e.started, false);
  assert.equal(e.input('A', 10).type, 'hit');
  assert.equal(e.input('ö', 20).type, 'hit');
  assert.equal(e.result().errors, 0);
});

test('Großbuchstabe zählt als ein Anschlag; ß und Umlaute über event.key', () => {
  const e = createEngine('Füße');
  typeAll(e, ['F', 'ü', 'ß', 'e']);
  assert.equal(e.result().hits, 4);
});

test('Timer pausiert nach 5 s ohne Eingabe', () => {
  const e = createEngine('abc');
  e.input('a', 0);
  e.input('b', 1000);
  e.input('c', 1000 + 60_000); // eine Minute Pause zählt nur 5 s
  const r = e.result();
  assert.equal(r.activeMs, 1000 + PAUSE_MS);
  assert.equal(r.seconds, 6);
});

test('Anschläge pro Minute', () => {
  assert.equal(apm(60, 60_000), 60);
  assert.equal(apm(30, 15_000), 120);
  assert.equal(apm(10, 0), 0);
  // 11 Anschläge, 10 Abstände à 600 ms = 6 s → 110 A/min
  const e = createEngine('aaaaaaaaaaa');
  typeAll(e, [...'aaaaaaaaaaa'], 600);
  assert.equal(e.result().apm, 110);
});

test('Genauigkeit', () => {
  assert.equal(accuracy(0, 0), 100);
  assert.equal(accuracy(95, 5), 95);
  assert.equal(accuracy(19, 1), 95);
});

test('Reaktionszeit wird pro Taste erfasst', () => {
  const e = createEngine('ff');
  e.input('f', 0);
  e.input('f', 400);
  const k = e.result().keyStats.f;
  assert.equal(k.timed, 1);
  assert.equal(k.totalMs, 400);
});

test('summarize fasst Schritte zusammen', () => {
  const a = createEngine('ab');
  typeAll(a, ['a', 'b'], 500);
  const b = createEngine('cd');
  typeAll(b, ['x', 'c', 'd'], 500);
  const r = summarize([a.snapshot(), b.snapshot()]);
  assert.equal(r.hits, 4);
  assert.equal(r.errors, 1);
  assert.equal(r.activeMs, 500 + 1000);
  assert.equal(r.accuracy, 80);
  assert.equal(r.keyStats.c.errors, 1);
});

test('Eingaben nach dem Ende werden ignoriert', () => {
  const e = createEngine('a');
  e.input('a', 0);
  assert.equal(e.input('b', 10).type, 'ignored');
  assert.equal(e.result().errors, 0);
});
