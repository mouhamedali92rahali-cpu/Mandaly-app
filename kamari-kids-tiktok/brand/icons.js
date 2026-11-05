// رموز أصلية بسيطة (SVG) — خطوط سميكة وأشكال كبيرة مقروءة على الهاتف.
// كل رمز يطابق فعلًا واحدًا: الوجه والماء لـ«نغسل وجهي»، والقميص لـ«نلبس»، وفرشاة الأسنان محجوزة لبطاقة غسل الأسنان.
(function () {
  const P = 'var(--plum)', S = 'stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    clock: `<svg viewBox="0 0 200 200"><g ${S} stroke="${P}" stroke-width="9">
      <path d="M40 58 a30 30 0 0 1 42-30" fill="var(--sun)"/><path d="M160 58 a30 30 0 0 0 -42-30" fill="var(--sun)"/>
      <line x1="62" y1="168" x2="50" y2="184"/><line x1="138" y1="168" x2="150" y2="184"/>
      <circle cx="100" cy="110" r="66" fill="#fff"/><circle cx="100" cy="110" r="52" fill="var(--sky)" stroke="none"/>
      <line x1="100" y1="110" x2="100" y2="76"/><line x1="100" y1="110" x2="124" y2="122"/>
      <line x1="100" y1="38" x2="100" y2="30"/></g><circle cx="100" cy="110" r="7" fill="${P}"/></svg>`,

    // وجه + قطرات ماء + حنفية صغيرة
    faceWash: `<svg viewBox="0 0 200 200"><g ${S} stroke="${P}" stroke-width="8">
      <path d="M118 20 h46 v18 h-14 v10" fill="var(--sky)"/>
      <circle cx="96" cy="118" r="58" fill="var(--sun-soft)"/>
      <path d="M72 108 q8 -8 16 0"/><path d="M106 108 q8 -8 16 0"/>
      <path d="M78 140 q19 16 38 0" fill="none"/></g>
      <g fill="#4FA8E8"><path d="M150 62 q-9 14 0 20 q9 -6 0 -20z"/><path d="M160 98 q-8 12 0 17 q8 -5 0 -17z"/>
      <path d="M36 70 q-8 12 0 17 q8 -5 0 -17z"/></g>
      <g fill="#fff" opacity=".9"><circle cx="60" cy="150" r="9"/><circle cx="134" cy="150" r="7"/><circle cx="46" cy="132" r="5"/></g></svg>`,

    shirt: `<svg viewBox="0 0 200 200"><g ${S} stroke="${P}" stroke-width="9">
      <path d="M70 32 L30 54 L46 92 L62 86 L62 172 L138 172 L138 86 L154 92 L170 54 L130 32 Q100 58 70 32Z" fill="var(--mint)"/>
      <path d="M84 36 Q100 50 116 36" fill="none"/></g>
      <circle cx="100" cy="112" r="14" fill="var(--sun)" stroke="${P}" stroke-width="6"/></svg>`,

    ball: `<svg viewBox="0 0 200 200"><g ${S} stroke="${P}" stroke-width="9">
      <circle cx="100" cy="100" r="74" fill="var(--sun)"/>
      <path d="M30 86 Q100 120 170 86" fill="none"/><path d="M84 27 Q60 100 92 173" fill="none"/>
      <path d="M128 32 Q150 100 120 170" fill="none"/></g>
      <path d="M58 60 q10 -14 26 -18" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" opacity=".8"/></svg>`,

    shoe: `<svg viewBox="0 0 200 200"><g ${S} stroke="${P}" stroke-width="9">
      <path d="M30 70 L76 70 Q86 100 120 108 Q170 116 174 140 L174 150 L30 150 Z" fill="var(--sky)"/>
      <path d="M30 150 L174 150 L174 164 L30 164 Z" fill="#fff"/>
      <line x1="84" y1="88" x2="98" y2="80"/><line x1="96" y1="100" x2="110" y2="92"/></g></svg>`,

    book: `<svg viewBox="0 0 200 200"><g ${S} stroke="${P}" stroke-width="9">
      <path d="M100 52 Q70 34 26 40 L26 158 Q70 152 100 170 Z" fill="var(--rose)"/>
      <path d="M100 52 Q130 34 174 40 L174 158 Q130 152 100 170 Z" fill="var(--mint)"/>
      <line x1="44" y1="76" x2="80" y2="80"/><line x1="44" y1="104" x2="80" y2="108"/>
      <line x1="120" y1="80" x2="156" y2="76"/><line x1="120" y1="108" x2="156" y2="104"/></g></svg>`,

    check: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="var(--mint-deep)"/>
      <path d="M28 52 L44 67 L73 36" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

    sun: `<svg viewBox="0 0 100 100"><g stroke="var(--sun)" stroke-width="8" stroke-linecap="round">
      <line x1="50" y1="6" x2="50" y2="18"/><line x1="50" y1="82" x2="50" y2="94"/><line x1="6" y1="50" x2="18" y2="50"/><line x1="82" y1="50" x2="94" y2="50"/>
      <line x1="19" y1="19" x2="27" y2="27"/><line x1="73" y1="73" x2="81" y2="81"/><line x1="19" y1="81" x2="27" y2="73"/><line x1="73" y1="27" x2="81" y2="19"/></g>
      <circle cx="50" cy="50" r="22" fill="var(--sun)" stroke="${P}" stroke-width="6"/></svg>`,

    pause: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="var(--plum)"/>
      <rect x="33" y="28" width="11" height="44" rx="4" fill="#fff"/><rect x="56" y="28" width="11" height="44" rx="4" fill="#fff"/></svg>`,

    // علامة مؤقتة: هلال + نجمة (قمر) — ليست الشعار النهائي
    moon: `<svg viewBox="0 0 120 120"><path d="M78 14 A48 48 0 1 0 104 92 A40 40 0 1 1 78 14Z" fill="var(--sun)" stroke="${P}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M92 34 l4 9 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="var(--mint)" stroke="${P}" stroke-width="4" stroke-linejoin="round"/></svg>`,

    star: `<svg viewBox="0 0 40 40"><path d="M20 2 l5 12 13 1 -10 8 3 13 -11 -7 -11 7 3 -13 -10 -8 13 -1z" fill="var(--sun)"/></svg>`,
  };
  window.ICONS = I;
})();
