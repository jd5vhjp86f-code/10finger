// Entdecker-Modus für Vorschulkinder: Buchstaben auf der Tastatur finden, Grundstellung ertasten.
// Kein Lesen nötig: großer Buchstabe, Bildschirmtastatur, Töne, auf Wunsch Vorlesen.

import { h, mount } from './dom.js';
import { renderKeyboard, renderHands, keyInfo, fingerName } from '../keyboard.js';
import { applyExplorer } from '../stats.js';
import { beep, speak } from './sound.js';
import { badgeList } from './results.js';

const ROUND = 10;
const HINT_AFTER_MS = 3000;
const HOME = ['a', 's', 'd', 'f', 'j', 'k', 'l', 'ö'];
const LETTERS = [...'abcdefghijklmnopqrstuvwxyzäöü'];

export const LEVELS = {
  grund: { icon: '🖐️', title: 'Grundstellung', text: 'Finger auf die Hügel – F und J!', letters: () => HOME, hintAlways: true },
  buchstaben: { icon: '🔤', title: 'Alle Buchstaben', text: 'Finde jeden Buchstaben', letters: () => LETTERS },
  name: { icon: '⭐', title: 'Mein Name', text: 'Die Buchstaben aus deinem Namen', letters: (p) => [...new Set([...p.name.toLowerCase()].filter((c) => LETTERS.includes(c) || c === 'ß'))] },
};

/** Reihenfolge der Ziele: Grundstellung beginnt immer mit F und J. */
export function explorerTargets(level, profile, rng = Math.random) {
  const pool = LEVELS[level].letters(profile);
  const out = level === 'grund' ? ['f', 'j'] : [];
  while (out.length < ROUND && pool.length) {
    const c = pool[Math.floor(rng() * pool.length)];
    if (c !== out.at(-1) || pool.length === 1) out.push(c);
  }
  return out;
}

function menu(root, ctx) {
  const p = ctx.profile;
  mount(root,
    h('header.topbar', {},
      h('h1', {}, '🔎 Entdecker'),
      h('nav.actions', {}, h('button.secondary', { type: 'button', onclick: () => ctx.go('course') }, 'Zurück'))),
    h('p.explorer-stars', {}, `🌟 ${p.explorer.stars} Sterne gesammelt`),
    h('div.explorer-levels', {},
      Object.entries(LEVELS).map(([id, l]) => h('button.activity.big', { type: 'button', onclick: () => ctx.go('explorer', { level: id }) },
        h('span.activity-icon', { 'aria-hidden': 'true' }, l.icon),
        h('span.activity-title', {}, l.title),
        h('span.activity-text', {}, l.text)))));
}

export function render(root, ctx, params = {}) {
  if (!params.level) return menu(root, ctx);
  const p = ctx.profile;
  const level = LEVELS[params.level];
  const targets = explorerTargets(params.level, p);
  let index = 0;
  let found = 0;
  let errors = 0;
  let hintTimer = 0;
  let locked = false;
  const startedAt = performance.now();

  const big = h('div.explorer-letter', { 'aria-live': 'polite' });
  const say = h('p.explorer-say', {});
  const stars = h('div.explorer-row', { 'aria-label': 'Sterne' });
  const kbBox = h('div.kb-box.explorer-kb');
  const keyboard = renderKeyboard(kbBox);
  const hands = renderHands(kbBox);

  mount(root,
    h('header.topbar.compact', {},
      h('h1', {}, `${level.icon} ${level.title}`),
      h('nav.actions', {}, h('button.secondary', { type: 'button', onclick: () => ctx.go('explorer') }, 'Zurück'))),
    stars, big, say, kbBox);

  function drawStars() {
    stars.replaceChildren(...targets.map((_, i) => h(`span.star${i < found ? '.on' : ''}`, { 'aria-hidden': 'true' }, i < found ? '★' : '☆')));
    stars.setAttribute('aria-label', `${found} von ${targets.length} Sternen`);
  }

  function showHint() {
    const t = targets[index];
    const info = keyboard.highlight(t);
    if (info) hands.highlight([info.finger], fingerName(info.finger));
  }

  function next() {
    locked = false;
    clearTimeout(hintTimer);
    keyboard.clear();
    hands.highlight([], '');
    if (index >= targets.length) return finish();
    const t = targets[index];
    big.replaceChildren(h('span.upper', {}, t.toUpperCase()), h('span.lower', {}, t));
    const prompt = params.level === 'grund' && index < 2
      ? `Leg die Finger auf die Grundstellung. Fühlst du den Hügel? Drück das ${t.toUpperCase()}!`
      : `Finde das ${t.toUpperCase()}!`;
    say.textContent = prompt;
    if (p.settings.speech) speak(prompt);
    if (level.hintAlways) showHint();
    else hintTimer = setTimeout(showHint, HINT_AFTER_MS);
  }

  function finish() {
    const seconds = Math.round((performance.now() - startedAt) / 1000);
    const total = found + errors;
    const result = { hits: found, errors, accuracy: total ? Math.round((found / total) * 1000) / 10 : 100, apm: 0, seconds, activeMs: seconds * 1000, keyStats: {} };
    const { newBadges } = applyExplorer(p, found, result);
    ctx.save();
    window.removeEventListener('keydown', onKeyDown);
    beep('fanfare');
    if (p.settings.speech) speak(`Super! ${found} Sterne!`);
    root.replaceChildren();
    mount(root,
      h('section.card.results.explorer-done', {},
        h('div.explorer-celebrate', { 'aria-hidden': 'true' }, '🌟🎉🌟'),
        h('h1', {}, `${found} Sterne!`),
        h('p', {}, `Zusammen hast du schon ${p.explorer.stars} Sterne gesammelt.`),
        badgeList(newBadges),
        h('div.row', {},
          h('button.primary', { type: 'button', onclick: () => ctx.go('explorer', { level: params.level }) }, 'Nochmal'),
          h('button.secondary', { type: 'button', onclick: () => ctx.go('explorer') }, 'Anderes Spiel'),
          h('button.secondary', { type: 'button', onclick: () => ctx.go('course') }, 'Fertig'))));
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || locked) return;
    if (e.key === ' ' || e.key === 'Backspace') e.preventDefault();
    if ([...e.key].length !== 1 || e.key === ' ') return;
    const t = targets[index];
    if (e.key.toLowerCase() === t) {
      locked = true;
      found++;
      index++;
      drawStars();
      if (p.settings.sound) beep('star');
      big.classList.add('pop');
      setTimeout(() => { big.classList.remove('pop'); next(); }, 700);
    } else {
      errors++;
      if (p.settings.sound) beep('error');
      const pressed = keyInfo(e.key.toLowerCase()) ? e.key.toUpperCase() : e.key;
      say.textContent = `Das war das ${pressed}. Suche das ${t.toUpperCase()}!`;
      showHint();
    }
  }

  window.addEventListener('keydown', onKeyDown);
  drawStars();
  next();

  return () => {
    clearTimeout(hintTimer);
    window.removeEventListener('keydown', onKeyDown);
    globalThis.speechSynthesis?.cancel?.();
  };
}
