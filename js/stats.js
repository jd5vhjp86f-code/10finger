// Auswertung, Bestwerte, Serie, Abzeichen. Verändert nur Objekte im Speicher;
// gespeichert wird anschließend über storage.js.

import { PASS_ACCURACY, LESSONS } from './lessons.js';

export const MAX_SESSIONS = 500;

export const BADGES = {
  'erste-lektion': { icon: '🎉', label: 'Erste Lektion geschafft' },
  'hundert-prozent': { icon: '🎯', label: '100 % ohne Fehler' },
  'drei-tage': { icon: '🔥', label: '3 Tage in Folge geübt' },
};

const pad = (n) => String(n).padStart(2, '0');

export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localStamp(d = new Date()) {
  return `${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function previousDay(day) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDay(d);
}

/** ISO-Kalenderwoche als „2026-W42“. */
export function isoWeek(day) {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // Donnerstag derselben Woche
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

/** Ältere Sitzungen über MAX_SESSIONS hinaus zu Wochenwerten zusammenfassen. */
export function capSessions(profile, max = MAX_SESSIONS) {
  if (profile.sessions.length <= max) return;
  const old = profile.sessions.splice(0, profile.sessions.length - max);
  for (const s of old) {
    const week = isoWeek(s.date);
    let w = profile.weeks.find((x) => x.week === week);
    if (!w) {
      w = { week, sessions: 0, seconds: 0, apm: 0, accuracy: 0 };
      profile.weeks.push(w);
    }
    const n = w.sessions;
    w.apm = Math.round((w.apm * n + s.apm) / (n + 1));
    w.accuracy = Math.round(((w.accuracy * n + s.accuracy) / (n + 1)) * 10) / 10;
    w.seconds += s.seconds;
    w.sessions = n + 1;
  }
  profile.weeks.sort((a, b) => a.week.localeCompare(b.week));
}

function mergeKeyStats(target, delta) {
  for (const [ch, d] of Object.entries(delta)) {
    const t = (target[ch] ??= { hits: 0, errors: 0, avgMs: 0 });
    const timedBefore = t.hits;
    if (d.timed > 0) {
      t.avgMs = Math.round((t.avgMs * timedBefore + d.totalMs) / (timedBefore + d.timed));
    }
    t.hits += d.hits;
    t.errors += d.errors;
  }
}

function updateStreak(profile, today) {
  const s = profile.streak;
  if (s.lastDay === today) return;
  s.current = s.lastDay === previousDay(today) ? s.current + 1 : 1;
  s.lastDay = today;
}

/**
 * Ergebnis einer Übung ins Profil übernehmen.
 * @returns {{passed: boolean, unlocked: number|null, newBestApm: boolean, newBestAccuracy: boolean, newBadges: string[]}}
 */
export function applyResult(profile, lessonNr, result, now = new Date()) {
  const passed = result.accuracy >= PASS_ACCURACY;
  const key = String(lessonNr);
  const before = profile.progress.lessons[key];
  const entry = before
    ? { ...before }
    : { done: false, bestApm: 0, bestAccuracy: 0, attempts: 0 };
  const newBestApm = passed && result.apm > entry.bestApm;
  const newBestAccuracy = result.accuracy > entry.bestAccuracy;
  entry.attempts += 1;
  entry.done = entry.done || passed;
  // Bestes Tempo zählt nur bei bestandener Genauigkeit – Genauigkeit vor Tempo.
  if (newBestApm) entry.bestApm = result.apm;
  if (newBestAccuracy) entry.bestAccuracy = result.accuracy;
  profile.progress.lessons[key] = entry;

  let unlocked = null;
  if (passed && lessonNr >= profile.progress.currentLesson && lessonNr < LESSONS.length) {
    profile.progress.currentLesson = lessonNr + 1;
    unlocked = lessonNr + 1;
  }

  mergeKeyStats(profile.keyStats, result.keyStats);
  profile.sessions.push({
    date: localStamp(now),
    lesson: lessonNr,
    seconds: result.seconds,
    apm: result.apm,
    accuracy: result.accuracy,
  });
  capSessions(profile);
  updateStreak(profile, localDay(now));

  const newBadges = [];
  const award = (id) => {
    if (!profile.badges.includes(id)) { profile.badges.push(id); newBadges.push(id); }
  };
  if (passed) award('erste-lektion');
  if (result.errors === 0 && result.hits >= 20) award('hundert-prozent');
  if (profile.streak.current >= 3) award('drei-tage');

  return { passed, unlocked, newBestApm, newBestAccuracy, newBadges };
}

/** Tasten mit den meisten Fehlern (für die Ergebnisansicht). */
export function problemKeys(keyStats, limit = 3) {
  return Object.entries(keyStats)
    .filter(([, s]) => s.errors > 0)
    .sort((a, b) => b[1].errors / (b[1].hits + b[1].errors) - a[1].errors / (a[1].hits + a[1].errors) || b[1].errors - a[1].errors)
    .slice(0, limit)
    .map(([ch, s]) => ({ ch, errors: s.errors, hits: s.hits }));
}

export function minutesToday(profile, today = localDay()) {
  const sec = profile.sessions.filter((s) => s.date.startsWith(today)).reduce((a, s) => a + s.seconds, 0);
  return Math.round(sec / 60);
}
