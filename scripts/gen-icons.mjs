import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bgSvg = readFileSync(join(__dirname, 'icon-bg.svg'));
const logoPath = join(root, 'src/assets/logo-mark.png');

const CANVAS = 512;
const LOGO_HEIGHT = 300; // stays within the maskable-icon safe zone (~80% of canvas)

const logoMeta = await sharp(logoPath).metadata();
const logoWidth = Math.round(LOGO_HEIGHT * (logoMeta.width / logoMeta.height));
const logoBuffer = await sharp(logoPath).resize(logoWidth, LOGO_HEIGHT).toBuffer();

const master = await sharp(bgSvg, { density: 384 })
  .resize(CANVAS, CANVAS)
  .composite([{ input: logoBuffer, gravity: 'centre' }])
  .png()
  .toBuffer();

const targets = [
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/icon-maskable-512.png', size: 512 },
  { file: 'public/icons/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon.png', size: 64 },
];

for (const t of targets) {
  await sharp(master).resize(t.size, t.size).png().toFile(join(root, t.file));
  console.log('wrote', t.file);
}
