// مكتبة صوت قمري كيدز — كل الأصوات مولّدة بالكود (أصلية، بلا حقوق خارجية).
//
// المبدأ: أصوات دافئة وخشبية وناعمة تناسب الطفل والولي معًا.
//   • لا أصوات حادة ولا صفارات ولا «فشل/خطأ» (لا buzzer)، ولا صراخ أو ضحك مسجَّل.
//   • كل النغمات من السلّم الخماسي (دو-ري-مي-صول-لا) فلا تتنافر أبدًا مع بعضها أو مع الموسيقى.
//   • توقيع صوتي ثابت للعلامة (ثلاث نغمات صاعدة) يتكرر في نهاية كل فيديو.
//   • المستوى منخفض تحت التعليق الصوتي؛ الفكرة مفهومة والصوت مكتوم.

export const SR = 44100;

// السلّم الخماسي (هرتز)
const N = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.0,
  C3: 130.81, F3: 174.61, G3: 196.0, A3: 220.0, F4: 349.23, B4: 493.88,
};
const PENTA = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'];

function makeBus(duration) {
  const n = Math.ceil(duration * SR) + SR * 2; // ذيل للصدى
  return { L: new Float32Array(n), R: new Float32Array(n), n };
}
let seed = 12345;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

// يضيف إشارة fn(tSec, i) إلى الحافلة مع توزيع يمين/يسار
function add(bus, t0, len, fn, pan = 0) {
  const s0 = Math.round(t0 * SR), L = Math.round(len * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < L; i++) {
    const k = s0 + i; if (k < 0 || k >= bus.n) continue;
    const v = fn(i / SR, i / L);
    bus.L[k] += v * gl * 1.414; bus.R[k] += v * gr * 1.414;
  }
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) * d));

// ---------- آلات ----------
const INST = {
  // ماريمبا: خشب دافئ — النقرات والتوقيع الصوتي
  marimba: (f) => (t) => env(t, .006, 7) * (Math.sin(2 * Math.PI * f * t) + .22 * Math.sin(2 * Math.PI * f * 3.99 * t) * Math.exp(-t * 18) + .04 * Math.sin(2 * Math.PI * f * 9.9 * t) * Math.exp(-t * 40)),
  // كاليمبا: نجاح ولحظات لطيفة
  kalimba: (f) => (t) => env(t, .004, 4.2) * (Math.sin(2 * Math.PI * f * t) + .5 * Math.sin(2 * Math.PI * f * 1.003 * t) + .12 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 12)) * .7,
  // جرس ناعم: نجوم ولمعان
  bell: (f) => (t) => env(t, .005, 3) * (Math.sin(2 * Math.PI * f * t) + .35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 5) + .15 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 9)),
};
function note(bus, t, name, inst = 'marimba', gain = .2, len = 1.4, pan = 0) {
  const f = typeof name === 'number' ? name : N[name];
  const v = INST[inst](f);
  add(bus, t, len, (tt) => gain * v(tt), pan);
}
// وتر منقور (Karplus-Strong) — يشبه الأوكوليلي، للموسيقى الخلفية
function pluck(bus, t, f, gain = .1, len = 1.6, pan = 0, bright = .5) {
  const p = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(p); { let lp = 0; for (let i = 0; i < p; i++) { lp += (rnd() - lp) * .35; buf[i] = lp * 2.2; } }
  let idx = 0, last = 0;
  const L = Math.round(len * SR), out = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    const cur = buf[idx];
    const nxt = .5 * (cur + buf[(idx + 1) % p]);
    buf[idx] = (bright * nxt + (1 - bright) * last) * .996; last = buf[idx];
    out[i] = cur; idx = (idx + 1) % p;
  }
  add(bus, t, len, (tt, q) => gain * out[Math.min(L - 1, Math.round(tt * SR))] * (1 - q * q), pan);
}
// ضجيج مرشّح (ورق، نفَس، انتقال)
function noise(bus, t, len, { gain = .2, lo = .02, hi = .1, shape = 'bell', pan = 0 } = {}) {
  // ثلاث مراحل تمرير منخفض متتالية (18 dB/أوكتاف) ثم حذف الترددات المنخفضة جدًا: هواء ناعم بلا «تشويش» حاد
  let a = 0, b2 = 0, c2 = 0, hp = 0;
  add(bus, t, len, (tt, q) => {
    const x = rnd();
    const k = lo + (hi - lo) * Math.sin(Math.PI * Math.min(1, q * 1.2)); // القطع يرتفع ثم ينزل
    a += (x - a) * k; b2 += (a - b2) * k; c2 += (b2 - c2) * k;
    hp += (c2 - hp) * .01; const y = (c2 - hp) * 3.5;
    const e = shape === 'bell' ? Math.sin(Math.PI * q) ** 1.5 : shape === 'in' ? q * q : Math.exp(-q * 6);
    return gain * y * e;
  }, pan);
}

