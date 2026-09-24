interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallElements {
  installBtn: HTMLButtonElement;
  installHint: HTMLElement;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const IOS_HINT_TEXT = '📲 اضغطوا زر المشاركة ⬆️ أسفل الشاشة، ثم اختاروا "إضافة إلى الشاشة الرئيسية".';
const GENERIC_HINT_TEXT = '📲 افتحوا قائمة المتصفح (⋮)، ثم اختاروا "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".';

/**
 * The icon button (⬇️ in the top-controls row) is always shown, not gated
 * on the browser's own beforeinstallprompt event — that event is
 * unreliable in practice (inconsistent timing, engagement heuristics
 * decided by the browser) and never fires at all on iOS Safari, so a
 * button that only appears once it fires can stay invisible for a real
 * customer indefinitely. Tapping it does the best available thing: the
 * real one-tap native prompt when the browser has actually offered one,
 * manual steps (shown in a small popup) otherwise.
 */
export function initInstallPrompt({ installBtn, installHint }: InstallElements): void {
  if (isStandalone()) return;

  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });

  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    installHint.hidden = true;
  });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  installHint.textContent = isIOS ? IOS_HINT_TEXT : GENERIC_HINT_TEXT;

  installBtn.hidden = false;

  installBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      await prompt.userChoice;
      return;
    }
    installHint.hidden = !installHint.hidden;
  });

  document.addEventListener('click', (e) => {
    if (!installHint.hidden && !installHint.contains(e.target as Node) && e.target !== installBtn) {
      installHint.hidden = true;
    }
  });
}
