// Auswertung, Bestwerte, Serie, Abzeichen, Schwächen, Geist. Verändert nur Objekte im Speicher;
// gespeichert wird anschließend über storage.js.

import { PASS_ACCURACY, LESSONS } from './lessons.js';
import { AGE_GROUPS } from './profiles.js';

export const MAX_SESSIONS = 500;

export const SESSION_KINDS = {
  lesson: 'Lektion',
  warmup: 'Aufwärmen',
  weakness: 'Schwächentraining',
  custom: 'Eigener Text',
  race: 'Rennen',
  rain: 'Wörterregen',
  explorer: 'Entdecker',
};

export const BADGES = {
  'erste-lektion': { icon: '🎉', label: 'Erste Lektion geschafft' },
  grundreihe: { icon: '🏡', label: 'Grundstellung sitzt' },
  grossschreibung: { icon: '🏰', label: 'Großschreibung gemeistert' },
  halbzeit: { icon: '⛰️', label: 'Halbzeit: 8 Lektionen' },
  'alle-buchstaben': { icon: '🌋', label: 'Alle Buchstaben gelernt' },
  tastenprofi: { icon: '💎', label: 'Ganzer Kurs geschafft' },
  'hundert-prozent': { icon: '🎯', label: '100 % ohne Fehler' },
  'tempo-100': { icon: '🚀', label: '100 Anschläge pro Minute' },
  'tempo-200': { icon: '⚡', label: '200 Anschläge pro Minute' },
  'drei-tage': { icon: '🔥', label: '3 Tage in Folge geübt' },
  'sieben-tage': { icon: '🌟', label: '7 Tage in Folge geübt' },
  tagesziel: { icon: '✅', label: 'Tagesziel erreicht' },
  fleissig: { icon: '⏱️', label: '60 Minuten geübt' },
  'geist-besiegt': { icon: '👻', label: 'Den eigenen Geist geschlagen' },
  regenmacher: { icon: '🌧️', label: '50 Punkte im Wörterregen' },
  entdecker: { icon: '🔎', label: '25 Entdecker-Sterne' },
};

const pad = (n) => String(n).padStart(2, '0');

