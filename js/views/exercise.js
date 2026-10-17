// Übungsbildschirm: neue Tasten vorstellen, dann die Schritte der Lektion abtippen.

import { h, mount } from './dom.js';
import { createEngine, summarize } from '../engine.js';
import { generateLesson, wrapText } from '../generator.js';
import { getLesson, newChars, SHIFT } from '../lessons.js';
import { renderKeyboard, renderHands, keyInfo, describeChar, fingerName } from '../keyboard.js';

const LINE_LENGTH = { riesig: 20, gross: 28, normal: 36 };

let audioCtx = null;
function beep(freq = 220, ms = 90) {
  try {
    audioCtx ??= new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* ohne Ton weiter */ }
}

export function render(root, ctx, { lesson: nr }) {
  const p = ctx.profile;
  const lesson = getLesson(nr);
  const settings = p.settings;
  const steps = generateLesson(nr, { words: ctx.words, sentences: ctx.sentences, ageGroup: p.ageGroup });
  const snapshots = [];
  let stepIndex = -1; // -1 = Vorstellung
  let engine = null;
  let lines = [];
  let paused = false;

  const title = h('h1', {}, `Lektion ${nr}: ${lesson.title}`);
  const stepLabel = h('p.step-label', { 'aria-live': 'polite' });
  const live = h('p.live-stats', {});
  const textBox = h('div.typing', { 'aria-live': 'off' });
  const capsWarn = h('p.caps-warning', { hidden: true, role: 'alert' }, '⇪ Die Feststelltaste ist an! Bitte ausschalten.');
  const overlay = h('button.focus-overlay', { type: 'button', hidden: true, onclick: () => resume() }, 'Hier klicken zum Weiterschreiben');
  const kbBox = h('div.kb-box', { hidden: !settings.showKeyboard });
  const keyboard = renderKeyboard(kbBox);
  const hands = renderHands(kbBox);

  mount(root,
    h('header.topbar.compact', {},
      h('div', {}, title, stepLabel),
      h('nav.actions', {},
        live,
        h('button.secondary', { type: 'button', onclick: () => ctx.go('course') }, 'Abbrechen'))),
    h('div.stage', {}, textBox, overlay),
    capsWarn,
    kbBox,
  );

  // ---- Vorstellung der neuen Tasten ----
  function showIntro() {
    const isShift = lesson.keys.includes(SHIFT);
    const fresh = newChars(lesson);
    stepLabel.textContent = 'Neue Tasten kennenlernen';
    const items = isShift
      ? [h('li', {}, 'Großbuchstaben: Umschalttaste mit dem kleinen Finger der ', h('strong', {}, 'anderen'), ' Hand halten, dann den Buchstaben tippen.'),
        h('li', {}, 'Beispiel: Für „A“ (linke Hand) drückt der kleine Finger rechts die Umschalttaste.')]
      : fresh.map((c) => h('li', {}, h('kbd', {}, c), ` – ${fingerName(keyInfo(c).finger)}`));
    if (nr === 1) items.push(h('li', {}, h('kbd', {}, 'Leertaste'), ' – Daumen'));
    textBox.replaceChildren(
      h('div.intro', {},
        h('p', {}, nr === 1
          ? 'Leg die Finger auf die Grundstellung: links a s d f, rechts j k l ö. Auf F und J fühlst du kleine Hügel – so findest du die Grundstellung ohne hinzuschauen.'
          : `Neu in dieser Lektion (${lesson.fingers}):`),
        h('ul.intro-keys', {}, items),
        h('p.hint', {}, 'Schau beim Tippen auf den Bildschirm, nicht auf die Hände. Genauigkeit ist wichtiger als Tempo.'),
        h('p.start-hint', {}, 'Drücke die ', h('kbd', {}, 'Leertaste'), ', um zu starten.')));
    if (isShift) {
      keyboard.highlightMany([], true);
      hands.highlight(['l5', 'r5'], 'kleine Finger: Umschalttaste der Gegenhand');
    } else {
      keyboard.highlightMany(fresh);
      const fingers = [...new Set(fresh.map((c) => keyInfo(c).finger))];
      if (nr === 1) fingers.push('th');
      hands.highlight(fingers, fingers.map(fingerName).join(', '));
    }
  }

  // ---- Schritte ----
  function startStep(i) {
    stepIndex = i;
    const step = steps[i];
    engine = createEngine(step.text, { errorMode: settings.errorMode });
    lines = wrapText(step.text, LINE_LENGTH[settings.fontSize] ?? 32);
    stepLabel.textContent = `Schritt ${i + 1} von ${steps.length}: ${step.title}`;
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
    // aktuelle Zeile groß, die nächste klein darunter
    for (let li = index; li < Math.min(lines.length, index + 2); li++) {
      let offset = start;
      for (let k = index; k < li; k++) offset += [...lines[k]].length;
      const row = h(li === index ? 'div.line.current' : 'div.line.upcoming');
      [...lines[li]].forEach((ch, j) => {
        const pos = offset + j;
        const st = engine.status[pos];
        const cls = ['ch', `st-${st}`];
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
    if (info) {
      const fingers = [info.finger, info.shiftFinger].filter(Boolean);
      hands.highlight(fingers, describeChar(ch));
    }
    const r = summarize([...snapshots, engine.snapshot()]);
    live.textContent = r.hits + r.errors ? `${String(r.accuracy).replace('.', ',')} % richtig` : '';
  }

  function finishStep() {
    snapshots.push(engine.snapshot());
    if (stepIndex + 1 < steps.length) {
      startStep(stepIndex + 1);
    } else {
      const result = summarize(snapshots);
      ctx.go('results', { lesson: nr, result });
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
    if (e.repeat) return;
    const res = engine.input(e.key, performance.now());
    if (res.type === 'ignored') return;
    if (res.type === 'error' && settings.sound) beep();
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

  showIntro();

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', pause);
  };
}
