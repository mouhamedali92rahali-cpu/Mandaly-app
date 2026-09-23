import { DECK, type Card } from './data/deck';
import { CATEGORY_ICONS, type CardCategory } from './data/categories';
import { playFlip, playHeart, playFamilyHeart } from './sound';
import { hapticDraw, hapticHeart } from './haptics';
import { shareCard } from './share';
import { hasSession, advanceTurn, awardPointTo, getPlayers, getCurrentIndex } from './players';
import type { Timer } from './timer';

const CATEGORIES: CardCategory[] = ['قلوب مفتوحة', 'حلبة العائلة', 'اقلب الطاولة'];
const NO_REPEAT_EVER: CardCategory = 'اقلب الطاولة';

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds a draw order (last card first, so drawCard() can keep using deck.pop())
// that keeps two "اقلب الطاولة" cards from ever landing back-to-back, and avoids
// repeating the other two categories back-to-back whenever an alternative exists.
function buildDrawOrder(cards: Card[]): Card[] {
  const groups = new Map<CardCategory, Card[]>(CATEGORIES.map((cat) => [cat, []]));
  for (const card of cards) groups.get(card.cat)!.push(card);
  for (const cat of CATEGORIES) groups.set(cat, shuffle(groups.get(cat)!));

  const remaining = () => CATEGORIES.reduce((sum, cat) => sum + groups.get(cat)!.length, 0);
  const order: Card[] = [];
  let lastCat: CardCategory | null = null;

  while (remaining() > 0) {
    let candidates = CATEGORIES.filter((cat) => groups.get(cat)!.length > 0);

    const withoutFlipRepeat = candidates.filter(
      (cat) => !(lastCat === NO_REPEAT_EVER && cat === NO_REPEAT_EVER),
    );
    if (withoutFlipRepeat.length > 0) candidates = withoutFlipRepeat;

    const withoutAnyRepeat = candidates.filter((cat) => cat !== lastCat);
    if (withoutAnyRepeat.length > 0) candidates = withoutAnyRepeat;

    // Among the valid options, favor whichever category still has the most cards
    // left, so a large category never gets cornered into forced repeats later.
    const maxCount = Math.max(...candidates.map((cat) => groups.get(cat)!.length));
    const top = candidates.filter((cat) => groups.get(cat)!.length === maxCount);
    const chosen = top[Math.floor(Math.random() * top.length)];

    order.push(groups.get(chosen)!.pop()!);
    lastCat = chosen;
  }

  return order.reverse();
}

export type GameLength = 'short' | 'medium' | 'long';

// Exact counts from the reviewed card bank's own category ratios (~5% اقلب
// الطاولة / ~30% قلوب مفتوحة / ~65% حلبة العائلة). "long" asks for more than
// any category actually has — selectCardsForLength() clamps that to "every
// eligible card", so it stays correct even if the bank's size changes later.
const LENGTH_TARGETS: Record<GameLength, Record<CardCategory, number>> = {
  short: { 'اقلب الطاولة': 4, 'قلوب مفتوحة': 22, 'حلبة العائلة': 44 },
  medium: { 'اقلب الطاولة': 7, 'قلوب مفتوحة': 46, 'حلبة العائلة': 97 },
  long: { 'اقلب الطاولة': Infinity, 'قلوب مفتوحة': Infinity, 'حلبة العائلة': Infinity },
};

// Cards flagged "needs3" (e.g. one-against-the-group) genuinely don't work
// below 3 players, so they're dropped from the pool up front whenever fewer
// than 3 names are registered — including the classic no-session mode, where
// the player count is unknown and 0 is the only safe assumption.
function selectCardsForLength(pool: Card[], length: GameLength, excludeNeeds3: boolean): Card[] {
  const eligible = excludeNeeds3 ? pool.filter((c) => !c.needs3) : pool;
  const targets = LENGTH_TARGETS[length];
  const selected: Card[] = [];
  for (const cat of CATEGORIES) {
    const catPool = shuffle(eligible.filter((c) => c.cat === cat));
    const count = Math.min(targets[cat], catPool.length);
    selected.push(...catPool.slice(0, count));
  }
  return selected;
}

interface Elements {
  card: HTMLElement;
  catBadge: HTMLElement;
  catLabel: HTMLElement;
  cardText: HTMLElement;
  drawBtn: HTMLElement;
  heartBtn: HTMLElement;
  shareBtn: HTMLButtonElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  statDrawn: HTMLElement;
  statHearts: HTMLElement;
  heartPop: HTMLElement;
  heartPopText: HTMLElement;
  lengthToggle: HTMLButtonElement;
  lengthMenu: HTMLElement;
  calmOnlyItem: HTMLButtonElement;
  turnBar: HTMLElement;
  turnPlayers: HTMLElement;
  endSessionBtn: HTMLButtonElement;
}

