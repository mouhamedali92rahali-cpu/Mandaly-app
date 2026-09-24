import './style.css';
import { initGame, type Game } from './game';
import { initInstallPrompt } from './install';
import { initFontToggle } from './font';
import { initSoundMenu } from './soundMenu';
import { resumeMusicIfEnabled } from './sound';
import { initTimer } from './timer';
import { initIntro } from './intro';
import { initPlayerSetup } from './playerSetup';
import { initFarewell, type Farewell } from './farewell';
import { initActivationGate } from './activation';
import { CATEGORY_ICONS } from './data/categories';
import logoMark from './assets/logo-mark.png';

const cardCorners = `
  <span class="corner corner-tl"></span>
  <span class="corner corner-tr"></span>
  <span class="corner corner-bl"></span>
  <span class="corner corner-br"></span>
`;

// Matches the gold-stroke style of CATEGORY_ICONS rather than relying on an
// emoji glyph, whose color and weight aren't controllable and render flat/
// dull on some devices.
const DOWNLOAD_ICON = `<svg viewBox="0 0 80 80"><path d="M40 14 L40 52 M24 36 L40 54 L56 36 M18 66 L62 66" fill="none" stroke="#c9a24b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const categoryRow = (cat: keyof typeof CATEGORY_ICONS, desc: string) => `
  <div class="intro-cat-row">
    <span class="cat-badge intro-cat-badge">${CATEGORY_ICONS[cat]}</span>
    <span class="intro-cat-text"><b>${cat}</b> — ${desc}</span>
  </div>
`;

const LENGTH_OPTIONS = [
  { length: 'short', icon: '⏱️', label: 'قصيرة', count: 70 },
  { length: 'medium', icon: '⏳', label: 'متوسطة', count: 150 },
  { length: 'long', icon: '🌙', label: 'طويلة', count: 199 },
] as const;

const lengthMenuItem = (opt: (typeof LENGTH_OPTIONS)[number]) => `
  <button
    class="filter-menu-item${opt.length === 'short' ? ' active' : ''}"
    data-length="${opt.length}"
    role="menuitemradio"
    aria-checked="${opt.length === 'short'}"
  >
    <span class="filter-item-icon">${opt.icon}</span>
    <span>${opt.label} — ${opt.count} كرت</span>
  </button>
