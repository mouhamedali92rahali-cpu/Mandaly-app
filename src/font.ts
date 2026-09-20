const STORAGE_KEY = 'mandaly-font';
type FontChoice = 'changa' | 'cairo';

const FONT_STACKS: Record<FontChoice, string> = {
  changa: "'Changa', sans-serif",
  cairo: "'Cairo', sans-serif",
};

function getSavedFont(): FontChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'changa' || saved === 'cairo') return saved;
  } catch {
    // localStorage unavailable (private browsing, etc.) — use the default.
  }
  return 'changa';
}

export function initFontToggle(button: HTMLButtonElement): void {
  let current = getSavedFont();

  function apply(): void {
    document.documentElement.style.setProperty('--font-question', FONT_STACKS[current]);
    button.title =
      current === 'changa'
        ? 'الخط الحالي: Changa — اضغط للتبديل إلى Cairo'
        : 'الخط الحالي: Cairo — اضغط للتبديل إلى Changa';
  }

  apply();

  button.addEventListener('click', () => {
    current = current === 'changa' ? 'cairo' : 'changa';
    apply();
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch {
      // no persistence available — the choice still applies for this visit.
    }
  });
}
