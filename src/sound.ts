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
 * Card flip/draw: a single flick-through-the-air whoosh that settles into a
 * soft landing tap, like a card being snapped down onto the table. The
 * whoosh is noise pushed through a bandpass filter whose center frequency
 * sweeps rapidly downward (the pitch-drop reads as motion), followed by a
 * short low-passed thud right as it lands.
 */
export function playFlip(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;

  const whooshDur = 0.11;
  const whoosh = audio.createBufferSource();
  whoosh.buffer = createNoiseBuffer(audio, whooshDur);
  const bandpass = audio.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.Q.value = 1.2;
  bandpass.frequency.setValueAtTime(4200, now);
  bandpass.frequency.exponentialRampToValueAtTime(700, now + whooshDur);
  const whooshGain = audio.createGain();
  whooshGain.gain.setValueAtTime(0, now);
  whooshGain.gain.linearRampToValueAtTime(0.14, now + 0.02);
  whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + whooshDur);
  whoosh.connect(bandpass).connect(whooshGain).connect(audio.destination);
  whoosh.start(now);
  whoosh.stop(now + whooshDur + 0.02);

  const tapAt = now + whooshDur - 0.01;
  const tap = audio.createBufferSource();
  tap.buffer = createNoiseBuffer(audio, 0.03);
  const lowpass = audio.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 500;
  const tapGain = audio.createGain();
  tapGain.gain.setValueAtTime(0, tapAt);
  tapGain.gain.linearRampToValueAtTime(0.18, tapAt + 0.004);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, tapAt + 0.05);
  tap.connect(lowpass).connect(tapGain).connect(audio.destination);
  tap.start(tapAt);
  tap.stop(tapAt + 0.06);
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
