// أدوات حركة صغيرة وحتمية: كل إطار يُحسب من الزمن t فقط (لا مؤقتات ولا CSS transitions)
(function () {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    linear: p => p,
    outCubic: p => 1 - Math.pow(1 - p, 3),
    inCubic: p => p * p * p,
    inOutCubic: p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outBack: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    outElastic: p => (p === 0 || p === 1) ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * (2 * Math.PI / 3)) + 1,
  };
  // ظهور ثم اختفاء: يعيد شفافية بين 0 و1
  const win = (t, a, b, fi = .3, fo = .3) => Math.min(E.outCubic(prog(t, a, a + fi)), 1 - E.inCubic(prog(t, b - fo, b)));
  // ضبط تحويل عنصر: x,y بالبكسل (مركز العنصر عند class center)، s تكبير، r دوران، o شفافية
  function set(el, { x = 0, y = 0, s = 1, r = 0, o = 1, centered = false } = {}) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    el.style.transform = `${centered ? 'translate(-50%,-50%) ' : ''}translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
    el.style.opacity = o;
    el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  }
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  if (params.get('guides') === '1') document.addEventListener('DOMContentLoaded', () => document.body.classList.add('guides'));
  if (params.get('transparent') === '1') document.addEventListener('DOMContentLoaded', () => document.body.classList.add('transparent'));

  // دليل المناطق التي تغطيها واجهة تيك توك تقريبًا (تقدير للعمل، يجب التأكد بمعاينة فعلية على الهاتف)
  document.addEventListener('DOMContentLoaded', () => {
    const g = document.createElement('div'); g.id = 'guides';
    g.innerHTML = `
      <div style="left:0;right:0;top:0;height:150px">أعلى: تبويبات التطبيق</div>
      <div style="right:0;width:130px;top:820px;height:780px">أزرار</div>
      <div style="left:0;right:0;bottom:0;height:400px">الوصف + الموسيقى + الاسم</div>`;
    document.body.appendChild(g);
  });

  // تقطيع النص إلى كلمات (بترتيب القراءة) لظهورها كلمة كلمة
  function words(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (el._words) return el._words;
    const out = [];
    const walk = (node) => {
      [...node.childNodes].forEach(ch => {
        if (ch.nodeType === 3) {
          const parts = ch.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = p; frag.appendChild(sp); out.push(sp);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && !ch.classList.contains('w')) walk(ch);
      });
    };
    walk(el);
    el._words = out;
    return out;
  }
  // يُظهر الكلمات بالتتابع ابتداءً من start، بفاصل per ثانية. الأشرطة (.bar) تنبسط مع أول كلمة فيها.
  // يعيد أزمنة ظهور الكلمات (مفيد لمزامنة النقرات الصوتية).
  function reveal(el, t, start, per = .22, out = Infinity) {
    if (typeof el === 'string') el = document.querySelector(el);
    const ws = words(el);
    const fadeOut = 1 - E.inCubic(prog(t, out - .3, out));
    el.style.opacity = fadeOut; el.style.visibility = fadeOut <= 0.001 || t < start ? 'hidden' : 'visible';
    ws.forEach((w, i) => {
      const a = start + i * per, p = E.outCubic(prog(t, a, a + .28));
      w.style.opacity = p; w.style.transform = `translateY(${(1 - p) * 22}px)`;
    });
    el.querySelectorAll('.bar').forEach(b => {
      const first = ws.findIndex(w => b.contains(w));
      const a = start + Math.max(0, first) * per - .12;
      b.style.setProperty('--bar', E.outCubic(prog(t, a, a + .3)).toFixed(3));
    });
    return ws.map((_, i) => start + i * per);
  }

  window.K = { clamp, lerp, prog, E, win, set, $, params, words, reveal };
})();
