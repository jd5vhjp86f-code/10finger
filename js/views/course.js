// Kurs als Landkarte mit Stationen, dazu Tagesziel, Serie, Abzeichen und weitere Übungsarten.

import { h, mount, backupReminder } from './dom.js';
import { avatarOf } from '../profiles.js';
import { LESSONS, AVAILABLE_LESSONS, PASS_ACCURACY, SHIFT, knownChars } from '../lessons.js';
import { BADGES, minutesToday, dailyGoal, weakKeys } from '../stats.js';

const COLS = 4;

function keysLabel(lesson) {
  return lesson.keys.map((k) => (k === ' ' ? 'Leertaste' : k === SHIFT ? 'Umschalt' : k)).join(' ');
}

function fmt(n) {
  return String(n).replace('.', ',');
}

/** Position einer Station auf der Schlangenlinie (in Prozent). */
function stationPos(i) {
  const row = Math.floor(i / COLS);
  const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
  const rows = Math.ceil(LESSONS.length / COLS);
  return { x: ((col + 0.5) / COLS) * 100, y: ((row + 0.5) / rows) * 100 };
}

function goalMeter(p) {
  const goal = dailyGoal(p);
  const today = minutesToday(p);
  const pct = Math.min(100, Math.round((today / goal) * 100));
  return h('div.goal', {},
    h('div.goal-text', {},
      h('strong', {}, today >= goal ? '✅ Tagesziel geschafft!' : `Tagesziel: ${today} von ${goal} Minuten`),
      p.streak.current > 1 ? h('span', {}, ` · 🔥 ${p.streak.current} Tage in Folge`) : null),
    h('div.meter', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(goal), 'aria-valuenow': String(today), 'aria-label': 'Tagesziel' },
      h('span', { style: `width:${pct}%` })));
}

export function render(root, ctx) {
  const p = ctx.profile;
  const current = Math.min(p.progress.currentLesson, AVAILABLE_LESSONS);
  const weak = weakKeys(p.keyStats, knownChars(current));
  const preschool = p.ageGroup === 'vorschule';

  const header = h('header.topbar', {},
    h('div.who', {},
      h('span.avatar.small', { 'aria-hidden': 'true' }, avatarOf(p)),
      h('div', {}, h('h1', {}, `Hallo ${p.name}!`))),
    h('nav.actions', {},
      h('button.secondary', { type: 'button', onclick: () => ctx.go('settings') }, '⚙️ Einstellungen'),
      h('button.secondary', { type: 'button', onclick: () => ctx.go('profile') }, '👥 Profil wechseln')),
  );

  const activity = (icon, title, text, onclick, primary = false) =>
    h(`button.activity${primary ? '.primary-activity' : ''}`, { type: 'button', onclick },
      h('span.activity-icon', { 'aria-hidden': 'true' }, icon),
      h('span.activity-title', {}, title),
      h('span.activity-text', {}, text));

  const activities = h('div.activities', {},
    preschool ? activity('🔎', 'Entdecker', 'Buchstaben auf der Tastatur finden', () => ctx.go('explorer'), true) : null,
    activity('🔥', 'Aufwärmen', '1 Minute bekannte Tasten', () => ctx.startExercise({ mode: 'warmup' })),
    activity('💪', 'Schwächentraining', weak.length ? `Heute dran: ${weak.join(' ')}` : 'Erst nach ein paar Übungen', () => ctx.startExercise({ mode: 'weakness' })),
    activity('📄', 'Eigene Texte', 'Lernwörter oder Diktate abtippen', () => ctx.go('custom')),
    activity('🎮', 'Spiele', 'Wörterregen und Rennen gegen den Geist', () => ctx.go('games')),
  );

  const preschoolNote = preschool
    ? h('p.note', {}, '🌱 Im Entdecker-Modus lernst du die Tastatur spielerisch kennen. Der Kurs unten setzt Lesen voraus – wenn du lesen kannst, stellen deine Eltern die Altersgruppe in den Einstellungen auf „Kind“.')
    : null;

  const earned = p.badges.filter((id) => BADGES[id]);
  const badges = h('details.badges-box', {},
    h('summary', {}, `🏅 Abzeichen: ${earned.length} von ${Object.keys(BADGES).length}`),
    h('div.badges', {},
      Object.entries(BADGES).map(([id, b]) => h(`span.badge${earned.includes(id) ? '' : '.missing'}`, { title: b.label },
        `${earned.includes(id) ? b.icon : '🔒'} ${b.label}`))));

  // Landkarte: Schlangenweg durch 16 Stationen
  const rows = Math.ceil(LESSONS.length / COLS);
  const points = LESSONS.map((_, i) => stationPos(i));
  const doneCount = LESSONS.filter((l) => p.progress.lessons[String(l.nr)]?.done).length;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'map-path');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = (pts, cls) => {
    const el = document.createElementNS(svgNs, 'polyline');
    el.setAttribute('points', pts.map((pt) => `${pt.x},${pt.y}`).join(' '));
    el.setAttribute('class', cls);
    svg.append(el);
  };
  path(points, 'trail');
  if (current > 1) path(points.slice(0, current), 'trail-done');

  const map = h('div.map', { style: `--rows:${rows}` }, svg,
    LESSONS.map((lesson, i) => {
      const info = p.progress.lessons[String(lesson.nr)];
      const unlocked = lesson.nr <= current;
      const isCurrent = lesson.nr === current && !info?.done;
      let status;
      if (info?.done) status = `✓ ${info.bestApm} A/min · ${fmt(info.bestAccuracy)} %`;
      else if (unlocked) status = info ? `noch nicht ${PASS_ACCURACY} %` : isCurrent ? 'jetzt dran' : 'offen';
      else status = '🔒 gesperrt';
      const cls = ['station', info?.done ? 'done' : '', isCurrent ? 'next' : '', unlocked ? '' : 'locked'].filter(Boolean).join('.');
      const { x, y } = points[i];
      return h(`button.${cls}`, {
        type: 'button',
        style: `left:${x}%;top:${y}%`,
        disabled: !unlocked,
        'aria-label': `Lektion ${lesson.nr}: ${lesson.title}, Tasten ${keysLabel(lesson)}, ${status}`,
        onclick: () => ctx.startExercise({ mode: 'lesson', lesson: lesson.nr }),
      },
      h('span.station-icon', { 'aria-hidden': 'true' }, lesson.icon),
      h('span.station-nr', {}, `${lesson.nr} · ${lesson.place}`),
      h('span.station-title', {}, lesson.title),
      h('span.station-keys', {}, keysLabel(lesson)),
      h('span.station-status', {}, status));
    }));

  mount(root, header, backupReminder(ctx), goalMeter(p), preschoolNote, activities,
    h('h2', {}, `Dein Kurs · ${doneCount} von ${LESSONS.length} Stationen geschafft`), map, badges);
}