`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="activation-gate" id="activationGate" hidden>
    <div class="activation-card">
      ${cardCorners}
      <img class="intro-logo" src="${logoMark}" alt="Mandaly" />
      <h2 class="intro-title">فعّل نسختك من Mandaly</h2>
      <p class="intro-text">أدخلوا كود التفعيل المطبوع داخل الصندوق لتشغيل اللعبة على هذا الجهاز.</p>
      <form id="activationForm">
        <label for="activationInput" class="sr-only">كود التفعيل</label>
        <input
          class="activation-input"
          id="activationInput"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="MDLY-XXXX-XXXX"
          maxlength="14"
        />
        <p class="activation-error" id="activationError" hidden></p>
        <button class="btn btn-primary" id="activationSubmit" type="submit">تفعيل</button>
      </form>
      <p class="activation-hint">يُفعَّل الكود مرة واحدة تلقائيًا لكل جهاز — بحد أقصى جهازين لكل صندوق.</p>
    </div>
  </div>

  <div class="intro-overlay" id="introOverlay" hidden>
    <div class="intro-page" id="introWelcome">
      ${cardCorners}
      <img class="intro-logo" src="${logoMark}" alt="Mandaly" />
      <h2 class="intro-title">أهلًا بكم في Mandaly</h2>
      <p class="intro-text">هنا، تتحوّل اللحظات العادية إلى ذكريات تستحق أن تُروى.</p>
      <p class="intro-text">كل بطاقة تسحبونها تقرّبكم خطوة من بعضكم — سؤال يفتح بابًا، تحدٍّ يجمعكم على الضحك، ومفاجأة تكسر الروتين.</p>
      <p class="intro-text intro-text-emphasis">هذه ليست لعبة تُلعب لتُربح، بل جلسة تُعاش لتُتذكر.</p>
      <p class="intro-text">💡 يمكنكم تثبيت Mandaly على هاتفكم كتطبيق حقيقي (أيقونة على الشاشة الرئيسية، ويعمل حتى بلا إنترنت) — زر التنزيل الذهبي بين "السابق" و"التالي" أثناء اللعب.</p>
      <button class="btn btn-primary" id="introNextBtn">التالي</button>
    </div>

    <div class="intro-page" id="introRules" hidden>
      ${cardCorners}
      <h2 class="intro-title">كيف نلعب؟</h2>
      ${categoryRow('قلوب مفتوحة', 'حديث واستماع، بلا نقاط، بلا فوز أو خسارة')}
      ${categoryRow('حلبة العائلة', 'تخمين وتحدٍّ، بنقاط فردية بسيطة')}
      ${categoryRow('اقلب الطاولة', 'يغيّر قواعد البطاقة القادمة، لمفاجأة خفيفة')}
      <p class="intro-text">💡 يمكنكم أيضًا اختيار طول اللعبة (قصيرة/متوسطة/طويلة) من قائمة "⋮" أعلى الشاشة.</p>
      <p class="intro-text">اسحبوا بطاقة، اقرؤوها بصوت عالٍ، وطبّقوها معًا.</p>
      <p class="intro-text">وفي أي لحظة تشعرون فيها بالدفء أو الضحك، قولوا: "قلب لهذه اللحظة!" ❤️</p>
      <label class="intro-checkbox-row" id="dontShowAgainRow">
        <input type="checkbox" id="dontShowAgain" />
        <span>لا تعرض هذا مرة أخرى</span>
      </label>
      <button class="btn btn-primary" id="introStartBtn">لنبدأ!</button>
    </div>

    <div class="intro-page" id="introPlayers" hidden>
      ${cardCorners}
      <h2 class="intro-title">من يلعب اليوم؟</h2>
      <p class="intro-text">
        سجّلوا الأسماء لتتبّع الأدوار — أو تخطّوا هذه الخطوة للعب الكلاسيكي بعدّاد مشترك.
      </p>
      <p class="intro-text">💡 خلال اللعب، اضغطوا على اسم أي لاعب في الشريط العلوي لمنحه نقطة عندما يستحقها.</p>
      <form id="playerForm" class="player-form">
        <label for="playerNameInput" class="sr-only">اسم اللاعب</label>
        <input
          class="player-input"
          id="playerNameInput"
          type="text"
          placeholder="اسم اللاعب"
          maxlength="18"
          autocomplete="off"
        />
        <button class="player-add-btn" type="submit" aria-label="إضافة لاعب">+</button>
      </form>
      <div class="player-chip-list" id="playerChipList"></div>
      <button class="btn btn-primary" id="playersStartBtn">ابدأ اللعب</button>
    </div>
  </div>

  <div class="intro-overlay" id="farewellOverlay" hidden>
    <div class="intro-page active" id="farewellPage">
      ${cardCorners}
      <img class="intro-logo" src="${logoMark}" alt="Mandaly" />
      <h2 class="intro-title">جلسة تستحق أن تُروى ✨</h2>
      <p class="intro-text" id="farewellSubtext">شكرًا لأنكم قضيتم هذا الوقت معًا. إليكم نتائج هذه الجولة:</p>
      <div class="standings-list" id="standingsList"></div>
      <button class="btn btn-primary" id="farewellRestartBtn">🔁 جولة جديدة</button>
      <button class="btn btn-heart" id="farewellEndBtn">إنهاء الجلسة</button>
    </div>
  </div>

  <div class="intro-overlay" id="goodbyeOverlay" hidden>
    <div class="intro-page active" id="goodbyePage">
      ${cardCorners}
      <img class="intro-logo" src="${logoMark}" alt="Mandaly" />
      <h2 class="intro-title">إلى اللقاء 🤍</h2>
      <p class="intro-text">شكرًا لكم على هذا الوقت الجميل معًا.</p>
      <p class="intro-text intro-text-emphasis">يمكنكم إغلاق التطبيق الآن.</p>
    </div>
  </div>

  <div class="app-shell" id="appShell" hidden>
    <div class="top-controls">
      <button class="icon-btn" id="fontToggle" aria-label="تبديل خط نص الأسئلة">Aa</button>
      <div class="icon-menu-anchor">
        <button class="icon-btn" id="soundToggle" aria-haspopup="true" aria-expanded="false" aria-label="إعدادات الصوت">🔊</button>
        <div class="filter-menu sound-menu" id="soundMenu" role="menu" hidden>
          <button class="filter-menu-item" id="sfxToggleItem" role="menuitemcheckbox" aria-checked="true">
            <span class="filter-item-icon">🔔</span>
            <span>المؤثرات الصوتية</span>
          </button>
          <button class="filter-menu-item" id="musicToggleItem" role="menuitemcheckbox" aria-checked="false">
            <span class="filter-item-icon">🎵</span>
            <span>الموسيقى الخلفية</span>
          </button>
        </div>
      </div>
      <button class="icon-btn" id="helpBtn" aria-label="كيف نلعب؟">؟</button>
    </div>

    <div class="top-controls-right">
      <button class="icon-btn" id="lengthToggle" aria-haspopup="true" aria-expanded="false" aria-label="اختيار طول اللعبة">⋮</button>
      <div class="filter-menu" id="lengthMenu" role="menu" hidden>
        ${LENGTH_OPTIONS.map(lengthMenuItem).join('')}
        <div class="filter-menu-divider"></div>
        <button class="filter-menu-item" id="calmOnlyItem" role="menuitemcheckbox" aria-checked="false">
          <span class="filter-item-icon">🤍</span>
          <span>قلوب مفتوحة فقط</span>
        </button>
      </div>
    </div>

    <div class="wordmark">MANDALY</div>

    <div class="turn-bar" id="turnBar" hidden>
      <div class="turn-players" id="turnPlayers"></div>
      <button class="turn-end-btn" id="endSessionBtn" aria-label="إنهاء الجلسة وعرض النتائج">إنهاء</button>
    </div>

    <div class="stage" id="stage">
      <div class="stack-card s2"></div>
      <div class="stack-card s1"></div>
      <div class="card" id="card">
        <div class="card-inner" id="cardInner">
          <div class="face face-back">
            ${cardCorners}
            <img class="back-logo" src="${logoMark}" alt="Mandaly" />
            <div class="back-hint">اضغط لسحب كرت</div>
          </div>
          <div class="face face-front">
            ${cardCorners}
            <div class="cat-badge" id="catBadge"></div>
            <div class="cat-label" id="catLabel"></div>
            <div class="card-text" id="cardText"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="timer-row" id="timerRow" hidden>
      <div class="timer-bar"><div class="timer-bar-fill" id="timerBarFill"></div></div>
      <div class="timer-controls">
        <div class="timer-display" id="timerDisplay">0:00</div>
        <button class="timer-btn" id="timerToggle">ابدأ</button>
        <button class="timer-reset" id="timerReset" aria-label="إعادة ضبط المؤقت">↺</button>
      </div>
    </div>

    <div class="nav-row">
      <button class="btn-nav" id="prevBtn" aria-label="الكرت السابق" disabled>‹ السابق</button>
      <div class="icon-menu-anchor">
        <button class="icon-btn install-btn" id="installBtn" aria-label="تثبيت التطبيق على الهاتف">${DOWNLOAD_ICON}</button>
        <div class="filter-menu install-hint" id="installHint" role="note" hidden></div>
      </div>
      <button class="btn-nav" id="nextBtn" aria-label="الكرت التالي" disabled>التالي ›</button>
    </div>

    <div class="actions">
      <button class="btn btn-primary" id="drawBtn">اسحب كرت جديد</button>
      <button class="btn btn-heart" id="heartBtn">قلب لهذه اللحظة ❤️</button>
    </div>

    <div class="stats">
      <div>كروت سُحبت: <b id="statDrawn">0</b></div>
      <div>قلوب: <b id="statHearts">0</b></div>
    </div>

    <div class="heart-pop" id="heartPop">
      <div class="heart-pop-inner">
        <div class="heart-pop-icon">❤️</div>
        <div class="heart-pop-text" id="heartPopText">نحبكم برشا</div>
      </div>
    </div>
  </div>
`;

