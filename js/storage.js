// Speicherzugriff: laden, speichern, Export/Import, Schema-Migration.
// Der Abgleich zwischen Geräten (Weg C) steckt in sync.js und hängt sich über `afterSave` an.

export const STORAGE_KEY = '10finger.v1';
export const SCHEMA_VERSION = 1;
export const BACKUP_INTERVAL_DAYS = 14;

export const DEFAULT_SETTINGS = {
  sound: true,
  fontSize: 'gross',
  errorMode: 'wait',
  showKeyboard: true,
  blindMode: 'auto', // aus | auto (sobald eine Lektion sicher sitzt) | immer
  warmup: true,
  speech: true,
  dailyGoal: null, // null = Vorgabe der Altersgruppe
  theme: 'auto', // auto | hell | dunkel
  contrast: false,
};

const MAX_CUSTOM_TEXTS = 20;

export function createEmptyData() {
  return { schemaVersion: SCHEMA_VERSION, lastBackup: null, profiles: [] };
}

/** Fehlende Felder eines Profils mit Vorgaben auffüllen (auch für ältere Sicherungen). */
export function normalizeProfile(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.name !== 'string') {
    throw new Error('Ungültiges Profil in den Daten.');
  }
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar ?? 'fuchs',
    ageGroup: ['vorschule', 'kind', 'erwachsen'].includes(p.ageGroup) ? p.ageGroup : 'kind',
    pinHash: p.pinHash ?? null,
    settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
    progress: {
      currentLesson: Number.isInteger(p.progress?.currentLesson) ? p.progress.currentLesson : 1,
      lessons: { ...(p.progress?.lessons ?? {}) },
    },
    keyStats: { ...(p.keyStats ?? {}) },
    sessions: Array.isArray(p.sessions) ? p.sessions : [],
    weeks: Array.isArray(p.weeks) ? p.weeks : [],
    streak: { current: p.streak?.current ?? 0, lastDay: p.streak?.lastDay ?? null },
    badges: Array.isArray(p.badges) ? p.badges : [],
    explorer: { stars: p.explorer?.stars ?? 0 },
    customTexts: Array.isArray(p.customTexts) ? p.customTexts.slice(-MAX_CUSTOM_TEXTS) : [],
    ghosts: p.ghosts && typeof p.ghosts === 'object' ? p.ghosts : {},
    games: { rainBest: p.games?.rainBest ?? 0 },
    flags: { ergonomicsSeen: Boolean(p.flags?.ergonomicsSeen) },
  };
}

/** Rohdaten prüfen und auf den aktuellen Stand bringen. Wirft bei unlesbaren Daten. */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.profiles)) {
    throw new Error('Das ist keine 10finger-Sicherung.');
  }
  const version = raw.schemaVersion;
  if (!Number.isInteger(version) || version < 1) throw new Error('Unbekannte Datenversion.');
  if (version > SCHEMA_VERSION) {
    throw new Error('Diese Sicherung stammt aus einer neueren Version der App.');
  }
  // Künftige Migrationen: if (version === 1) { …; version = 2; }
  return {
    schemaVersion: SCHEMA_VERSION,
    lastBackup: typeof raw.lastBackup === 'string' ? raw.lastBackup : null,
    profiles: raw.profiles.map(normalizeProfile),
  };
}

export function daysBetween(fromDay, toDay) {
  const a = Date.parse(`${fromDay}T00:00:00Z`);
  const b = Date.parse(`${toDay}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/**
 * Erinnerung an eine Sicherung: noch nie gesichert → ab dem Tag nach dem ersten Üben
 * (nicht mitten in der ersten Übung), danach alle 14 Tage.
 */
export function needsBackupReminder(data, today) {
  const practiced = data.profiles.filter((p) => p.sessions?.length > 0 || p.weeks?.length > 0);
  if (!practiced.length) return false;
  if (!data.lastBackup) {
    // Wochenwerte gibt es nur bei sehr alten Sitzungen – dann ist der erste Übungstag lange her.
    if (practiced.some((p) => p.weeks?.length > 0)) return true;
    const first = practiced.map((p) => p.sessions[0].date.slice(0, 10)).sort()[0];
    return daysBetween(first, today) >= 1;
  }
  return daysBetween(data.lastBackup, today) >= BACKUP_INTERVAL_DAYS;
}

/**
 * @param {Storage} [backend] standardmäßig localStorage; in Tests ein Ersatzobjekt.
 * @param {StorageManager} [manager] standardmäßig navigator.storage
 * @param {(data: object) => void} [afterSave] wird nach jedem erfolgreichen Speichern aufgerufen (Sync)
 */
export function createStorage(backend = globalThis.localStorage, manager = globalThis.navigator?.storage, afterSave = null) {
  function available() {
    try {
      const probe = `${STORAGE_KEY}.probe`;
      backend.setItem(probe, '1');
      backend.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  /** @returns {{data: object, error: string|null}} */
  function load() {
    let text;
    try {
      text = backend.getItem(STORAGE_KEY);
    } catch {
      return { data: createEmptyData(), error: 'Der Browser erlaubt kein Speichern.' };
    }
    if (text == null) return { data: createEmptyData(), error: null };
    try {
      return { data: migrate(JSON.parse(text)), error: null };
    } catch (e) {
      // Defekte Daten nicht überschreiben, sondern beiseitelegen.
      try { backend.setItem(`${STORAGE_KEY}.defekt`, text); } catch { /* nichts mehr zu retten */ }
      return { data: createEmptyData(), error: `Gespeicherte Daten waren nicht lesbar (${e.message}). Bitte Sicherung laden.` };
    }
  }

  /** @returns {boolean} ob gespeichert werden konnte */
  function save(data) {
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(data));
      try { afterSave?.(data); } catch { /* Abgleich darf das Speichern nie stören */ }
      return true;
    } catch {
      return false;
    }
  }

  /** Sicherung als JSON-Text; vermerkt das Datum der Sicherung. */
  function exportData(data, today) {
    data.lastBackup = today;
    save(data);
    return JSON.stringify({ app: '10finger', exported: today, ...data }, null, 2);
  }

  /** Sicherung einlesen; wirft mit verständlicher Meldung, wenn die Datei nicht passt. */
  function importData(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('Die Datei ist keine lesbare Sicherung.');
    }
    const { app, exported, ...rest } = raw ?? {};
    const data = migrate(rest);
    save(data);
    return data;
  }

  /** Beim ersten Start um dauerhaften Speicher bitten (Browser darf ablehnen). */
  async function requestPersist() {
    try {
      if (!manager?.persist) return null;
      if (await manager.persisted()) return true;
      return await manager.persist();
    } catch {
      return null;
    }
  }

  /** true / false, oder null wenn der Browser es nicht unterstützt. */
  async function persistStatus() {
    try {
      return manager?.persisted ? await manager.persisted() : null;
    } catch {
      return null;
    }
  }

  return { available, load, save, exportData, importData, requestPersist, persistStatus };
}