export interface Game {
  /** Call after a player session starts or restarts, so the turn indicator
   * picks it up — initGame() itself always runs before onboarding finishes,
   * so it can't know about a session that doesn't exist yet at that point. */
  notifySessionChanged: () => void;
}

// Every card is always vertically centered (see .card-text in style.css).
// Font size is picked by a continuous shrink/grow-to-fit search instead of a
// small set of fixed tiers: a short 1-2 line question grows well past the
// old flat "large" size to actually fill the card, a 6-line one shrinks only
// as far as it needs to, and everything in between (3-4 lines, which used to
// get stranded at whichever tier it fell into with empty space left over)
// lands on its own in-between size. Line-height scales down alongside font
// size — tighter leading reads fine at small sizes but would look sparse at
// large ones, and looser leading is what makes the large sizes feel bold and
// intentional rather than just "big text".
const MAX_FONT_SIZE = 32;
const MIN_FONT_SIZE = 16;
const FONT_STEP = 0.5;
const MAX_LINE_HEIGHT_RATIO = 1.85;
const MIN_LINE_HEIGHT_RATIO = 1.6;

function lineHeightRatioFor(fontSize: number): number {
  const t = (fontSize - MIN_FONT_SIZE) / (MAX_FONT_SIZE - MIN_FONT_SIZE);
  return MIN_LINE_HEIGHT_RATIO + t * (MAX_LINE_HEIGHT_RATIO - MIN_LINE_HEIGHT_RATIO);
}

// cardText is a flex:1 child, so its own box is stretched to fill the card —
// scrollHeight would just report that stretched box, not the text's actual
// wrapped height. Counting the text node's own line boxes via Range sidesteps
// that entirely. Rects are grouped by their vertical position rather than
// just counted, because bidi text (Arabic mixed with a Latin "+1", say) can
// split one visual line into multiple rects at the direction change.
function countWrappedLines(cardText: HTMLElement): number {
  const textNode = cardText.firstChild;
  if (!textNode) return 0;
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const lineTops = new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top)));
  return lineTops.size;
}

// blockHeight is an estimate (lines × fontSize × lineHeight ratio) — real
// text rendering can land a pixel or two taller than that estimate, so a
// pick that only just "fits" can still clip against card-text's own
// overflow: hidden. Leaving a small margin here is cheaper than chasing
// sub-pixel accuracy in the estimate itself.
const FIT_SAFETY_MARGIN = 0.97;

function setCardText(cardText: HTMLElement, text: string): void {
  cardText.textContent = text;
  // The flex-allocated height stays the same across every font size tried
  // (card-text's sibling min-height is 0 inside the scrollable .face-front),
  // so it only needs to be read once, before the search starts.
  const available = cardText.clientHeight * FIT_SAFETY_MARGIN;

  let chosenSize = MIN_FONT_SIZE;
  let chosenLineHeight = lineHeightRatioFor(MIN_FONT_SIZE);

  for (let size = MAX_FONT_SIZE; size >= MIN_FONT_SIZE; size -= FONT_STEP) {
    const lineHeight = lineHeightRatioFor(size);
    cardText.style.fontSize = `${size}px`;
    cardText.style.lineHeight = String(lineHeight);
    const lines = countWrappedLines(cardText);
    const blockHeight = lines * size * lineHeight;
    if (blockHeight <= available) {
      chosenSize = size;
      chosenLineHeight = lineHeight;
      break;
    }
    // Doesn't fit at this size — the loop tries the next, smaller one, and
    // the smallest size is kept as a last-resort floor (card-text clips
    // rather than overflowing the card itself in that rare case).
  }

  cardText.style.fontSize = `${chosenSize}px`;
  cardText.style.lineHeight = String(chosenLineHeight);
}