// ---------- مؤثرات جاهزة (أسماء الإشارات المستعملة في VIDEO.sfx) ----------
const FX = {
  // نقرة خشبية صغيرة: ظهور كلمة/نص. pitch = رقم درجة في السلّم الخماسي
  tap: (b, c) => note(b, c.t, PENTA[(c.pitch ?? 2) % PENTA.length], 'marimba', .07 * (c.gain ?? 1), .5, c.pan ?? 0),
  blip: (b, c) => FX.tap(b, c),
  // تك-توك ساعة هادئ
  ticktock: (b, c) => { const n = c.count ?? 4; for (let i = 0; i < n; i++) add(b, c.t + i * .5, .06, (t) => (c.gain ?? 1) * .16 * Math.sin(2 * Math.PI * (i % 2 ? 1250 : 1650) * t) * Math.exp(-t * 90), i % 2 ? -.2 : .2); },
  // منبه لطيف: ترعيش جرس ناعم، ليس رنينًا حادًا
  ring: (b, c) => { const len = c.len ?? 1; for (let i = 0; i * .075 < len; i++) note(b, c.t + i * .075, i % 2 ? 'E6' : 'C6', 'bell', .05 * (c.gain ?? 1) * (1 - .5 * i * .075 / len), .4, i % 2 ? .25 : -.25); },
  // فقاعة كلام «قوم!» — بوب صغير صاعد
  bubble: (b, c) => add(b, c.t, .16, (t) => (c.gain ?? 1) * .22 * Math.sin(2 * Math.PI * (380 + 1900 * t) * t) * env(t, .004, 26), c.pan ?? 0),
  // رفع الكرت: «بووب» صاعد ناعم
  lift: (b, c) => add(b, c.t, .2, (t) => (c.gain ?? 1) * .16 * Math.sin(2 * Math.PI * (300 + 900 * t) * t) * env(t, .01, 14), c.pan ?? 0),
  // انزلاق الكرت على اللوحة: ورق ناعم
  slide: (b, c) => noise(b, c.t, c.len ?? .5, { gain: .16 * (c.gain ?? 1), lo: .06, hi: .16, pan: c.pan ?? 0 }),
  // استقرار الكرت في مكانه: نقرة خشبية مكتومة
  pop: (b, c) => { add(b, c.t, .12, (t) => (c.gain ?? 1) * .3 * Math.sin(2 * Math.PI * (260 - 500 * t) * t) * env(t, .002, 40)); noise(b, c.t, .05, { gain: .08 * (c.gain ?? 1), lo: .12, hi: .12, shape: 'dec' }); },
  // نجاح: نغمتان صاعدتان على الكاليمبا (علامة الصح)
  success: (b, c) => { const base = c.pitch ?? 0; note(b, c.t, PENTA[2 + base], 'kalimba', .15 * (c.gain ?? 1), 1.4, -.15); note(b, c.t + .11, PENTA[5 + base], 'kalimba', .15 * (c.gain ?? 1), 1.6, .15); },
  chime: (b, c) => FX.success(b, c),
  // لمعان النجوم
  sparkle: (b, c) => { const notes = ['G6', 'E6', 'A6', 'C6']; notes.forEach((n, i) => note(b, c.t + i * .07, n, 'bell', .035 * (c.gain ?? 1), .8, (i % 2 ? .5 : -.5))); },
  // انتقال: نفَس هوائي ناعم
  swish: (b, c) => noise(b, c.t, c.len ?? .5, { gain: .3 * (c.gain ?? 1), lo: .015, hi: .07 }),
  // من الليل للنهار: هواء + جليساندو صاعد (هارب صغير)
  sunrise: (b, c) => { FX.swish(b, { t: c.t, len: .7, gain: (c.gain ?? 1) * .8 }); ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'].forEach((n, i) => pluck(b, c.t + .1 + i * .055, N[n], .07 * (c.gain ?? 1), 1.4, -.6 + i * .17, .7)); },
  // التوقيع الصوتي لقمري كيدز: صول-دو-مي صاعدة + لمعة
  logo: (b, c) => { const g = c.gain ?? 1; note(b, c.t, 'G5', 'marimba', .2 * g, 1.2, -.2); note(b, c.t + .15, 'C6', 'marimba', .2 * g, 1.2, 0); note(b, c.t + .3, 'E6', 'marimba', .22 * g, 1.8, .2); note(b, c.t + .3, 'C5', 'kalimba', .1 * g, 1.8); FX.sparkle(b, { t: c.t + .45, gain: .7 * g }); },
};

// صدى غرفة صغير (Freeverb مبسّط) — يعطي دفئًا بدل الصوت «الجاف»
function reverb(bus, wet = .16) {
  const combsL = [1116, 1188, 1277, 1356], combsR = combsL.map(d => d + 23), aps = [556, 441];
  const run = (x, combs) => {
    const out = new Float32Array(x.length);
    for (const d of combs) {
      const buf = new Float32Array(d); let i = 0, store = 0;
      for (let k = 0; k < x.length; k++) {
        const y = buf[i]; store = y * .7 + store * .3;
        buf[i] = x[k] * .015 + store * .8; out[k] += y; i = (i + 1) % d;
      }
    }
    for (const d of aps) {
      const buf = new Float32Array(d); let i = 0;
      for (let k = 0; k < x.length; k++) { const b = buf[i]; const y = -out[k] + b; buf[i] = out[k] + b * .5; out[k] = y; i = (i + 1) % d; }
    }
    return out;
  };
  const wl = run(bus.L, combsL), wr = run(bus.R, combsR);
  for (let k = 0; k < bus.n; k++) { bus.L[k] += wl[k] * wet * 4; bus.R[k] += wr[k] * wet * 4; }
}

// ---------- موسيقى خلفية أصلية (اختيارية) ----------
// أوكوليلي منقور خفيف، 88 نبضة/دقيقة، دو - صول - لا صغير - فا. تدخل وتخرج بتلاشٍ.
function music(bus, { start = 0, end, gain = 1 } = {}) {
  const beat = 60 / 88, bar = beat * 4;
  const chords = [['C4', 'E4', 'G4', 'C5'], ['G3', 'D4', 'G4', 'B4'], ['A3', 'E4', 'A4', 'C5'], ['F3', 'C4', 'F4', 'A4']];
  const bass = ['C3', 'G3', 'A3', 'F3'];
  const pattern = [0, 2, 1, 3, 2, 1, 3, 2]; // أربعة أثمان لكل نصف مقياس
  for (let t = start, b = 0; t < end; t += bar, b++) {
    const ch = chords[b % 4];
    for (let e = 0; e < 8; e++) {
      const tt = t + e * beat / 2; if (tt >= end) break;
      const fade = Math.min(1, (tt - start) / 1.2, (end - tt) / 1.5);
      if (fade <= 0) continue;
      pluck(bus, tt, N[ch[pattern[e]]], .075 * gain * fade * (e % 2 ? .75 : 1), 1.4, e % 2 ? .35 : -.35, .45);
    }
    const fadeB = Math.min(1, (t - start) / 1.2, (end - t) / 1.5);
    if (fadeB > 0) add(bus, t, bar, (tt) => .06 * gain * fadeB * Math.sin(2 * Math.PI * N[bass[b % 4]] * tt) * env(tt, .02, 1.6));
  }
}

function toWav(bus, seconds) {
  const n = Math.round(seconds * SR);
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    pcm.writeInt16LE(Math.round(Math.tanh(bus.L[i] * 1.1) * 32767 * .9), i * 4);
    pcm.writeInt16LE(Math.round(Math.tanh(bus.R[i] * 1.1) * 32767 * .9), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export function renderSfx(cues, duration) {
  seed = 12345;
  const bus = makeBus(duration);
  for (const c of cues) { const fx = FX[c.type]; if (fx) fx(bus, c); else console.warn('unknown sfx', c.type); }
  reverb(bus, .16);
  return toWav(bus, duration);
}
export function renderMusic(spec, duration) {
  seed = 777;
  const bus = makeBus(duration);
  music(bus, { start: spec.start ?? 0, end: spec.end ?? duration, gain: spec.gain ?? 1 });
  // تمرير منخفض لطيف (~4 كيلوهرتز) حتى تبقى الموسيقى دافئة خلف الكلام وبلا لمعان حاد
  for (const ch of [bus.L, bus.R]) { let a = 0, b = 0; for (let k = 0; k < bus.n; k++) { a += (ch[k] - a) * .45; b += (a - b) * .45; ch[k] = b; } }
  reverb(bus, .12);
  return toWav(bus, duration);
}
export const SFX_TYPES = Object.keys(FX);
