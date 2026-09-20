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

/** Bright, festive little fanfare for the "family heart" button. */
export function playHeart(): void {
  playTones([
    // warm low pad underneath, for a fuller/rounder "togetherness" feel
    { freq: 392.0, start: 0, duration: 0.6, peak: 0.06, type: 'sine' }, // G4
    // ascending sparkle on top
    { freq: 523.25, start: 0, duration: 0.16, peak: 0.13 }, // C5
    { freq: 659.25, start: 0.07, duration: 0.16, peak: 0.13 }, // E5
    { freq: 783.99, start: 0.14, duration: 0.18, peak: 0.14 }, // G5
    { freq: 1046.5, start: 0.22, duration: 0.36, peak: 0.17 }, // C6 — bright finish
  ]);
}

/** Gentle two-tone chime when a card's timer runs out. */
export function playTimerEnd(): void {
  playTones([
    { freq: 880, start: 0, duration: 0.16, peak: 0.14 },
    { freq: 659.25, start: 0.17, duration: 0.22, peak: 0.14 },
  ]);
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
