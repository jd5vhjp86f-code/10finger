// Weg C: Abgleich der Profile zwischen Geräten über den eigenen LernSync-Server
// (Cloudflare Worker, Daten in der EU). Neben storage.js das einzige Modul mit Speicherzugriff.
//
// Grundsätze:
// - Das Gerät bleibt die Hauptquelle. Ohne Familien-Code, ohne Netz oder bei Serverfehlern
//   läuft alles wie bisher, nur lokal.
// - Jedes Profil ist ein eigener Eintrag auf dem Server. Geändert wird immer das ganze Profil;
//   bei zwei Geräten gewinnt der jeweils neuere Stand dieses Profils.
// - Gelöschte Profile werden als „gelöscht“ vermerkt, damit sie auf anderen Geräten
//   ebenfalls verschwinden und nicht wieder auftauchen.

import { normalizeProfile } from './storage.js';

export const SYNC_SERVER = 'https://lernsync.2n7vt787wn.workers.dev';
const APP = '10finger';
const CODE_KEY = 'lernsync.code';
const META_KEY = '10finger.sync';
// Gespeichert wird nur am Ende einer Übung oder bei Einstellungen – also selten. Deshalb fast sofort
// senden: Wer gleich danach den Laptop zuklappt, soll den Stand trotzdem auf dem Server haben.
const SEND_DELAY_MS = 1500;
// Browser schicken beim Schließen der Seite nur kleine Anfragen sicher ab (keepalive, max. 64 KB).
const KEEPALIVE_MAX_BYTES = 60000;

