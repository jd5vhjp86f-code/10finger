// Einstellungen des Profils, PIN, Sicherung, Speicherstatus.

import { h, mount, downloadBackup, pickBackup } from './dom.js';
import { AGE_GROUPS, avatarOf, deleteProfile, isValidPin, setPin } from '../profiles.js';

export function render(root, ctx) {
  const p = ctx.profile;
  const s = p.settings;

  function save(msg = 'Gespeichert.') {
    if (ctx.save()) status.textContent = msg;
  }

  const status = h('p.saved', { role: 'status' });

  const check = (key, label) => {
    const input = h('input', { type: 'checkbox', id: `set-${key}`, checked: s[key] });
    input.addEventListener('change', () => { s[key] = input.checked; save(); });
    return h('div.field.check', {}, input, h('label', { for: `set-${key}` }, label));
  };

  const select = (key, label, options, onChange) => {
    const el = h('select', { id: `set-${key}` },
      Object.entries(options).map(([v, l]) => h('option', { value: v, selected: s[key] === v }, l)));
    el.addEventListener('change', () => { s[key] = el.value; onChange?.(); save(); });
    return h('div.field', {}, h('label', { for: `set-${key}` }, label), el);
  };

  const age = h('select', { id: 'set-age' },
    Object.entries(AGE_GROUPS).map(([v, g]) => h('option', { value: v, selected: p.ageGroup === v }, g.label)));
  age.addEventListener('change', () => { p.ageGroup = age.value; save(); });

  const pinInput = h('input', { type: 'password', id: 'set-pin', inputmode: 'numeric', maxlength: '4', autocomplete: 'off' });
  const pinBox = h('div.field', {},
    h('label', { for: 'set-pin' }, p.pinHash ? 'Neue PIN (4 Ziffern)' : 'PIN festlegen (4 Ziffern)'),
    h('div.row', {},
      pinInput,
      h('button.secondary', {
        type: 'button',
        onclick: async () => {
          if (!isValidPin(pinInput.value)) { status.textContent = 'Die PIN muss aus 4 Ziffern bestehen.'; return; }
          await setPin(p, pinInput.value);
          pinInput.value = '';
          save('PIN gespeichert.');
        },
      }, 'PIN speichern'),
      p.pinHash ? h('button.secondary', { type: 'button', onclick: async () => { await setPin(p, null); save('PIN entfernt.'); } }, 'PIN entfernen') : null));

  const persist = h('p.hint', {}, 'Speicherstatus wird geprüft …');
  ctx.storage.persistStatus().then((ok) => {
    persist.textContent = ok === true
      ? '✓ Der Browser hält die Daten dauerhaft vor.'
      : ok === false
        ? 'Der Browser hat dauerhaften Speicher nicht zugesagt. Er kann die Daten bei Platzmangel löschen – deshalb regelmäßig sichern.'
        : 'Dieser Browser sagt nicht, ob die Daten dauerhaft bleiben. Bitte regelmäßig sichern.';
  });

  mount(root,
    h('header.topbar', {},
      h('div.who', {}, h('span.avatar.small', { 'aria-hidden': 'true' }, avatarOf(p)), h('h1', {}, `Einstellungen für ${p.name}`)),
      h('nav.actions', {}, h('button.primary', { type: 'button', onclick: () => ctx.go('course') }, 'Fertig'))),
    h('div.settings-grid', {},
      h('section.card', {},
        h('h2', {}, 'Üben'),
        check('sound', 'Ton bei Tippfehlern'),
        check('showKeyboard', 'Bildschirmtastatur anzeigen'),
        select('fontSize', 'Schriftgröße', { normal: 'normal', gross: 'groß', riesig: 'sehr groß' }, () => ctx.applyFontSize(p)),
        select('errorMode', 'Bei Tippfehlern', { wait: 'warten, bis die richtige Taste kommt', continue: 'weiterschreiben (Rücktaste erlaubt)' }),
        h('div.field', {}, h('label', { for: 'set-age' }, 'Altersgruppe'), age),
        status),
      h('section.card', {},
        h('h2', {}, 'Profil schützen'),
        h('p.hint', {}, 'Die PIN verhindert, dass Geschwister aus Versehen im falschen Profil üben. Sie ist kein echter Schutz.'),
        pinBox),
      h('section.card', {},
        h('h2', {}, 'Sicherung'),
        h('p', {}, 'Der Fortschritt aller Profile liegt nur in diesem Browser. Eine Sicherungsdatei schützt vor Datenverlust und überträgt den Stand auf einen anderen Rechner.'),
        h('p.hint', {}, ctx.data.lastBackup ? `Letzte Sicherung: ${ctx.data.lastBackup.split('-').reverse().join('.')}` : 'Noch keine Sicherung gespeichert.'),
        persist,
        h('div.row', {},
          h('button.primary', { type: 'button', onclick: () => { downloadBackup(ctx); ctx.go('settings'); } }, '💾 Sicherung speichern'),
          h('button.secondary', { type: 'button', onclick: () => pickBackup(ctx, () => ctx.go('profile')) }, '📂 Sicherung laden'))),
      h('section.card.danger-zone', {},
        h('h2', {}, 'Profil löschen'),
        h('p', {}, 'Löscht dieses Profil mit allen Fortschritten aus diesem Browser.'),
        h('button.danger', {
          type: 'button',
          onclick: () => {
            if (!confirm(`Profil „${p.name}“ mit allem Fortschritt wirklich löschen?`)) return;
            deleteProfile(ctx.data, p.id);
            ctx.save();
            ctx.go('profile');
          },
        }, 'Profil löschen'))),
  );
}
