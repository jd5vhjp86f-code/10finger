// Töne (Web Audio, im Browser erzeugt) und Vorlesen (nur lokale Stimmen, nichts geht ins Netz).

let audioCtx = null;

const TONES = {
  error: [[220, 90]],
  ok: [[660, 70]],
  star: [[660, 90], [880, 120]],
  fanfare: [[523, 120], [659, 120], [784, 120], [1047, 260]],
  lost: [[330, 140], [262, 220]],
};

export function beep(kind = 'error') {
  try {
    audioCtx ??= new AudioContext();
    let t = audioCtx.currentTime;
    for (const [freq, ms] of TONES[kind] ?? TONES.error) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = kind === 'error' ? 'square' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(kind === 'error' ? 0.04 : 0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + ms / 1000);
      t += ms / 1000;
    }
  } catch { /* ohne Ton weiter */ }
}

function germanLocalVoice() {
  const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((v) => v.localService && v.lang?.toLowerCase().startsWith('de')) ?? null;
}

/** Ob Vorlesen mit einer lokalen deutschen Stimme möglich ist. */
export function canSpeak() {
  return Boolean(germanLocalVoice());
}

export function speak(text) {
  try {
    const voice = germanLocalVoice();
    if (!voice) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

// Stimmen laden in manchen Browsern verzögert
globalThis.speechSynthesis?.getVoices?.();
