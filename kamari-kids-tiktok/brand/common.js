// عناصر مشتركة بين الفيديوهات: الخلفية وبطاقة النهاية
(function () {
  // خلفية ناعمة: وردي + نعناعي + سماوي على أساس كريمي (حتى لا تكون الهوية وردية فقط)
  K.background = function (stage) {
    const b = document.createElement('div'); b.id = 'bg';
    b.innerHTML = `
      <div class="bg-blob" id="blob1" style="width:760px;height:760px;left:-260px;top:-220px;background:var(--rose)"></div>
      <div class="bg-blob" id="blob2" style="width:620px;height:620px;right:-240px;top:900px;background:var(--mint);opacity:.45"></div>
      <div class="bg-blob" id="blob3" style="width:520px;height:520px;left:-200px;bottom:-160px;background:var(--sky);opacity:.55"></div>`;
    stage.prepend(b);
  };
  K.animateBackground = function (t) {
    K.set('#blob1', { x: Math.sin(t * .35) * 30, y: Math.cos(t * .3) * 20 });
    K.set('#blob2', { x: Math.cos(t * .28) * 26, y: Math.sin(t * .33) * 30 });
    K.set('#blob3', { x: Math.sin(t * .25 + 1) * 24, y: Math.cos(t * .31) * 18 });
  };

  // بطاقة النهاية: شعار نصي مؤقت + دعوة واحدة
  K.endcard = function (stage, { line1 = '', line2 = '' } = {}) {
    const e = document.createElement('div'); e.id = 'endcard'; e.className = 'abs';
    e.style.cssText = 'left:0;right:0;top:0;bottom:0;';
    e.innerHTML = `
      <div class="abs" id="ec-moon" style="left:440px;top:430px;width:200px;height:200px">${ICONS.moon}</div>
      <div class="abs wordmark" id="ec-mark" style="left:60px;right:60px;top:660px">
        <div class="latin">KAMARI <span class="kids">kids</span></div>
        <div class="ar">قمري كيدز</div>
      </div>
      <div class="sub" id="ec-l1" style="top:1060px;font-size:58px;color:var(--plum);font-weight:700">${line1}</div>
      <div class="sub" id="ec-l2" style="top:1150px">${line2}</div>`;
    stage.appendChild(e);
  };
  K.animateEndcard = function (t, start) {
    const p = K.prog(t, start, start + .7);
    K.set('#endcard', { o: K.E.outCubic(p) });
    K.set('#ec-moon', { s: K.lerp(.4, 1, K.E.outBack(K.prog(t, start, start + .8))), r: Math.sin((t - start) * 1.6) * 6 });
    K.set('#ec-mark', { y: K.lerp(40, 0, K.E.outCubic(K.prog(t, start + .15, start + .85))), o: K.prog(t, start + .15, start + .6) });
    K.set('#ec-l1', { o: K.prog(t, start + .6, start + 1) });
    K.set('#ec-l2', { o: K.prog(t, start + .9, start + 1.3) });
  };
})();
