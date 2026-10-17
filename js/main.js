// Start, Wechsel zwischen Ansichten.

import { createStorage } from './storage.js';
import { getProfile } from './profiles.js';
import * as profileView from './views/profile.js';
import * as courseView from './views/course.js';
import * as exerciseView from './views/exercise.js';
import * as resultsView from './views/results.js';
import * as settingsView from './views/settings.js';

const VIEWS = {
  profile: profileView,
  course: courseView,
  exercise: exerciseView,
  results: resultsView,
  settings: settingsView,
};

const root = document.getElementById('app');
const bannerBox = document.getElementById('banners');
const storage = createStorage();

const ctx = {
  storage,
  data: null,
  profileId: null,
  words: [],
  sentences: { kids: [], adults: [] },
  get profile() {
    return this.profileId ? getProfile(this.data, this.profileId) : null;
  },
  save() {
    if (!storage.save(this.data)) {
      banner('save-failed', 'Speichern hat nicht geklappt. Bitte eine Sicherung herunterladen (Einstellungen).', 'warn');
      return false;
    }
    return true;
  },
  go,
  banner,
  setProfile(id) {
    this.profileId = id;
    applyFontSize(this.profile);
  },
  applyFontSize,
};

let cleanup = null;

function go(name, params = {}) {
  if (cleanup) cleanup();
  cleanup = null;
  if (name !== 'profile' && !ctx.profile) name = 'profile';
  root.replaceChildren();
  root.dataset.view = name;
  cleanup = VIEWS[name].render(root, ctx, params) ?? null;
  window.scrollTo(0, 0);
}

function applyFontSize(profile) {
  document.body.dataset.font = profile?.settings.fontSize ?? 'gross';
}

/** Hinweisleiste; gleiche id ersetzt die vorherige Meldung. */
function banner(id, text, kind = 'info') {
  bannerBox.querySelector(`[data-id="${id}"]`)?.remove();
  if (!text) return;
  const el = document.createElement('div');
  el.className = `banner banner-${kind}`;
  el.dataset.id = id;
  const p = document.createElement('p');
  p.textContent = text;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'banner-close';
  close.setAttribute('aria-label', 'Hinweis schließen');
  close.textContent = '×';
  close.addEventListener('click', () => el.remove());
  el.append(p, close);
  bannerBox.append(el);
}

async function loadJson(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch {
    banner('data', 'Die Wortliste konnte nicht geladen werden. Geübt wird dann mit Silben.', 'warn');
    return fallback;
  }
}

function environmentHints() {
  if (!storage.available()) {
    banner('storage', 'Dieser Browser erlaubt kein Speichern (privates Fenster?). Der Fortschritt geht beim Schließen verloren.', 'warn');
  }
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  if (touchOnly) {
    banner('touch', 'Zehnfingerschreiben braucht eine echte Tastatur. Bitte eine Tastatur anschließen oder am Computer üben.', 'warn');
  }
  const ua = navigator.userAgent;
  const isSafari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS|FxiOS|Edg\//.test(ua);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isSafari && !standalone) {
    banner('safari', 'Hinweis: Safari löscht gespeicherte Daten, wenn die Seite 7 Tage nicht besucht wurde. Besser Chrome, Edge oder Firefox nutzen – oder regelmäßig eine Sicherung speichern.', 'info');
  }
}

async function start() {
  const { data, error } = storage.load();
  ctx.data = data;
  if (error) banner('load', error, 'warn');
  environmentHints();
  storage.requestPersist(); // Ergebnis zeigt die Einstellungsseite
  const [words, kids, adults] = await Promise.all([
    loadJson('data/words-de.json', []),
    loadJson('data/sentences-kids.json', []),
    loadJson('data/sentences-adults.json', []),
  ]);
  ctx.words = words;
  ctx.sentences = { kids, adults };
  go('profile');
}

start();
