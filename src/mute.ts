import { isMuted, setMuted } from './sound';

export function initMuteToggle(button: HTMLButtonElement): void {
  function render(): void {
    const muted = isMuted();
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? 'الصوت مكتوم — اضغط للتشغيل' : 'الصوت مشغّل — اضغط للكتم';
  }

  render();

  button.addEventListener('click', () => {
    setMuted(!isMuted());
    render();
  });
}
