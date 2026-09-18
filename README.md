# Mandaly

لعبة كروت عائلية بالعربية (RTL) — تطبيق ويب تقدمي (PWA) قابل للتثبيت على الشاشة الرئيسية ويعمل بلا إنترنت بعد أول فتح.

**الرابط المباشر:** https://mouhamedali92rahali-cpu.github.io/Mandaly-app/

## التشغيل محليًا

```bash
npm install
npm run dev
```

## البناء للإنتاج

```bash
npm run build
npm run preview
```

## النشر

كل push إلى الفرع الرئيسي يشغّل `.github/workflows/deploy.yml` الذي يبني المشروع وينشره تلقائيًا على GitHub Pages.

## بنية المشروع

- `src/data/deck.ts` — بنك الكروت (الصنف والنص)
- `src/data/categories.ts` — أيقونات الأصناف الثلاثة
- `src/game.ts` — منطق السحب والخلط وحركة الانقلاب
- `src/main.ts` — نقطة الدخول وبناء الواجهة
- `scripts/gen-icons.mjs` — توليد أيقونات PWA من `scripts/brand-icon.svg`
