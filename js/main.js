// Start, Wechsel zwischen Ansichten, Hinweisleisten, Darstellung, Offline-Betrieb.

import { createStorage } from './storage.js';
import { createSync } from './sync.js';
import { getProfile } from './profiles.js';
import * as profileView from './views/profile.js';
import * as courseView from './views/course.js';
import * as exerciseView from './views/exercise.js';
import * as resultsView from './views/results.js';
import * as settingsView from './views/settings.js';
import * as familyView from './views/family.js';
import * as customView from './views/custom.js';
import * as explorerView from './views/explorer.js';
import * as gamesView from './views/games.js';
import * as ergonomicsView from './views/ergonomics.js';

const VIEWS = {
  profile: profileView,
  course: courseView,
  exercise: exerciseView,
  results: resultsView,
  settings: settingsView,
  family: familyView,
  custom: customView,
  explorer: explorerView,
  games: gamesView,
  ergonomics: ergonomicsView,
};

// Ansichten, die ohne gewähltes Profil erreichbar sind
const PUBLIC_VIEWS = new Set(['profile', 'family']);
const WARMUP_GAP_MS = 60 * 60 * 1000;

const root = document.getElementById('app');
const bannerBox = document.getElementById('banners');
const sync = createSync({ onRemoteChange: () => afterRemoteChange() });
const storage = createStorage(undefined, undefined, (data) => sync.afterSave(data));

const ctx = {
  storage,
  sync,
  syncNow,
  data: null,
  profileId: null,
  words: [],
  sentences: { kids: [], adults: [] },
  practiceSeconds: 0,
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
    this.practiceSeconds = 0;
    applyAppearance(this.profile);
  },
  applyAppearance,
  startExercise,
};

let cleanup = null;

function go(name, params = {}) {
  if (cleanup) cleanup();
  cleanup = null;
  if (!PUBLIC_VIEWS.has(name) && !ctx.profile) name = 'profile';
  root.replaceChildren();
  root.dataset.view = name;
  cleanup = VIEWS[name].render(root, ctx, params) ?? null;
  window.scrollTo(0, 0);
}

/**
 * Übung starten. Beim allerersten Mal kommt der Ergonomie-Hinweis; vor der ersten Lektion
 * einer Sitzung (eine Stunde Pause) eine Minute Aufwärmen, wenn eingeschaltet.
 */
function startExercise(params, { skipWarmup = false } = {}) {
  const p = ctx.profile;
  if (!p.flags.ergonomicsSeen) {
    go('ergonomics', { next: params });
    return;
  }
  const last = p.sessions.at(-1);
  const sinceLast = last ? Date.now() - new Date(last.date).getTime() : Infinity;
  const wantsWarmup = !skipWarmup && p.settings.warmup && params.mode === 'lesson'
    && params.lesson > 1 && last && sinceLast > WARMUP_GAP_MS;
  if (wantsWarmup) go('exercise', { mode: 'warmup', next: params });
  else go('exercise', params);
}

/** Schriftgröße, Farbschema und Kontrast des aktiven Profils anwenden. */
function applyAppearance(profile) {
  const s = profile?.settings;
  document.body.dataset.font = s?.fontSize ?? 'gross';
  const theme = s?.theme ?? 'auto';
  if (theme === 'hell') document.documentElement.dataset.theme = 'light';
  else if (theme === 'dunkel') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  if (s?.contrast) document.documentElement.dataset.contrast = 'hoch';
  else delete document.documentElement.dataset.contrast;
}

/** Hinweisleiste; gleiche id ersetzt die vorherige Meldung. Optional mit Knopf. */
function banner(id, text, kind = 'info', action = null) {
  bannerBox.querySelector(`[data-id="${id}"]`)?.remove();
  if (!text) return;
  const el = document.createElement('div');
  el.className = `banner banner-${kind}`;
  el.dataset.id = id;
  const p = document.createElement('p');
  p.textContent = text;
  el.append(p);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary';
    b.textContent = action.label;
    b.addEventListener('click', action.onClick);
    el.append(b);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'banner-close';
  close.setAttribute('aria-label', 'Hinweis schließen');
  close.textContent = '×';
  close.addEventListener('click', () => el.remove());
  el.append(close);
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
    banner('safari', 'Hinweis: Safari löscht gespeicherte Daten, wenn die Seite 7 Tage nicht besucht wurde. Besser Chrome, Edge oder Firefox nutzen, die Seite als App installieren – oder regelmäßig eine Sicherung speichern.', 'info');
  }
}

/** Offline-Betrieb: Service Worker nur über HTTPS (oder localhost). */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          banner('update', 'Eine neue Version von 10finger ist da.', 'info', { label: 'Neu laden', onClick: () => location.reload() });
        }
      });
    });
  }).catch(() => { /* ohne Offline-Betrieb weiter */ });
}

// Ansichten, die bei einem Stand von einem anderen Gerät neu gezeichnet werden dürfen.
// Während einer Übung oder eines Spiels wird nichts umgebaut.
const REDRAW_VIEWS = new Set(['profile', 'family', 'course', 'settings']);

function afterRemoteChange() {
  storage.save(ctx.data);
  if (ctx.profileId && !ctx.profile) ctx.profileId = null; // Profil wurde anderswo gelöscht
  const view = root.dataset.view;
  if (REDRAW_VIEWS.has(view)) go(view);
}

let lastSync = 0;
/** Mit dem LernSync-Server abgleichen (nur mit Familien-Code). */
async function syncNow({ force = false } = {}) {
  if (!sync.hasCode()) return false;
  if (!force && (!REDRAW_VIEWS.has(root.dataset.view) || Date.now() - lastSync < 60000)) return false;
  lastSync = Date.now();
  const changed = await sync.sync(ctx.data);
  if (changed) afterRemoteChange();
  return changed;
}

function watchSync() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sync.flush(true);
    else syncNow();
  });
  window.addEventListener('pagehide', () => sync.flush(true));
}

async function start() {
  const { data, error } = storage.load();
  ctx.data = data;
  if (error) banner('load', error, 'warn');
  environmentHints();
  storage.requestPersist(); // Ergebnis zeigt die Einstellungsseite
  registerServiceWorker();
  const [words, kids, adults] = await Promise.all([
    loadJson('data/words-de.json', []),
    loadJson('data/sentences-kids.json', []),
    loadJson('data/sentences-adults.json', []),
  ]);
  ctx.words = words;
  ctx.sentences = { kids, adults };
  go('profile');
  watchSync();
  syncNow({ force: true });
}

start();
