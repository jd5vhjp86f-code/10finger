import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSync, checksum } from '../js/sync.js';
import { createStorage, createEmptyData, normalizeProfile } from '../js/storage.js';

const CODE = 'richtiger-code';

function memoryBackend() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

/** Nachbau des LernSync-Workers mit denselben Regeln. */
function fakeServer() {
  const store = new Map();
  let online = true;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  async function fetchFn(url, init = {}) {
    if (!online) throw new TypeError('Failed to fetch');
    const { pathname } = new URL(url);
    if (init.headers?.['X-Familien-Code'] !== CODE) return json(401, { error: 'Familien-Code falsch' });
    if (pathname === '/v1/check') return json(200, { ok: true });
    const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const prefix = `${parts[1]}:`;
    if (parts.length === 3) {
      return json(200, { profile: [...store].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ profil: k.slice(prefix.length), updatedAt: v.updatedAt })) });
    }
    const key = prefix + parts[3];
    const method = init.method ?? 'GET';
    if (method === 'GET') return store.has(key) ? json(200, store.get(key)) : json(404, { error: 'kein Lernstand' });
    if (method === 'PUT') {
      const body = JSON.parse(init.body);
      const old = store.get(key);
      if (old && old.updatedAt > body.updatedAt) return json(409, { status: 'server-neuer', ...old });
      store.set(key, { data: body.data, updatedAt: body.updatedAt });
      return json(200, { status: 'gespeichert' });
    }
    return json(405, {});
  }
  return { store, fetchFn, setOnline: (v) => { online = v; } };
}

/** Ein Gerät: eigener Browser-Speicher, gemeinsamer Server, eigene Uhr. */
function device(server, clock = { t: 1000 }) {
  const backend = memoryBackend();
  let remote = 0;
  const sync = createSync({ backend, fetchFn: server.fetchFn, now: () => clock.t, delay: 1e9, onRemoteChange: () => { remote++; } });
  const storage = createStorage(backend, null, (d) => sync.afterSave(d));
  const data = storage.load().data;
  return { backend, sync, storage, data, clock, get remote() { return remote; } };
}

const profile = (id, name, lesson = 1) => normalizeProfile({ id, name, progress: { currentLesson: lesson } });

test('Prüfwert ist stabil und unterscheidet Änderungen', () => {
  assert.equal(checksum('abc'), checksum('abc'));
  assert.notEqual(checksum('abc'), checksum('abd'));
});

test('ohne Familien-Code: keine Anfrage, alles lokal', async () => {
  const server = fakeServer();
  const a = device(server);
  a.data.profiles.push(profile('p_aaaa', 'Lukas'));
  a.storage.save(a.data);
  assert.equal(await a.sync.sync(a.data), false);
  assert.equal(server.store.size, 0);
  assert.equal(a.sync.status, 'aus');
});

test('falscher Code wird nicht gemerkt', async () => {
  const a = device(fakeServer());
  assert.equal(await a.sync.setCode('falsch'), false);
  assert.equal(a.sync.hasCode(), false);
});

test('vorhandene Profile werden beim Verbinden hochgeladen und erscheinen auf dem zweiten Gerät', async () => {
  const server = fakeServer();
  const a = device(server);
  a.data.profiles.push(profile('p_aaaa', 'Lukas', 3), profile('p_bbbb', 'Mama', 5));
  a.storage.save(a.data);
  assert.ok(await a.sync.setCode(CODE));
  await a.sync.sync(a.data);
  assert.equal(server.store.size, 2);

  const b = device(server, { t: 2000 });
  await b.sync.setCode(CODE);
  assert.equal(await b.sync.sync(b.data), true);
  b.storage.save(b.data);
  assert.deepEqual(b.data.profiles.map((p) => p.name).sort(), ['Lukas', 'Mama']);
  assert.equal(b.data.profiles.find((p) => p.id === 'p_aaaa').progress.currentLesson, 3);
  // Nach dem Übernehmen gilt nichts als geändert -> kein erneutes Hochladen nötig
  const meta = JSON.parse(b.backend.getItem('10finger.sync'));
  assert.ok(Object.values(meta.profiles).every((e) => !e.pending));
});

