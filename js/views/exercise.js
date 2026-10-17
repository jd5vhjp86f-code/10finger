// Übungsbildschirm: Vorstellung, dann Schritte abtippen.
// Arten: lesson (Lektion), warmup (1 Minute), weakness (Schwächentraining), custom (eigener Text),
// race (Rennen gegen den Geist der eigenen besten Runde).

import { h, mount } from './dom.js';
import { createEngine, summarize, PAUSE_MS } from '../engine.js';
import { generateLesson, warmupText, weaknessSteps, raceText, chunkText, wrapText } from '../generator.js';
import { getLesson, newChars, knownChars, SHIFT } from '../lessons.js';
import { renderKeyboard, renderHands, keyInfo, describeChar, fingerName } from '../keyboard.js';
import { weakKeys, ghostPosition } from '../stats.js';
import { beep } from './sound.js';

const LINE_LENGTH = { riesig: 20, gross: 28, normal: 36 };
const WARMUP_MS = 60_000;
const BLIND_ACCURACY = 97;

/** Soll die Bildschirmtastatur verborgen sein (Blindmodus)? */
export function isBlind(profile, lessonNr) {
  const mode = profile.settings.blindMode;
  if (mode === 'immer') return true;
  if (mode !== 'auto' || !lessonNr) return false;
  const info = profile.progress.lessons[String(lessonNr)];
  return Boolean(info?.done && info.bestAccuracy >= BLIND_ACCURACY);
}

function buildPlan(ctx, params) {
  const p = ctx.profile;
  const nr = params.lesson ?? Math.min(p.progress.currentLesson, 16);
  const opts = { words: ctx.words, sentences: ctx.sentences, ageGroup: p.ageGroup };
  switch (params.mode) {
    case 'warmup': {
      const best = Math.max(0, ...Object.values(p.progress.lessons).map((l) => l.bestApm ?? 0));
      const chars = Math.max(120, Math.round((best || 80) * 1.3));
      return {
        nr, title: 'Aufwärmen', timeLimit: WARMUP_MS,
        steps: [{ id: 'warmup', title: '1 Minute bekannte Tasten', text: warmupText(nr, { ...opts, chars }) }],
        intro: () => [h('p', {}, 'Eine Minute lockeres Tippen mit Tasten, die du schon kannst. Finger auf die Grundstellung!')],
      };
    }
    case 'weakness': {
      const weak = weakKeys(p.keyStats, knownChars(nr));
      return {
        nr, title: 'Schwächentraining', weak,
        steps: weaknessSteps(nr, weak, opts),
        intro: () => [
          h('p', {}, 'Diese Tasten gehen noch daneben oder dauern lange – heute üben wir sie gezielt:'),
          h('ul.intro-keys', {}, weak.map((c) => h('li', {}, h('kbd', {}, c), ` – ${fingerName(keyInfo(c)?.finger)}`))),
        ],
        highlight: weak,
      };
    }
    case 'custom':
      return {
        nr: 0, title: params.title || 'Eigener Text',
        steps: chunkText(params.text).map((text, i, all) => ({ id: `custom-${i}`, title: all.length > 1 ? `Abschnitt ${i + 1}` : 'Text', text })),
        intro: () => [h('p', {}, 'Tippe deinen eigenen Text ab. Zeichen, die nicht auf der Tastatur liegen, wurden entfernt.')],
      };
    case 'race': {
      const text = raceText(nr, opts);
      const ghost = p.ghosts?.[nr]?.text === text ? p.ghosts[nr] : null;
      return {
        nr, title: `Rennen: Lektion ${nr}`, ghost, raceText: text,
        steps: [{ id: 'race', title: 'Rennen', text }],
        intro: () => [h('p', {}, ghost
          ? `Dein Geist ist ${ghost.apm} Anschläge pro Minute gelaufen. Schaffst du es schneller – mit mindestens 95 % Genauigkeit?`
          : 'Noch kein Geist da. Tipp diese Runde mit mindestens 95 % – dann läuft sie beim nächsten Mal als Geist gegen dich.')],
      };
    }
    default: {
      const lesson = getLesson(nr);
      return {
        nr, lesson, title: `Lektion ${nr}: ${lesson.title}`,
        steps: generateLesson(nr, opts),
        intro: null,
      };
    }
  }
}

