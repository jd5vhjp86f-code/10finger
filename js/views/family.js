// Familienübersicht: pro Profil letzte Übung, Minuten pro Woche, Tempo- und Fehlerverlauf, Problemtasten.
// Bewusst ohne Rangliste – jeder misst sich an sich selbst.

import { h, mount } from './dom.js';
import { avatarOf, AGE_GROUPS } from '../profiles.js';
import { getLesson, AVAILABLE_LESSONS } from '../lessons.js';
import { lastSession, minutesLastWeek, minutesToday, dailyGoal, trend, problemKeys, totalMinutes, SESSION_KINDS, localDay } from '../stats.js';

const fmt = (n) => String(n).replace('.', ',');

function relativeDay(date) {
  const day = date.slice(0, 10);
  const today = localDay();
  const diff = Math.round((new Date(`${today}T12:00`) - new Date(`${day}T12:00`)) / 86400000);
  if (diff === 0) return `heute, ${date.slice(11, 16)} Uhr`;
  if (diff === 1) return 'gestern';
  return `vor ${diff} Tagen`;
}

const shortDate = (date) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`;

/**
 * Kleines Liniendiagramm für eine Messgröße (eine Reihe, eine Achse) mit Hover-Tooltip.
 * Text bleibt in Textfarbe; die Linie trägt die Farbe.
 */
function lineChart({ title, values, dates, unit, domain }) {
  const W = 300;
  const H = 90;
  const pad = { l: 6, r: 44, t: 10, b: 10 };
  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  const span = max - min || 1;
  const x = (i) => pad.l + (values.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (values.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${title}: zuletzt ${fmt(values.at(-1))} ${unit}` });
  svg.append(el('line', { x1: pad.l, x2: W - pad.r, y1: H - pad.b, y2: H - pad.b, class: 'chart-base' }));
  svg.append(el('polyline', { points: values.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'chart-line' }));
  const last = values.length - 1;
  svg.append(el('circle', { cx: x(last), cy: y(values[last]), r: 4, class: 'chart-dot' }));
  const lbl = el('text', { x: x(last) + 8, y: y(values[last]) + 4, class: 'chart-label' });
  lbl.textContent = fmt(values[last]);
  svg.append(lbl);
  const cross = el('line', { y1: pad.t, y2: H - pad.b, class: 'chart-cross', visibility: 'hidden' });
  const hoverDot = el('circle', { r: 5, class: 'chart-dot hover', visibility: 'hidden' });
  svg.append(cross, hoverDot);

  const tip = h('div.chart-tip', { hidden: true });
  const wrap = h('figure.chart-box', {}, h('figcaption', {}, title), svg, tip);
  function move(e) {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let i = 0;
    let best = Infinity;
    values.forEach((_, k) => { const d = Math.abs(x(k) - px); if (d < best) { best = d; i = k; } });
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    hoverDot.setAttribute('cx', x(i)); hoverDot.setAttribute('cy', y(values[i])); hoverDot.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.textContent = `${shortDate(dates[i])}: ${fmt(values[i])} ${unit}`;
    tip.style.left = `${(x(i) / W) * 100}%`;
  }
  function leave() {
    cross.setAttribute('visibility', 'hidden');
    hoverDot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  }
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
  return wrap;
}

function profileCard(p) {
  const last = lastSession(p);
  const sessions = trend(p, 20);
  const problems = problemKeys(p.keyStats, 3, 20);
  const current = Math.min(p.progress.currentLesson, AVAILABLE_LESSONS);
  const stat = (label, value) => h('div.stat', {}, h('span.stat-label', {}, label), h('span.stat-value', {}, value));

  const charts = sessions.length >= 2
    ? h('div.charts', {},
      lineChart({ title: 'Tempo (Anschläge pro Minute)', values: sessions.map((s) => s.apm), dates: sessions.map((s) => s.date), unit: 'A/min', domain: [0, Math.max(60, ...sessions.map((s) => s.apm))] }),
      lineChart({ title: 'Genauigkeit (%)', values: sessions.map((s) => s.accuracy), dates: sessions.map((s) => s.date), unit: '%', domain: [Math.min(80, ...sessions.map((s) => s.accuracy)), 100] }))
    : h('p.hint', {}, 'Verläufe erscheinen nach den ersten zwei Übungen.');

  const table = sessions.length
    ? h('details.table-view', {},
      h('summary', {}, 'Letzte Übungen als Tabelle'),
      h('table', {},
        h('thead', {}, h('tr', {}, ['Datum', 'Art', 'Lektion', 'Minuten', 'A/min', 'Genauigkeit'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, [...p.sessions].slice(-15).reverse().map((s) => h('tr', {},
          h('td', {}, `${shortDate(s.date)} ${s.date.slice(11, 16)}`),
          h('td', {}, SESSION_KINDS[s.kind ?? 'lesson'] ?? s.kind),
          h('td', {}, s.lesson || '–'),
          h('td', {}, fmt(Math.round(s.seconds / 6) / 10)),
          h('td', {}, s.apm),
          h('td', {}, `${fmt(s.accuracy)} %`))))))
    : null;

  return h('article.card.family-card', {},
    h('header.family-head', {},
      h('span.avatar.small', { 'aria-hidden': 'true' }, avatarOf(p)),
      h('div', {},
        h('h2', {}, p.name),
        h('p.sub', {}, `${AGE_GROUPS[p.ageGroup].label} · ${p.ageGroup === 'vorschule' ? `${p.explorer.stars} Entdecker-Sterne` : `Lektion ${current}: ${getLesson(current).title}`}`))),
    h('div.stats', {},
      stat('Letzte Übung', last ? relativeDay(last.date) : 'noch keine'),
      stat('Heute', `${minutesToday(p)} / ${dailyGoal(p)} min`),
      stat('Letzte 7 Tage', `${minutesLastWeek(p)} min`),
      stat('Insgesamt', `${totalMinutes(p)} min`),
      stat('Serie', p.streak.current > 0 ? `${p.streak.current} ${p.streak.current === 1 ? 'Tag' : 'Tage'}` : '–')),
    charts,
    problems.length
      ? h('p.problem-line', {}, 'Problemtasten: ', problems.map((k) => h('kbd', {}, k.ch)), ` (${problems.map((k) => `${k.ch}: ${Math.round((k.errors / (k.hits + k.errors)) * 100)} % Fehler`).join(', ')})`)
      : null,
    table);
}

export function render(root, ctx) {
  mount(root,
    h('header.topbar', {},
      h('h1', {}, '📊 Familienübersicht'),
      h('nav.actions', {}, h('button.primary', { type: 'button', onclick: () => ctx.go('profile') }, 'Zurück'))),
    h('p.hint', {}, 'Jede und jeder misst sich an der eigenen Bestleistung – deshalb gibt es hier keine Rangliste.'),
    h('div.family-grid', {}, ctx.data.profiles.map(profileCard)));
}
