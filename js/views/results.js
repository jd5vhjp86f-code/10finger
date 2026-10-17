// Ergebnisansicht: Messwerte, bestanden ja/nein, Bestwerte, Problemtasten.

import { h, mount } from './dom.js';
import { applyResult, problemKeys, BADGES } from '../stats.js';
import { PASS_ACCURACY, AVAILABLE_LESSONS, getLesson } from '../lessons.js';
import { describeChar } from '../keyboard.js';

const fmt = (n) => String(n).replace('.', ',');

function duration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

export function render(root, ctx, { lesson: nr, result }) {
  const p = ctx.profile;
  const outcome = applyResult(p, nr, result);
  ctx.save();

  const next = nr + 1;
  const nextOpen = next <= AVAILABLE_LESSONS && p.progress.currentLesson >= next;
  const kid = p.ageGroup !== 'erwachsen';

  const headline = outcome.passed
    ? (kid ? '🌟 Super gemacht!' : 'Geschafft!')
    : (kid ? '💪 Fast! Noch einmal üben.' : 'Noch nicht ganz.');
  const explain = outcome.passed
    ? (outcome.unlocked && outcome.unlocked <= AVAILABLE_LESSONS
      ? `Lektion ${outcome.unlocked} ist jetzt frei.`
      : outcome.unlocked ? 'Die nächsten Lektionen kommen bald.' : 'Lektion wiederholt – gut für die Sicherheit.')
    : `Für die nächste Lektion brauchst du ${PASS_ACCURACY} % richtige Anschläge. Langsamer tippen hilft!`;

  const problems = problemKeys(result.keyStats);

  mount(root,
    h('section.card.results', {},
      h('p.kicker', {}, `Lektion ${nr}: ${getLesson(nr).title}`),
      h('h1', {}, headline),
      h('p', {}, explain),
      h('dl.metrics', {},
        h('div', {}, h('dt', {}, 'Genauigkeit'), h('dd', {}, `${fmt(result.accuracy)} %`, outcome.newBestAccuracy ? h('span.best', {}, ' Bestwert!') : '')),
        h('div', {}, h('dt', {}, 'Anschläge pro Minute'), h('dd', {}, String(result.apm), outcome.newBestApm ? h('span.best', {}, ' Bestwert!') : '')),
        h('div', {}, h('dt', {}, 'Fehler'), h('dd', {}, String(result.errors))),
        h('div', {}, h('dt', {}, 'Dauer'), h('dd', {}, duration(result.seconds)))),
      problems.length
        ? h('div.problems', {},
          h('h2', {}, 'Diese Tasten üben wir noch'),
          h('ul', {}, problems.map((k) => h('li', {}, h('kbd', {}, k.ch === ' ' ? 'Leertaste' : k.ch), ` ${k.errors}× daneben – ${describeChar(k.ch).split(': ')[1] ?? ''}`))))
        : null,
      outcome.newBadges.length
        ? h('div.badges', {}, outcome.newBadges.map((id) => h('span.badge.new', {}, `${BADGES[id].icon} Neues Abzeichen: ${BADGES[id].label}`)))
        : null,
      h('div.row', {},
        h('button.secondary', { type: 'button', onclick: () => ctx.go('course') }, 'Zum Kurs'),
        h('button.secondary', { type: 'button', onclick: () => ctx.go('exercise', { lesson: nr }) }, 'Nochmal'),
        nextOpen ? h('button.primary', { type: 'button', onclick: () => ctx.go('exercise', { lesson: next }) }, `Weiter mit Lektion ${next}`) : null),
      h('p.hint', {}, 'Tipp: Mit der Eingabetaste geht es weiter.'),
    ),
  );

  // Nur die Eingabetaste führt weiter – ein nachträglich getipptes Leerzeichen soll nichts auslösen.
  const primary = root.querySelector('button.primary') ?? root.querySelectorAll('button.secondary')[1];
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.repeat && document.activeElement === document.body) {
      e.preventDefault();
      primary.click();
    }
  }
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
