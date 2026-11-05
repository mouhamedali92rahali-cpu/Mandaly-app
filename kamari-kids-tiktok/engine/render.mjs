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

// الصوت: engine/sound.mjs (مؤثرات + موسيقى خلفية أصلية اختيارية)
import { renderSfx, renderMusic, SR } from './sound.mjs';

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
fs.writeFileSync(sfxPath, renderSfx(V.sfx || [], V.duration));
// موسيقى خلفية: تُفعَّل من VIDEO.music، وتُلغى بـ --no-music
const musicPath = path.join(ROOT, 'out', `${slug}.music.wav`);
const useMusic = !!V.music && !args.includes('--no-music');
if (useMusic) fs.writeFileSync(musicPath, renderMusic(V.music, V.duration));
const vo = ['vo.wav', 'vo.m4a', 'vo.mp3'].map(f => path.join(videoDir, f)).find(f => fs.existsSync(f));

const ff = ['-y', '-hide_banner', '-loglevel', 'error'];
let idx = 0; const inputs = {};
if (base) { ff.push('-i', path.resolve(base)); inputs.base = idx++; }
ff.push('-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'); inputs.frames = idx++;
ff.push('-i', sfxPath); inputs.sfx = idx++;
if (useMusic) { ff.push('-i', musicPath); inputs.music = idx++; }
if (vo) { ff.push('-i', vo); inputs.vo = idx++; }

const fc = [];
if (base) fc.push(`[${inputs.base}:v]fps=${fps},scale=1080:1920,setsar=1[bv];[bv][${inputs.frames}:v]overlay=0:0:format=auto[v]`);
else fc.push(`[${inputs.frames}:v]format=yuv420p[v]`);
// مزج الصوت: المؤثرات تنخفض قليلًا عند وجود تعليق صوتي؛ صوت اللقطات الأصلي (إن وجد) يبقى خافتًا
const aParts = [`[${inputs.sfx}:a]volume=${vo ? 0.6 : 1}[s]`]; const aLabels = ['[s]'];
if (vo) {
  aParts.push(`[${inputs.vo}:a]aresample=${SR},aformat=channel_layouts=stereo,asplit=2[vo][voKey]`); aLabels.push('[vo]');
}
if (useMusic) {
  // الموسيقى تنخفض تلقائيًا كلما تكلّم المعلّق (ducking)
  if (vo) aParts.push(`[${inputs.music}:a][voKey]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[m]`);
  else aParts.push(`[${inputs.music}:a]anull[m]`);
  aLabels.push('[m]');
} else if (vo) aParts.push('[voKey]anullsink');
if (base && V.keepBaseAudio) { aParts.push(`[${inputs.base}:a]volume=${V.keepBaseAudio}[ba]`); aLabels.push('[ba]'); }
fc.push(aParts.join(';'));
// تطبيع الجهارة قرب مستوى المنصات الشائع (~-16 LUFS) حتى لا يكون الفيديو أخفت من غيره
const LOUD = 'loudnorm=I=-16:TP=-1.5:LRA=11';
fc.push(`${aLabels.join('')}amix=inputs=${aLabels.length}:duration=longest:normalize=0,${LOUD},aresample=${SR},apad[a]`);
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
// نسخة بديلة بلا موسيقى (نفس الصورة، مؤثرات فقط) للمقارنة
if (useMusic && !vo) {
  const alt = outFile.replace(/\.mp4$/, '-sfx-only.mp4');
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', outFile, '-i', sfxPath, '-map', '0:v', '-map', '1:a', '-af', LOUD + `,aresample=${SR}`,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(V.duration), '-movflags', '+faststart', alt]);
  console.log(`variant → ${path.relative(ROOT, alt)}`);
}
fs.unlinkSync(sfxPath);
if (useMusic) fs.unlinkSync(musicPath);
console.log(`\r${slug}: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${path.relative(ROOT, outFile)}${vo ? ' (with VO)' : ' (sfx only, no VO yet)'}`);
