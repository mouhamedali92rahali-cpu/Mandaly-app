const STORAGE_KEY = 'mandaly-intro-seen';

// The welcome page greets players on every open, no exceptions; only the
// rules page is skippable, once dismissed with "don't show again" checked.
function hasSeenRules(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markRulesSeen(): void {
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
  playersPage: HTMLElement;
  startBtn: HTMLButtonElement;
  dontShowAgainRow: HTMLElement;
  dontShowAgain: HTMLInputElement;
  helpBtn: HTMLButtonElement;
}

export interface Intro {
  /** Called by the player-setup step once it's done — closes onboarding and
   * reveals the game, same as finishing onboarding used to happen inline. */
  finishOnboarding: () => void;
}

export function initIntro(el: IntroElements, onReveal?: () => void): Intro {
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
    // Always reached from a real click handler (the overlay tap or the
    // start button), so this is a safe, gesture-backed place to resume
    // background music if it was left on from a previous visit — audio
    // playback started outside a user gesture gets blocked by the browser.
    onReveal?.();
  }

  function goToRulesPage(): void {
    el.welcomePage.hidden = true;
    el.welcomePage.classList.remove('active');
    el.rulesPage.hidden = false;
    void el.rulesPage.offsetWidth;
    el.rulesPage.classList.add('active');
  }

  // "Who's playing" is a per-sitting choice, not a one-time explainer, so it
  // always shows — even on a visit that skips the rules page entirely.
  function goToPlayersPage(): void {
    el.welcomePage.hidden = true;
    el.welcomePage.classList.remove('active');
    el.rulesPage.hidden = true;
    el.rulesPage.classList.remove('active');
    el.playersPage.hidden = false;
    void el.playersPage.offsetWidth;
    el.playersPage.classList.add('active');
  }

  function finishOnboarding(): void {
    closeOverlay();
    revealGame();
  }

  function advanceFromWelcome(): void {
    if (hasSeenRules()) {
      goToPlayersPage();
    } else {
      goToRulesPage();
    }
  }

  // Tapping anywhere on the welcome screen advances it, not just the "التالي"
  // button — the button's own click bubbles here too, so one handler covers
  // both. Gated to the welcome page only, so it never fires while the rules
  // page (reused for onboarding and for the "؟" help reopen) is showing.
  el.overlay.addEventListener('click', () => {
    if (el.welcomePage.classList.contains('active')) advanceFromWelcome();
  });

  el.startBtn.addEventListener('click', () => {
    if (mode === 'onboarding') {
      if (el.dontShowAgain.checked) markRulesSeen();
      goToPlayersPage();
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

  el.appShell.hidden = true;
  el.welcomePage.hidden = false;
  el.welcomePage.classList.add('active');
  el.overlay.hidden = false;

  return { finishOnboarding };
}
