import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bgSvg = readFileSync(join(__dirname, 'icon-bg.svg'));
const logoPath = join(root, 'src/assets/logo-mark.png');

const CANVAS = 512;
const logoMeta = await sharp(logoPath).metadata();
const ratio = logoMeta.width / logoMeta.height;

async function buildMaster(logoHeight) {
  const logoWidth = Math.round(logoHeight * ratio);
  const logoBuffer = await sharp(logoPath).resize(logoWidth, logoHeight).toBuffer();
  return sharp(bgSvg, { density: 384 })
    .resize(CANVAS, CANVAS)
    .composite([{ input: logoBuffer, gravity: 'centre' }])
    .png()
    .toBuffer();
}

// Regular icons (and the splash screen Android/iOS auto-generate from them) are
// never shape-masked, so the mark can run large and fill most of the frame.
const masterAny = await buildMaster(420);
// Maskable icons *are* shape-masked (circle, squircle, ...); OS UI can crop
// anything outside the centered ~80% "safe zone", so this stays conservative.
const masterMaskable = await buildMaster(300);

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, master: masterAny },
  { file: 'public/icons/icon-512.png', size: 512, master: masterAny },
  { file: 'public/icons/icon-maskable-512.png', size: 512, master: masterMaskable },
  { file: 'public/icons/apple-touch-icon.png', size: 180, master: masterAny },
  { file: 'public/favicon.png', size: 64, master: masterAny },
];

for (const t of targets) {
  await sharp(t.master).resize(t.size, t.size).png().toFile(join(root, t.file));
  console.log('wrote', t.file);
}

// Icon files keep a stable filename across builds (they live in public/, unlike
// Vite's content-hashed src/ assets), so browsers, CDNs, and iOS's own touch-icon
// cache can keep serving old bytes at that same URL after a redeploy. A version
// string appended as a query param forces every consumer to fetch fresh.
const version = createHash('md5').update(masterAny).update(masterMaskable).digest('hex').slice(0, 10);
writeFileSync(join(root, 'icon-version.json'), JSON.stringify({ version }));
console.log('icon version:', version);
