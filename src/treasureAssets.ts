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
