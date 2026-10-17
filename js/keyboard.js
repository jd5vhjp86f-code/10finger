// Deutsches QWERTZ-Layout (PC), Fingerzuordnung, Bildschirmtastatur und Handgrafik.
// Die Bildschirmtastatur leuchtet nach dem ERWARTETEN Zeichen auf (eigene Layout-Tabelle),
// nicht nach event.code – der folgt dem US-Layout.

export const FINGERS = {
  l5: { name: 'kleiner Finger links', hand: 'l' },
  l4: { name: 'Ringfinger links', hand: 'l' },
  l3: { name: 'Mittelfinger links', hand: 'l' },
  l2: { name: 'Zeigefinger links', hand: 'l' },
  th: { name: 'Daumen', hand: 'both' },
  r2: { name: 'Zeigefinger rechts', hand: 'r' },
  r3: { name: 'Mittelfinger rechts', hand: 'r' },
  r4: { name: 'Ringfinger rechts', hand: 'r' },
  r5: { name: 'kleiner Finger rechts', hand: 'r' },
};

// [id, Zeichen ohne Umschalt, Zeichen mit Umschalt, Finger, Breite]
const ROWS = [
  [
    ['Backquote', '^', '°', 'l5'], ['Digit1', '1', '!', 'l5'], ['Digit2', '2', '"', 'l4'],
    ['Digit3', '3', '§', 'l3'], ['Digit4', '4', '$', 'l2'], ['Digit5', '5', '%', 'l2'],
    ['Digit6', '6', '&', 'r2'], ['Digit7', '7', '/', 'r2'], ['Digit8', '8', '(', 'r3'],
    ['Digit9', '9', ')', 'r4'], ['Digit0', '0', '=', 'r5'], ['Minus', 'ß', '?', 'r5'],
    ['Equal', '´', '`', 'r5'], ['Backspace', 'Rück', '', 'r5', 2],
  ],
  [
    ['Tab', 'Tab', '', 'l5', 1.5], ['KeyQ', 'q', 'Q', 'l5'], ['KeyW', 'w', 'W', 'l4'],
    ['KeyE', 'e', 'E', 'l3'], ['KeyR', 'r', 'R', 'l2'], ['KeyT', 't', 'T', 'l2'],
    ['KeyY', 'z', 'Z', 'r2'], ['KeyU', 'u', 'U', 'r2'], ['KeyI', 'i', 'I', 'r3'],
    ['KeyO', 'o', 'O', 'r4'], ['KeyP', 'p', 'P', 'r5'], ['BracketLeft', 'ü', 'Ü', 'r5'],
    ['BracketRight', '+', '*', 'r5'], ['Enter', 'Enter', '', 'r5', 1.5],
  ],
  [
    ['CapsLock', 'Feststell', '', 'l5', 1.75], ['KeyA', 'a', 'A', 'l5'], ['KeyS', 's', 'S', 'l4'],
    ['KeyD', 'd', 'D', 'l3'], ['KeyF', 'f', 'F', 'l2'], ['KeyG', 'g', 'G', 'l2'],
    ['KeyH', 'h', 'H', 'r2'], ['KeyJ', 'j', 'J', 'r2'], ['KeyK', 'k', 'K', 'r3'],
    ['KeyL', 'l', 'L', 'r4'], ['Semicolon', 'ö', 'Ö', 'r5'], ['Quote', 'ä', 'Ä', 'r5'],
    ['Backslash', '#', "'", 'r5', 1.25],
  ],
  [
    ['ShiftLeft', 'Umschalt', '', 'l5', 1.25], ['IntlBackslash', '<', '>', 'l5'],
    ['KeyZ', 'y', 'Y', 'l5'], ['KeyX', 'x', 'X', 'l4'], ['KeyC', 'c', 'C', 'l3'],
    ['KeyV', 'v', 'V', 'l2'], ['KeyB', 'b', 'B', 'l2'], ['KeyN', 'n', 'N', 'r2'],
    ['KeyM', 'm', 'M', 'r2'], ['Comma', ',', ';', 'r3'], ['Period', '.', ':', 'r4'],
    ['Slash', '-', '_', 'r5'], ['ShiftRight', 'Umschalt', '', 'r5', 2.75],
  ],
  [['_spaceL', '', '', null, 3.75], ['Space', 'Leertaste', '', 'th', 6.25], ['_spaceR', '', '', null, 5]],
];

const HOME_KEYS = new Set(['KeyF', 'KeyJ']);
const DEAD_KEYS = new Set(['^', '´', '`']);

const CHAR_MAP = new Map();
const KEY_FINGER = new Map();
for (const row of ROWS) {
  for (const [id, lower, upper, finger] of row) {
    if (!finger) continue;
    KEY_FINGER.set(id, finger);
    if ([...lower].length === 1) CHAR_MAP.set(lower, { id, finger, shift: false });
    if ([...upper].length === 1) CHAR_MAP.set(upper, { id, finger, shift: true });
  }
}
CHAR_MAP.set(' ', { id: 'Space', finger: 'th', shift: false });

/** Welche Taste, welcher Finger und ggf. welche Umschalttaste (immer die der Gegenhand). */
export function keyInfo(char) {
  const k = CHAR_MAP.get(char);
  if (!k) return null;
  let shift = null;
  if (k.shift) shift = FINGERS[k.finger].hand === 'l' ? 'ShiftRight' : 'ShiftLeft';
  return {
    id: k.id,
    finger: k.finger,
    shift,
    shiftFinger: shift === 'ShiftLeft' ? 'l5' : shift === 'ShiftRight' ? 'r5' : null,
    dead: DEAD_KEYS.has(char),
  };
}

