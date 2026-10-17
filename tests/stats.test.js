import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyResult, capSessions, isoWeek, problemKeys, localDay } from '../js/stats.js';
import { normalizeProfile } from '../js/storage.js';

const profile = () => normalizeProfile({ id: 'p_1', name: 'Moritz' });
const result = (accuracy, apm = 80, errors = 1) => ({
  hits: 100, errors, accuracy, apm, seconds: 60,
  keyStats: { f: { hits: 10, errors: 1, totalMs: 3000, timed: 10 } },
});

test('ab 95 % wird die nächste Lektion freigeschaltet', () => {
  const p = profile();
  const r = applyResult(p, 1, result(95), new Date(2026, 9, 17, 15, 2));
  assert.equal(r.passed, true);
  assert.equal(r.unlocked, 2);
  assert.equal(p.progress.currentLesson, 2);
  assert.equal(p.progress.lessons['1'].done, true);
  assert.equal(p.sessions[0].date, '2026-10-17T15:02');
  assert.ok(p.badges.includes('erste-lektion'));
});

test('unter 95 % bleibt die Lektion gesperrt, Tempo-Bestwert zählt nicht', () => {
  const p = profile();
  const r = applyResult(p, 1, result(94.9, 200));
  assert.equal(r.passed, false);
  assert.equal(p.progress.currentLesson, 1);
  assert.equal(p.progress.lessons['1'].bestApm, 0);
  assert.equal(p.progress.lessons['1'].attempts, 1);
});

test('Wiederholen einer alten Lektion ändert die aktuelle Lektion nicht', () => {
  const p = profile();
  p.progress.currentLesson = 4;
  applyResult(p, 2, result(99));
  assert.equal(p.progress.currentLesson, 4);
});

test('Tastenstatistik wird zusammengeführt', () => {
  const p = profile();
  applyResult(p, 1, result(96));
  applyResult(p, 1, result(96));
  assert.deepEqual(p.keyStats.f, { hits: 20, errors: 2, avgMs: 300 });
});

test('Serie zählt Tage in Folge', () => {
  const p = profile();
  applyResult(p, 1, result(96), new Date(2026, 9, 15, 10));
  applyResult(p, 1, result(96), new Date(2026, 9, 16, 10));
  applyResult(p, 1, result(96), new Date(2026, 9, 16, 18));
  assert.equal(p.streak.current, 2);
  applyResult(p, 1, result(96), new Date(2026, 9, 17, 10));
  assert.equal(p.streak.current, 3);
  assert.ok(p.badges.includes('drei-tage'));
  applyResult(p, 1, result(96), new Date(2026, 9, 20, 10));
  assert.equal(p.streak.current, 1);
});

test('mehr als 500 Sitzungen werden zu Wochenwerten', () => {
  const p = profile();
  for (let i = 0; i < 503; i++) {
    p.sessions.push({ date: '2026-10-12T10:00', lesson: 1, seconds: 60, apm: 50 + (i % 2) * 10, accuracy: 96 });
  }
  capSessions(p, 500);
  assert.equal(p.sessions.length, 500);
  assert.equal(p.weeks.length, 1);
  assert.equal(p.weeks[0].week, '2026-W42');
  assert.equal(p.weeks[0].sessions, 3);
  assert.equal(p.weeks[0].seconds, 180);
});

test('ISO-Kalenderwochen', () => {
  assert.equal(isoWeek('2026-10-17'), '2026-W42');
  assert.equal(isoWeek('2026-01-01'), '2026-W01');
  assert.equal(isoWeek('2027-01-01'), '2026-W53');
  assert.equal(isoWeek('2024-12-30'), '2025-W01');
});

test('Problemtasten nach Fehlerquote', () => {
  const keys = problemKeys({ a: { hits: 10, errors: 0 }, s: { hits: 5, errors: 5 }, d: { hits: 20, errors: 2 } });
  assert.deepEqual(keys.map((k) => k.ch), ['s', 'd']);
});

test('localDay nutzt die lokale Zeit', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
