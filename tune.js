// ブロックのマークの微調整（?tune=1 のときだけ読む。2026-10-31 オーナー）。
// つまみで形の数字を変えると、13 種の見本と後ろの盤がその場で描き直される。
// 値はこの端末の localStorage（glyphshift.tune）に残り、ふだんの画面でも効く。決まったらコードの既定値に移す。
(() => {
  const SLIDERS = [
    ['size', 'マークの大きさ（%）', 50, 95, 1],
    ['dotR', '動くマスの点の大きさ', 1, 3.5, 0.1],
    ['selfR', '中央の輪の大きさ', 1.5, 4, 0.1],
    ['selfW', '中央の輪の太さ', 0.6, 2.5, 0.1],
    ['backR', '目印の点の大きさ', 0, 2, 0.1],
    ['backOp', '目印の点の濃さ', 0, 0.6, 0.02],
    ['linkW', '入れ替えの弧の太さ', 0.6, 2.5, 0.1],
    ['linkBend', '入れ替えの弧の曲がり', 2, 10, 0.5],
    ['arcR', '回転の弧の半径', 7, 11, 0.25],
    ['arcSweep', '回転の弧の長さ（度）', 90, 360, 5],
    ['arcW', '回転の弧の太さ', 0.6, 2.5, 0.1],
    ['headLen', '矢じりの長さ', 1.5, 7, 0.1],
    ['headW', '矢じりの幅', 1.5, 7, 0.1],
    ['halfW', '半回転の線の太さ', 0.6, 2.5, 0.1],
    ['bowH', '片側どうしの弧の膨らみ', 1, 7, 0.2],
  ];
  const css = document.createElement('style');
  css.textContent = `
    .tune { position: fixed; left: 0; right: 0; bottom: 0; z-index: 90; max-height: 62dvh; overflow-y: auto;
      background: var(--panel); border-top: 1px solid var(--line); box-shadow: 0 -10px 30px rgba(0,0,0,.4);
      padding: 12px 14px calc(16px + env(safe-area-inset-bottom)); font-size: 12px; color: var(--text); }
    .tune h2 { margin: 0 0 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .tune h2 button { margin-left: auto; }
    .tune button { font: 600 11px/1 var(--ui); padding: 7px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--ground); color: var(--text); }
    .tune-prev { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 4px 0 10px; }
    .tune-prev .t { aspect-ratio: 1; border-radius: 18%; display: grid; place-items: center; }
    .tune-prev .t svg { width: var(--glyph-size, 74%); height: var(--glyph-size, 74%); }
    .tune-small { display: flex; gap: 3px; margin-bottom: 10px; }
    .tune-small .t { width: 18px; height: 18px; border-radius: 18%; display: grid; place-items: center; }
    .tune-small .t svg { width: var(--glyph-size, 74%); height: var(--glyph-size, 74%); }
    .tune label { display: grid; grid-template-columns: 1fr 44px; gap: 2px 8px; align-items: center; margin: 6px 0; }
    .tune input[type=range] { grid-column: 1 / -1; width: 100%; }
    .tune output { text-align: right; font-family: var(--mono); }
    .tune .tune-out { width: 100%; height: 60px; font: 10px/1.4 var(--mono); margin-top: 8px; background: var(--ground); color: var(--text); border: 1px solid var(--line); border-radius: 8px; }
  `;
  document.head.append(css);

  const box = document.createElement('section');
  box.className = 'tune';
  box.innerHTML = '<h2>マークの微調整 <button type="button" data-a="reset">元に戻す</button><button type="button" data-a="hide">閉じる</button></h2>'
    + '<div class="tune-prev"></div><div class="tune-small"></div><div class="tune-sliders"></div>'
    + '<textarea class="tune-out" readonly></textarea>';
  document.body.append(box);
  const prev = box.querySelector('.tune-prev'), small = box.querySelector('.tune-small'), sl = box.querySelector('.tune-sliders'), out = box.querySelector('.tune-out');

  const chip = (k) => { const t = document.createElement('span'); t.className = 't'; t.style.background = bgOf(k); t.style.color = INK; t.innerHTML = iconSvg(k); return t; };
  function redraw() {
    prev.replaceChildren(...ABILITIES.map((_, k) => chip(k)));
    small.replaceChildren(...ABILITIES.map((_, k) => chip(k)));
    // 後ろの盤・目標・ホームのカードも描き直す
    try { paintTiles(); renderGoal(); renderStageList(); } catch (e) { /* 盤がまだ無いときは見本だけ */ }
    const cur = Glyphs.getTune(), diff = {};
    for (const k of Object.keys(cur)) if (cur[k] !== Glyphs.TUNE_DEFAULT[k]) diff[k] = cur[k];
    out.value = JSON.stringify(diff);
  }
  function set(o) {
    applyGlyphTune(o);
    try { localStorage.setItem(TUNE_KEY, JSON.stringify(Glyphs.getTune())); } catch (e) { /* 保存できなくても今は効く */ }
    redraw();
  }
  for (const [key, name, min, max, step] of SLIDERS) {
    const lab = document.createElement('label');
    const v = Glyphs.getTune()[key];
    lab.innerHTML = `<span>${name}</span><output>${v}</output><input type="range" min="${min}" max="${max}" step="${step}" value="${v}">`;
    const input = lab.querySelector('input'), o = lab.querySelector('output');
    input.addEventListener('input', () => { o.textContent = input.value; set({ ...Glyphs.getTune(), [key]: Number(input.value) }); });
    sl.append(lab);
  }
  box.addEventListener('click', (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (a === 'reset') {
      try { localStorage.removeItem(TUNE_KEY); } catch (err) { /* なくてよい */ }
      applyGlyphTune(null);
      for (const [i, [key]] of SLIDERS.entries()) { const lab = sl.children[i]; lab.querySelector('input').value = Glyphs.getTune()[key]; lab.querySelector('output').textContent = Glyphs.getTune()[key]; }
      redraw();
    }
    if (a === 'hide') box.remove();
  });
  redraw();
})();
