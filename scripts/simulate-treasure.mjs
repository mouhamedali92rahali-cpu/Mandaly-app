// Sweeps candidate رحلة الكنز path lengths per game length, simulating full
// sessions (real card order via buildSessionDeck) and reporting what
// fraction of sessions reach the treasure by the time the deck runs out.
// Used to pick the PATH_LENGTH constants in src/treasure.ts — aiming for
// close to two-thirds of sessions succeeding, per length.
//
// Progress now comes from two triggers (src/treasure.ts's advanceOnDraw/
// advanceOnPoint), not from card category alone: قلوب مفتوحة/اقلب الطاولة
// give a small step on the draw itself, but حلبة العائلة only advances the
// path when a point is actually awarded for it -- a human decision this
// script can't observe from card content. POINT_AWARD_RATE below is a
// modeling assumption (how often a drawn حلبة العائلة card ends up with an
// actual point tap), not a measured constant -- real families will vary,
// and that's the point of tying progress to points at all. Re-run this
// after changing that assumption, DRAW_STEP, POINT_STEP, or the deck.
//
// Usage: node scripts/simulate-treasure.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const tmpDir = mkdtempSync(join(tmpdir(), 'mandaly-treasure-sim-'));

try {
  const tscBin = join(projectRoot, 'node_modules', '.bin', 'tsc');

  execFileSync(
    tscBin,
    [
      '--target', 'es2022',
      '--module', 'commonjs',
      '--moduleResolution', 'node',
      '--ignoreDeprecations', '6.0',
      '--esModuleInterop',
      '--rootDir', srcDir,
      '--outDir', tmpDir,
      '--skipLibCheck',
      join(srcDir, 'data', 'categories.ts'),
      join(srcDir, 'data', 'deck.ts'),
      join(srcDir, 'data', 'session.ts'),
      join(srcDir, 'treasure.ts'),
    ],
    { stdio: 'inherit', cwd: tmpDir },
  );

  const { DECK } = require(join(tmpDir, 'data', 'deck.js'));
  const { buildSessionDeck } = require(join(tmpDir, 'data', 'session.js'));
  const treasure = require(join(tmpDir, 'treasure.js'));

  const ARENA_CAT = 'حلبة العائلة';
  // Assumption: a drawn حلبة العائلة card results in an actual point tap
  // this often. Not every guess/challenge lands, and this is deliberately
  // a bit conservative rather than assuming every card scores.
  const POINT_AWARD_RATE = 0.6;

  const ITER = 3000;
  const LENGTHS = ['veryShort', 'short', 'medium', 'long'];
  const CANDIDATES = {
    veryShort: [44],
    short: [102],
    medium: [220],
    long: [296],
  };

  function runOne(length, pathLength) {
    const excludeNeeds3 = false; // player count doesn't affect category mix ratios materially
    const drawStack = buildSessionDeck(DECK, length, excludeNeeds3);
    const drawOrder = drawStack.slice().reverse();

    treasure.configureWithPathLength(pathLength);
    treasure.setEnabled(true);

    for (const card of drawOrder) {
      treasure.advanceOnDraw(card.cat);
      if (card.cat === ARENA_CAT && Math.random() < POINT_AWARD_RATE) {
        treasure.advanceOnPoint();
      }
    }
    return treasure.getProgress().reachedTreasure;
  }

  console.log('length | pathLength | reachedPct');
  console.log('-'.repeat(45));
  for (const length of LENGTHS) {
    for (const pathLength of CANDIDATES[length]) {
      let reached = 0;
      for (let i = 0; i < ITER; i++) {
        if (runOne(length, pathLength)) reached++;
      }
      const pct = ((reached / ITER) * 100).toFixed(1);
      console.log(`${length} | ${pathLength} | ${pct}%`);
    }
    console.log('');
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
