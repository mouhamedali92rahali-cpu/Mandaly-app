import { DECK, type Card } from './data/deck';
import { CATEGORY_ICONS } from './data/categories';

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Elements {
  card: HTMLElement;
  catBadge: HTMLElement;
  catLabel: HTMLElement;
  cardText: HTMLElement;
  drawBtn: HTMLElement;
  heartBtn: HTMLElement;
  statDrawn: HTMLElement;
  statHearts: HTMLElement;
  heartPop: HTMLElement;
}

export function initGame(el: Elements): void {
  let deck: Card[] = shuffle(DECK);
  let drawn = 0;
  let hearts = 0;

  function resetDeck(): void {
    deck = shuffle(DECK);
  }

  function drawCard(): void {
    if (deck.length === 0) {
      el.catLabel.textContent = '';
      el.catBadge.innerHTML = '';
      el.cardText.textContent = 'خلصت كل الكروت — اضغطوا مرة أخرى للخلط من جديد';
      el.card.classList.remove('flipped');
      void el.card.offsetWidth;
      requestAnimationFrame(() => el.card.classList.add('flipped'));
      resetDeck();
      drawn = 0;
      el.statDrawn.textContent = String(drawn);
      return;
    }

    const next = deck.pop()!;
    el.catBadge.innerHTML = CATEGORY_ICONS[next.cat];
    el.catLabel.textContent = next.cat;
    el.cardText.textContent = next.text;
    drawn++;
    el.statDrawn.textContent = String(drawn);

    el.card.classList.remove('flipped');
    void el.card.offsetWidth;
    requestAnimationFrame(() => el.card.classList.add('flipped'));
  }

  el.drawBtn.addEventListener('click', drawCard);
  el.card.addEventListener('click', drawCard);

  el.heartBtn.addEventListener('click', () => {
    hearts++;
    el.statHearts.textContent = String(hearts);
    el.heartPop.classList.remove('show');
    void el.heartPop.offsetWidth;
    el.heartPop.classList.add('show');
  });
}
