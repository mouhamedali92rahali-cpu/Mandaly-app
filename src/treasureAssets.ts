// Hand-drawn treasure-chest artwork the user generated (Gemini/ChatGPT,
// matching the app's gold-line mandala style) and asked to be used as the
// real رحلة الكنز map imagery instead of a flat progress bar with emoji.
import chestClosed from './assets/treasure/chest_closed.png';
import chestOpen from './assets/treasure/chest_open.png';
import station1 from './assets/treasure/station1.png';
import station2 from './assets/treasure/station2.png';
import station3 from './assets/treasure/station3.png';
import arrowBack from './assets/treasure/arrow_back.png';
import arrowFwd from './assets/treasure/arrow_fwd.png';
import sparkle from './assets/treasure/sparkle.png';
import heartPin from './assets/treasure/heart_pin.png';

export const TREASURE_IMAGES = {
  chestClosed,
  chestOpen,
  stations: [station1, station2, station3],
  back2: arrowBack,
  jump3: arrowFwd,
  doubleNext: sparkle,
  currentPosition: heartPin,
};

// A gentle wave (viewBox 0 0 300 20) for the small persistent strip above
// the card, echoing the full map's winding route instead of a flat bar.
// Starts at x=300 (right edge) so the RTL fill direction matches the main
// map's — see renderTreasureBar()'s stroke-dashoffset math in game.ts.
// Shared between main.ts (draws it) and game.ts (animates its fill) so
// both always agree on the same curve.
export const TREASURE_MINI_WAVE_D =
  'M 300 10 Q 285 2, 270 10 T 240 10 T 210 10 T 180 10 T 150 10 T 120 10 T 90 10 T 60 10 T 30 10 T 0 10';
