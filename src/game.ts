import { DECK, type Card } from './data/deck';
import { CATEGORY_ICONS } from './data/categories';
import { buildSessionDeck, orderSessionCards, type GameLength } from './data/session';
import { playFlip, playHeart, playFamilyHeart } from './sound';
import { hapticDraw, hapticHeart } from './haptics';
import { hasSession, advanceTurn, awardPointTo, getPlayers, getCurrentIndex } from './players';
import * as treasure from './treasure';
import { TREASURE_IMAGES } from './treasureAssets';
import type { Timer } from './timer';

export type { GameLength };

interface Elements {
  card: HTMLElement;
  catBadge: HTMLElement;
  catLabel: HTMLElement;
  cardText: HTMLElement;
  drawBtn: HTMLElement;
  heartBtn: HTMLButtonElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  statDrawn: HTMLElement;
  statHearts: HTMLElement;
  heartPop: HTMLElement;
  heartPopText: HTMLElement;
  lengthToggle: HTMLButtonElement;
  lengthMenu: HTMLElement;
  calmOnlyItem: HTMLButtonElement;
  treasureToggleItem: HTMLButtonElement;
  treasureRulesOverlay: HTMLElement;
  treasureRulesStartBtn: HTMLButtonElement;
  treasureBar: HTMLButtonElement;
  treasureBarFill: SVGPathElement;
  treasureMapOverlay: HTMLElement;
  treasureMap: HTMLElement;
  treasureMapStatus: HTMLElement;
  treasureMapCloseBtn: HTMLButtonElement;
  treasurePop: HTMLElement;
  treasurePopIcon: HTMLElement;
  treasurePopText: HTMLElement;
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

  const SURPRISE_ICON: Record<treasure.SurpriseKind, string> = {
    back2: '⬅️',
    jump3: '➡️',
    doubleNext: '✨',
  };
  const SURPRISE_TEXT: Record<treasure.SurpriseKind, string> = {
    back2: 'مفاجأة! تراجعتم خطوتين على مسار الكنز.',
    jump3: 'مفاجأة! قفزتم 3 خطوات إضافية على مسار الكنز.',
    doubleNext: 'مفاجأة! الخطوة القادمة على مسار الكنز مضاعفة.',
  };

  function showTreasurePop(icon: string, text: string): void {
    el.treasurePopIcon.textContent = icon;
    el.treasurePopText.textContent = text;
    el.treasurePop.classList.remove('show');
    void el.treasurePop.offsetWidth;
    el.treasurePop.classList.add('show');
  }

  // `popupDelayMs` staggers the treasure popup after a competing one:
  // advanceOnPoint() fires right alongside showCelebrationPop() (the
  // "أحسنت يا..." pop), and both are full-screen centered overlays that
  // would otherwise land on top of each other at the exact same moment.
  function handleTreasureResult(result: ReturnType<typeof treasure.advanceOnDraw>, popupDelayMs = 0): void {
    renderTreasureBar();
    if (!result.justReached && !result.station && !result.event) return;

    const showPopup = () => {
      // Reaching the treasure is the biggest news, so it wins if it
      // happens alongside a station or surprise tile (rare, but possible
      // with a jump3 tile right before the end).
      if (result.justReached) {
        showTreasurePop('🏆', 'وصلتم للكنز معًا! 🎉');
      } else if (result.station) {
        const openPool = DECK.filter((c) => c.cat === 'قلوب مفتوحة');
        const revealed = openPool[Math.floor(Math.random() * openPool.length)];
        showTreasurePop('🎁', `محطة كنز! ${revealed.text}`);
      } else if (result.event) {
        showTreasurePop(SURPRISE_ICON[result.event.kind], SURPRISE_TEXT[result.event.kind]);
      }
    };

    if (popupDelayMs > 0) window.setTimeout(showPopup, popupDelayMs);
    else showPopup();
  }

  function renderTreasureBar(): void {
    const active = treasure.isEnabled();
    el.treasureBar.hidden = !active;
    if (!active) return;
    const { currentStep, pathLength } = treasure.getProgress();
    const pct = pathLength > 0 ? Math.min(100, (currentStep / pathLength) * 100) : 0;
    const total = el.treasureBarFill.getTotalLength();
    el.treasureBarFill.style.strokeDasharray = `${total}`;
    el.treasureBarFill.style.strokeDashoffset = `${total * (1 - pct / 100)}`;
  }

