// Kleine DOM-Helfer und Sicherung als Datei (Herunterladen / Einlesen).

import { needsBackupReminder } from '../storage.js';
import { localDay } from '../stats.js';

/** h('button.primary', { onclick }, 'Text') */
export function h(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name);
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Knoten einhängen; null/false (bedingte Teile) werden übersprungen. */
export function mount(root, ...nodes) {
  root.append(...nodes.flat().filter((n) => n != null && n !== false));
}

export function downloadBackup(ctx) {
  const today = localDay();
  const text = ctx.storage.exportData(ctx.data, today);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `10finger-sicherung-${today}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ctx.banner('backup', null);
}

/** Datei auswählen lassen und einlesen. Ruft onDone() nach erfolgreichem Import. */
export function pickBackup(ctx, onDone) {
  const input = h('input', { type: 'file', accept: 'application/json,.json' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!confirm('Die Sicherung ersetzt alle Profile und Fortschritte in diesem Browser. Fortfahren?')) return;
    try {
      ctx.data = ctx.storage.importData(await file.text());
      ctx.profileId = null;
      ctx.banner('import', 'Sicherung geladen.', 'ok');
      onDone?.();
    } catch (e) {
      ctx.banner('import', e.message, 'warn');
    }
  });
  input.click();
}

export function backupReminder(ctx) {
  if (!needsBackupReminder(ctx.data, localDay())) return null;
  return h('div.reminder',
    {},
    h('p', {}, '💾 Zeit für eine Sicherung! Falls der Browser seine Daten löscht, bleibt euer Fortschritt so erhalten.'),
    h('button.secondary', { type: 'button', onclick: (e) => { downloadBackup(ctx); e.target.closest('.reminder').remove(); } }, 'Sicherung speichern'),
  );
}

/** Einfache PIN-Abfrage als modaler Dialog. Liefert die Eingabe oder null. */
export function askPin(title) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'password', inputmode: 'numeric', maxlength: '4', pattern: '\\d{4}', autocomplete: 'off', 'aria-label': 'PIN', required: true });
    const form = h('form', { method: 'dialog' },
      h('h2', {}, title),
      input,
      h('div.row', {},
        h('button.secondary', { type: 'button', value: 'cancel', onclick: () => dialog.close('') }, 'Abbrechen'),
        h('button.primary', { type: 'submit' }, 'OK')),
    );
    const dialog = h('dialog.pin-dialog', {}, form);
    form.addEventListener('submit', (e) => { e.preventDefault(); dialog.close(input.value); });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(dialog.returnValue || null); });
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
  });
}
