// Profil wählen oder anlegen.

import { h, mount, downloadBackup, pickBackup, backupReminder, askPin } from './dom.js';
import { AGE_GROUPS, AVATARS, avatarOf, createProfile, verifyPin } from '../profiles.js';
import { AVAILABLE_LESSONS } from '../lessons.js';

export function render(root, ctx) {
  ctx.profileId = null;
  ctx.applyAppearance(null);

  async function choose(profile) {
    if (profile.pinHash) {
      const pin = await askPin(`PIN für ${profile.name}`);
      if (pin == null) return;
      if (!(await verifyPin(profile, pin))) {
        ctx.banner('pin', 'Die PIN stimmt nicht.', 'warn');
        return;
      }
      ctx.banner('pin', null);
    }
    ctx.setProfile(profile.id);
    ctx.go('course');
  }

  const cards = ctx.data.profiles.map((p) =>
    h('button.profile-card', { type: 'button', onclick: () => choose(p) },
      h('span.avatar', { 'aria-hidden': 'true' }, avatarOf(p)),
      h('span.profile-name', {}, p.name),
      h('span.profile-meta', {}, `Lektion ${Math.min(p.progress.currentLesson, AVAILABLE_LESSONS)}`, p.pinHash ? ' · 🔒' : ''),
    ));

  const addCard = h('button.profile-card.add-card', { type: 'button', onclick: () => showForm() },
    h('span.avatar', { 'aria-hidden': 'true' }, '＋'),
    h('span.profile-name', {}, 'Neues Profil'));

  const formBox = h('div');

  function showForm() {
    let avatar = Object.keys(AVATARS)[ctx.data.profiles.length % Object.keys(AVATARS).length];
    const name = h('input', { id: 'pf-name', type: 'text', maxlength: '20', required: true, autocomplete: 'off' });
    const age = h('select', { id: 'pf-age' },
      Object.entries(AGE_GROUPS).map(([id, g]) => h('option', { value: id, selected: id === 'kind' }, g.label)));
    const pin = h('input', { id: 'pf-pin', type: 'password', inputmode: 'numeric', maxlength: '4', pattern: '\\d{4}', autocomplete: 'off' });
    const avatars = h('div.avatar-picker', { role: 'radiogroup', 'aria-label': 'Tier aussuchen' },
      Object.entries(AVATARS).map(([id, emoji]) => {
        const b = h('button.avatar-option', {
          type: 'button', role: 'radio', 'aria-checked': String(id === avatar), 'aria-label': id,
          onclick: () => {
            avatar = id;
            for (const o of avatars.children) o.setAttribute('aria-checked', String(o === b));
          },
        }, emoji);
        return b;
      }));
    const error = h('p.form-error', { role: 'alert' });
    const form = h('form.card.profile-form', {},
      h('h2', {}, 'Neues Profil'),
      h('label', { for: 'pf-name' }, 'Name'), name,
      h('span.label', {}, 'Tier'), avatars,
      h('label', { for: 'pf-age' }, 'Altersgruppe'), age,
      h('p.hint', {}, 'Die Altersgruppe bestimmt Texte, Schriftgröße und Länge der Übungen.'),
      h('label', { for: 'pf-pin' }, 'PIN (freiwillig, 4 Ziffern)'), pin,
      h('p.hint', {}, 'Die PIN verhindert nur, dass jemand aus Versehen im falschen Profil übt.'),
      error,
      h('div.row', {},
        h('button.secondary', { type: 'button', onclick: () => formBox.replaceChildren() }, 'Abbrechen'),
        h('button.primary', { type: 'submit' }, 'Profil anlegen')),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const profile = await createProfile(ctx.data, { name: name.value, avatar, ageGroup: age.value, pin: pin.value });
        ctx.save();
        ctx.setProfile(profile.id);
        ctx.go('course');
      } catch (err) {
        error.textContent = err.message;
      }
    });
    formBox.replaceChildren(form);
    name.focus();
  }

  mount(root,
    h('header.hero', {},
      h('h1', {}, '10finger'),
      h('p.tagline', {}, 'Zehnfingerschreiben lernen – Schritt für Schritt, ohne auf die Tasten zu schauen.')),
    backupReminder(ctx),
    h('section', { 'aria-labelledby': 'who' },
      h('h2', { id: 'who' }, ctx.data.profiles.length ? 'Wer übt heute?' : 'Leg zuerst ein Profil an.'),
      h('div.profile-grid', {}, cards, addCard)),
    formBox,
    h('section.backup-row', {},
      h('button.link', { type: 'button', onclick: () => ctx.go('family') }, ctx.data.profiles.length ? '📊 Familienübersicht' : '🔄 Geräte verbinden'),
      h('button.link', { type: 'button', onclick: () => downloadBackup(ctx), disabled: !ctx.data.profiles.length }, '💾 Sicherung speichern'),
      h('button.link', { type: 'button', onclick: () => pickBackup(ctx, () => ctx.go('profile')) }, '📂 Sicherung laden')),
  );

  if (!ctx.data.profiles.length) showForm();
}
