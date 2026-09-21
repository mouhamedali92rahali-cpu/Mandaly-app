import cardFlipUrl from './assets/card-flip.mp3';

const STORAGE_KEY = 'mandaly-muted';

let ctx: AudioContext | null = null;
let muted = getSavedMuted();
let flipBuffer: AudioBuffer | null = null;
let flipBufferPromise: Promise<AudioBuffer> | null = null;

function getSavedMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function getContext(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // Web Audio unsupported — sounds are a nice-to-have, not a requirement.
  }
}

interface Tone {
  freq: number;
  start: number; // seconds from now
  duration: number; // seconds
  peak?: number; // gain, 0-1
  type?: OscillatorType;
}

function playTones(tones: Tone[]): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  for (const t of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.value = t.freq;
    const at = now + t.start;
    const peak = t.peak ?? 0.16;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + t.duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + t.duration + 0.02);
  }
}

function loadFlipBuffer(audio: AudioContext): Promise<AudioBuffer> {
  if (flipBuffer) return Promise.resolve(flipBuffer);
  flipBufferPromise ??= fetch(cardFlipUrl)
    .then((res) => res.arrayBuffer())
    .then((data) => audio.decodeAudioData(data))
    .then((decoded) => {
      flipBuffer = decoded;
      return decoded;
    });
  return flipBufferPromise;
}

/** Card flip/draw: a real recorded card-dealing snap, trimmed to one card. */
export function playFlip(): void {
  const audio = getContext();
  if (!audio) return;
  loadFlipBuffer(audio)
    .then((buffer) => {
      if (muted) return; // mute may have been toggled while decoding
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.start();
    })
    .catch(() => {
      // decode failure — sound is a nice-to-have, fail silently.
    });
}

/**
 * Celebratory fanfare for the "family heart" button: a warm two-note pad
 * underneath, an ascending arpeggio building energy, landing on a bright
 * triumphant chord, then a few high triangle-wave sparkle notes on top —
 * like a little burst of confetti.
 */
export function playHeart(): void {
  playTones([
    // warm low pad underneath, for a fuller/rounder "togetherness" feel
    { freq: 392.0, start: 0, duration: 0.7, peak: 0.07, type: 'sine' }, // G4
    { freq: 261.63, start: 0, duration: 0.7, peak: 0.05, type: 'sine' }, // C4

    // ascending arpeggio building energy
    { freq: 523.25, start: 0, duration: 0.14, peak: 0.13 }, // C5
    { freq: 659.25, start: 0.06, duration: 0.14, peak: 0.13 }, // E5
    { freq: 783.99, start: 0.12, duration: 0.16, peak: 0.14 }, // G5
    { freq: 1046.5, start: 0.18, duration: 0.18, peak: 0.15 }, // C6

    // bright triumphant chord landing
    { freq: 1046.5, start: 0.28, duration: 0.42, peak: 0.17 }, // C6
    { freq: 1318.51, start: 0.28, duration: 0.42, peak: 0.14 }, // E6
    { freq: 1567.98, start: 0.28, duration: 0.42, peak: 0.13 }, // G6

    // confetti sparkle on top
    { freq: 2093.0, start: 0.34, duration: 0.12, peak: 0.08, type: 'triangle' }, // C7
    { freq: 1760.0, start: 0.42, duration: 0.12, peak: 0.07, type: 'triangle' }, // A6
    { freq: 2349.32, start: 0.5, duration: 0.14, peak: 0.07, type: 'triangle' }, // D7
  ]);
}

/** Gentle two-tone chime when a card's timer runs out. */
export function playTimerEnd(): void {
  playTones([
    { freq: 880, start: 0, duration: 0.16, peak: 0.14 },
    { freq: 659.25, start: 0.17, duration: 0.22, peak: 0.14 },
  ]);
}

/** Soft, unobtrusive tick for each second of a card's countdown timer. */
export function playTick(): void {
  playTones([{ freq: 880, start: 0, duration: 0.055, peak: 0.05 }]);
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // no persistence available — the choice still applies for this visit.
  }
}