/** Kurzer, schneller Prüfwert (cyrb53) – nur um Änderungen zu erkennen. */
export function checksum(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const sum = (profile) => checksum(JSON.stringify(profile));

/**
 * @param {object} [opts]
 * @param {Storage} [opts.backend] localStorage oder Ersatz in Tests
 * @param {typeof fetch} [opts.fetchFn]
 * @param {() => number} [opts.now]
 * @param {(data: object) => void} [opts.onRemoteChange] wenn ein anderes Gerät neuer war
 */
export function createSync({
  backend = globalThis.localStorage,
  fetchFn = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  server = SYNC_SERVER,
  delay = SEND_DELAY_MS,
  onRemoteChange = null,
} = {}) {
  let status = 'aus';
  const listeners = new Set();
  let timer = null;
  let latest = null; // zuletzt gespeicherte Daten

  const read = (k) => { try { return backend.getItem(k); } catch { return null; } };
  const write = (k, v) => {
    try { if (v == null) backend.removeItem(k); else backend.setItem(k, v); } catch { /* ohne Ablage kein Abgleich */ }
  };
  const code = () => read(CODE_KEY) ?? '';
  function meta() {
    try {
      const m = JSON.parse(read(META_KEY) ?? 'null');
      if (m && typeof m === 'object' && m.profiles && typeof m.profiles === 'object') {
        return { connected: m.connected === true, profiles: m.profiles };
      }
    } catch { /* neu anfangen */ }
    return { connected: false, profiles: {} };
  }
  const saveMeta = (m) => write(META_KEY, JSON.stringify(m));
  function setStatus(s) {
    if (s === status) return;
    status = s;
    for (const fn of listeners) fn(s);
  }

  async function request(method, path, body, keepalive = false) {
    const c = code();
    if (!c) { setStatus('aus'); return null; }
    try {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const res = await fetchFn(server + path, {
        method,
        keepalive: keepalive && (payload?.length ?? 0) < KEEPALIVE_MAX_BYTES,
        headers: { 'X-Familien-Code': c, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: payload,
      });
      if (res.status === 401) { setStatus('code-falsch'); return null; }
      setStatus('ok');
      return { status: res.status, body: await res.json().catch(() => null) };
    } catch {
      setStatus('offline');
      return null;
    }
  }

  /**
   * Einen Stand vom Server in die Daten übernehmen. Das Profil-Objekt wird an Ort und Stelle
   * ersetzt, damit eine offene Ansicht nicht mit einer veralteten Kopie weiterarbeitet.
   */
  function apply(data, m, id, record) {
    if (record?.data?.deleted === true) {
      const before = data.profiles.length;
      data.profiles = data.profiles.filter((p) => p.id !== id);
      m.profiles[id] = { sum: null, deleted: true, updatedAt: record.updatedAt, pending: false };
      return data.profiles.length !== before;
    }
    let incoming;
    try {
      incoming = normalizeProfile({ ...record.data, id });
    } catch {
      return false; // unlesbarer Eintrag: lieber ignorieren als lokale Daten gefährden
    }
    let pending = false;
    let updatedAt = record.updatedAt;
    const clash = data.profiles.find((p) => p.id !== id && p.name.toLowerCase() === incoming.name.toLowerCase());
    if (clash) {
      // Gleicher Name auf zwei Geräten getrennt angelegt: beide behalten, eines umbenennen.
      incoming.name = `${incoming.name} (2)`;
      pending = true;
      updatedAt = Math.max(now(), record.updatedAt + 1);
    }
    const existing = data.profiles.find((p) => p.id === id);
    if (existing) {
      for (const k of Object.keys(existing)) delete existing[k];
      Object.assign(existing, incoming);
    } else {
      data.profiles.push(incoming);
    }
    m.profiles[id] = { sum: sum(existing ?? incoming), deleted: false, updatedAt, pending };
    return true;
  }

  async function send(keepalive = false) {
    const m = meta();
    if (!m.connected || !latest) return;
    const open = Object.entries(m.profiles).filter(([, e]) => e.pending);
    let changed = false;
    for (const [id, entry] of open) {
      const profile = latest.profiles.find((p) => p.id === id);
      const data = entry.deleted ? { deleted: true } : profile;
      if (!data) continue;
      const res = await request('PUT', `/v1/${APP}/profile/${encodeURIComponent(id)}`, { data, updatedAt: entry.updatedAt }, keepalive);
      if (!res) return;
      const current = meta();
      if (res.status === 200) {
        if (current.profiles[id]?.updatedAt === entry.updatedAt) current.profiles[id].pending = false;
        saveMeta(current);
      } else if (res.status === 409 && res.body) {
        // Ein anderes Gerät war neuer – dessen Stand gilt.
        if (apply(latest, current, id, res.body)) changed = true;
        saveMeta(current);
      }
    }
    if (changed) onRemoteChange?.(latest);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; send(); }, delay);
  }

  return {
    get status() { return code() ? status : 'aus'; },
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    hasCode: () => Boolean(code()),

    /** Nach jedem erfolgreichen Speichern: geänderte und gelöschte Profile vormerken. */
    afterSave(data) {
      latest = data;
      const m = meta();
      let any = false;
      const ids = new Set();
      for (const p of data.profiles) {
        ids.add(p.id);
        const s = sum(p);
        const e = m.profiles[p.id];
        if (!e || e.sum !== s) {
          m.profiles[p.id] = { sum: s, deleted: false, updatedAt: now(), pending: true };
          any = true;
        }
      }
      for (const [id, e] of Object.entries(m.profiles)) {
        if (!ids.has(id) && !e.deleted) {
          m.profiles[id] = { sum: null, deleted: true, updatedAt: now(), pending: true };
          any = true;
        }
      }
      if (any) {
        saveMeta(m);
        if (code()) schedule();
      }
    },

    /**
     * Mit dem Server abgleichen. Verändert `data` an Ort und Stelle.
     * @returns {Promise<boolean>} ob sich lokal etwas geändert hat
     */
    async sync(data) {
      latest = data;
      if (!code()) return false;
      const list = await request('GET', `/v1/${APP}/profile`);
      if (!list || list.status !== 200 || !Array.isArray(list.body?.profile)) return false;
      const m = meta();
      let changed = false;
      const onServer = new Set();
      for (const { profil: id, updatedAt } of list.body.profile) {
        onServer.add(id);
        const e = m.profiles[id];
        if (e && e.updatedAt >= (updatedAt ?? 0)) continue; // unser Stand ist gleich alt oder neuer
        const rec = await request('GET', `/v1/${APP}/profile/${encodeURIComponent(id)}`);
        if (rec?.status === 200 && rec.body && typeof rec.body.updatedAt === 'number') {
          if (apply(data, m, id, rec.body)) changed = true;
        }
      }
      // Was der Server noch nicht kennt (z. B. Profile von vor dem Verbinden), hochladen.
      for (const p of data.profiles) {
        const e = m.profiles[p.id];
        if (!onServer.has(p.id) && !e?.pending) {
          m.profiles[p.id] = { sum: sum(p), deleted: false, updatedAt: e?.updatedAt || now(), pending: true };
        }
      }
      m.connected = true;
      saveMeta(m);
      clearTimeout(timer);
      timer = null;
      await send();
      return changed;
    },

    /** Code beim Server prüfen; nur ein gültiger Code wird gemerkt. */
    async setCode(value) {
      const old = code();
      write(CODE_KEY, String(value).trim());
      const res = await request('GET', '/v1/check');
      if (res?.status === 200) return true;
      write(CODE_KEY, old || null);
      if (!old) setStatus('aus');
      return false;
    },

    removeCode() {
      write(CODE_KEY, null);
      setStatus('aus');
    },

    /** Ausstehendes sofort senden (z. B. beim Verlassen der Seite). */
    async flush(keepalive = false) {
      clearTimeout(timer);
      timer = null;
      await send(keepalive);
    },
  };
}