// Everything below only runs once the activation gate has let the player
// through — either immediately (already activated on this device) or right
// after a successful one-time activation call.
function initEverything(): void {
  const timer = initTimer({
    row: document.getElementById('timerRow')!,
    display: document.getElementById('timerDisplay')!,
    barFill: document.getElementById('timerBarFill') as HTMLElement,
    toggleBtn: document.getElementById('timerToggle') as HTMLButtonElement,
    resetBtn: document.getElementById('timerReset') as HTMLButtonElement,
  });

  // `game` and `farewell` are defined further down but reference each other
  // (ending a session shows the farewell page; restarting from that page
  // needs to refresh the game's turn indicator) — the indirection through
  // these forward-declared bindings breaks that cycle, since neither
  // callback actually runs until well after both are assigned.
  let game: Game;
  let farewell: Farewell;

  game = initGame(
    {
      card: document.getElementById('card')!,
      catBadge: document.getElementById('catBadge')!,
      catLabel: document.getElementById('catLabel')!,
      cardText: document.getElementById('cardText')!,
      drawBtn: document.getElementById('drawBtn')!,
      heartBtn: document.getElementById('heartBtn') as HTMLButtonElement,
      prevBtn: document.getElementById('prevBtn') as HTMLButtonElement,
      nextBtn: document.getElementById('nextBtn') as HTMLButtonElement,
      lengthToggle: document.getElementById('lengthToggle') as HTMLButtonElement,
      lengthMenu: document.getElementById('lengthMenu')!,
      calmOnlyItem: document.getElementById('calmOnlyItem') as HTMLButtonElement,
      statDrawn: document.getElementById('statDrawn')!,
      statHearts: document.getElementById('statHearts')!,
      heartPop: document.getElementById('heartPop')!,
      heartPopText: document.getElementById('heartPopText')!,
      turnBar: document.getElementById('turnBar')!,
      turnPlayers: document.getElementById('turnPlayers')!,
      endSessionBtn: document.getElementById('endSessionBtn') as HTMLButtonElement,
    },
    timer,
    () => farewell.show(),
  );

  initInstallPrompt({
    installBtn: document.getElementById('installBtn') as HTMLButtonElement,
    installHint: document.getElementById('installHint')!,
  });

  initFontToggle(document.getElementById('fontToggle') as HTMLButtonElement);
  initSoundMenu({
    toggle: document.getElementById('soundToggle') as HTMLButtonElement,
    menu: document.getElementById('soundMenu')!,
    sfxItem: document.getElementById('sfxToggleItem') as HTMLButtonElement,
    musicItem: document.getElementById('musicToggleItem') as HTMLButtonElement,
  });

  // Ending the session (from the farewell page) is meant to feel final, not
  // like an invitation to start over — a plain "close the app" isn't
  // something a web page can actually do on its own (window.close() is
  // blocked by every browser unless the tab was opened by a script), so
  // this shows a last, non-interactive goodbye screen instead and leaves
  // actually closing the tab/app to the player.
  function showGoodbye(): void {
    document.getElementById('goodbyeOverlay')!.hidden = false;
  }

  farewell = initFarewell(
    {
      overlay: document.getElementById('farewellOverlay')!,
      subtext: document.getElementById('farewellSubtext')!,
      standingsList: document.getElementById('standingsList')!,
      restartBtn: document.getElementById('farewellRestartBtn') as HTMLButtonElement,
      endBtn: document.getElementById('farewellEndBtn') as HTMLButtonElement,
    },
    () => game.notifySessionChanged(),
    showGoodbye,
  );

  const intro = initIntro(
    {
      appShell: document.getElementById('appShell')!,
      overlay: document.getElementById('introOverlay')!,
      welcomePage: document.getElementById('introWelcome')!,
      rulesPage: document.getElementById('introRules')!,
      playersPage: document.getElementById('introPlayers')!,
      startBtn: document.getElementById('introStartBtn') as HTMLButtonElement,
      dontShowAgainRow: document.getElementById('dontShowAgainRow')!,
      dontShowAgain: document.getElementById('dontShowAgain') as HTMLInputElement,
      helpBtn: document.getElementById('helpBtn') as HTMLButtonElement,
    },
    resumeMusicIfEnabled,
  );

  initPlayerSetup(
    {
      form: document.getElementById('playerForm') as HTMLFormElement,
      input: document.getElementById('playerNameInput') as HTMLInputElement,
      chipList: document.getElementById('playerChipList')!,
      startBtn: document.getElementById('playersStartBtn') as HTMLButtonElement,
    },
    () => {
      game.notifySessionChanged();
      intro.finishOnboarding();
    },
  );
}

initActivationGate(
  {
    gate: document.getElementById('activationGate')!,
    form: document.getElementById('activationForm') as HTMLFormElement,
    input: document.getElementById('activationInput') as HTMLInputElement,
    submitBtn: document.getElementById('activationSubmit') as HTMLButtonElement,
    errorMsg: document.getElementById('activationError')!,
  },
  initEverything,
);
