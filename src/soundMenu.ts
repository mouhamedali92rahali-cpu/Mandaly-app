import { isMuted, setMuted, isMusicEnabled, setMusicEnabled, isSpeechEnabled, setSpeechEnabled } from './sound';

export interface SoundMenuElements {
  toggle: HTMLButtonElement;
  menu: HTMLElement;
  sfxItem: HTMLButtonElement;
  musicItem: HTMLButtonElement;
  speechItem: HTMLButtonElement;
}

// A dropdown (same pattern as the "⋮" filter menu) with two independent
// switches, instead of a second icon button, so short effects and the
// continuous background music can be muted separately without crowding the
// top bar with a third control.
export function initSoundMenu(el: SoundMenuElements): void {
  function render(): void {
    const sfxOn = !isMuted();
    const musicOn = isMusicEnabled();
    const speechOn = isSpeechEnabled();

    el.toggle.textContent = sfxOn ? '🔊' : '🔇';
    el.toggle.classList.toggle('has-music', musicOn || speechOn);

    el.sfxItem.classList.toggle('active', sfxOn);
    el.sfxItem.setAttribute('aria-checked', String(sfxOn));
    el.musicItem.classList.toggle('active', musicOn);
    el.musicItem.setAttribute('aria-checked', String(musicOn));
    el.speechItem.classList.toggle('active', speechOn);
    el.speechItem.setAttribute('aria-checked', String(speechOn));
  }

  function closeMenu(): void {
    el.menu.hidden = true;
    el.toggle.setAttribute('aria-expanded', 'false');
  }

  function openMenu(): void {
    el.menu.hidden = false;
    el.toggle.setAttribute('aria-expanded', 'true');
  }

  render();

  el.toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (el.menu.hidden) openMenu();
    else closeMenu();
  });

  el.sfxItem.addEventListener('click', () => {
    setMuted(!isMuted());
    render();
  });

  el.musicItem.addEventListener('click', () => {
    setMusicEnabled(!isMusicEnabled());
    render();
  });

  el.speechItem.addEventListener('click', () => {
    setSpeechEnabled(!isSpeechEnabled());
    render();
  });

  document.addEventListener('click', (e) => {
    if (!el.menu.hidden && !el.menu.contains(e.target as Node)) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.menu.hidden) closeMenu();
  });
}
