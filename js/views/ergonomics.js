// Kurze Grafik zu Sitzhaltung und Grundstellung, einmalig vor der ersten Übung.

import { h, mount } from './dom.js';
import { renderKeyboard } from '../keyboard.js';

// Seitenansicht: Kind am Tisch. Beschriftungen stehen zusätzlich als Liste daneben.
const POSTURE_SVG = `
<svg viewBox="0 0 420 300" class="posture" role="img" aria-label="Sitzhaltung am Computer">
  <rect x="250" y="70" width="12" height="80" rx="3" class="pc"/>
  <rect x="236" y="60" width="40" height="70" rx="6" class="pc screen"/>
  <rect x="150" y="150" width="200" height="10" rx="3" class="desk"/>
  <rect x="330" y="160" width="10" height="120" class="desk"/>
  <rect x="165" y="142" width="50" height="8" rx="2" class="pc"/>
  <rect x="60" y="190" width="90" height="10" rx="3" class="chair"/>
  <rect x="58" y="90" width="10" height="110" rx="3" class="chair"/>
  <rect x="100" y="200" width="8" height="80" class="chair"/>
  <circle cx="95" cy="70" r="22" class="body"/>
  <line x1="92" y1="94" x2="88" y2="185" class="limb"/>
  <line x1="90" y1="115" x2="125" y2="150" class="limb"/>
  <line x1="125" y1="150" x2="180" y2="146" class="limb"/>
  <line x1="88" y1="185" x2="150" y2="188" class="limb"/>
  <line x1="150" y1="188" x2="152" y2="270" class="limb"/>
  <line x1="152" y1="270" x2="180" y2="270" class="limb"/>
  <line x1="110" y1="66" x2="236" y2="90" class="sight"/>
  <text x="290" y="50" class="lbl">1</text>
  <text x="150" y="130" class="lbl">2</text>
  <text x="40" y="140" class="lbl">3</text>
  <text x="185" y="290" class="lbl">4</text>
</svg>`;

export function render(root, ctx, { next }) {
  const p = ctx.profile;
  const kbBox = h('div.kb-box.small');
  const keyboard = renderKeyboard(kbBox);
  keyboard.highlightMany(['a', 's', 'd', 'f', 'j', 'k', 'l', 'ö']);

  function done() {
    p.flags.ergonomicsSeen = true;
    ctx.save();
    ctx.startExercise(next ?? { mode: 'lesson', lesson: 1 });
  }

  mount(root,
    h('header.topbar', {}, h('h1', {}, '🪑 Bevor es losgeht: gut sitzen')),
    h('div.ergo', {},
      h('div.ergo-figure', { html: POSTURE_SVG }),
      h('ol.ergo-list', {},
        h('li', {}, h('strong', {}, 'Bildschirm: '), 'eine Armlänge entfernt, die Oberkante etwa auf Augenhöhe.'),
        h('li', {}, h('strong', {}, 'Arme: '), 'Unterarme ungefähr waagerecht, Schultern locker, Handgelenke nicht abknicken.'),
        h('li', {}, h('strong', {}, 'Rücken: '), 'aufrecht sitzen und anlehnen.'),
        h('li', {}, h('strong', {}, 'Füße: '), 'flach auf dem Boden – oder auf einer Fußstütze, wenn die Beine noch zu kurz sind.'))),
    h('section.card', {},
      h('h2', {}, 'Grundstellung'),
      h('p', {}, 'Die Finger liegen locker auf a s d f und j k l ö, die Daumen über der Leertaste. Auf F und J sind kleine Hügel – die findest du, ohne hinzuschauen. Nach jedem Anschlag kehren die Finger hierher zurück.'),
      kbBox),
    h('p.hint', {}, 'Nach 15 Minuten erinnert dich 10finger an eine kurze Pause.'),
    h('div.row', {}, h('button.primary', { type: 'button', onclick: done }, 'Verstanden – los geht’s')));
}
