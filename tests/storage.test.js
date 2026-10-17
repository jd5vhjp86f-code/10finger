import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStorage, createEmptyData, migrate, needsBackupReminder, normalizeProfile,
  STORAGE_KEY, SCHEMA_VERSION, DEFAULT_SETTINGS,
} from '../js/storage.js';

function memoryBackend() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

function failingBackend() {
  return {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() {},
  };
}

const sample = () => ({
  schemaVersion: 1,
  lastBackup: '2026-10-17',
  profiles: [{
    id: 'p_x7k2', name: 'Lukas', avatar: 'fuchs', ageGroup: 'kind', pinHash: null,
    settings: { sound: true, fontSize: 'gross', errorMode: 'wait', showKeyboard: true },
    progress: { currentLesson: 3, lessons: { 1: { done: true, bestApm: 62, bestAccuracy: 97.5, attempts: 4 } } },
    keyStats: { f: { hits: 412, errors: 9, avgMs: 380 } },
    sessions: [{ date: '2026-10-17T15:02', lesson: 3, seconds: 300, apm: 58, accuracy: 96.1 }],
    streak: { current: 3, lastDay: '2026-10-17' },
    badges: ['erste-lektion'],
  }],
});

test('leerer Speicher liefert leere Daten', () => {
  const s = createStorage(memoryBackend());
  const { data, error } = s.load();
  assert.equal(error, null);
  assert.deepEqual(data, createEmptyData());
});

test('speichern und laden unter dem Schlüssel 10finger.v1', () => {
  const backend = memoryBackend();
  const s = createStorage(backend);
  assert.equal(s.save(sample()), true);
  assert.ok(backend._map.has(STORAGE_KEY));
  const { data } = createStorage(backend).load();
  assert.equal(data.profiles[0].name, 'Lukas');
  assert.equal(data.profiles[0].progress.currentLesson, 3);
  assert.equal(data.schemaVersion, SCHEMA_VERSION);
});

test('defekte Daten werden beiseitegelegt statt überschrieben', () => {
  const backend = memoryBackend();
  backend.setItem(STORAGE_KEY, '{kaputt');
  const { data, error } = createStorage(backend).load();
  assert.ok(error);
  assert.deepEqual(data, createEmptyData());
  assert.equal(backend.getItem(`${STORAGE_KEY}.defekt`), '{kaputt');
});

test('blockierter Speicher (z. B. privates Fenster) wird erkannt', () => {
  const s = createStorage(failingBackend());
  assert.equal(s.available(), false);
  assert.equal(s.save(sample()), false);
  assert.ok(s.load().error);
});

test('Export und Import ergeben dieselben Daten und vermerken die Sicherung', () => {
  const s = createStorage(memoryBackend());
  const data = sample();
  const text = s.exportData(data, '2026-11-01');
  assert.equal(data.lastBackup, '2026-11-01');
  const other = createStorage(memoryBackend());
  const imported = other.importData(text);
  assert.equal(imported.lastBackup, '2026-11-01');
  assert.deepEqual(imported.profiles[0].keyStats, sample().profiles[0].keyStats);
  assert.equal(other.load().data.profiles.length, 1);
});

test('Import lehnt fremde oder zu neue Dateien verständlich ab', () => {
  const s = createStorage(memoryBackend());
  assert.throws(() => s.importData('kein json'), /keine lesbare Sicherung/);
  assert.throws(() => s.importData('{"foo":1}'), /keine 10finger-Sicherung/);
  assert.throws(() => s.importData(JSON.stringify({ ...sample(), schemaVersion: 99 })), /neueren Version/);
});

test('Migration füllt fehlende Felder auf', () => {
  const data = migrate({ schemaVersion: 1, profiles: [{ id: 'p_1', name: 'Anna' }] });
  const p = data.profiles[0];
  assert.deepEqual(p.settings, DEFAULT_SETTINGS);
  assert.equal(p.progress.currentLesson, 1);
  assert.deepEqual(p.sessions, []);
  assert.equal(p.ageGroup, 'kind');
  assert.equal(data.lastBackup, null);
});

test('normalizeProfile lehnt Profile ohne id oder Namen ab', () => {
  assert.throws(() => normalizeProfile({ name: 'x' }));
  assert.throws(() => normalizeProfile(null));
});

test('Erinnerung an Sicherung alle 14 Tage, aber erst nach dem ersten Üben', () => {
  const data = sample();
  assert.equal(needsBackupReminder(data, '2026-10-30'), false);
  assert.equal(needsBackupReminder(data, '2026-10-31'), true);
  data.lastBackup = null;
  assert.equal(needsBackupReminder(data, '2026-10-17'), true);
  assert.equal(needsBackupReminder(createEmptyData(), '2026-10-17'), false);
});

test('persist-Status wird abgefragt, Fehler werden abgefangen', async () => {
  const granted = { persisted: async () => false, persist: async () => true };
  assert.equal(await createStorage(memoryBackend(), granted).requestPersist(), true);
  assert.equal(await createStorage(memoryBackend(), undefined).requestPersist(), null);
  const broken = { persisted: async () => { throw new Error('x'); }, persist: async () => true };
  assert.equal(await createStorage(memoryBackend(), broken).persistStatus(), null);
});
