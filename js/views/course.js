// Kursübersicht: Lektionen mit Status, Bestwerten und Serie.

import { h, mount, backupReminder } from './dom.js';
import { avatarOf, AGE_GROUPS } from '../profiles.js';
import { LESSONS, AVAILABLE_LESSONS, PASS_ACCURACY, SHIFT } from '../lessons.js';
import { BADGES, minutesToday } from '../stats.js';

function keysLabel(lesson) {
  return lesson.keys.map((k) => (k === ' ' ? 'Leertaste' : k === SHIFT ? 'Umschalttaste' : k)).join(' ');
}

export function render(root, ctx) {
  const p = ctx.profile;
  const current = p.progress.currentLesson;
  const group = AGE_GROUPS[p.ageGroup];
  const today = minutesToday(p);

  const header = h('header.topbar', {},
    h('div.who', {},
      h('span.avatar.small', { 'aria-hidden': 'true' }, avatarOf(p)),
      h('div', {},
        h('h1', {}, `Hallo ${p.name}!`),
        h('p.sub', {},
          `Heute geübt: ${today} von ${group.minutes} Minuten`,
          p.streak.current > 1 ? ` · 🔥 ${p.streak.current} Tage in Folge` : ''))),
    h('nav.actions', {},
      h('button.secondary', { type: 'button', onclick: () => ctx.go('settings') }, '⚙️ Einstellungen'),
      h('button.secondary', { type: 'button', onclick: () => ctx.go('profile') }, '👥 Profil wechseln')),
  );

  const preschoolNote = p.ageGroup === 'vorschule'
    ? h('p.note', {}, '🌱 Für Vorschulkinder kommt bald ein eigener Entdecker-Modus. Bis dahin: Lektion 1 in Ruhe ausprobieren – Finger auf die Grundstellung, die Hügel auf F und J ertasten.')
    : null;

  const badges = p.badges.length
    ? h('div.badges', { 'aria-label': 'Abzeichen' },
      p.badges.map((id) => BADGES[id] && h('span.badge', { title: BADGES[id].label }, `${BADGES[id].icon} ${BADGES[id].label}`)))
    : null;

  const list = h('ol.lesson-list', {},
    LESSONS.map((lesson) => {
      const info = p.progress.lessons[String(lesson.nr)];
      const available = lesson.nr <= AVAILABLE_LESSONS;
      const unlocked = available && lesson.nr <= current;
      const isCurrent = lesson.nr === Math.min(current, AVAILABLE_LESSONS);
      let status;
      if (!available) status = 'kommt bald';
      else if (info?.done) status = `✓ geschafft · Bestwert ${info.bestApm} A/min, ${String(info.bestAccuracy).replace('.', ',')} %`;
      else if (unlocked) status = info ? `noch nicht ${PASS_ACCURACY} % – weiter üben!` : isCurrent ? 'jetzt dran' : 'offen';
      else status = `🔒 ab ${PASS_ACCURACY} % in Lektion ${lesson.nr - 1}`;
      const cls = ['lesson', info?.done ? 'done' : '', isCurrent && !info?.done ? 'next' : '', unlocked ? '' : 'locked'].filter(Boolean).join('.');
      return h(`li.${cls}`, {},
        h('button.lesson-btn', {
          type: 'button',
          disabled: !unlocked,
          onclick: () => ctx.go('exercise', { lesson: lesson.nr }),
        },
        h('span.lesson-nr', {}, String(lesson.nr)),
        h('span.lesson-body', {},
          h('span.lesson-title', {}, lesson.title),
          h('span.lesson-keys', {}, keysLabel(lesson)),
          h('span.lesson-status', {}, status))));
    }));

  mount(root, header, backupReminder(ctx), preschoolNote, badges, h('h2', {}, 'Dein Kurs'), list);
}
