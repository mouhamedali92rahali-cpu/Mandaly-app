// Sweeps candidate رحلة الكنز path lengths per game length, simulating full
// sessions (real card order via buildSessionDeck) and reporting what
// fraction of sessions reach the treasure by the time the deck runs out.
// Used to pick the PATH_LENGTH constants in src/treasure.ts — aiming for
// close to two-thirds of sessions succeeding, per length.
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

  const ITER = 3000;
  const LENGTHS = ['veryShort', 'short', 'medium', 'long'];
  const CANDIDATES = {
    veryShort: [41],
    short: [93],
    medium: [199],
    long: [259],
  };

  function runOne(length, pathLength) {
    const excludeNeeds3 = false; // player count doesn't affect category mix ratios materially
    const drawStack = buildSessionDeck(DECK, length, excludeNeeds3);
    const drawOrder = drawStack.slice().reverse();

    treasure.configureWithPathLength(pathLength);
    treasure.setEnabled(true);

    for (const card of drawOrder) {
      treasure.advance(card.cat);
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