export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localStamp(d = new Date()) {
  return `${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
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
  for (const [ch, d] of Object.entries(delta ?? {})) {
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
  s.current = s.lastDay === shiftDay(today, -1) ? s.current + 1 : 1;
  s.lastDay = today;
}

export function dailyGoal(profile) {
  return profile.settings.dailyGoal ?? AGE_GROUPS[profile.ageGroup]?.minutes ?? 10;
}

export function secondsOn(profile, day) {
  return profile.sessions.filter((s) => s.date.startsWith(day)).reduce((a, s) => a + s.seconds, 0);
}

export function minutesToday(profile, today = localDay()) {
  return Math.round(secondsOn(profile, today) / 60);
}

/** Minuten der letzten 7 Tage (heute eingeschlossen). */
export function minutesLastWeek(profile, today = localDay()) {
  let sec = 0;
  for (let i = 0; i < 7; i++) sec += secondsOn(profile, shiftDay(today, -i));
  return Math.round(sec / 60);
}

export function totalMinutes(profile) {
  const sec = profile.sessions.reduce((a, s) => a + s.seconds, 0) + profile.weeks.reduce((a, w) => a + w.seconds, 0);
  return Math.round(sec / 60);
}

export function lastSession(profile) {
  return profile.sessions.at(-1) ?? null;
}

/** Verlauf für die Familienübersicht: nur Sitzungen mit sinnvollem Tempo. */
export function trend(profile, n = 20) {
  return profile.sessions
    .filter((s) => (s.kind ?? 'lesson') !== 'explorer' && s.apm > 0)
    .slice(-n);
}

function award(profile, id, list) {
  if (!profile.badges.includes(id)) {
    profile.badges.push(id);
    list.push(id);
  }
}

/**
 * Jede Übung (gleich welcher Art) eintragen: Sitzung, Tastenstatistik, Serie, allgemeine Abzeichen.
 * @returns {{newBadges: string[], goalReached: boolean}}
 */
export function recordSession(profile, kind, lessonNr, result, now = new Date()) {
  const today = localDay(now);
  const before = minutesToday(profile, today);
  mergeKeyStats(profile.keyStats, result.keyStats);
  profile.sessions.push({
    date: localStamp(now),
    kind,
    lesson: lessonNr,
    seconds: result.seconds,
    apm: result.apm,
    accuracy: result.accuracy,
  });
  capSessions(profile);
  updateStreak(profile, today);

  const newBadges = [];
  const goal = dailyGoal(profile);
  const after = minutesToday(profile, today);
  const goalReached = before < goal && after >= goal;
  if (goalReached) award(profile, 'tagesziel', newBadges);
  if (kind !== 'explorer' && kind !== 'rain') {
    if (result.errors === 0 && result.hits >= 20) award(profile, 'hundert-prozent', newBadges);
    if (result.accuracy >= PASS_ACCURACY && result.hits >= 50) {
      if (result.apm >= 100) award(profile, 'tempo-100', newBadges);
      if (result.apm >= 200) award(profile, 'tempo-200', newBadges);
    }
  }
  if (profile.streak.current >= 3) award(profile, 'drei-tage', newBadges);
  if (profile.streak.current >= 7) award(profile, 'sieben-tage', newBadges);
  if (totalMinutes(profile) >= 60) award(profile, 'fleissig', newBadges);
  return { newBadges, goalReached };
}

const LESSON_BADGES = { 1: 'grundreihe', 6: 'grossschreibung', 8: 'halbzeit', 14: 'alle-buchstaben', 16: 'tastenprofi' };

/**
 * Ergebnis einer Lektion übernehmen.
 * @returns {{passed: boolean, unlocked: number|null, newBestApm: boolean, newBestAccuracy: boolean, newBadges: string[], goalReached: boolean}}
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

  const { newBadges, goalReached } = recordSession(profile, 'lesson', lessonNr, result, now);
  if (passed) {
    award(profile, 'erste-lektion', newBadges);
    if (LESSON_BADGES[lessonNr]) award(profile, LESSON_BADGES[lessonNr], newBadges);
  }
  return { passed, unlocked, newBestApm, newBestAccuracy, newBadges, goalReached };
}

/** Tasten mit den meisten Fehlern (für die Ergebnisansicht). */
export function problemKeys(keyStats, limit = 3, minTotal = 1) {
  return Object.entries(keyStats)
    .filter(([, s]) => s.errors > 0 && s.hits + s.errors >= minTotal)
    .sort((a, b) => b[1].errors / (b[1].hits + b[1].errors) - a[1].errors / (a[1].hits + a[1].errors) || b[1].errors - a[1].errors)
    .slice(0, limit)
    .map(([ch, s]) => ({ ch, errors: s.errors, hits: s.hits }));
}

/**
 * Schwächste Tasten für das Schwächentraining: hohe Fehlerquote oder deutlich langsamer als üblich.
 * @param {Set<string>} known nur diese Zeichen kommen in Frage
 */
export function weakKeys(keyStats, known, limit = 4, minTotal = 15) {
  const entries = Object.entries(keyStats).filter(([ch, s]) => ch !== ' ' && known.has(ch.toLowerCase()) && s.hits + s.errors >= minTotal);
  if (!entries.length) return [];
  const times = entries.map(([, s]) => s.avgMs).filter((t) => t > 0).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;
  return entries
    .map(([ch, s]) => {
      const rate = s.errors / (s.hits + s.errors);
      const slow = median && s.avgMs > median * 1.3 ? (s.avgMs / median - 1) * 0.05 : 0;
      return { ch, score: rate + slow };
    })
    .filter((e) => e.score >= 0.03)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => e.ch);
}

// ---------- Geist (Rennen gegen die eigene beste Runde) ----------

/** Zeitpunkte (ms) → Abstände, kompakt zum Speichern. */
export function encodeTimeline(timeline) {
  const out = [];
  let prev = 0;
  for (const t of timeline) {
    out.push(Math.max(0, Math.round(t - prev)));
    prev = t;
  }
  return out;
}

/** Wie viele Zeichen hatte der Geist nach `ms` aktiver Zeit getippt? */
export function ghostPosition(deltas, ms) {
  let t = 0;
  for (let i = 0; i < deltas.length; i++) {
    t += deltas[i];
    if (t > ms) return i;
  }
  return deltas.length;
}

/**
 * Rennen auswerten und ggf. neuen Geist speichern (nur bei ≥ 95 % und schneller als der alte).
 * @returns {{beatGhost: boolean, hadGhost: boolean, newGhost: boolean, newBadges: string[]}}
 */
export function applyRace(profile, lessonNr, text, result, timeline) {
  profile.ghosts ??= {};
  const old = profile.ghosts[lessonNr];
  const valid = old && old.text === text;
  const totalMs = result.activeMs;
  const oldMs = valid ? old.times.reduce((a, b) => a + b, 0) : Infinity;
  const passed = result.accuracy >= PASS_ACCURACY;
  const beatGhost = valid && passed && totalMs < oldMs;
  const newGhost = passed && totalMs < oldMs;
  if (newGhost) profile.ghosts[lessonNr] = { text, apm: result.apm, accuracy: result.accuracy, times: encodeTimeline(timeline) };
  const { newBadges } = recordSession(profile, 'race', lessonNr, result);
  if (beatGhost) award(profile, 'geist-besiegt', newBadges);
  return { beatGhost, hadGhost: Boolean(valid), newGhost, newBadges };
}

export function applyRain(profile, lessonNr, score, result) {
  profile.games ??= {};
  const best = profile.games.rainBest ?? 0;
  const newBest = score > best;
  if (newBest) profile.games.rainBest = score;
  const { newBadges } = recordSession(profile, 'rain', lessonNr, result);
  if (score >= 50) award(profile, 'regenmacher', newBadges);
  return { newBest, best: Math.max(best, score), newBadges };
}

export function applyExplorer(profile, stars, result) {
  profile.explorer.stars += stars;
  const { newBadges } = recordSession(profile, 'explorer', 0, result);
  if (profile.explorer.stars >= 25) award(profile, 'entdecker', newBadges);
  return { newBadges };
}
