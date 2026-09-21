import { DECK, type Card } from './data/deck';
import { CATEGORY_ICONS, type CardCategory } from './data/categories';
import { playFlip, playHeart } from './sound';
import { hapticDraw, hapticHeart } from './haptics';
import { shareCard } from './share';
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
  filterToggle: HTMLButtonElement;
  filterMenu: HTMLElement;
}

// Every card is always vertically centered (see .card-text in style.css); what
// changes per card is the font size, picked here by shrink-to-fit: try the
// boldest tier first and step down only as far as needed so the text block
// still fits the card's fixed height, instead of a single short/long cutoff
// that left medium-length questions stranded at the smallest size with a big
// empty gap under them.
const FONT_TIERS: ReadonlyArray<{ fontSize: number; lineHeight: number }> = [
  { fontSize: 23, lineHeight: 1.75 },
  { fontSize: 20, lineHeight: 1.7 },
  { fontSize: 18.5, lineHeight: 1.68 },
  { fontSize: 17, lineHeight: 1.65 },
];

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

function setCardText(cardText: HTMLElement, text: string): void {
  cardText.textContent = text;
  // The flex-allocated height stays the same across tiers (card-text's
  // sibling min-height is 0 inside the scrollable .face-front), so it only
  // needs to be read once, before trying any font size.
  const available = cardText.clientHeight;

  for (let i = 0; i < FONT_TIERS.length; i++) {
    const tier = FONT_TIERS[i];
    cardText.style.fontSize = `${tier.fontSize}px`;
    cardText.style.lineHeight = String(tier.lineHeight);
    const isLast = i === FONT_TIERS.length - 1;
    if (isLast) break;
    const lines = countWrappedLines(cardText);
    const blockHeight = lines * tier.fontSize * tier.lineHeight;
    if (blockHeight <= available) break;
    // Doesn't fit at this tier — try the next, smaller one.
  }
}

export function initGame(el: Elements, timer: Timer): void {
  // null means drawing from all three categories; set from the "⋮" filter menu
  // to restrict the pool to just one, e.g. a calmer "قلوب مفتوحة"-only session.
  let activeFilter: CardCategory | null = null;

  function currentPool(): Card[] {
    return activeFilter ? DECK.filter((card) => card.cat === activeFilter) : DECK;
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
    el.nextBtn.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
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
  el.nextBtn.addEventListener('click', () => goToHistory(historyIndex + 1));
  updateNavButtons();

  el.heartBtn.addEventListener('click', () => {
    hearts++;
    el.statHearts.textContent = String(hearts);
    el.heartPop.classList.remove('show');
    void el.heartPop.offsetWidth;
    el.heartPop.classList.add('show');
    playHeart();
    hapticHeart();
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

  function closeFilterMenu(): void {
    el.filterMenu.hidden = true;
    el.filterToggle.setAttribute('aria-expanded', 'false');
  }

  function openFilterMenu(): void {
    el.filterMenu.hidden = false;
    el.filterToggle.setAttribute('aria-expanded', 'true');
  }

  el.filterToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (el.filterMenu.hidden) openFilterMenu();
    else closeFilterMenu();
  });

  el.filterMenu.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.filter-menu-item');
    if (!item) return;

    const value = item.dataset.filter!;
    activeFilter = value === 'all' ? null : (value as CardCategory);

    for (const other of el.filterMenu.querySelectorAll('.filter-menu-item')) {
      const isActive = other === item;
      other.classList.toggle('active', isActive);
      other.setAttribute('aria-checked', String(isActive));
    }
    // A dot on the "⋮" button is the only always-visible cue once a filter is
    // active, since the menu itself stays closed the rest of the time.
    el.filterToggle.classList.toggle('has-filter', activeFilter !== null);

    // Only affects the pool future draws come from — the card on screen and
    // history stay put until the next draw.
    deck = buildDrawOrder(currentPool());
    closeFilterMenu();
  });

  document.addEventListener('click', (e) => {
    if (!el.filterMenu.hidden && !el.filterMenu.contains(e.target as Node)) closeFilterMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.filterMenu.hidden) closeFilterMenu();
  });
}
