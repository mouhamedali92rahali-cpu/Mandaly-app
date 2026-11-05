// محرك تصدير قمري كيدز: صفحة HTML حتمية → إطارات عبر Chromium (Playwright) → FFmpeg (H.264 + AAC)
//
// الاستعمال:
//   node engine/render.mjs videos/01-sabah-routine            # الفيديو الكامل → out/01-sabah-routine.mp4
//   node engine/render.mjs videos/01-sabah-routine --stills   # صور مراجعة فقط (غلاف + إطارات مفتاحية + دليل المناطق الآمنة)
//   node engine/render.mjs videos/03-tri9-sayyara --base footage.mp4 --out out/x.mp4
//        (وضع التراكب: الصفحة تُرسم بخلفية شفافة فوق لقطات حقيقية)
//
// الصوت: المؤثرات تُولَّد برمجيًا من قائمة VIDEO.sfx (لا ملفات خارجية ولا موسيقى بحقوق).
// إذا وُجد ملف vo.wav (أو vo.m4a / vo.mp3) داخل مجلد الفيديو، يُمزج تلقائيًا كتعليق صوتي.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright: محلي في المشروع إن وُجد، وإلا النسخة المثبتة مسبقًا في البيئة
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const videoDir = path.resolve(args[0] || '');
if (!args[0] || !fs.existsSync(path.join(videoDir, 'index.html'))) {
  console.error('usage: node engine/render.mjs <video-dir> [--stills] [--base clip.mp4] [--out file.mp4] [--query k=v&..]');
  process.exit(1);
}
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const stillsOnly = args.includes('--stills');
const base = opt('--base');
const slug = path.basename(videoDir);
const outFile = path.resolve(opt('--out') || path.join(ROOT, 'out', `${slug}.mp4`));
const extraQuery = opt('--query') || '';
fs.mkdirSync(path.dirname(outFile), { recursive: true });

function run(cmd, argv, { input } = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('error', rej);
    p.on('close', c => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
    if (input) input(p.stdin);
  });
}

// ---------- مؤثرات صوتية مولّدة ----------
const SR = 44100;
function synthSfx(cues, duration) {
  const n = Math.ceil(duration * SR);
  const buf = new Float32Array(n);
  const add = (t0, len, fn) => {
    const s0 = Math.floor(t0 * SR), L = Math.floor(len * SR);
    for (let i = 0; i < L && s0 + i < n; i++) if (s0 + i >= 0) buf[s0 + i] += fn(i / SR, i / L);
  };
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const c of cues) {
    const g = c.gain ?? 1;
    switch (c.type) {
      case 'pop': // نقرة ناعمة عند استقرار بطاقة
        add(c.t, .14, (t, p) => g * .45 * Math.sin(2 * Math.PI * (520 - 900 * t) * t) * Math.exp(-t * 38));
        break;
      case 'blip': // ظهور نص
        add(c.t, .09, (t) => g * .16 * Math.sin(2 * Math.PI * 990 * t) * Math.exp(-t * 55));
        break;
      case 'ring': { // منبه مكتوم (ليس مزعجًا)
        const len = c.len ?? .9;
        add(c.t, len, (t, p) => {
          const f = (Math.floor(t * 16) % 2) ? 1320 : 1180;
          const gate = (Math.floor(t * 8) % 2) ? .25 : 1;
          return g * .09 * gate * Math.sin(2 * Math.PI * f * t) * (1 - p);
        });
        break;
      }
      case 'swish': { // حركة ستارة/انتقال: ضجيج مفلتر
        let lp = 0; const len = c.len ?? .45;
        add(c.t, len, (t, p) => { lp += (rnd() - lp) * (.05 + .25 * Math.sin(Math.PI * p)); return g * .5 * lp * Math.sin(Math.PI * p); });
        break;
      }
      case 'chime': // تهنئة هادئة
        add(c.t, 1.6, (t) => g * .12 * Math.exp(-t * 2.6) *
          (Math.sin(2 * Math.PI * 784 * t) + .6 * Math.sin(2 * Math.PI * 1175 * t) + .35 * Math.sin(2 * Math.PI * 1568 * t)));
        break;
      case 'sparkle':
        for (let k = 0; k < 4; k++) add(c.t + k * .07, .25, (t) => g * .07 * Math.sin(2 * Math.PI * (1800 + k * 260) * t) * Math.exp(-t * 16));
        break;
    }
  }
  // مضغوط بسيط لتفادي التشبع
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(Math.tanh(buf[i] * 1.2) * 32767 * .8), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// ---------- التصيير ----------
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
async function open(query) {
  const url = 'file://' + path.join(videoDir, 'index.html') + '?' + [query, extraQuery].filter(Boolean).join('&');
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.VIDEO && typeof window.renderFrame === 'function');
  return page.evaluate(() => ({ ...window.VIDEO, hasCover: typeof window.renderCover === 'function' }));
}
const shot = (o = {}) => page.screenshot({ type: 'png', omitBackground: !!o.transparent });

