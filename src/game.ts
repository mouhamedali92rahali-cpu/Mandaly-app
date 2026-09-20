import { DECK, type Card } from './data/deck';
import { CATEGORY_ICONS, type CardCategory } from './data/categories';
import { playFlip, playHeart } from './sound';
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
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  statDrawn: HTMLElement;
  statHearts: HTMLElement;
  heartPop: HTMLElement;
}

// Short questions get centered in the card's text area instead of hugging the
// top with an empty gap below; longer ones stay top-anchored so they read
// naturally and never crowd the card's bottom edge. "Short" means it wraps
// to 3 lines or fewer.
const SHORT_TEXT_MAX_LINES = 3;

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
  const isShort = countWrappedLines(cardText) <= SHORT_TEXT_MAX_LINES;
  cardText.classList.toggle('is-centered', isShort);
}

export function initGame(el: Elements, timer: Timer): void {
  let deck: Card[] = buildDrawOrder(DECK);
  let drawn = 0;
  let hearts = 0;

  // Every real card drawn this session, in order, so players can step back to
  // review one instead of losing it the moment the next card is drawn.
  const history: Card[] = [];
  let historyIndex = -1;

  function resetDeck(): void {
    deck = buildDrawOrder(DECK);
  }

  function updateNavButtons(): void {
    el.prevBtn.disabled = historyIndex <= 0;
    el.nextBtn.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
  }

  function flipTo(render: () => void): void {
    render();
    el.card.classList.remove('flipped');
    void el.card.offsetWidth;
    requestAnimationFrame(() => el.card.classList.add('flipped'));
    playFlip();
  }

  function showCard(card: Card): void {
    flipTo(() => {
      el.catBadge.innerHTML = CATEGORY_ICONS[card.cat];
      el.catLabel.textContent = card.cat;
      setCardText(el.cardText, card.text);
    });
    timer.setCard(card.duration);
  }

  function drawCard(): void {
    if (deck.length === 0) {
      flipTo(() => {
        el.catLabel.textContent = '';
        el.catBadge.innerHTML = '';
        setCardText(el.cardText, 'خلصت كل الكروت — اضغطوا مرة أخرى للخلط من جديد');
      });
      timer.setCard(undefined);
      resetDeck();
      drawn = 0;
      el.statDrawn.textContent = String(drawn);
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
  });
}
