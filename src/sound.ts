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
 * Papery card "flick" for a flip/draw — a brief burst of band-passed noise
 * (the riffle/friction texture a real card makes) with a tiny low click
 * layered under its start for the edge's snap. A pure tone can't produce
 * that texture, so this bypasses playTones and shapes noise directly.
 */
export function playFlip(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;

  const noise = audio.createBufferSource();
  noise.buffer = createNoiseBuffer(audio, 0.13);
  const bandpass = audio.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 3200;
  bandpass.Q.value = 0.6;
  const noiseGain = audio.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.24, now + 0.008);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  noise.connect(bandpass).connect(noiseGain).connect(audio.destination);
  noise.start(now);
  noise.stop(now + 0.14);

  const click = audio.createOscillator();
  const clickGain = audio.createGain();
  click.type = 'triangle';
  click.frequency.value = 190;
  clickGain.gain.setValueAtTime(0, now);
  clickGain.gain.linearRampToValueAtTime(0.09, now + 0.004);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
  click.connect(clickGain).connect(audio.destination);
  click.start(now);
  click.stop(now + 0.04);
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
