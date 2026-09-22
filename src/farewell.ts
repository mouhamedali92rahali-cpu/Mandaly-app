import { getStandings, restartSession, endSession } from './players';
import { playFarewellFanfare } from './sound';

export interface FarewellElements {
  overlay: HTMLElement;
  standingsList: HTMLElement;
  restartBtn: HTMLButtonElement;
  endBtn: HTMLButtonElement;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export interface Farewell {
  show: () => void;
}

export function initFarewell(el: FarewellElements, onRestart: () => void, onEnd: () => void): Farewell {
  function renderStandings(): void {
    el.standingsList.replaceChildren();
    const standings = getStandings();
    standings.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'standing-row';
      if (index === 0 && player.score > 0) row.classList.add('standing-winner');

      const rank = document.createElement('span');
      rank.className = 'standing-rank';
      rank.textContent = MEDALS[index] ?? String(index + 1);
      row.appendChild(rank);

      const name = document.createElement('span');
      name.className = 'standing-name';
      name.textContent = player.name;
      row.appendChild(name);

      const score = document.createElement('span');
      score.className = 'standing-score';
      score.textContent = `${player.score} ❤️`;
      row.appendChild(score);

      el.standingsList.appendChild(row);
    });
  }

  function show(): void {
    renderStandings();
    el.overlay.hidden = false;
    void el.overlay.offsetWidth;
    el.overlay.classList.remove('overlay-hidden');
    playFarewellFanfare();
  }

  function hide(): void {
    el.overlay.classList.add('overlay-hidden');
    window.setTimeout(() => {
      el.overlay.hidden = true;
    }, 300);
  }

  el.restartBtn.addEventListener('click', () => {
    restartSession();
    hide();
    onRestart();
  });

  el.endBtn.addEventListener('click', () => {
    endSession();
    hide();
    onEnd();
  });

  return { show };
}
