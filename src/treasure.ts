import type { CardCategory } from './data/categories';
import type { GameLength } from './data/session';

export type SurpriseKind = 'back2' | 'jump3' | 'doubleNext';

export interface SurpriseTile {
  position: number;
  kind: SurpriseKind;
  triggered: boolean;
}

export interface Station {
  position: number;
  triggered: boolean;
}

export interface TreasureEvent {
  kind: SurpriseKind;
  delta: number;
}

export interface AdvanceResult {
  event: TreasureEvent | null;
  station: Station | null;
  justReached: boolean;
}

const NO_RESULT: AdvanceResult = { event: null, station: null, justReached: false };

// Tuned via scripts/simulate-treasure.mjs so that roughly two-thirds of
// sessions reach the treasure by the time the deck runs out, for each game
// length separately — see NOTES.md's رحلة الكنز section for the numbers
// and the point-award-rate assumption the tuning is built on.
const PATH_LENGTH: Record<GameLength, number> = {
  veryShort: 44,
  short: 102,
  medium: 220,
  long: 296,
};

const OPEN_CAT: CardCategory = 'قلوب مفتوحة';
const FLIP_CAT: CardCategory = 'اقلب الطاولة';

// Just drawing a card isn't an accomplishment worth shared progress on its
// own — قلوب مفتوحة and اقلب الطاولة have no "correct answer" to judge, so
// they get a small fixed step for being drawn at all, while حلبة العائلة
// (the only category with real points) contributes nothing on the draw
// itself — only advanceOnPoint(), fired when a point is actually awarded,
// moves the path for it. See advanceOnPoint()'s own comment for why this
// isn't gated against the point-award mechanic being unverified.
const DRAW_STEP = 1;
const POINT_STEP = 3;

let enabled = false;
let locked = false;
let pathLength = 0;
let currentStep = 0;
let stations: Station[] = [];
let surprises: SurpriseTile[] = [];
let doubleNextPending = false;

function buildLayout(length: number): { stations: Station[]; surprises: SurpriseTile[] } {
  const stationPositions = [
    Math.round(length * 0.25),
    Math.round(length * 0.5),
    Math.round(length * 0.75),
  ];

  // One tile per surprise kind, spread across the path and never sharing a
  // position with a station (visual/logical clash) or with each other.
  const kinds: SurpriseKind[] = ['back2', 'doubleNext', 'jump3'];
  const fractions = [0.35, 0.6, 0.85];
  const taken = new Set(stationPositions);
  const surpriseTiles: SurpriseTile[] = kinds.map((kind, i) => {
    let pos = Math.round(length * fractions[i]);
    while (taken.has(pos) && pos < length - 1) pos++;
    taken.add(pos);
    return { position: pos, kind, triggered: false };
  });

  return {
    stations: stationPositions.map((position) => ({ position, triggered: false })),
    surprises: surpriseTiles,
  };
}

export function isEnabled(): boolean {
  return enabled;
}

export function isLocked(): boolean {
  return locked;
}

/** Refused silently once locked — the caller (the menu click handler) should
 * check isLocked() itself before flipping the UI, this is just the guard of
 * last resort. */
export function setEnabled(value: boolean): void {
  if (locked) return;
  enabled = value;
}

export function lock(): void {
  locked = true;
}

/** Call whenever a session (re)starts or the length selection changes —
 * resets progress and rebuilds the path's station/surprise layout for the
 * current length. Does not touch `enabled` itself, so the player's toggle
 * choice survives a same-length restart. */
export function configureForLength(length: GameLength): void {
  configureWithPathLength(PATH_LENGTH[length]);
}

// Exposed only so scripts/simulate-treasure.mjs can sweep candidate path
// lengths against the real layout/advance logic while tuning PATH_LENGTH —
// production code always goes through configureForLength() instead.
export function configureWithPathLength(length: number): void {
  pathLength = length;
  currentStep = 0;
  locked = false;
  doubleNextPending = false;
  const layout = buildLayout(pathLength);
  stations = layout.stations;
  surprises = layout.surprises;
}

// Shared by both entry points below: applies `steps` (doubled if a ✨ tile
// is pending), then checks for newly-crossed surprise tiles and stations.
function applySteps(steps: number): AdvanceResult {
  if (!enabled || pathLength === 0) return NO_RESULT;
  if (steps === 0 && !doubleNextPending) return NO_RESULT;

  const wasAtEnd = currentStep >= pathLength;
  if (doubleNextPending) {
    steps *= 2;
    doubleNextPending = false;
  }
  currentStep = Math.max(0, currentStep + steps);

  let event: TreasureEvent | null = null;
  for (const tile of surprises) {
    if (!tile.triggered && currentStep >= tile.position) {
      tile.triggered = true;
      if (tile.kind === 'back2') {
        currentStep = Math.max(0, currentStep - 2);
        event = { kind: tile.kind, delta: -2 };
      } else if (tile.kind === 'jump3') {
        currentStep += 3;
        event = { kind: tile.kind, delta: 3 };
      } else {
        doubleNextPending = true;
        event = { kind: tile.kind, delta: 0 };
      }
      // Only the first newly-triggered tile in a single call fires — tiles
      // are spread apart well beyond DRAW_STEP/POINT_STEP, so two firing
      // off one call isn't reachable in practice, but this keeps whichever
      // does show unambiguous if it ever were.
      break;
    }
  }

  let station: Station | null = null;
  for (const s of stations) {
    if (!s.triggered && currentStep >= s.position) {
      s.triggered = true;
      station = s;
      break;
    }
  }

  const justReached = !wasAtEnd && currentStep >= pathLength;
  return { event, station, justReached };
}

/** Call once per card drawn — قلوب مفتوحة/اقلب الطاولة give a small step
 * just for being drawn (see DRAW_STEP's comment); حلبة العائلة gives
 * nothing here, only advanceOnPoint() moves the path for it. */
export function advanceOnDraw(cat: CardCategory): AdvanceResult {
  const steps = cat === OPEN_CAT || cat === FLIP_CAT ? DRAW_STEP : 0;
  return applySteps(steps);
}

/** Call once per point actually awarded to a player (awardPointTo() in
 * players.ts) — this is the real "answered correctly / earned it" signal
 * the path is meant to reward. Point-awarding itself stays exactly as
 * unverified as it already was (any player, any time, no check) — tying
 * shared progress to it is an accepted, deliberate risk, not something
 * this module tries to guard against. */
export function advanceOnPoint(): AdvanceResult {
  return applySteps(POINT_STEP);
}

export function getProgress(): {
  currentStep: number;
  pathLength: number;
  stations: Station[];
  surprises: SurpriseTile[];
  reachedTreasure: boolean;
} {
  return {
    currentStep: Math.min(currentStep, pathLength),
    pathLength,
    stations,
    surprises,
    reachedTreasure: currentStep >= pathLength && pathLength > 0,
  };
}
