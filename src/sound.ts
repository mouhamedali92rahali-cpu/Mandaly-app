const STORAGE_KEY = 'mandaly-muted';

let ctx: AudioContext | null = null;
let muted = getSavedMuted();

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

function createNoiseBuffer(audio: AudioContext, durationSec: number): AudioBuffer {
  const length = Math.max(1, Math.floor(audio.sampleRate * durationSec));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Card riffle for a flip/draw. A real riffle isn't one smooth noise swell —
 * it's a fast stutter of separate little edge-clicks as the cards flick past
 * each other. This fires a handful of very short high-passed noise clicks in
 * quick, slightly irregular succession (irregular timing/amplitude so it
 * doesn't sound like a mechanical repeating beep).
 */
export function playFlip(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;

  const clicks = 5;
  for (let i = 0; i < clicks; i++) {
    const at = now + i * 0.013 + Math.random() * 0.006;
    const noise = audio.createBufferSource();
    noise.buffer = createNoiseBuffer(audio, 0.02);
    const highpass = audio.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 2200 + Math.random() * 1800;
    const gain = audio.createGain();
    const peak = 0.08 + Math.random() * 0.05;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
    noise.connect(highpass).connect(gain).connect(audio.destination);
    noise.start(at);
    noise.stop(at + 0.025);
  }
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
