import { startSession } from './players';

export interface PlayerSetupElements {
  form: HTMLFormElement;
  input: HTMLInputElement;
  chipList: HTMLElement;
  startBtn: HTMLButtonElement;
}

const MAX_PLAYERS = 12;

export function initPlayerSetup(el: PlayerSetupElements, onDone: () => void): void {
  let names: string[] = [];

  function renderChips(): void {
    el.chipList.replaceChildren();
    for (const [index, name] of names.entries()) {
      const chip = document.createElement('span');
      chip.className = 'player-chip';

      const label = document.createElement('span');
      label.textContent = name;
      chip.appendChild(label);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'player-chip-remove';
      remove.setAttribute('aria-label', `إزالة ${name}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        names.splice(index, 1);
        renderChips();
      });
      chip.appendChild(remove);

      el.chipList.appendChild(chip);
    }
    el.input.disabled = names.length >= MAX_PLAYERS;
  }

  function addName(): void {
    const name = el.input.value.trim();
    if (!name || names.length >= MAX_PLAYERS) return;
    names.push(name);
    el.input.value = '';
    renderChips();
    el.input.focus();
  }

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    addName();
  });

  el.startBtn.addEventListener('click', () => {
    // Zero names typed in is a valid choice, not an error — it just means
    // "skip turns/scores and play the classic way", same as before this
    // feature existed.
    if (names.length > 0) startSession(names);
    onDone();
  });
}