export function fingerName(finger) {
  return FINGERS[finger]?.name ?? '';
}

/** Kurzbeschreibung für ein Zeichen, z. B. „E: Mittelfinger links + Umschalt rechts“. */
export function describeChar(char) {
  const info = keyInfo(char);
  if (!info) return '';
  const label = char === ' ' ? 'Leertaste' : char;
  let text = `${label}: ${fingerName(info.finger)}`;
  if (info.shift) text += ` + Umschalttaste ${info.shift === 'ShiftLeft' ? 'links' : 'rechts'}`;
  return text;
}

export function renderKeyboard(container) {
  const el = document.createElement('div');
  el.className = 'keyboard';
  el.setAttribute('aria-hidden', 'true');
  const keys = new Map();
  for (const row of ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    for (const [id, lower, upper, finger, width = 1] of row) {
      const key = document.createElement('div');
      key.style.flexGrow = String(width);
      if (!finger) {
        key.className = 'kb-gap';
      } else {
        key.className = `kb-key f-${finger}`;
        if (HOME_KEYS.has(id)) key.classList.add('kb-home');
        if (lower.length > 1) {
          key.classList.add('kb-wide');
          key.textContent = lower;
        } else {
          key.innerHTML = upper && upper.toLowerCase() !== lower
            ? `<span class="kb-upper">${escapeHtml(upper)}</span><span class="kb-lower">${escapeHtml(lower)}</span>`
            : `<span class="kb-main">${escapeHtml(upper || lower)}</span>`;
        }
        keys.set(id, key);
      }
      rowEl.append(key);
    }
    el.append(rowEl);
  }
  container.append(el);

  let lit = [];
  function clear() {
    for (const k of lit) k.classList.remove('kb-next', 'kb-shift');
    lit = [];
  }
  return {
    el,
    /** Nächstes Zeichen hervorheben; gibt die keyInfo zurück. */
    highlight(char) {
      clear();
      const info = keyInfo(char);
      if (!info) return null;
      const key = keys.get(info.id);
      if (key) { key.classList.add('kb-next'); lit.push(key); }
      if (info.shift) {
        const s = keys.get(info.shift);
        s.classList.add('kb-shift');
        lit.push(s);
      }
      return info;
    },
    /** Mehrere Tasten hervorheben (Vorstellung neuer Tasten). */
    highlightMany(chars, withShift = false) {
      clear();
      for (const c of chars) {
        const info = keyInfo(c);
        const key = info && keys.get(info.id);
        if (key) { key.classList.add('kb-next'); lit.push(key); }
      }
      if (withShift) {
        for (const id of ['ShiftLeft', 'ShiftRight']) {
          keys.get(id).classList.add('kb-shift');
          lit.push(keys.get(id));
        }
      }
    },
    clear,
  };
}

// Handgrafik: zwei Hände, jeder Finger einzeln adressierbar. Die Bedeutung trägt
// zusätzlich der Text darunter (Farbe allein reicht nicht, z. B. bei Farbsehschwäche).
const HAND_FINGERS = {
  l: [['l5', 18, 52, 30], ['l4', 52, 30, 30], ['l3', 86, 20, 30], ['l2', 120, 30, 30], ['th', 160, 88, 30, -35]],
  r: [['th', 30, 88, 30, 35], ['r2', 80, 30, 30], ['r3', 114, 20, 30], ['r4', 148, 30, 30], ['r5', 182, 52, 30]],
};

export function renderHands(container) {
  const wrap = document.createElement('div');
  wrap.className = 'hands';
  const svgNs = 'http://www.w3.org/2000/svg';
  const parts = new Map();
  for (const side of ['l', 'r']) {
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 230 200');
    svg.setAttribute('class', `hand hand-${side}`);
    svg.setAttribute('aria-hidden', 'true');
    const palm = document.createElementNS(svgNs, 'rect');
    palm.setAttribute('x', side === 'l' ? '14' : '70');
    palm.setAttribute('y', '110');
    palm.setAttribute('width', '146');
    palm.setAttribute('height', '84');
    palm.setAttribute('rx', '34');
    palm.setAttribute('class', 'palm');
    svg.append(palm);
    for (const [finger, x, y, w, rot = 0] of HAND_FINGERS[side]) {
      const r = document.createElementNS(svgNs, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', String(w));
      r.setAttribute('height', String(finger === 'th' ? 64 : 150 - y));
      r.setAttribute('rx', '15');
      r.setAttribute('class', `finger f-${finger}`);
      if (rot) r.setAttribute('transform', `rotate(${rot} ${x + w / 2} ${y + 32})`);
      svg.append(r);
      if (!parts.has(finger)) parts.set(finger, []);
      parts.get(finger).push(r);
    }
    wrap.append(svg);
  }
  const label = document.createElement('p');
  label.className = 'finger-label';
  label.setAttribute('aria-live', 'polite');
  container.append(wrap, label);

  let lit = [];
  return {
    highlight(fingers, text = '') {
      for (const r of lit) r.classList.remove('finger-on');
      lit = [];
      for (const f of fingers) {
        for (const r of parts.get(f) ?? []) { r.classList.add('finger-on'); lit.push(r); }
      }
      label.textContent = text;
    },
  };
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