export function render(root, ctx, params) {
  const p = ctx.profile;
  const settings = p.settings;
  const mode = params.mode ?? 'lesson';
  const plan = buildPlan(ctx, { ...params, mode });
  const { nr, steps } = plan;

  if (!steps.length) {
    mount(root, h('section.card.results', {},
      h('h1', {}, plan.title),
      h('p', {}, mode === 'weakness'
        ? 'Noch keine Schwächen gefunden – übe erst ein paar Lektionen, dann weiß ich, welche Tasten du trainieren solltest.'
        : 'Für diese Übung gibt es keinen Text.'),
      h('div.row', {}, h('button.primary', { type: 'button', onclick: () => ctx.go('course') }, 'Zum Kurs'))));
    return null;
  }

  const snapshots = [];
  let stepIndex = -1; // -1 = Vorstellung
  let engine = null;
  let lines = [];
  let paused = false;
  let lastKeyAt = null;
  let raf = 0;
  let flashTimer = 0;
  const blind = settings.showKeyboard && isBlind(p, mode === 'custom' ? 0 : nr);

  const stepLabel = h('p.step-label', { 'aria-live': 'polite' });
  const live = h('p.live-stats', {});
  const textBox = h('div.typing', { 'aria-live': 'off' });
  const capsWarn = h('p.caps-warning', { hidden: true, role: 'alert' }, '⇪ Die Feststelltaste ist an! Bitte ausschalten.');
  const overlay = h('button.focus-overlay', { type: 'button', hidden: true, onclick: () => resume() }, 'Hier klicken zum Weiterschreiben');
  const kbBox = h('div.kb-box', { hidden: !settings.showKeyboard || blind });
  const keyboard = renderKeyboard(kbBox);
  const hands = renderHands(kbBox);
  const timerBar = plan.timeLimit ? h('div.timebar', { role: 'progressbar', 'aria-label': 'Zeit', 'aria-valuemin': '0', 'aria-valuemax': '60' }, h('span')) : null;
  const raceBox = mode === 'race'
    ? h('div.race', {},
      h('div.lane', {}, h('span.lane-label', {}, 'Du'), h('div.track', {}, h('span.runner.me', {}, '🏃'))),
      plan.ghost ? h('div.lane', {}, h('span.lane-label', {}, 'Geist'), h('div.track', {}, h('span.runner.ghost', {}, '👻'))) : null)
    : null;
  const blindNote = blind
    ? h('p.blind-note', {}, '🙈 Blindmodus: Die Tastatur ist versteckt, weil du diese Lektion schon sicher kannst. Bei einem Fehler erscheint sie kurz.')
    : null;

  mount(root,
    h('header.topbar.compact', {},
      h('div', {}, h('h1', {}, plan.title), stepLabel),
      h('nav.actions', {},
        live,
        h('button.secondary', { type: 'button', onclick: () => ctx.go('course') }, 'Abbrechen'))),
    raceBox,
    timerBar,
    h('div.stage', {}, textBox, overlay),
    capsWarn,
    blindNote,
    kbBox,
  );

  // ---- Vorstellung ----
  function showIntro() {
    stepLabel.textContent = mode === 'lesson' ? 'Neue Tasten kennenlernen' : 'Gleich geht es los';
    let items;
    if (plan.intro) {
      items = plan.intro();
      keyboard.highlightMany(plan.highlight ?? []);
      hands.highlight([...new Set((plan.highlight ?? []).map((c) => keyInfo(c)?.finger).filter(Boolean))], '');
    } else {
      const lesson = plan.lesson;
      const isShift = lesson.keys.includes(SHIFT);
      const fresh = newChars(lesson);
      const list = isShift
        ? [h('li', {}, 'Großbuchstaben: Umschalttaste mit dem kleinen Finger der ', h('strong', {}, 'anderen'), ' Hand halten, dann den Buchstaben tippen.'),
          h('li', {}, 'Beispiel: Für „A“ (linke Hand) drückt der kleine Finger rechts die Umschalttaste.')]
        : fresh.map((c) => {
          const info = keyInfo(c);
          return h('li', {}, h('kbd', {}, c), ` – ${fingerName(info.finger)}${info.shift ? ' + Umschalttaste der Gegenhand' : ''}`);
        });
      if (nr === 1) list.push(h('li', {}, h('kbd', {}, 'Leertaste'), ' – Daumen'));
      items = [
        h('p', {}, nr === 1
          ? 'Leg die Finger auf die Grundstellung: links a s d f, rechts j k l ö. Auf F und J fühlst du kleine Hügel – so findest du die Grundstellung ohne hinzuschauen.'
          : `Neu in dieser Lektion (${lesson.fingers}):`),
        h('ul.intro-keys', {}, list),
      ];
      if (isShift) {
        keyboard.highlightMany([], true);
        hands.highlight(['l5', 'r5'], 'kleine Finger: Umschalttaste der Gegenhand');
      } else {
        keyboard.highlightMany(fresh);
        const fingers = [...new Set(fresh.map((c) => keyInfo(c).finger))];
        if (nr === 1) fingers.push('th');
        hands.highlight(fingers, fingers.map(fingerName).join(', '));
      }
      if (blind) kbBox.hidden = false; // neue Tasten immer zeigen
    }
    textBox.replaceChildren(
      h('div.intro', {},
        ...items,
        h('p.hint', {}, 'Schau beim Tippen auf den Bildschirm, nicht auf die Hände. Genauigkeit ist wichtiger als Tempo.'),
        h('p.start-hint', {}, 'Drücke die ', h('kbd', {}, 'Leertaste'), ', um zu starten.')));
  }

  // ---- Schritte ----
  function startStep(i) {
    stepIndex = i;
    const step = steps[i];
    engine = createEngine(step.text, { errorMode: settings.errorMode });
    lines = wrapText(step.text, LINE_LENGTH[settings.fontSize] ?? 28);
    stepLabel.textContent = steps.length > 1 ? `Schritt ${i + 1} von ${steps.length}: ${step.title}` : step.title;
    if (blind) kbBox.hidden = true;
    drawText();
    updateHint();
  }

  function lineOf(pos) {
    let start = 0;
    for (let i = 0; i < lines.length; i++) {
      const len = [...lines[i]].length;
      if (pos < start + len) return { index: i, start };
      start += len;
    }
    return { index: lines.length - 1, start: start - [...lines.at(-1)].length };
  }

  function drawText() {
    const { index, start } = lineOf(engine.pos);
    const visible = [];
    for (let li = index; li < Math.min(lines.length, index + 2); li++) {
      let offset = start;
      for (let k = index; k < li; k++) offset += [...lines[k]].length;
      const row = h(li === index ? 'div.line.current' : 'div.line.upcoming');
      [...lines[li]].forEach((ch, j) => {
        const pos = offset + j;
        const cls = ['ch', `st-${engine.status[pos]}`];
        if (pos === engine.pos) cls.push('cursor');
        if (ch === ' ') cls.push('space');
        row.append(h(`span.${cls.join('.')}`, {}, ch === ' ' ? ' ' : ch));
      });
      visible.push(row);
    }
    textBox.replaceChildren(...visible);
  }

  function updateHint() {
    const ch = engine.expected;
    if (ch == null) return;
    const info = keyboard.highlight(ch);
    if (info) hands.highlight([info.finger, info.shiftFinger].filter(Boolean), describeChar(ch));
    const r = summarize([...snapshots, engine.snapshot()]);
    live.textContent = r.hits + r.errors ? `${String(r.accuracy).replace('.', ',')} % richtig` : '';
  }

  function flashKeyboard() {
    if (!blind) return;
    kbBox.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { kbBox.hidden = true; }, 1500);
  }

  function activeNow() {
    if (!engine?.started || lastKeyAt === null) return 0;
    return engine.activeMs + Math.min(performance.now() - lastKeyAt, PAUSE_MS);
  }

  function tickFrame() {
    raf = requestAnimationFrame(tickFrame);
    if (!engine || paused) return;
    const ms = activeNow();
    if (timerBar) {
      const left = Math.max(0, 1 - ms / plan.timeLimit);
      timerBar.firstChild.style.width = `${left * 100}%`;
      timerBar.setAttribute('aria-valuenow', String(Math.round((plan.timeLimit - Math.min(ms, plan.timeLimit)) / 1000)));
      if (ms >= plan.timeLimit && engine.started) finish();
    }
    if (raceBox) {
      const total = engine.chars.length;
      raceBox.querySelector('.me').style.left = `${(engine.pos / total) * 92}%`;
      const g = raceBox.querySelector('.ghost');
      if (g) g.style.left = `${(Math.min(ghostPosition(plan.ghost.times, ms), total) / total) * 92}%`;
    }
  }

  function finish() {
    if (stepIndex === -2) return;
    snapshots.push(engine.snapshot());
    const timeline = [...engine.timeline];
    stepIndex = -2;
    const result = summarize(snapshots);
    ctx.go('results', {
      mode, lesson: nr, result, timeline, text: plan.raceText, next: params.next, weak: plan.weak,
    });
  }

  function finishStep() {
    if (stepIndex + 1 < steps.length) {
      snapshots.push(engine.snapshot());
      startStep(stepIndex + 1);
    } else {
      finish();
    }
  }

  // ---- Eingabe ----
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || (e.altKey && !e.getModifierState?.('AltGraph'))) return;
    capsWarn.hidden = !e.getModifierState?.('CapsLock');
    if (e.key === ' ' || e.key === 'Backspace' || e.key === "'" || e.key === '/') e.preventDefault();
    if (paused) { resume(); return; }
    if (stepIndex === -1) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); startStep(0); }
      return;
    }
    if (stepIndex < 0 || e.repeat) return;
    const res = engine.input(e.key, performance.now());
    if (res.type === 'ignored') return;
    lastKeyAt = performance.now();
    if (res.type === 'error') {
      if (settings.sound) beep('error');
      flashKeyboard();
    }
    if (res.done) { finishStep(); return; }
    drawText();
    updateHint();
  }

  function onKeyUp(e) {
    capsWarn.hidden = !e.getModifierState?.('CapsLock');
  }

  function pause() {
    if (stepIndex < 0) return;
    paused = true;
    overlay.hidden = false;
  }

  function resume() {
    paused = false;
    overlay.hidden = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', pause);
  raf = requestAnimationFrame(tickFrame);

  showIntro();

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(flashTimer);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', pause);
  };
}