  // Hand-drawn winding route rather than a straight bar — a real map, per
  // the user's explicit ask, with a path that curves like the reference
  // artwork instead of a flat progress strip. Markers are positioned along
  // this exact curve via CSS motion-path (offset-path/offset-distance),
  // which places them by *arc length* percentage — matching the SVG
  // <path> stroke-dasharray dots, so a marker at 40% sits on the 40%-along
  // point of the drawn line, on curves too, not just straight segments.
  //
  // offset-path's path() coordinates are literal CSS pixels in the
  // containing block, *not* scaled by an SVG viewBox — so .treasure-svg-wrap
  // is fixed at exactly this coordinate space's size (260×370px) rather
  // than left responsive, or the markers and the drawn line would drift
  // apart on different screen widths.
  const TREASURE_MAP_W = 260;
  const TREASURE_MAP_H = 370;
  const TREASURE_PATH_D =
    'M 228 22 C 163 13, 103 34, 112 73 C 120 112, 189 103, 194 142 ' +
    'C 198 181, 86 172, 69 215 C 52 258, 138 258, 146 297 ' +
    'C 153 327, 95 331, 82 348';

  // The full map draws a small, fixed number of markers (stations + surprise
  // tiles + the chest + the current position) positioned along the curve by
  // percentage, rather than one element per path step — a 200+ step path
  // would otherwise mean 200+ DOM nodes.
  function renderTreasureMap(): void {
    const { currentStep, pathLength, stations, surprises, reachedTreasure } = treasure.getProgress();
    el.treasureMap.replaceChildren();
    if (pathLength === 0) return;

    const svgWrap = document.createElement('div');
    svgWrap.className = 'treasure-svg-wrap';
    svgWrap.innerHTML = `
      <svg viewBox="0 0 ${TREASURE_MAP_W} ${TREASURE_MAP_H}" class="treasure-route-svg" aria-hidden="true">
        <path d="${TREASURE_PATH_D}" class="treasure-route-line" />
        <path d="${TREASURE_PATH_D}" class="treasure-route-fill" id="treasureRouteFill" />
      </svg>
    `;
    el.treasureMap.appendChild(svgWrap);

    // stroke-dasharray/dashoffset need the path's real drawn length in SVG
    // units (getTotalLength()), not a guessed round number, or the "filled"
    // portion wouldn't actually line up with the percentage it's meant to
    // represent.
    const fillPath = svgWrap.querySelector<SVGPathElement>('#treasureRouteFill')!;
    const totalLength = fillPath.getTotalLength();
    const progressPct = Math.min(100, (currentStep / pathLength) * 100);
    fillPath.style.strokeDasharray = `${totalLength}`;
    fillPath.style.strokeDashoffset = `${totalLength * (1 - progressPct / 100)}`;

    function addMarker(position: number, cls: string, src: string, label: string, size: number): void {
      const marker = document.createElement('img');
      marker.src = src;
      marker.className = `treasure-marker ${cls}`;
      marker.style.width = `${size}px`;
      marker.style.offsetPath = `path('${TREASURE_PATH_D}')`;
      marker.style.offsetDistance = `${Math.min(100, (position / pathLength) * 100)}%`;
      // Fixed upright orientation -- offset-path's default rotates the
      // element to match the curve's tangent, which would tilt these icons
      // as they follow the winding line.
      marker.style.offsetRotate = '0deg';
      marker.setAttribute('aria-label', label);
      marker.setAttribute('alt', label);
      svgWrap.appendChild(marker);
    }

    stations.forEach((s, i) => {
      addMarker(s.position, s.triggered ? 'treasure-marker-done' : '', TREASURE_IMAGES.stations[i], 'محطة', 34);
    });
    for (const s of surprises) {
      addMarker(
        s.position,
        s.triggered ? 'treasure-marker-done' : '',
        TREASURE_IMAGES[s.kind],
        'مفاجأة',
        26,
      );
    }
    addMarker(
      pathLength,
      'treasure-marker-chest',
      reachedTreasure ? TREASURE_IMAGES.chestOpen : TREASURE_IMAGES.chestClosed,
      'الكنز',
      44,
    );
    addMarker(
      Math.min(currentStep, pathLength),
      'treasure-marker-current',
      TREASURE_IMAGES.currentPosition,
      'موقعكم الآن',
      28,
    );

    el.treasureMapStatus.textContent = reachedTreasure
      ? 'وصلتم للكنز معًا! 🎉'
      : `${Math.min(currentStep, pathLength)} من ${pathLength} خطوة — الكنز ما زال ينتظركم.`;
  }

  function buildDeck(): Card[] {
    treasure.configureForLength(gameLength);
    if (calmOnly) return orderSessionCards(DECK.filter((c) => c.cat === 'قلوب مفتوحة'));
    const excludeNeeds3 = getPlayers().length < 3;
    return buildSessionDeck(DECK, gameLength, excludeNeeds3);
  }

  let deck: Card[] = buildDeck();
  let drawn = 0;
  let hearts = 0;

  // Every real card drawn this session, in order, so players can step back to
  // review one instead of losing it the moment the next card is drawn.
  const history: Card[] = [];
  let historyIndex = -1;

