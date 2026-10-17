// Ergebnisansicht: Messwerte, bestanden ja/nein, Bestwerte, Problemtasten, Abzeichen, Pausenhinweis.

import { h, mount } from './dom.js';
import { applyResult, applyRace, recordSession, problemKeys, BADGES, dailyGoal, minutesToday } from '../stats.js';
import { PASS_ACCURACY, AVAILABLE_LESSONS, getLesson } from '../lessons.js';
import { describeChar } from '../keyboard.js';
import { beep } from './sound.js';

const fmt = (n) => String(n).replace('.', ',');
export const PAUSE_AFTER_SECONDS = 15 * 60;

function duration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

export function badgeList(ids) {
  return ids.length
    ? h('div.badges', {}, ids.map((id) => h('span.badge.new', {}, `${BADGES[id].icon} Neues Abzeichen: ${BADGES[id].label}`)))
    : null;
}

/** Pausenhinweis, sobald in dieser Sitzung 15 Minuten zusammenkommen. */
export function pauseHint(ctx, seconds) {
  ctx.practiceSeconds = (ctx.practiceSeconds ?? 0) + seconds;
  if (ctx.practiceSeconds < PAUSE_AFTER_SECONDS) return null;
  ctx.practiceSeconds = 0;
  return h('div.pause-hint', { role: 'note' },
    h('strong', {}, '🧘 Zeit für eine kurze Pause! '),
    'Du übst schon 15 Minuten. Steh kurz auf, schüttel die Hände aus und schau aus dem Fenster in die Ferne.');
}

export function render(root, ctx, params) {
  const { mode = 'lesson', lesson: nr, result } = params;
  const p = ctx.profile;
  const kid = p.ageGroup !== 'erwachsen';
  let headline;
  let explain;
  let newBadges = [];
  let goalReached = false;
  let bestApm = false;
  let bestAcc = false;
  const buttons = [];

  if (mode === 'lesson') {
    const outcome = applyResult(p, nr, result);
    ({ newBadges, goalReached } = outcome);
    bestApm = outcome.newBestApm;
    bestAcc = outcome.newBestAccuracy;
    headline = outcome.passed ? (kid ? '🌟 Super gemacht!' : 'Geschafft!') : (kid ? '💪 Fast! Noch einmal üben.' : 'Noch nicht ganz.');
    explain = outcome.passed
      ? (outcome.unlocked && outcome.unlocked <= AVAILABLE_LESSONS
        ? `Lektion ${outcome.unlocked} (${getLesson(outcome.unlocked).place}) ist jetzt frei.`
        : nr === AVAILABLE_LESSONS ? 'Du hast den ganzen Kurs geschafft! Jetzt geht es um Tempo – probier die Spiele.' : 'Lektion wiederholt – gut für die Sicherheit.')
      : `Für die nächste Lektion brauchst du ${PASS_ACCURACY} % richtige Anschläge. Langsamer tippen hilft!`;
    const next = nr + 1;
    buttons.push(h('button.secondary', { type: 'button', onclick: () => ctx.startExercise({ mode: 'lesson', lesson: nr }, { skipWarmup: true }) }, 'Nochmal'));
    if (next <= AVAILABLE_LESSONS && p.progress.currentLesson >= next) {
      buttons.push(h('button.primary', { type: 'button', onclick: () => ctx.startExercise({ mode: 'lesson', lesson: next }, { skipWarmup: true }) }, `Weiter mit Lektion ${next}`));
    }
    if (outcome.passed) beep('fanfare');
  } else if (mode === 'race') {
    const outcome = applyRace(p, nr, params.text, result, params.timeline);
    newBadges = outcome.newBadges;
    headline = outcome.beatGhost ? '👻 Geist geschlagen!' : outcome.newGhost ? '🏁 Neuer Geist gespeichert' : outcome.hadGhost ? 'Der Geist war schneller' : 'Ziel erreicht';
    explain = result.accuracy < PASS_ACCURACY
      ? `Für einen neuen Geist brauchst du mindestens ${PASS_ACCURACY} % Genauigkeit.`
      : outcome.newGhost ? 'Beim nächsten Rennen läuft diese Runde als Geist gegen dich.' : 'Versuch es gleich noch einmal!';
    buttons.push(h('button.primary', { type: 'button', onclick: () => ctx.go('exercise', { mode: 'race', lesson: nr }) }, 'Nochmal rennen'));
    if (outcome.beatGhost) beep('fanfare');
  } else {
    ({ newBadges, goalReached } = recordSession(p, mode, nr, result));
    headline = { warmup: '🔥 Aufgewärmt!', weakness: '💪 Schwächen trainiert', custom: '📄 Text geschafft' }[mode] ?? 'Fertig!';
    explain = mode === 'weakness' && params.weak?.length ? `Geübt: ${params.weak.join(' ')}` : '';
    if (params.next) {
      buttons.push(h('button.primary', { type: 'button', onclick: () => ctx.go('exercise', params.next) }, `Weiter mit Lektion ${params.next.lesson}`));
    } else if (mode !== 'custom') {
      buttons.push(h('button.secondary', { type: 'button', onclick: () => ctx.go('exercise', { mode }) }, 'Nochmal'));
    }
  }
  ctx.save();

  const problems = problemKeys(result.keyStats);
  const goal = dailyGoal(p);

  mount(root,
    h('section.card.results', {},
      nr && mode === 'lesson' ? h('p.kicker', {}, `Lektion ${nr}: ${getLesson(nr).title}`) : null,
      h('h1', {}, headline),
      explain ? h('p', {}, explain) : null,
      goalReached ? h('p.goal-reached', {}, `✅ Tagesziel geschafft: ${goal} Minuten!`) : null,
      h('dl.metrics', {},
        h('div', {}, h('dt', {}, 'Genauigkeit'), h('dd', {}, `${fmt(result.accuracy)} %`, bestAcc ? h('span.best', {}, ' Bestwert!') : '')),
        h('div', {}, h('dt', {}, 'Anschläge pro Minute'), h('dd', {}, String(result.apm), bestApm ? h('span.best', {}, ' Bestwert!') : '')),
        h('div', {}, h('dt', {}, 'Fehler'), h('dd', {}, String(result.errors))),
        h('div', {}, h('dt', {}, 'Dauer'), h('dd', {}, duration(result.seconds)))),
      problems.length
        ? h('div.problems', {},
          h('h2', {}, 'Diese Tasten üben wir noch'),
          h('ul', {}, problems.map((k) => h('li', {}, h('kbd', {}, k.ch === ' ' ? 'Leertaste' : k.ch), ` ${k.errors}× daneben – ${describeChar(k.ch).split(': ')[1] ?? ''}`))))
        : null,
      badgeList(newBadges),
      pauseHint(ctx, result.seconds),
      h('p.hint', {}, `Heute geübt: ${minutesToday(p)} von ${goal} Minuten`),
      h('div.row', {},
        h('button.secondary', { type: 'button', onclick: () => ctx.go('course') }, 'Zum Kurs'),
        buttons),
      h('p.hint', {}, 'Tipp: Mit der Eingabetaste geht es weiter.'),
    ),
  );

  // Nur die Eingabetaste führt weiter – ein nachträglich getipptes Leerzeichen soll nichts auslösen.
  const primary = root.querySelector('.results button.primary') ?? root.querySelector('.results .row button');
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.repeat && document.activeElement === document.body) {
      e.preventDefault();
      primary.click();
    }
  }
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