export function initGame(el: Elements, timer: Timer, onEndSession: () => void): Game {
  // Defaults to a quick session; set from the "⋮" length menu.
  let gameLength: GameLength = 'short';

  // Independent of length: a pure single-category mode for a calmer,
  // no-points, no-challenges session — bypasses the length ratios entirely
  // rather than trying to fit "only one category" into a 3-category split.
  let calmOnly = false;

  // Whether the very next draw is the first one since a session (re)started —
  // that first card belongs to whoever the turn indicator already shows, so
  // the turn only advances on draws AFTER it. Otherwise the indicator would
  // flip to the second player before the first player's own card even shows.
  let firstDrawPending = true;

  // Whoever earned a card's point — guessed right, won a physical challenge —
  // is a judgment call the players make themselves, and isn't necessarily
  // whoever's turn it is to read the card. So every player gets their own
  // tappable chip here (award a point to any of them directly), while
  // highlighting stays reserved for showing whose *turn* it is to draw.
  // Past this many players, a single scrollable row starts hiding names
  // behind the "إنهاء" button, reachable only by swiping — switching to a
  // smaller, wrapping two-row layout keeps every name visible at a glance.
  const COMPACT_PLAYER_THRESHOLD = 4;

  function renderTurnBar(): void {
    const active = hasSession();
    el.turnBar.hidden = !active;
    if (!active) return;

    const players = getPlayers();
    const curIndex = getCurrentIndex();
    el.turnBar.classList.toggle('compact', players.length > COMPACT_PLAYER_THRESHOLD);
    el.turnPlayers.replaceChildren();

    players.forEach((player, index) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'turn-chip';
      if (index === curIndex) chip.classList.add('turn-chip-current');
      chip.dataset.index = String(index);
      chip.setAttribute('aria-label', `امنح نقطة لـ ${player.name}`);

      const avatar = document.createElement('span');
      avatar.className = 'turn-chip-avatar';
      avatar.textContent = player.name.trim().charAt(0).toUpperCase();

      const name = document.createElement('span');
      name.className = 'turn-chip-name';
      name.textContent = player.name;

      const score = document.createElement('span');
      score.className = 'turn-chip-score';
      score.textContent = String(player.score);

      chip.append(avatar, name, score);
      el.turnPlayers.appendChild(chip);
    });
  }

  function currentPool(): Card[] {
    if (calmOnly) return DECK.filter((c) => c.cat === 'قلوب مفتوحة');
    const excludeNeeds3 = getPlayers().length < 3;
    return selectCardsForLength(DECK, gameLength, excludeNeeds3);
  }

  let deck: Card[] = buildDrawOrder(currentPool());
  let drawn = 0;
  let hearts = 0;

  // Every real card drawn this session, in order, so players can step back to
  // review one instead of losing it the moment the next card is drawn.
  const history: Card[] = [];
  let historyIndex = -1;

  // The card currently showing, so the share button knows what to share and
  // stays disabled on the card back / the "deck reshuffled" filler screen.
  let currentCard: Card | null = null;

  function resetDeck(): void {
    deck = buildDrawOrder(currentPool());
  }

  function updateNavButtons(): void {
    el.prevBtn.disabled = historyIndex <= 0;
    // "Next" always has something to do once a card has been drawn: step
    // forward through history if we've stepped back from it, otherwise draw
    // a new card — so it's only ever disabled before the very first draw,
    // never in a state that needs explaining.
    el.nextBtn.disabled = historyIndex < 0;
    el.shareBtn.disabled = currentCard === null;
  }

  function flipTo(render: () => void): void {
    render();
    el.card.classList.remove('flipped');
    void el.card.offsetWidth;
    requestAnimationFrame(() => el.card.classList.add('flipped'));
    playFlip();
    hapticDraw();
  }

  function showCard(card: Card): void {
    currentCard = card;
    flipTo(() => {
      el.catBadge.innerHTML = CATEGORY_ICONS[card.cat];
      el.catLabel.textContent = card.cat;
      setCardText(el.cardText, card.text);
    });
    timer.setCard(card.duration);
  }

  function drawCard(): void {
    if (deck.length === 0) {
      // A player session has a defined size (the chosen game length) —
      // running out of cards IS finishing it, so it goes straight to the
      // standings instead of the classic "shuffle again" filler, which
      // only makes sense for the open-ended no-session mode.
      if (hasSession()) {
        onEndSession();
        return;
      }

      currentCard = null;
      flipTo(() => {
        el.catLabel.textContent = '';
        el.catBadge.innerHTML = '';
        setCardText(el.cardText, 'خلصت كل الكروت — اضغطوا مرة أخرى للخلط من جديد');
      });
      timer.setCard(undefined);
      resetDeck();
      drawn = 0;
      el.statDrawn.textContent = String(drawn);
      el.shareBtn.disabled = true;
      return;
    }

    const next = deck.pop()!;
    // Drawing a fresh card after stepping back drops whatever was ahead in
    // history, the same way navigating to a new page drops "forward" history.
    if (historyIndex < history.length - 1) history.length = historyIndex + 1;
    history.push(next);
    historyIndex = history.length - 1;

    if (hasSession()) {
      if (firstDrawPending) firstDrawPending = false;
      else advanceTurn();
      renderTurnBar();
    }

    showCard(next);
    drawn++;
    el.statDrawn.textContent = String(drawn);
    updateNavButtons();
  }

  function goToHistory(index: number): void {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    showCard(history[historyIndex]);
    updateNavButtons();
  }

  el.drawBtn.addEventListener('click', drawCard);
  el.card.addEventListener('click', drawCard);
  el.prevBtn.addEventListener('click', () => goToHistory(historyIndex - 1));
  el.nextBtn.addEventListener('click', () => {
    if (historyIndex < history.length - 1) goToHistory(historyIndex + 1);
    else drawCard();
  });
  updateNavButtons();

  const HEART_POP_DEFAULT_TEXT = el.heartPopText.textContent ?? '';

  // The pop animation (icon + text + haptic) is shared, but the sound isn't:
  // the heart button is a family-wide "this moment mattered" expression
  // (always audible — see playFamilyHeart), while tapping a player's chip is
  // an ordinary scoring action that stays muteable like any other effect.
  function showCelebrationPop(text: string): void {
    el.heartPopText.textContent = text;
    el.heartPop.classList.remove('show');
    void el.heartPop.offsetWidth;
    el.heartPop.classList.add('show');
    hapticHeart();
  }

  el.heartBtn.addEventListener('click', () => {
    hearts++;
    el.statHearts.textContent = String(hearts);
    showCelebrationPop(HEART_POP_DEFAULT_TEXT);
    playFamilyHeart();
  });

  el.turnPlayers.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.turn-chip');
    if (!chip) return;
    const index = Number(chip.dataset.index);
    awardPointTo(index);
    renderTurnBar();
    showCelebrationPop(`أحسنت يا ${getPlayers()[index].name}! ❤️`);
    playHeart();
  });

  const SHARE_ICON = el.shareBtn.textContent ?? '';
  let shareFeedbackTimer: number | undefined;

  el.shareBtn.addEventListener('click', () => {
    if (!currentCard) return;
    void shareCard(currentCard.text).then((result) => {
      if (result !== 'copied') return;
      window.clearTimeout(shareFeedbackTimer);
      el.shareBtn.textContent = '✅';
      shareFeedbackTimer = window.setTimeout(() => {
        el.shareBtn.textContent = SHARE_ICON;
      }, 1400);
    });
  });

  function closeLengthMenu(): void {
    el.lengthMenu.hidden = true;
    el.lengthToggle.setAttribute('aria-expanded', 'false');
  }

  function openLengthMenu(): void {
    el.lengthMenu.hidden = false;
    el.lengthToggle.setAttribute('aria-expanded', 'true');
  }

  el.lengthToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (el.lengthMenu.hidden) openLengthMenu();
    else closeLengthMenu();
  });

  function refreshLengthMenuUi(): void {
    for (const other of el.lengthMenu.querySelectorAll('.filter-menu-item[data-length]')) {
      const isActive = other.getAttribute('data-length') === gameLength;
      other.classList.toggle('active', isActive);
      other.setAttribute('aria-checked', String(isActive));
    }
    el.calmOnlyItem.classList.toggle('active', calmOnly);
    el.calmOnlyItem.setAttribute('aria-checked', String(calmOnly));
    // A dot on the "⋮" button is the only always-visible cue once a
    // non-default choice is active, since the menu itself stays closed
    // the rest of the time.
    el.lengthToggle.classList.toggle('has-filter', calmOnly || gameLength !== 'short');
  }

  el.lengthMenu.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.filter-menu-item');
    if (!item) return;

    if (item === el.calmOnlyItem) {
      calmOnly = !calmOnly;
    } else if (item.dataset.length) {
      gameLength = item.dataset.length as GameLength;
    } else {
      return;
    }

    refreshLengthMenuUi();
    // Only affects the pool future draws come from — the card on screen and
    // history stay put until the next draw.
    deck = buildDrawOrder(currentPool());
    closeLengthMenu();
  });

  document.addEventListener('click', (e) => {
    if (!el.lengthMenu.hidden && !el.lengthMenu.contains(e.target as Node)) closeLengthMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.lengthMenu.hidden) closeLengthMenu();
  });

  el.endSessionBtn.addEventListener('click', onEndSession);

  renderTurnBar();

  return {
    notifySessionChanged(): void {
      firstDrawPending = true;
      renderTurnBar();
      // initGame() runs (and builds the initial deck) before any players
      // exist — the needs3 pool check only sees the real registered count
      // from here on, once a session actually starts or restarts.
      deck = buildDrawOrder(currentPool());
    },
  };
}
