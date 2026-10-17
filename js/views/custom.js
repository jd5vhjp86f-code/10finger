// Eigene Texte einfügen, speichern und abtippen (z. B. Lernwörter oder Diktate aus der Schule).

import { h, mount } from './dom.js';
import { normalizeCustomText } from '../generator.js';

const MAX_TEXTS = 20;
const MAX_LENGTH = 3000;

export function render(root, ctx) {
  const p = ctx.profile;

  const title = h('input', { id: 'ct-title', type: 'text', maxlength: '40', placeholder: 'z. B. Lernwörter Woche 12' });
  const area = h('textarea', { id: 'ct-text', rows: '8', maxlength: String(MAX_LENGTH), placeholder: 'Text hier einfügen oder eintippen …' });
  const info = h('p.hint', { role: 'status' });

  area.addEventListener('input', () => {
    const { text, removed } = normalizeCustomText(area.value);
    info.textContent = area.value.trim()
      ? `${text.length} Zeichen${removed.length ? ` · nicht tippbar und entfernt: ${removed.map((c) => (c === '\n' ? '↵' : c)).join(' ')}` : ''}`
      : '';
  });

  function start(entry) {
    ctx.startExercise({ mode: 'custom', text: entry.text, title: entry.title });
  }

  function saveText(andStart) {
    const { text } = normalizeCustomText(area.value);
    if (text.length < 5) {
      info.textContent = 'Der Text ist zu kurz.';
      return;
    }
    const entry = { id: `t_${Date.now().toString(36)}`, title: title.value.trim() || text.slice(0, 30), text };
    p.customTexts.push(entry);
    if (p.customTexts.length > MAX_TEXTS) p.customTexts.shift();
    ctx.save();
    if (andStart) start(entry);
    else ctx.go('custom');
  }

  const list = p.customTexts.length
    ? h('ul.text-list', {}, [...p.customTexts].reverse().map((t) => h('li.card', {},
      h('div.text-meta', {}, h('strong', {}, t.title), h('span.hint', {}, `${t.text.length} Zeichen`)),
      h('p.text-preview', {}, t.text.length > 140 ? `${t.text.slice(0, 140)} …` : t.text),
      h('div.row', {},
        h('button.primary', { type: 'button', onclick: () => start(t) }, 'Üben'),
        h('button.secondary', {
          type: 'button',
          onclick: () => {
            if (!confirm(`„${t.title}“ löschen?`)) return;
            p.customTexts = p.customTexts.filter((x) => x.id !== t.id);
            ctx.save();
            ctx.go('custom');
          },
        }, 'Löschen')))))
    : h('p.hint', {}, 'Noch keine eigenen Texte gespeichert.');

  mount(root,
    h('header.topbar', {},
      h('h1', {}, '📄 Eigene Texte'),
      h('nav.actions', {}, h('button.secondary', { type: 'button', onclick: () => ctx.go('course') }, 'Zurück'))),
    h('section.card.custom-form', {},
      h('label', { for: 'ct-title' }, 'Titel'), title,
      h('label', { for: 'ct-text' }, 'Text'), area,
      info,
      h('p.hint', {}, 'Typografische Anführungszeichen und Gedankenstriche werden in tippbare Zeichen umgewandelt. Zeichen wie @ oder €, die AltGr brauchen, werden entfernt.'),
      h('div.row', {},
        h('button.primary', { type: 'button', onclick: () => saveText(true) }, 'Speichern und üben'),
        h('button.secondary', { type: 'button', onclick: () => saveText(false) }, 'Nur speichern'))),
    h('h2', {}, 'Gespeicherte Texte'),
    list);
}
