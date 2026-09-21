import { playTimerEnd, playTick } from './sound';

interface TimerElements {
  row: HTMLElement;
  display: HTMLElement;
  barFill: HTMLElement;
  toggleBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
}

const TICK_MS = 100;

function formatTime(seconds: number): string {
  const secs = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(secs / 60);
  const r = secs % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : String(secs);
}

export interface Timer {
  /** Shows and resets the timer for a duration (seconds), or hides it entirely. */
  setCard(duration: number | undefined): void;
}

export function initTimer(el: TimerElements): Timer {
  let duration = 0;
  let remaining = 0;
  let running = false;
  let endAt = 0;
  let intervalId: number | undefined;
  // The whole-second count last ticked, so a tick fires once per second
  // crossed rather than every TICK_MS poll — and never for the starting
  // second itself, only once the count actually drops.
  let lastTickSecond: number | undefined;

  function render(): void {
    el.display.textContent = formatTime(remaining);
    el.barFill.style.width = `${duration > 0 ? (remaining / duration) * 100 : 0}%`;
  }

  function stop(): void {
    running = false;
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  }

  function tick(): void {
    remaining = Math.max(0, (endAt - Date.now()) / 1000);
    render();

    const currentSecond = Math.ceil(remaining);
    if (remaining > 0 && currentSecond < (lastTickSecond ?? currentSecond)) {
      lastTickSecond = currentSecond;
      playTick();
    }

    if (remaining <= 0) {
      stop();
      el.toggleBtn.textContent = 'ابدأ';
      el.row.classList.add('timer-done');
      playTimerEnd();
    }
  }

  function start(): void {
    if (remaining <= 0) remaining = duration;
    endAt = Date.now() + remaining * 1000;
    running = true;
    lastTickSecond = Math.ceil(remaining);
    el.row.classList.remove('timer-done');
    el.toggleBtn.textContent = 'إيقاف';
    intervalId = window.setInterval(tick, TICK_MS);
  }

  function pause(): void {
    stop();
    el.toggleBtn.textContent = 'استئناف';
  }

  el.toggleBtn.addEventListener('click', () => {
    if (running) pause();
    else start();
  });

  el.resetBtn.addEventListener('click', () => {
    stop();
    remaining = duration;
    el.row.classList.remove('timer-done');
    el.toggleBtn.textContent = 'ابدأ';
    render();
  });

  function setCard(cardDuration: number | undefined): void {
    stop();
    el.row.classList.remove('timer-done');
    if (!cardDuration) {
      el.row.hidden = true;
      return;
    }
    duration = cardDuration;
    remaining = cardDuration;
    el.toggleBtn.textContent = 'ابدأ';
    el.row.hidden = false;
    render();
  }

  return { setCard };
}
