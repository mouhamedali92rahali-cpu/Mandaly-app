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

// Tuned via scripts/simulate-treasure.mjs so that roughly two-thirds of
// sessions reach the treasure by the time the deck runs out, for each game
// length separately — see NOTES.md's رحلة الكنز section for the numbers.
const PATH_LENGTH: Record<GameLength, number> = {
  veryShort: 41,
  short: 93,
  medium: 199,
  long: 259,
};

const OPEN_CAT: CardCategory = 'قلوب مفتوحة';

// selectSessionCards() fixes each category's *count* deterministically for a
// given length (only which specific cards fill it is random) — so a flat
// 2-steps/1-step rule would give every session of a given length the exact
// same total, making "reach the treasure" an all-or-nothing cliff rather
// than the ~two-thirds probability this is tuned for. Rolling around the
// same averages (2 for قلوب مفتوحة, 1 for the rest) keeps the intended
// per-category weighting while giving real session-to-session variance.
function stepsFor(cat: CardCategory): number {
  const r = Math.random();
  if (cat === OPEN_CAT) return r < 0.2 ? 1 : r < 0.8 ? 2 : 3;
  return r < 0.2 ? 0 : r < 0.8 ? 1 : 2;
}

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

/** Advances the path for one drawn card of category `cat`. Returns the
 * surprise event triggered by this draw, if any (for the UI to announce),
 * the station just reached, if any (reveals a special card), plus whether
 * the treasure was just reached this call (so it's announced once, not on
 * every subsequent draw once already at/past the end). */
export function advance(cat: CardCategory): {
  event: TreasureEvent | null;
  station: Station | null;
  justReached: boolean;
} {
  if (!enabled || pathLength === 0) return { event: null, station: null, justReached: false };

  const wasAtEnd = currentStep >= pathLength;
  let steps = stepsFor(cat);
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
      // Only the first newly-triggered tile in a single draw fires — with
      // ~1-2 steps per draw and tiles spread well apart, two tiles firing
      // off one draw isn't reachable in practice, but this keeps the event
      // shown to the player unambiguous if it ever were.
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
