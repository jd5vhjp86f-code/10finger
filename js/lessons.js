// Die 16 Lektionen als Daten, jede mit einer Station auf der Kurs-Landkarte.

export const PASS_ACCURACY = 95;
export const AVAILABLE_LESSONS = 16;
export const SHIFT = 'Shift';

export const LESSONS = [
  { nr: 1, title: 'Grundstellung', keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', 'ö', ' '], fingers: 'Grundstellung, Daumen', icon: '🏡', place: 'Zuhause' },
  { nr: 2, title: 'e und i', keys: ['e', 'i'], fingers: 'Mittelfinger links / rechts', icon: '🌼', place: 'Blumenwiese' },
  { nr: 3, title: 'r und u', keys: ['r', 'u'], fingers: 'Zeigefinger links / rechts', icon: '🌲', place: 'Wald' },
  { nr: 4, title: 'g und h', keys: ['g', 'h'], fingers: 'Zeigefinger links / rechts', icon: '🌉', place: 'Brücke' },
  { nr: 5, title: 't und n', keys: ['t', 'n'], fingers: 'Zeigefinger links / rechts', icon: '🐄', place: 'Bauernhof' },
  { nr: 6, title: 'Großschreibung', keys: [SHIFT], fingers: 'kleiner Finger der Gegenhand', icon: '🏰', place: 'Burg' },
  { nr: 7, title: 'c und m', keys: ['c', 'm'], fingers: 'Mittelfinger links / Zeigefinger rechts', icon: '🛶', place: 'See' },
  { nr: 8, title: 'w und o', keys: ['w', 'o'], fingers: 'Ringfinger links / rechts', icon: '⛰️', place: 'Berg' },
  { nr: 9, title: 'b und z', keys: ['b', 'z'], fingers: 'Zeigefinger links / rechts', icon: '🦇', place: 'Höhle' },
  { nr: 10, title: 'Komma und Punkt', keys: [',', '.'], fingers: 'Mittelfinger / Ringfinger rechts', icon: '🏘️', place: 'Dorf' },
  { nr: 11, title: 'v und p', keys: ['v', 'p'], fingers: 'Zeigefinger links / kleiner Finger rechts', icon: '⚓', place: 'Hafen' },
  { nr: 12, title: 'ü und ä', keys: ['ü', 'ä'], fingers: 'kleiner Finger rechts', icon: '🌊', place: 'Meer' },
  { nr: 13, title: 'ß und Bindestrich', keys: ['ß', '-'], fingers: 'kleiner Finger rechts', icon: '🏝️', place: 'Insel' },
  { nr: 14, title: 'q, x und y', keys: ['q', 'x', 'y'], fingers: 'kleiner / Ringfinger / kleiner Finger links', icon: '🌋', place: 'Vulkan' },
  { nr: 15, title: 'Ziffern', keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], fingers: 'Finger der Spalte darunter', icon: '🔭', place: 'Sternwarte' },
  { nr: 16, title: 'Satzzeichen', keys: ['!', '"', '?', ':', '(', ')'], fingers: 'Umschalttaste + Spaltenfinger', icon: '💎', place: 'Schatz' },
];

export function getLesson(nr) {
  return LESSONS.find((l) => l.nr === nr) ?? null;
}

/** Neue Zeichen der Lektion (ohne Leertaste und ohne die Umschalttaste als „Taste“). */
export function newChars(lesson) {
  return lesson.keys.filter((k) => k !== ' ' && k !== SHIFT);
}

export function shiftUnlocked(nr) {
  return LESSONS.some((l) => l.nr <= nr && l.keys.includes(SHIFT));
}

/** Alle bis einschließlich Lektion `nr` bekannten Zeichen (klein), plus Leertaste. */
export function knownChars(nr) {
  const set = new Set([' ']);
  for (const l of LESSONS) {
    if (l.nr > nr) break;
    for (const k of newChars(l)) set.add(k);
  }
  return set;
}

/** Darf ein Text in Lektion `nr` vorkommen? Großbuchstaben erst mit freigeschalteter Umschalttaste. */
export function isTypeable(text, nr) {
  const known = knownChars(nr);
  const shift = shiftUnlocked(nr);
  for (const ch of text) {
    if (known.has(ch)) continue;
    const lower = ch.toLowerCase();
    if (shift && lower !== ch && known.has(lower)) continue;
    return false;
  }
  return true;
}
