import { type Card } from './deck';
import type { CardCategory } from './categories';

export type GameLength = 'veryShort' | 'short' | 'medium' | 'long';

const FLIP_CAT: CardCategory = 'اقلب الطاولة';
const OPEN_CAT: CardCategory = 'قلوب مفتوحة';
const ARENA_CAT: CardCategory = 'حلبة العائلة';

// "long" has no nominal cap — selectSessionCards() clamps it to every
// eligible card, same idea as the old per-category Infinity targets.
const NOMINAL_LENGTH: Record<GameLength, number> = { veryShort: 30, short: 70, medium: 150, long: Infinity };

const FLIP_RATIO = 0.05;
const XY_CAP_RATIO: Record<'veryShort' | 'short' | 'medium', number> = { veryShort: 0.25, short: 0.25, medium: 0.4 };
const OPEN_RATIO = 1 / 3;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks which cards make up a session, in four pools by priority:
 * 1. اقلب الطاولة — ~5% of the session length.
 * 2. حلبة العائلة cards tagged mechanic: 'xy' (the "اختر لاعبًا: X أم Y؟"
 *    template) — capped at 25%/25%/40% of a very-short/short/medium session
 *    so this, the deck's single most common template, can't dominate a
 *    session; "long" takes every xy card since it already takes everything
 *    else too. If the other pools can't fill the remaining slots on their
 *    own, the cap is raised just enough to make up the shortfall.
 * 3. Everything else (دائرة الحديث + non-xy حلبة العائلة), aiming to keep
 *    قلوب مفتوحة close to a third of the session.
 * Selection within each pool is random, so which xy cards show up varies
 * session to session.
 */
export function selectSessionCards(deck: Card[], length: GameLength, excludeNeeds3: boolean): Card[] {
  const eligible = excludeNeeds3 ? deck.filter((c) => !c.needs3) : deck;
  const flipPool = eligible.filter((c) => c.cat === FLIP_CAT);
  const xyPool = eligible.filter((c) => c.cat === ARENA_CAT && c.mechanic === 'xy');
  const nonXyArenaPool = eligible.filter((c) => c.cat === ARENA_CAT && c.mechanic !== 'xy');
  const openPool = eligible.filter((c) => c.cat === OPEN_CAT);

  const totalAvailable = flipPool.length + xyPool.length + nonXyArenaPool.length + openPool.length;
  const target = Math.min(NOMINAL_LENGTH[length], totalAvailable);

  const flipCount = Math.min(Math.round(target * FLIP_RATIO), flipPool.length, target);

  let xyCount: number;
  if (length === 'long') {
    xyCount = xyPool.length;
  } else {
    const cap = Math.floor(target * XY_CAP_RATIO[length]);
    const wanted = Math.min(cap, xyPool.length);
    const otherCapacity = openPool.length + nonXyArenaPool.length;
    const remainingAfterWanted = target - flipCount - wanted;
    xyCount =
      remainingAfterWanted > otherCapacity
        ? Math.min(wanted + (remainingAfterWanted - otherCapacity), xyPool.length)
        : wanted;
  }
  xyCount = Math.min(xyCount, Math.max(target - flipCount, 0));

  const remaining = Math.max(target - flipCount - xyCount, 0);
  let openCount = Math.min(Math.round(target * OPEN_RATIO), remaining, openPool.length);
  let arenaCount = remaining - openCount;
  if (arenaCount > nonXyArenaPool.length) {
    const shortfall = arenaCount - nonXyArenaPool.length;
    arenaCount = nonXyArenaPool.length;
    openCount = Math.min(openCount + shortfall, openPool.length);
  }

  return [
    ...shuffle(flipPool).slice(0, flipCount),
    ...shuffle(xyPool).slice(0, xyCount),
    ...shuffle(openPool).slice(0, openCount),
    ...shuffle(nonXyArenaPool).slice(0, arenaCount),
  ];
}

const CAT_RUN_LIMIT = 3;
const XY_RUN_LIMIT = 2;
const FLIP_AVOID_FIRST_N = 5;

// Picks between two pools that mutually cap each other's run length at
// `runLimit` (each is the only thing that can interrupt the other), subject
// to whichever the run-limit currently blocks outright.
//
// Once a pool's count drops to the bare minimum still needed to keep
// interrupting the other (no slack left above ⌊other / runLimit⌋), it has to
// stop being spent voluntarily and get *conserved* — picking the other pool
// instead, letting the run-limit force this one out only when it actually
// has to. Forcing it to be picked *more* the moment it gets scarce (the
// intuitive-seeming direction) is backwards: that only spends down the
// scarce pool faster without shrinking the other, so it still hits zero
// with the other pool nowhere near done.
// While both pools have slack to spare, pick with real randomness weighted
// by what's left, so the sequence doesn't read as mechanical.
function pickTwoPools(
  aBlocked: boolean,
  aCount: number,
  bBlocked: boolean,
  bCount: number,
  runLimit: number,
): 'a' | 'b' | null {
  const aOk = !aBlocked && aCount > 0;
  const bOk = !bBlocked && bCount > 0;
  if (!aOk && !bOk) {
    // Only reachable when a run limit truly can't be honored any further
    // (the interrupting pool ran out early) — pick whichever still has
    // cards, ignoring the block, rather than looping.
    if (aCount > 0 || bCount > 0) return aCount >= bCount ? 'a' : 'b';
    return null;
  }
  if (!aOk) return 'b';
  if (!bOk) return 'a';

  if (aCount <= Math.floor(bCount / runLimit)) return 'b';
  if (bCount <= Math.floor(aCount / runLimit)) return 'a';
  return Math.random() * (aCount + bCount) < aCount ? 'a' : 'b';
}

