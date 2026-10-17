// Service Worker: macht 10finger offline nutzbar.
// Bei jeder Änderung an den Dateien VERSION erhöhen; die Liste prüft tests/sw.test.js.

const VERSION = 'v3-sync-1';
const CACHE = `10finger-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/engine.js',
  'js/generator.js',
  'js/keyboard.js',
  'js/lessons.js',
  'js/main.js',
  'js/profiles.js',
  'js/stats.js',
  'js/storage.js',
  'js/sync.js',
  'js/views/course.js',
  'js/views/custom.js',
  'js/views/dom.js',
  'js/views/ergonomics.js',
  'js/views/exercise.js',
  'js/views/explorer.js',
  'js/views/family.js',
  'js/views/games.js',
  'js/views/profile.js',
  'js/views/results.js',
  'js/views/settings.js',
  'js/views/sound.js',
  'data/sentences-adults.json',
  'data/sentences-kids.json',
  'data/words-de.json',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('10finger-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

// Erst aus dem Zwischenspeicher antworten (schnell, offline), im Hintergrund aktualisieren.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const res = await network;
    return res ?? (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  })());
});
