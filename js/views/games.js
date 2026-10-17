// Spiele: Wörterregen (fallende Wörter abtippen) und Rennen gegen den Geist der eigenen besten Runde.

import { h, mount } from './dom.js';
import { rainWords } from '../generator.js';
import { applyRain } from '../stats.js';
import { getLesson, AVAILABLE_LESSONS } from '../lessons.js';
import { beep } from './sound.js';
import { badgeList, pauseHint } from './results.js';

const LIVES = 3;
const START_SPEED = { vorschule: 22, kind: 34, erwachsen: 44 }; // Pixel pro Sekunde
const SPAWN_MS = { vorschule: 3400, kind: 2600, erwachsen: 2200 };

/** Welches fallende Wort passt zur getippten Eingabe? Bevorzugt das am weitesten unten. */
export function chooseTarget(drops, ch) {
  const candidates = drops.filter((d) => d.word.startsWith(ch));
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b.y > a.y ? b : a));
}

function menu(root, ctx) {
  const p = ctx.profile;
  const current = Math.min(p.progress.currentLesson, AVAILABLE_LESSONS);
  const lessonSelect = h('select', { id: 'race-lesson' },
    Array.from({ length: current }, (_, i) => i + 1).map((nr) => h('option', { value: String(nr), selected: nr === current },
      `Lektion ${nr}: ${getLesson(nr).title}${p.ghosts?.[nr] ? ` (Geist: ${p.ghosts[nr].apm} A/min)` : ''}`)));
  mount(root,
    h('header.topbar', {},
      h('h1', {}, '🎮 Spiele'),
      h('nav.actions', {}, h('button.secondary', { type: 'button', onclick: () => ctx.go('course') }, 'Zurück'))),
    h('div.games', {},
      h('section.card.game-card', {},
        h('div.game-icon', { 'aria-hidden': 'true' }, '🌧️'),
        h('h2', {}, 'Wörterregen'),
        h('p', {}, 'Wörter fallen vom Himmel. Tippe sie ab, bevor sie unten ankommen! Nur Buchstaben, die du schon kannst.'),
        h('p.hint', {}, `Bester Punktestand: ${p.games.rainBest}`),
        h('button.primary', { type: 'button', onclick: () => ctx.go('games', { game: 'rain' }) }, 'Spielen')),
      h('section.card.game-card', {},
        h('div.game-icon', { 'aria-hidden': 'true' }, '👻'),
        h('h2', {}, 'Rennen gegen den Geist'),
        h('p', {}, 'Tippe einen festen Text und renne gegen deine eigene beste Runde.'),
        h('div.field', {}, h('label', { for: 'race-lesson' }, 'Strecke'), lessonSelect),
        h('button.primary', { type: 'button', onclick: () => ctx.startExercise({ mode: 'race', lesson: Number(lessonSelect.value) }) }, 'Los'))));
}

