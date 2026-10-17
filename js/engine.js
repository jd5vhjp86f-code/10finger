// Tippkern: Eingabe, Vergleich, Fehler, Messwerte, Pause.
// Rein logisch und ohne DOM, damit er mit node --test prüfbar ist.

export const PAUSE_MS = 5000;

/**
 * @param {string} text  abzutippender Text
 * @param {object} [opts]
 * @param {'wait'|'continue'} [opts.errorMode]  'wait': Cursor wartet auf die richtige Taste;
 *        'continue': Fehler wird markiert, es geht weiter (Rücktaste erlaubt).
 * @param {number} [opts.pauseMs]  Lücken ohne Eingabe zählen höchstens so lange (Timer pausiert).
 */
export function createEngine(text, { errorMode = 'wait', pauseMs = PAUSE_MS } = {}) {
  const chars = [...text];
  // todo | ok | fixed (erst falsch, dann richtig) | error (gerade falsch) | wrong (falsch übersprungen)
  const status = chars.map(() => 'todo');
  let pos = 0;
  let hits = 0;
  let errors = 0;
  let activeMs = 0;
  let lastT = null;
  const keyStats = {};
  // aktive Zeit (ms) beim Erreichen jeder Position – Grundlage für den „Geist“ im Rennen
  const timeline = [];

  function stat(ch) {
    if (!keyStats[ch]) keyStats[ch] = { hits: 0, errors: 0, totalMs: 0, timed: 0 };
    return keyStats[ch];
  }

  function tick(t) {
    const gap = lastT === null ? null : Math.max(0, t - lastT);
    if (gap !== null) activeMs += Math.min(gap, pauseMs);
    lastT = t;
    return gap;
  }

  /**
   * Eine Taste verarbeiten. `key` ist event.key (das tatsächlich getippte Zeichen).
   * Tottasten ("Dead"), Umschalt, Enter usw. werden ignoriert und nicht als Fehler gezählt.
   */
  function input(key, t) {
    if (pos >= chars.length) return { type: 'ignored', done: true };
    if (key === 'Backspace') {
      if (errorMode === 'continue' && pos > 0) {
        tick(t);
        pos--;
        status[pos] = 'todo';
        return { type: 'back', done: false };
      }
      return { type: 'ignored', done: false };
    }
    if (typeof key !== 'string' || [...key].length !== 1) return { type: 'ignored', done: false };

    const gap = tick(t);
    const expected = chars[pos];
    const s = stat(expected);
    if (key === expected) {
      hits++;
      s.hits++;
      if (gap !== null && gap < pauseMs && status[pos] === 'todo') {
        s.totalMs += gap;
        s.timed++;
      }
      status[pos] = status[pos] === 'error' ? 'fixed' : 'ok';
      timeline[pos] = activeMs;
      pos++;
      return { type: 'hit', done: pos >= chars.length };
    }
    errors++;
    s.errors++;
    if (errorMode === 'continue') {
      status[pos] = 'wrong';
      pos++;
      return { type: 'error', expected, typed: key, done: pos >= chars.length };
    }
    status[pos] = 'error';
    return { type: 'error', expected, typed: key, done: false };
  }

  return {
    input,
    get pos() { return pos; },
    get done() { return pos >= chars.length; },
    get expected() { return chars[pos]; },
    get started() { return lastT !== null; },
    get activeMs() { return activeMs; },
    timeline,
    chars,
    status,
    snapshot() {
      return { hits, errors, activeMs, keyStats: structuredClone(keyStats) };
    },
    result() {
      return summarize([this.snapshot()]);
    },
  };
}

export function accuracy(hits, errors) {
  const total = hits + errors;
  return total === 0 ? 100 : Math.round((hits / total) * 1000) / 10;
}

/** Anschläge pro Minute: richtig getippte Zeichen inkl. Leerzeichen; ein Großbuchstabe = ein Anschlag. */
export function apm(hits, activeMs) {
  return activeMs <= 0 ? 0 : Math.round(hits / (activeMs / 60000));
}

/** Mehrere Schritte einer Lektion zu einem Ergebnis zusammenfassen. */
export function summarize(snapshots) {
  let hits = 0;
  let errors = 0;
  let activeMs = 0;
  const keyStats = {};
  for (const s of snapshots) {
    hits += s.hits;
    errors += s.errors;
    activeMs += s.activeMs;
    for (const [ch, k] of Object.entries(s.keyStats)) {
      const t = (keyStats[ch] ??= { hits: 0, errors: 0, totalMs: 0, timed: 0 });
      t.hits += k.hits;
      t.errors += k.errors;
      t.totalMs += k.totalMs;
      t.timed += k.timed;
    }
  }
  return {
    hits,
    errors,
    activeMs,
    seconds: Math.round(activeMs / 1000),
    accuracy: accuracy(hits, errors),
    apm: apm(hits, activeMs),
    keyStats,
  };
}