// Chooses which of the `target` slots the اقلب الطاولة cards occupy: never
// the last slot (it modifies the *next* card's rules), never two slots apart
// by less than 2 (so they can't land back-to-back), and drawn from slots
// index >= FLIP_AVOID_FIRST_N whenever there's room, only spilling into the
// earlier slots if `count` genuinely doesn't fit in the preferred range —
// which the ~5% flip ratio never comes close to forcing in practice.
function pickFlipPositions(target: number, count: number): Set<number> {
  const chosen = new Set<number>();
  if (count === 0 || target === 0) return chosen;
  const lastIndex = target - 1;

  function fillFrom(pool: number[]): void {
    for (const i of shuffle(pool)) {
      if (chosen.size >= count) return;
      let tooClose = false;
      for (const p of chosen) {
        if (Math.abs(p - i) < 2) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) chosen.add(i);
    }
  }

  const preferred: number[] = [];
  for (let i = FLIP_AVOID_FIRST_N; i < lastIndex; i++) preferred.push(i);
  fillFrom(preferred);

  if (chosen.size < count) {
    const fallback: number[] = [];
    for (let i = 0; i < Math.min(FLIP_AVOID_FIRST_N, lastIndex); i++) fallback.push(i);
    fillFrom(fallback);
  }

  // Only reachable if `count` is too large for `target` to seat with any
  // spacing at all — allow adjacency as a last resort rather than dropping a
  // card or looping.
  if (chosen.size < count) {
    for (let i = 0; i < lastIndex && chosen.size < count; i++) chosen.add(i);
  }

  return chosen;
}

// Orders the non-flip cards so that, drawn in sequence, no more than 3 in a
// row share a category and no more than 2 in a row are the xy template. The
// two run-limits apply at different levels — cat-run spans حلبة العائلة as a
// whole (xy and its non-xy cards combined) vs. قلوب مفتوحة, while xy-run is
// a limit *within* the حلبة العائلة picks — so this decides in two matching
// steps: first قلوب مفتوحة vs. حلبة العائلة for the slot, then, only when
// حلبة العائلة wins it, xy vs. non-xy for which card fills it. Falls back to
// whichever pool still has cards, ignoring the limit, only when a limit
// truly can't be honored any further — guaranteeing this always terminates
// rather than looping.
function orderBody(cards: Card[]): Card[] {
  const openPool = shuffle(cards.filter((c) => c.cat === OPEN_CAT));
  const xyPool = shuffle(cards.filter((c) => c.cat === ARENA_CAT && c.mechanic === 'xy'));
  const arenaPool = shuffle(cards.filter((c) => c.cat === ARENA_CAT && c.mechanic !== 'xy'));

  const order: Card[] = [];
  const catHistory: CardCategory[] = [];
  const xyHistory: boolean[] = [];

  const catRunBlocks = (cat: CardCategory) =>
    catHistory.length >= CAT_RUN_LIMIT && catHistory.slice(-CAT_RUN_LIMIT).every((c) => c === cat);
  const xyRunBlocks = () =>
    xyHistory.length >= XY_RUN_LIMIT && xyHistory.slice(-XY_RUN_LIMIT).every((x) => x);

  while (openPool.length + xyPool.length + arenaPool.length > 0) {
    const arenaCombined = xyPool.length + arenaPool.length;
    const pick = pickTwoPools(
      catRunBlocks(OPEN_CAT),
      openPool.length,
      catRunBlocks(ARENA_CAT),
      arenaCombined,
      CAT_RUN_LIMIT,
    );

    if (pick === 'a') {
      order.push(openPool.pop()!);
      catHistory.push(OPEN_CAT);
      xyHistory.push(false);
      continue;
    }

    // pick === 'b' is guaranteed here: arenaCombined > 0 whenever openPool
    // is empty (the while condition), and pickTwoPools only returns null
    // when both counts are 0.
    const useXy = pickTwoPools(xyRunBlocks(), xyPool.length, false, arenaPool.length, XY_RUN_LIMIT) === 'a';
    order.push(useXy ? xyPool.pop()! : arenaPool.pop()!);
    catHistory.push(ARENA_CAT);
    xyHistory.push(useXy);
  }

  return order;
}

/**
 * Orders an already-picked session's cards into the sequence they'll be
 * drawn in. Two passes: first decide which slots the اقلب الطاولة cards
 * occupy (never last, never adjacent, preferably not in the first 5), then
 * fill every other slot with the rest of the cards (no more than 3 in a row
 * sharing a category, no more than 2 in a row from the xy template). Built
 * once, up front, and returned as a draw stack (last-in-first-out via
 * .pop()), so it stays fixed for the whole session — "السابق/التالي" step
 * through this same sequence rather than a freshly-shuffled one.
 */
export function orderSessionCards(cards: Card[]): Card[] {
  const flipCards = shuffle(cards.filter((c) => c.cat === FLIP_CAT));
  const bodyOrder = orderBody(cards.filter((c) => c.cat !== FLIP_CAT));
  const target = cards.length;
  const flipPositions = pickFlipPositions(target, flipCards.length);

  const order: Card[] = [];
  let flipIdx = 0;
  let bodyIdx = 0;
  for (let pos = 0; pos < target; pos++) {
    order.push(flipPositions.has(pos) ? flipCards[flipIdx++] : bodyOrder[bodyIdx++]);
  }

  return order.reverse();
}

export function buildSessionDeck(deck: Card[], length: GameLength, excludeNeeds3: boolean): Card[] {
  return orderSessionCards(selectSessionCards(deck, length, excludeNeeds3));
}