test('Fortschritt wandert in beide Richtungen, das neuere gewinnt', async () => {
  const server = fakeServer();
  const a = device(server, { t: 1000 });
  a.data.profiles.push(profile('p_aaaa', 'Lukas', 1));
  a.storage.save(a.data);
  await a.sync.setCode(CODE);
  await a.sync.sync(a.data);
  const b = device(server, { t: 1500 });
  await b.sync.setCode(CODE);
  await b.sync.sync(b.data);
  b.storage.save(b.data);

  // B übt
  b.clock.t = 3000;
  b.data.profiles[0].progress.currentLesson = 4;
  b.storage.save(b.data);
  await b.sync.flush();

  // A holt den Stand; die offene Ansicht behält dasselbe Objekt
  const ref = a.data.profiles[0];
  assert.equal(await a.sync.sync(a.data), true);
  assert.equal(ref.progress.currentLesson, 4);
  assert.equal(a.data.profiles[0], ref);

  // A übt offline (älterer Zeitstempel), B ist inzwischen weiter -> 409 -> A übernimmt B
  a.clock.t = 3500;
  server.setOnline(false);
  ref.progress.currentLesson = 5;
  a.storage.save(a.data);
  await a.sync.flush();
  assert.equal(a.sync.status, 'offline');
  server.setOnline(true);
  b.clock.t = 4000;
  b.data.profiles[0].progress.currentLesson = 7;
  b.storage.save(b.data);
  await b.sync.flush();
  await a.sync.flush();
  assert.equal(a.remote, 1);
  assert.equal(a.data.profiles[0].progress.currentLesson, 7);
});

test('gelöschte Profile verschwinden auch auf anderen Geräten', async () => {
  const server = fakeServer();
  const a = device(server, { t: 1000 });
  a.data.profiles.push(profile('p_aaaa', 'Lukas'), profile('p_bbbb', 'Test'));
  a.storage.save(a.data);
  await a.sync.setCode(CODE);
  await a.sync.sync(a.data);
  const b = device(server, { t: 1100 });
  await b.sync.setCode(CODE);
  await b.sync.sync(b.data);
  b.storage.save(b.data);
  assert.equal(b.data.profiles.length, 2);

  a.clock.t = 2000;
  a.data.profiles = a.data.profiles.filter((p) => p.id !== 'p_bbbb');
  a.storage.save(a.data);
  await a.sync.flush();
  assert.deepEqual(server.store.get('10finger:p_bbbb').data, { deleted: true });

  assert.equal(await b.sync.sync(b.data), true);
  assert.deepEqual(b.data.profiles.map((p) => p.id), ['p_aaaa']);
  // und taucht bei A nicht wieder auf
  assert.equal(await a.sync.sync(a.data), false);
  assert.deepEqual(a.data.profiles.map((p) => p.id), ['p_aaaa']);
});

test('gleicher Name auf zwei Geräten getrennt angelegt: beide bleiben erhalten', async () => {
  const server = fakeServer();
  const a = device(server, { t: 1000 });
  a.data.profiles.push(profile('p_aaaa', 'Moritz', 6));
  a.storage.save(a.data);
  await a.sync.setCode(CODE);
  await a.sync.sync(a.data);

  const b = device(server, { t: 2000 });
  b.data.profiles.push(profile('p_cccc', 'Moritz', 2));
  b.storage.save(b.data);
  await b.sync.setCode(CODE);
  await b.sync.sync(b.data);
  b.storage.save(b.data);
  assert.deepEqual(b.data.profiles.map((p) => p.name).sort(), ['Moritz', 'Moritz (2)']);
  assert.equal(server.store.size, 2);
});

test('Import einer Sicherung wird abgeglichen', async () => {
  const server = fakeServer();
  const a = device(server);
  await a.sync.setCode(CODE);
  await a.sync.sync(a.data);
  const backup = { ...createEmptyData(), profiles: [profile('p_dddd', 'Anna')] };
  a.data = a.storage.importData(JSON.stringify(backup));
  await a.sync.flush();
  assert.equal(server.store.get('10finger:p_dddd').data.name, 'Anna');
});
