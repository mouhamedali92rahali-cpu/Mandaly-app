import cardFlipUrl from './assets/card-flip.mp3';
// "Intimate Piano" by The_Mountain — Pixabay Music (pixabay.com/music,
// track id 252951), under the Pixabay Content License: free for
// commercial use, no attribution required. Denoised (ffmpeg afftdn) to cut
// the recording's own background hiss, audible in quiet rooms once looped
// continuously, then trimmed with a 1.5s fade-in / 2.5s fade-out so the loop
// restart has no audible click.
import bgMusicUrl from './assets/bg-music.mp3';

const SFX_MUTED_KEY = 'mandaly-muted';
const MUSIC_ENABLED_KEY = 'mandaly-music-enabled';

let ctx: AudioContext | null = null;
// Short effects (flip, heart, timer) and the continuous background music are
// muted independently — each caller below checks only the flag it cares
// about, so turning one off never touches the other.
let sfxMuted = getSavedFlag(SFX_MUTED_KEY, false);
// Off by default: music only starts if the player explicitly turns it on.
let musicEnabled = getSavedFlag(MUSIC_ENABLED_KEY, false);

let flipBuffer: AudioBuffer | null = null;
let flipBufferPromise: Promise<AudioBuffer> | null = null;

function getSavedFlag(key: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved === '1') return true;
    if (saved === '0') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function setSavedFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // no persistence available — the choice still applies for this visit.
  }
}

// Creating/resuming the context is silent by itself — nothing plays without
// an explicit gain node — so this is shared by both SFX and music instead of
// being gated by either one's mute flag.
function getContext(): AudioContext | null {
  try {
    // 'playback' asks the browser for a larger internal audio buffer than
    // the ('interactive') default, which is tuned for the lowest possible
    // latency at the cost of being more prone to underrun glitches (an
    // audible crackle/click) the moment the main thread is briefly busy —
    // easy to hit here since a continuous looping music bed keeps the audio
    // thread running the whole session, unlike the short one-off SFX this
    // was originally tuned for. This app has no reason to need low-latency
    // response (no rhythm-game-style timing), so the tradeoff costs nothing.
    ctx ??= new AudioContext({ latencyHint: 'playback' });
    // Never auto-resume while the tab/app is backgrounded — otherwise a
    // background timer tick could silently undo the pause below for the
    // rest of the time it stays hidden.
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    return ctx;
  } catch {
    return null; // Web Audio unsupported — sounds are a nice-to-have, not a requirement.
  }
}

// Suspending the whole context (rather than just stopping the music source)
// freezes every scheduled node — including an in-flight SFX envelope — and
// resume() picks up exactly where it left off, so nothing needs to track
// playback position by hand. Without this, looping background music kept
// playing (audibly, on some devices) after leaving the app or locking the
// screen, since neither backgrounding a tab nor a PWA going to the
// background stops Web Audio on its own.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}

interface Tone {
  freq: number;
  start: number; // seconds from now
  duration: number; // seconds
  peak?: number; // gain, 0-1
  type?: OscillatorType;
}