  function updateNavButtons(): void {
    el.prevBtn.disabled = historyIndex <= 0;
    // "Next" always has something to do once a card has been drawn: step
    // forward through history if we've stepped back from it, otherwise draw
    // a new card — so it's only ever disabled before the very first draw,
    // never in a state that needs explaining.
    el.nextBtn.disabled = historyIndex < 0;
    // "لهذه اللحظة" needs an actual moment (a drawn card) to refer to — stays
    // disabled on the pre-first-draw card back, where a tap would otherwise
    // register a heart with no real card behind it.
    el.heartBtn.disabled = historyIndex < 0;
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
    flipTo(() => {
      el.catBadge.innerHTML = CATEGORY_ICONS[card.cat];
      el.catLabel.textContent = card.cat;
      setCardText(el.cardText, card.text);
    });
    timer.setCard(card.duration);
  }

  function drawCard(): void {
    if (deck.length === 0) {
      // Every deck now has a defined size (the chosen game length), with or
      // without registered players — running out of cards finishes the
      // session, so this always goes to the closing screen instead of the
      // old classic-mode "shuffle again" filler.
      onEndSession();
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

    // Locks the toggle regardless of whether رحلة الكنز is even on this
    // session — once a real card has been drawn, switching it on or off
    // mid-session would silently invalidate whatever progress is (or isn't)
    // being tracked, so the choice made before the first draw is final.
    treasure.lock();
    if (treasure.isEnabled()) handleTreasureResult(treasure.advanceOnDraw(next.cat));
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
    const name = getPlayers()[index].name;
    awardPointTo(index);
    renderTurnBar();
    showCelebrationPop(`أحسنت يا ${name}! ❤️`);
    playHeart();
    if (treasure.isEnabled()) handleTreasureResult(treasure.advanceOnPoint(), 1300);
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
    el.treasureToggleItem.classList.toggle('active', treasure.isEnabled());
    el.treasureToggleItem.setAttribute('aria-checked', String(treasure.isEnabled()));
    // A dot on the "⋮" button is the only always-visible cue once a
    // non-default choice is active, since the menu itself stays closed
    // the rest of the time.
    el.lengthToggle.classList.toggle('has-filter', calmOnly || treasure.isEnabled() || gameLength !== 'short');
  }

  el.lengthMenu.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.filter-menu-item');
    if (!item) return;

    if (item === el.calmOnlyItem) {
      // قلوب مفتوحة فقط and رحلة الكنز are mutually exclusive (every card
      // would give the same fixed step count, defeating the ~two-thirds
      // odds the path length is tuned for) — but once treasure is locked
      // in for the session, there's no way to turn it off to make room, so
      // the toggle is refused rather than silently breaking that exclusion.
      if (treasure.isEnabled() && treasure.isLocked()) return;
      calmOnly = !calmOnly;
      if (calmOnly) treasure.setEnabled(false);
    } else if (item === el.treasureToggleItem) {
      if (treasure.isLocked()) return;
      const turningOn = !treasure.isEnabled();
      treasure.setEnabled(turningOn);
      if (turningOn) {
        calmOnly = false;
        el.treasureRulesOverlay.hidden = false;
      }
    } else if (item.dataset.length) {
      gameLength = item.dataset.length as GameLength;
    } else {
      return;
    }

    refreshLengthMenuUi();
    // Only affects the pool future draws come from — the card on screen and
    // history stay put until the next draw.
    deck = buildDeck();
    renderTreasureBar();
    closeLengthMenu();
  });

  el.treasureRulesStartBtn.addEventListener('click', () => {
    el.treasureRulesOverlay.hidden = true;
  });

  el.treasureBar.addEventListener('click', () => {
    renderTreasureMap();
    el.treasureMapOverlay.hidden = false;
  });
  el.treasureMapCloseBtn.addEventListener('click', () => {
    el.treasureMapOverlay.hidden = true;
  });

  document.addEventListener('click', (e) => {
    if (!el.lengthMenu.hidden && !el.lengthMenu.contains(e.target as Node)) closeLengthMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.lengthMenu.hidden) closeLengthMenu();
  });

  el.endSessionBtn.addEventListener('click', onEndSession);

  renderTurnBar();
  renderTreasureBar();

  return {
    notifySessionChanged(): void {
      firstDrawPending = true;
      renderTurnBar();
      // Covers both a genuinely new session (already zeroed, so this is a
      // no-op) and restarting from the closing screen ("🔁 جولة جديدة") —
      // that one needs an actual reset, or the draw count would keep
      // climbing past the previous round's total and "السابق" would still
      // walk back into cards from before the restart.
      drawn = 0;
      el.statDrawn.textContent = String(drawn);
      history.length = 0;
      historyIndex = -1;
      el.card.classList.remove('flipped');
      timer.setCard(undefined);
      updateNavButtons();
      // initGame() runs (and builds the initial deck) before any players
      // exist — the needs3 pool check only sees the real registered count
      // from here on, once a session actually starts or restarts.
      deck = buildDeck();
      // buildDeck() already reconfigures the path layout for the current
      // length — this just refreshes the strip to reflect the reset.
      renderTreasureBar();
    },
  };
}