function rain(root, ctx) {
  const p = ctx.profile;
  const nr = Math.min(p.progress.currentLesson, AVAILABLE_LESSONS);
  const pool = rainWords(ctx.words, nr, p.ageGroup);
  const field = h('div.rain-field', { role: 'application', 'aria-label': 'Wörterregen' });
  const scoreEl = h('span', {}, '0');
  const livesEl = h('span', {}, '❤️'.repeat(LIVES));
  const levelEl = h('span', {}, '1');
  const overlay = h('button.focus-overlay', { type: 'button', hidden: true, onclick: () => resume() }, 'Pause – hier klicken zum Weiterspielen');
  const startNote = h('div.rain-start', {}, h('p', {}, 'Finger auf die Grundstellung!'), h('p.start-hint', {}, 'Drücke die ', h('kbd', {}, 'Leertaste'), ', um zu starten.'));

  mount(root,
    h('header.topbar.compact', {},
      h('h1', {}, '🌧️ Wörterregen'),
      h('nav.actions', {},
        h('p.rain-hud', {}, 'Punkte ', scoreEl, ' · Stufe ', levelEl, ' · ', livesEl),
        h('button.secondary', { type: 'button', onclick: () => ctx.go('games') }, 'Beenden'))),
    h('div.stage', {}, field, overlay),
    startNote);

  const ageGroup = p.ageGroup;
  let drops = [];
  let target = null;
  let typed = 0;
  let score = 0;
  let lives = LIVES;
  let words = 0;
  let hits = 0;
  let errors = 0;
  let speed = START_SPEED[ageGroup] ?? 34;
  let spawnMs = SPAWN_MS[ageGroup] ?? 2600;
  let running = false;
  let paused = false;
  let last = 0;
  let sinceSpawn = 0;
  let playMs = 0;
  let raf = 0;
  let lastWord = '';

  function spawn() {
    let word = pool[Math.floor(Math.random() * pool.length)];
    if (word === lastWord) word = pool[Math.floor(Math.random() * pool.length)];
    lastWord = word;
    const el = h('div.drop', {});
    field.append(el);
    const width = field.clientWidth;
    const x = 10 + Math.random() * Math.max(10, width - 200);
    const d = { word, y: -30, x, el };
    el.style.left = `${x}px`;
    drawDrop(d);
    drops.push(d);
  }

  function drawDrop(d) {
    d.el.replaceChildren(
      h('span.drop-done', {}, d.word.slice(0, d === target ? typed : 0)),
      h('span', {}, d.word.slice(d === target ? typed : 0)));
    d.el.classList.toggle('active', d === target);
    d.el.style.transform = `translateY(${d.y}px)`;
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (!running || paused) { last = t; return; }
    const dt = Math.min(100, t - (last || t));
    last = t;
    playMs += dt;
    sinceSpawn += dt;
    if (sinceSpawn >= spawnMs || !drops.length) { sinceSpawn = 0; spawn(); }
    const bottom = field.clientHeight - 30;
    for (const d of [...drops]) {
      d.y += (speed * dt) / 1000;
      if (d.y >= bottom) {
        d.el.remove();
        drops = drops.filter((x) => x !== d);
        if (d === target) { target = null; typed = 0; }
        lives--;
        livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(LIVES - Math.max(0, lives));
        if (p.settings.sound) beep('lost');
        if (lives <= 0) { gameOver(); return; }
      } else {
        d.el.style.transform = `translateY(${d.y}px)`;
      }
    }
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || (e.altKey && !e.getModifierState?.('AltGraph'))) return;
    if (e.key === ' ' || e.key === 'Backspace' || e.key === "'" || e.key === '/') e.preventDefault();
    if (paused) { resume(); return; }
    if (!running) {
      if (e.key === ' ') { running = true; startNote.remove(); }
      return;
    }
    if (e.repeat || [...e.key].length !== 1 || e.key === ' ') return;
    if (!target) {
      target = chooseTarget(drops, e.key);
      typed = 0;
      if (!target) { errors++; if (p.settings.sound) beep('error'); return; }
    }
    if (target.word[typed] === e.key) {
      hits++;
      typed++;
      if (typed === target.word.length) {
        score += target.word.length;
        words++;
        scoreEl.textContent = String(score);
        target.el.remove();
        drops = drops.filter((x) => x !== target);
        target = null;
        typed = 0;
        if (p.settings.sound) beep('ok');
        if (words % 8 === 0) {
          speed *= 1.12;
          spawnMs = Math.max(900, spawnMs * 0.9);
          levelEl.textContent = String(1 + words / 8);
        }
      } else {
        drawDrop(target);
      }
    } else {
      errors++;
      if (p.settings.sound) beep('error');
    }
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', pause);
    const seconds = Math.round(playMs / 1000);
    const total = hits + errors;
    const result = {
      hits, errors, seconds, activeMs: playMs, keyStats: {},
      accuracy: total ? Math.round((hits / total) * 1000) / 10 : 100,
      apm: playMs ? Math.round(hits / (playMs / 60000)) : 0,
    };
    const outcome = applyRain(p, nr, score, result);
    ctx.save();
    root.replaceChildren();
    mount(root,
      h('section.card.results', {},
        h('h1', {}, outcome.newBest ? '🏆 Neuer Rekord!' : '🌧️ Regen vorbei'),
        h('dl.metrics', {},
          h('div', {}, h('dt', {}, 'Punkte'), h('dd', {}, String(score))),
          h('div', {}, h('dt', {}, 'Wörter'), h('dd', {}, String(words))),
          h('div', {}, h('dt', {}, 'Genauigkeit'), h('dd', {}, `${String(result.accuracy).replace('.', ',')} %`)),
          h('div', {}, h('dt', {}, 'Rekord'), h('dd', {}, String(outcome.best)))),
        badgeList(outcome.newBadges),
        pauseHint(ctx, seconds),
        h('div.row', {},
          h('button.secondary', { type: 'button', onclick: () => ctx.go('games') }, 'Andere Spiele'),
          h('button.primary', { type: 'button', onclick: () => ctx.go('games', { game: 'rain' }) }, 'Nochmal'))));
  }

  function pause() {
    if (!running) return;
    paused = true;
    overlay.hidden = false;
  }

  function resume() {
    paused = false;
    overlay.hidden = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', pause);
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', pause);
  };
}

export function render(root, ctx, params = {}) {
  if (params.game === 'rain') return rain(root, ctx);
  return menu(root, ctx);
}
