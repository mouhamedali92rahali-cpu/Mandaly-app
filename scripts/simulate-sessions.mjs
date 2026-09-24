// Simulates 1000 sessions per (length x player-count) scenario and reports
// selection ratios plus rule-violation counts for the session builder in
// src/data/session.ts. Run this after any change to src/data/deck.ts (new
// cards, mechanic tags, needs3 tags) to confirm sessions are still built
// validly — see NOTES.md's "اختبار المحاكاة" section.
//
// Usage: node scripts/simulate-sessions.mjs
//   (or: npm run simulate)
//
// Compiles src/data/{categories,deck,session}.ts to plain CommonJS in a
// throwaway temp directory (no new dependency needed — the project already
// has `typescript`) and runs the simulation against that, so this always
// tests the real, current session-building code rather than a re-implemented
// copy of it.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const srcData = join(projectRoot, 'src', 'data');
const tmpDir = mkdtempSync(join(tmpdir(), 'mandaly-sim-'));

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
      '--rootDir', srcData,
      '--outDir', tmpDir,
      '--skipLibCheck',
      join(srcData, 'categories.ts'),
      join(srcData, 'deck.ts'),
      join(srcData, 'session.ts'),
    ],
    // Running from the project root would make tsc pick up tsconfig.json
    // and refuse to also take file arguments on the command line — running
    // from the throwaway temp dir instead means no tsconfig.json is ever
    // discovered along the way up.
    { stdio: 'inherit', cwd: tmpDir },
  );

  const { DECK } = require(join(tmpDir, 'deck.js'));
  const { buildSessionDeck } = require(join(tmpDir, 'session.js'));

  const FLIP_CAT = 'اقلب الطاولة';
  const OPEN_CAT = 'قلوب مفتوحة';
  const ARENA_CAT = 'حلبة العائلة';
  const CAT_RUN_LIMIT = 3;
  const XY_RUN_LIMIT = 2;

  const ITER = 1000;
  const LENGTHS = ['short', 'medium', 'long'];
  const PLAYER_COUNTS = [2, 3, 5];

  function analyzeOrder(cards) {
    let violations = 0;
    let longestXyRun = 0;
    let curXyRun = 0;
    let curCatRun = 0;
    let lastCat = null;

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const isXy = c.mechanic === 'xy';

      if (isXy) curXyRun++;
      else curXyRun = 0;
      if (curXyRun > longestXyRun) longestXyRun = curXyRun;
      if (curXyRun > XY_RUN_LIMIT) violations++;

      if (c.cat === lastCat) curCatRun++;
      else curCatRun = 1;
      lastCat = c.cat;
      if (curCatRun > CAT_RUN_LIMIT) violations++;

      if (c.cat === FLIP_CAT && i > 0 && cards[i - 1].cat === FLIP_CAT) violations++;
    }

    if (cards.length > 0 && cards[cards.length - 1].cat === FLIP_CAT) violations++;

    return { violations, longestXyRun };
  }

  function pct(n, total) {
    return total === 0 ? '0.0%' : ((n / total) * 100).toFixed(1) + '%';
  }

  const rows = [];

  for (const length of LENGTHS) {
    for (const players of PLAYER_COUNTS) {
      const excludeNeeds3 = players < 3;

      let sumCount = 0;
      let sumXy = 0;
      let sumFlip = 0;
      let sumOpen = 0;
      let sumArena = 0;
      let sumViolations = 0;
      let maxXyRunSeen = 0;
      let minCount = Infinity;
      let maxCount = -Infinity;

      for (let i = 0; i < ITER; i++) {
        const drawStack = buildSessionDeck(DECK, length, excludeNeeds3);
        const drawOrder = drawStack.slice().reverse();

        sumCount += drawOrder.length;
        minCount = Math.min(minCount, drawOrder.length);
        maxCount = Math.max(maxCount, drawOrder.length);

        for (const c of drawOrder) {
          if (c.mechanic === 'xy') sumXy++;
          if (c.cat === FLIP_CAT) sumFlip++;
          if (c.cat === OPEN_CAT) sumOpen++;
          if (c.cat === ARENA_CAT) sumArena++;
        }

        const { violations, longestXyRun } = analyzeOrder(drawOrder);
        sumViolations += violations;
        maxXyRunSeen = Math.max(maxXyRunSeen, longestXyRun);
      }

      rows.push({
        length,
        players,
        avgCount: (sumCount / ITER).toFixed(1),
        minCount,
        maxCount,
        xyPct: pct(sumXy, sumCount),
        openPct: pct(sumOpen, sumCount),
        arenaPct: pct(sumArena, sumCount),
        flipPct: pct(sumFlip, sumCount),
        avgFlip: (sumFlip / ITER).toFixed(2),
        maxXyRun: maxXyRunSeen,
        totalViolations: sumViolations,
      });
    }
  }

  const headers = [
    'length', 'players', 'avgCount', 'min-max', 'xy%', 'open%', 'arena%', 'flip%',
    'avgFlipCards', 'maxXyRun', 'violations/1000',
  ];
  console.log(headers.join(' | '));
  console.log('-'.repeat(120));
  let anyViolations = false;
  for (const r of rows) {
    if (r.totalViolations > 0) anyViolations = true;
    console.log(
      [
        r.length, r.players, r.avgCount, `${r.minCount}-${r.maxCount}`, r.xyPct, r.openPct,
        r.arenaPct, r.flipPct, r.avgFlip, r.maxXyRun, r.totalViolations,
      ].join(' | '),
    );
  }

  console.log('');
  if (anyViolations) {
    console.log('⚠️  Some scenarios show rule violations — check src/data/session.ts ordering logic.');
    process.exitCode = 1;
  } else {
    console.log('✅ Zero rule violations across all scenarios.');
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
