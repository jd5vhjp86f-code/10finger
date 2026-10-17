// Profile anlegen, wählen, PIN. Die PIN ist eine Bequemlichkeitssperre, keine Sicherheit;
// gespeichert wird nur ihr Hash.

import { normalizeProfile } from './storage.js';

export const AGE_GROUPS = {
  vorschule: { label: 'Vorschule', fontSize: 'riesig', minutes: 4, sentences: null },
  kind: { label: 'Kind', fontSize: 'gross', minutes: 7, sentences: 'kids' },
  erwachsen: { label: 'Erwachsen', fontSize: 'normal', minutes: 12, sentences: 'adults' },
};

export const AVATARS = {
  fuchs: '🦊', eule: '🦉', katze: '🐱', hund: '🐶', panda: '🐼',
  frosch: '🐸', loewe: '🦁', einhorn: '🦄', schildkroete: '🐢', drache: '🐉',
};

export function avatarOf(profile) {
  return AVATARS[profile.avatar] ?? AVATARS.fuchs;
}

function newId(existing) {
  let id;
  do {
    id = `p_${Math.random().toString(36).slice(2, 6)}`;
  } while (existing.some((p) => p.id === id));
  return id;
}

export function isValidPin(pin) {
  return /^\d{4}$/.test(pin);
}

export async function hashPin(pin, salt) {
  const bytes = new TextEncoder().encode(`10finger:${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(profile, pin) {
  if (!profile.pinHash) return true;
  return (await hashPin(pin, profile.id)) === profile.pinHash;
}

export async function setPin(profile, pin) {
  profile.pinHash = pin ? await hashPin(pin, profile.id) : null;
}

export async function createProfile(data, { name, avatar, ageGroup, pin }) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Bitte einen Namen eingeben.');
  if (data.profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('Diesen Namen gibt es schon.');
  }
  if (pin && !isValidPin(pin)) throw new Error('Die PIN muss aus 4 Ziffern bestehen.');
  const profile = normalizeProfile({ id: newId(data.profiles), name: trimmed, avatar, ageGroup });
  profile.settings.fontSize = AGE_GROUPS[profile.ageGroup].fontSize;
  if (pin) await setPin(profile, pin);
  data.profiles.push(profile);
  return profile;
}

export function getProfile(data, id) {
  return data.profiles.find((p) => p.id === id) ?? null;
}

export function deleteProfile(data, id) {
  data.profiles = data.profiles.filter((p) => p.id !== id);
}