// The heart button's sound is exempt from the SFX mute — it marks a rare,
// deliberately-chosen family moment rather than routine feedback like a card
// flip or a timer tick, so playHeart() calls this directly and skips the
// mute check that playTones() applies for everything else.
function playTonesUnconditionally(tones: Tone[]): void {
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

function playTones(tones: Tone[]): void {
  if (sfxMuted) return;
  playTonesUnconditionally(tones);
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
  if (sfxMuted) return;
  const audio = getContext();
  if (!audio) return;
  loadFlipBuffer(audio)
    .then((buffer) => {
      if (sfxMuted) return; // mute may have been toggled while decoding
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
 * Celebratory fanfare shared by the "family heart" button and by awarding a
 * player a point: a warm two-note pad underneath, an ascending arpeggio
 * building energy, landing on a bright triumphant chord, then a few high
 * triangle-wave sparkle notes on top — like a little burst of confetti.
 */
const HEART_TONES: Tone[] = [
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
];

/** Awarding a player a point — respects the SFX mute like any other effect. */
export function playHeart(): void {
  playTones(HEART_TONES);
}

/**
 * The "قلب لهذه اللحظة" button specifically — always plays, even with SFX
 * muted, since it marks a deliberately-chosen family moment rather than
 * routine feedback. Awarding a player a point (playHeart above) is a
 * distinct, ordinary action and stays muteable like everything else.
 */
export function playFamilyHeart(): void {
  playTonesUnconditionally(HEART_TONES);
}

/**
 * Farewell fanfare for the end-of-session standings page: a longer arc than
 * playHeart's — pad, a five-note rise, a bright held chord, sparkles, then a
 * warm resolving chord that settles back down, for a "that's a wrap, well
 * done" feeling rather than playHeart's quick mid-game hype burst.
 */
export function playFarewellFanfare(): void {
  playTones([
    // warm low pad underneath the rise
    { freq: 196.0, start: 0, duration: 0.9, peak: 0.06, type: 'sine' }, // G3
    { freq: 261.63, start: 0, duration: 0.9, peak: 0.045, type: 'sine' }, // C4

    // five-note rising arpeggio
    { freq: 523.25, start: 0, duration: 0.14, peak: 0.12 }, // C5
    { freq: 659.25, start: 0.08, duration: 0.14, peak: 0.12 }, // E5
    { freq: 783.99, start: 0.16, duration: 0.16, peak: 0.13 }, // G5
    { freq: 1046.5, start: 0.24, duration: 0.16, peak: 0.14 }, // C6
    { freq: 1318.51, start: 0.32, duration: 0.18, peak: 0.15 }, // E6

    // bright held landing chord
    { freq: 1046.5, start: 0.42, duration: 0.55, peak: 0.16 }, // C6
    { freq: 1318.51, start: 0.42, duration: 0.55, peak: 0.13 }, // E6
    { freq: 1567.98, start: 0.42, duration: 0.55, peak: 0.12 }, // G6

    // sparkle on top
    { freq: 2093.0, start: 0.48, duration: 0.14, peak: 0.07, type: 'triangle' }, // C7
    { freq: 2349.32, start: 0.58, duration: 0.14, peak: 0.06, type: 'triangle' }, // D7
    { freq: 1975.53, start: 0.7, duration: 0.16, peak: 0.06, type: 'triangle' }, // B6

    // warm resolving chord, settling the piece down to a close
    { freq: 349.23, start: 1.0, duration: 0.9, peak: 0.1 }, // F4
    { freq: 440.0, start: 1.0, duration: 0.9, peak: 0.08 }, // A4
    { freq: 523.25, start: 1.0, duration: 0.9, peak: 0.07 }, // C5
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
  return sfxMuted;
}

export function setMuted(next: boolean): void {
  sfxMuted = next;
  setSavedFlag(SFX_MUTED_KEY, sfxMuted);
}

// Quiet enough to stay a background bed rather than compete with reading a
// card out loud, but still clearly audible — not a "did I imagine that"
// level. Faded in/out rather than switched, so turning it on/off never pops.
const MUSIC_VOLUME = 0.08;
const MUSIC_FADE_SECONDS = 1.4;

let musicBuffer: AudioBuffer | null = null;
let musicBufferPromise: Promise<AudioBuffer> | null = null;
let musicSource: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;

function loadMusicBuffer(audio: AudioContext): Promise<AudioBuffer> {
  if (musicBuffer) return Promise.resolve(musicBuffer);
  musicBufferPromise ??= fetch(bgMusicUrl)
    .then((res) => res.arrayBuffer())
    .then((data) => audio.decodeAudioData(data))
    .then((decoded) => {
      musicBuffer = decoded;
      return decoded;
    });
  return musicBufferPromise;
}

// AudioBufferSourceNode.loop (rather than <audio loop>) restarts the buffer
// at a sample-accurate boundary, so a track trimmed to a clean loop point
// has no audible gap or click at the seam.
function startMusicPlayback(audio: AudioContext, buffer: AudioBuffer): void {
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = audio.createGain();
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + MUSIC_FADE_SECONDS);
  source.connect(gain).connect(audio.destination);
  source.start();
  musicSource = source;
  musicGain = gain;
}

function stopMusicPlayback(): void {
  if (!musicSource || !musicGain || !ctx) return;
  const source = musicSource;
  const gain = musicGain;
  const audio = ctx;
  musicSource = null;
  musicGain = null;
  const now = audio.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE_SECONDS);
  source.stop(now + MUSIC_FADE_SECONDS + 0.1);
}

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

export function setMusicEnabled(next: boolean): void {
  musicEnabled = next;
  setSavedFlag(MUSIC_ENABLED_KEY, musicEnabled);

  if (!musicEnabled) {
    stopMusicPlayback();
    return;
  }

  const audio = getContext();
  if (!audio) return;
  loadMusicBuffer(audio)
    .then((buffer) => {
      if (!musicEnabled || musicSource) return; // toggled off, or already playing
      startMusicPlayback(audio, buffer);
    })
    .catch(() => {
      // decode failure — music is a nice-to-have, fail silently.
    });
}

/**
 * Called once, from inside a guaranteed user gesture (entering the app past
 * the welcome screen), to resume music that was left on from a previous
 * visit. A fresh page load can't start audio on its own — browsers require
 * a gesture on *this* load first, regardless of what was saved before.
 */
export function resumeMusicIfEnabled(): void {
  if (musicEnabled) setMusicEnabled(true);
}
