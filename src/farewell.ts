import { getPlayers, getStandings, restartSession, endSession } from './players';
import { playFarewellFanfare } from './sound';

export interface FarewellElements {
  overlay: HTMLElement;
  subtext: HTMLElement;
  standingsList: HTMLElement;
  restartBtn: HTMLButtonElement;
  endBtn: HTMLButtonElement;
}

const MEDALS = ['🥇', '🥈', '🥉'];

const WITH_PLAYERS_SUBTEXT = 'شكرًا لأنكم قضيتم هذا الوقت معًا. إليكم نتائج هذه الجولة:';
const CLASSIC_SUBTEXT = 'شكرًا لمشاركتكم في هذه الجلسة. نتمنى أن تكون التجربة أعجبتكم 🤍';
const WITH_PLAYERS_RESTART_LABEL = '🔁 جولة جديدة بنفس اللاعبين';
const CLASSIC_RESTART_LABEL = '🔁 جولة جديدة';

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
    // The classic (no registered players) mode has no scores to show —
    // just a generic thank-you instead of standings that would otherwise
    // render as an empty list.
    const withPlayers = getPlayers().length > 0;
    el.subtext.textContent = withPlayers ? WITH_PLAYERS_SUBTEXT : CLASSIC_SUBTEXT;
    el.standingsList.hidden = !withPlayers;
    el.restartBtn.textContent = withPlayers ? WITH_PLAYERS_RESTART_LABEL : CLASSIC_RESTART_LABEL;
    if (withPlayers) renderStandings();

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