const stillsDir = path.join(ROOT, 'out', `${slug}-stills`);
let V = await open(base ? 'transparent=1' : '');
const fps = V.fps || 30;
const total = Math.round(V.duration * fps);

// صور المراجعة: الغلاف + الإطارات المفتاحية + دليل المناطق الآمنة
fs.mkdirSync(stillsDir, { recursive: true });
if (V.hasCover && !base) {
  await page.evaluate(() => window.renderCover());
  fs.writeFileSync(path.join(stillsDir, 'cover.png'), await shot());
  await open(''); // الغلاف قد يعدّل الصفحة؛ نعيد التحميل قبل الإطارات المفتاحية
}
for (const t of V.keyframes || []) {
  await page.evaluate(t => window.renderFrame(t), t);
  fs.writeFileSync(path.join(stillsDir, `t${String(t.toFixed(1)).padStart(4, '0')}.png`), await shot({ transparent: !!base }));
}
await open((base ? 'transparent=1&' : '') + 'guides=1');
for (const t of V.guideTimes || []) {
  await page.evaluate(t => window.renderFrame(t), t);
  fs.writeFileSync(path.join(stillsDir, `guides-t${t}.png`), await shot({ transparent: !!base }));
}
console.log(`stills → ${path.relative(ROOT, stillsDir)}`);

if (stillsOnly) { await browser.close(); process.exit(0); }

V = await open(base ? 'transparent=1' : '');
const sfxPath = path.join(ROOT, 'out', `${slug}.sfx.wav`);
fs.writeFileSync(sfxPath, synthSfx(V.sfx || [], V.duration));
const vo = ['vo.wav', 'vo.m4a', 'vo.mp3'].map(f => path.join(videoDir, f)).find(f => fs.existsSync(f));

const ff = ['-y', '-hide_banner', '-loglevel', 'error'];
let idx = 0; const inputs = {};
if (base) { ff.push('-i', path.resolve(base)); inputs.base = idx++; }
ff.push('-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'); inputs.frames = idx++;
ff.push('-i', sfxPath); inputs.sfx = idx++;
if (vo) { ff.push('-i', vo); inputs.vo = idx++; }

const fc = [];
if (base) fc.push(`[${inputs.base}:v]fps=${fps},scale=1080:1920,setsar=1[bv];[bv][${inputs.frames}:v]overlay=0:0:format=auto[v]`);
else fc.push(`[${inputs.frames}:v]format=yuv420p[v]`);
// مزج الصوت: المؤثرات تنخفض قليلًا عند وجود تعليق صوتي؛ صوت اللقطات الأصلي (إن وجد) يبقى خافتًا
const aParts = [`[${inputs.sfx}:a]volume=${vo ? 0.6 : 1}[s]`]; const aLabels = ['[s]'];
if (vo) { aParts.push(`[${inputs.vo}:a]aresample=${SR},volume=1.0[vo]`); aLabels.push('[vo]'); }
if (base && V.keepBaseAudio) { aParts.push(`[${inputs.base}:a]volume=${V.keepBaseAudio}[ba]`); aLabels.push('[ba]'); }
fc.push(aParts.join(';'));
fc.push(`${aLabels.join('')}amix=inputs=${aLabels.length}:duration=longest:normalize=0,apad[a]`);
ff.push('-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[a]',
  '-t', String(V.duration), '-r', String(fps),
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '160k', '-ar', String(SR), '-movflags', '+faststart', outFile);

const t0 = Date.now();
await run('ffmpeg', ff, {
  input: async (stdin) => {
    for (let f = 0; f < total; f++) {
      await page.evaluate(t => window.renderFrame(t), f / fps);
      const png = await shot({ transparent: !!base });
      if (!stdin.write(png)) await new Promise(r => stdin.once('drain', r));
      if (f % 60 === 0) process.stdout.write(`\r${slug}: frame ${f}/${total}`);
    }
    stdin.end();
  },
});
await browser.close();
fs.unlinkSync(sfxPath);
console.log(`\r${slug}: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${path.relative(ROOT, outFile)}${vo ? ' (with VO)' : ' (sfx only, no VO yet)'}`);
