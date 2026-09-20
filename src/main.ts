import './style.css';
import { initGame } from './game';
import { initInstallPrompt } from './install';
import { initFontToggle } from './font';
import logoMark from './assets/logo-mark.png';

const cardCorners = `
  <span class="corner corner-tl"></span>
  <span class="corner corner-tr"></span>
  <span class="corner corner-bl"></span>
  <span class="corner corner-br"></span>
`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <button class="font-toggle" id="fontToggle" aria-label="تبديل خط نص الأسئلة">Aa</button>

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

  <div class="nav-row">
    <button class="btn-nav" id="prevBtn" aria-label="الكرت السابق" disabled>‹ السابق</button>
    <button class="btn-nav" id="nextBtn" aria-label="الكرت التالي" disabled>التالي ›</button>
  </div>

  <div class="actions">
    <button class="btn btn-primary" id="drawBtn">اسحب كرت جديد</button>
    <button class="btn btn-heart" id="heartBtn">❤️ هاي تستاهل قلب</button>
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
`;

initGame({
  card: document.getElementById('card')!,
  catBadge: document.getElementById('catBadge')!,
  catLabel: document.getElementById('catLabel')!,
  cardText: document.getElementById('cardText')!,
  drawBtn: document.getElementById('drawBtn')!,
  heartBtn: document.getElementById('heartBtn')!,
  prevBtn: document.getElementById('prevBtn') as HTMLButtonElement,
  nextBtn: document.getElementById('nextBtn') as HTMLButtonElement,
  statDrawn: document.getElementById('statDrawn')!,
  statHearts: document.getElementById('statHearts')!,
  heartPop: document.getElementById('heartPop')!,
});

initInstallPrompt({
  installBtn: document.getElementById('installBtn') as HTMLButtonElement,
  iosHint: document.getElementById('iosHint')!,
});

initFontToggle(document.getElementById('fontToggle') as HTMLButtonElement);
