import './style.css';
import { initGame } from './game';
import { initInstallPrompt } from './install';
import { initFontToggle } from './font';
import { initMuteToggle } from './mute';
import { initTimer } from './timer';
import { initIntro } from './intro';
import { CATEGORY_ICONS } from './data/categories';
import logoMark from './assets/logo-mark.png';

const cardCorners = `
  <span class="corner corner-tl"></span>
  <span class="corner corner-tr"></span>
  <span class="corner corner-bl"></span>
  <span class="corner corner-br"></span>
`;

const categoryRow = (cat: keyof typeof CATEGORY_ICONS, desc: string) => `
  <div class="intro-cat-row">
    <span class="cat-badge intro-cat-badge">${CATEGORY_ICONS[cat]}</span>
    <span class="intro-cat-text"><b>${cat}</b> — ${desc}</span>
  </div>
`;

const filterMenuItem = (cat: keyof typeof CATEGORY_ICONS) => `
  <button class="filter-menu-item" data-filter="${cat}" role="menuitemradio" aria-checked="false">
    <span class="filter-item-icon">${CATEGORY_ICONS[cat]}</span>
    <span>${cat}</span>
  </button>
`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="intro-overlay" id="introOverlay">
    <div class="intro-page" id="introWelcome">
      ${cardCorners}
      <img class="intro-logo" src="${logoMark}" alt="Mandaly" />
      <h2 class="intro-title">أهلًا بكم في Mandaly</h2>
      <p class="intro-text">هنا، تتحوّل اللحظات العادية إلى ذكريات تستحق أن تُروى.</p>
      <p class="intro-text">كل بطاقة تسحبونها تقرّبكم خطوة من بعضكم — سؤال يفتح بابًا، تحدٍّ يجمعكم على الضحك، ومفاجأة تكسر الروتين.</p>
      <p class="intro-text intro-text-emphasis">هذه ليست لعبة تُلعب لتُربح، بل جلسة تُعاش لتُتذكر.</p>
      <button class="btn btn-primary" id="introNextBtn">التالي</button>
    </div>

    <div class="intro-page" id="introRules" hidden>
      ${cardCorners}
      <h2 class="intro-title">كيف نلعب؟</h2>
      ${categoryRow('قلوب مفتوحة', 'حديث واستماع، بلا نقاط، بلا فوز أو خسارة')}
      ${categoryRow('حلبة العائلة', 'تخمين وتحدٍّ، بنقاط فردية بسيطة')}
      ${categoryRow('اقلب الطاولة', 'يغيّر قواعد البطاقة القادمة، لمفاجأة خفيفة')}
      <p class="intro-text">💡 يمكنكم أيضًا اختيار فئة واحدة فقط للسحب منها، من قائمة "⋮" أعلى الشاشة.</p>
      <p class="intro-text">اسحبوا بطاقة، اقرؤوها بصوت عالٍ، وطبّقوها معًا.</p>
      <p class="intro-text">وفي أي لحظة تشعرون فيها بالدفء أو الضحك، قولوا: "قلب لهذه اللحظة!" ❤️</p>
      <label class="intro-checkbox-row" id="dontShowAgainRow">
        <input type="checkbox" id="dontShowAgain" />
        <span>لا تعرض هذا مرة أخرى</span>
      </label>
      <button class="btn btn-primary" id="introStartBtn">لنبدأ!</button>
    </div>
  </div>

  <div class="app-shell" id="appShell">
    <div class="top-controls">
      <button class="icon-btn" id="fontToggle" aria-label="تبديل خط نص الأسئلة">Aa</button>
      <button class="icon-btn" id="muteToggle" aria-label="كتم/تشغيل الصوت">🔊</button>
      <button class="icon-btn" id="helpBtn" aria-label="كيف نلعب؟">؟</button>
    </div>

    <div class="top-controls-right">
      <button class="icon-btn" id="filterToggle" aria-haspopup="true" aria-expanded="false" aria-label="اختيار فئة السحب">⋮</button>
      <div class="filter-menu" id="filterMenu" role="menu" hidden>
        <button class="filter-menu-item active" data-filter="all" role="menuitemradio" aria-checked="true">
          <span class="filter-item-icon">🎴</span>
          <span>الكل</span>
        </button>
        ${filterMenuItem('قلوب مفتوحة')}
        ${filterMenuItem('حلبة العائلة')}
        ${filterMenuItem('اقلب الطاولة')}
      </div>
    </div>

    <div class="wordmark">MANDALY</div>

    <button class="btn-install" id="installBtn" hidden>⬇️ ثبّت اللعبة على هاتفك</button>
    <p class="ios-hint" id="iosHint" hidden>
      📲 للتثبيت: اضغط زر المشاركة ⬆️ بالأسفل، ثم اختر "إضافة إلى الشاشة الرئيسية"
    </p>

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
      <button class="icon-btn" id="shareBtn" aria-label="مشاركة هذا السؤال" disabled>📤</button>
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
        <div class="heart-pop-text">نحبكم برشا</div>
      </div>
    </div>
  </div>
`;

const timer = initTimer({
  row: document.getElementById('timerRow')!,
  display: document.getElementById('timerDisplay')!,
  barFill: document.getElementById('timerBarFill') as HTMLElement,
  toggleBtn: document.getElementById('timerToggle') as HTMLButtonElement,
  resetBtn: document.getElementById('timerReset') as HTMLButtonElement,
});

initGame(
  {
    card: document.getElementById('card')!,
    catBadge: document.getElementById('catBadge')!,
    catLabel: document.getElementById('catLabel')!,
    cardText: document.getElementById('cardText')!,
    drawBtn: document.getElementById('drawBtn')!,
    heartBtn: document.getElementById('heartBtn')!,
    shareBtn: document.getElementById('shareBtn') as HTMLButtonElement,
    prevBtn: document.getElementById('prevBtn') as HTMLButtonElement,
    nextBtn: document.getElementById('nextBtn') as HTMLButtonElement,
    filterToggle: document.getElementById('filterToggle') as HTMLButtonElement,
    filterMenu: document.getElementById('filterMenu')!,
    statDrawn: document.getElementById('statDrawn')!,
    statHearts: document.getElementById('statHearts')!,
    heartPop: document.getElementById('heartPop')!,
  },
  timer,
);

initInstallPrompt({
  installBtn: document.getElementById('installBtn') as HTMLButtonElement,
  iosHint: document.getElementById('iosHint')!,
});

initFontToggle(document.getElementById('fontToggle') as HTMLButtonElement);
initMuteToggle(document.getElementById('muteToggle') as HTMLButtonElement);

initIntro({
  appShell: document.getElementById('appShell')!,
  overlay: document.getElementById('introOverlay')!,
  welcomePage: document.getElementById('introWelcome')!,
  rulesPage: document.getElementById('introRules')!,
  startBtn: document.getElementById('introStartBtn') as HTMLButtonElement,
  dontShowAgainRow: document.getElementById('dontShowAgainRow')!,
  dontShowAgain: document.getElementById('dontShowAgain') as HTMLInputElement,
  helpBtn: document.getElementById('helpBtn') as HTMLButtonElement,
});
