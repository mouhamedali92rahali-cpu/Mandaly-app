const STORAGE_KEY = 'mandaly-intro-seen';

function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // no persistence available — the checkbox just won't stick between visits.
  }
}

export interface IntroElements {
  appShell: HTMLElement;
  overlay: HTMLElement;
  welcomePage: HTMLElement;
  rulesPage: HTMLElement;
  nextBtn: HTMLButtonElement;
  startBtn: HTMLButtonElement;
  dontShowAgainRow: HTMLElement;
  dontShowAgain: HTMLInputElement;
  helpBtn: HTMLButtonElement;
}

export function initIntro(el: IntroElements): void {
  // The help button can reopen the rules page any time after onboarding is
  // done; when it does, the button reads "إغلاق" and just dismisses the
  // overlay instead of revealing the game (which is already showing).
  let mode: 'onboarding' | 'reopened' = 'onboarding';

  function closeOverlay(): void {
    el.overlay.classList.add('overlay-hidden');
    window.setTimeout(() => {
      el.overlay.hidden = true;
    }, 300);
  }

  function openOverlay(): void {
    el.overlay.hidden = false;
    void el.overlay.offsetWidth;
    el.overlay.classList.remove('overlay-hidden');
  }

  function revealGame(): void {
    el.appShell.hidden = false;
    void el.appShell.offsetWidth;
    el.appShell.classList.add('shell-visible');
  }

  function goToRulesPage(): void {
    el.welcomePage.hidden = true;
    el.welcomePage.classList.remove('active');
    el.rulesPage.hidden = false;
    void el.rulesPage.offsetWidth;
    el.rulesPage.classList.add('active');
  }

  el.nextBtn.addEventListener('click', goToRulesPage);

  el.startBtn.addEventListener('click', () => {
    if (mode === 'onboarding') {
      if (el.dontShowAgain.checked) markIntroSeen();
      closeOverlay();
      revealGame();
    } else {
      closeOverlay();
    }
  });

  el.helpBtn.addEventListener('click', () => {
    mode = 'reopened';
    el.startBtn.textContent = 'إغلاق';
    el.dontShowAgainRow.hidden = true;
    el.welcomePage.hidden = true;
    el.welcomePage.classList.remove('active');
    el.rulesPage.hidden = false;
    el.rulesPage.classList.add('active');
    openOverlay();
  });

  if (hasSeenIntro()) {
    el.overlay.hidden = true;
    el.appShell.hidden = false;
    el.appShell.classList.add('shell-visible');
  } else {
    el.appShell.hidden = true;
    el.welcomePage.hidden = false;
    el.welcomePage.classList.add('active');
    el.overlay.hidden = false;
  }
}
