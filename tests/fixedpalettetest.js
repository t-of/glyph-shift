// 固定パレットの品質を、知覚的な色差（CIELAB の ΔE）で確かめる
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// hsl -> rgb -> XYZ -> Lab
function hsl2rgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
function rgb2lab([r, g, b]) {
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  [r, g, b] = [lin(r), lin(g), lin(b)];
  const X = (r * .4124 + g * .3576 + b * .1805) / .95047;
  const Y = (r * .2126 + g * .7152 + b * .0722);
  const Z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
// 色は #rrggbb（2026-10-30 の案 A から）か hsl() で書く
const toRgb = (css) => {
  const hx = css.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hx) return hx.slice(1).map((v) => parseInt(v, 16) / 255);
  const [h, s, l] = css.match(/hsl\((\d+) (\d+)% (\d+)%\)/).slice(1).map(Number);
  return hsl2rgb(h, s, l);
};
const labOf = (css) => rgb2lab(toRgb(css));
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// CIEDE2000。明るさをそろえた配色（2026-10-30 の案 A）では、CIE76 より見た目の差に近い
function dE00([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = a1 * (1 + G), ap2 = a2 * (1 + G);
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => { const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = hp2 - hp1;
  if (Cp1 * Cp2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2);
  const Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hb = Math.abs(hp1 - hp2) > 180 ? (hb + (hb < 360 ? 360 : -360)) / 2 : hb / 2;
  const T = 1 - .17 * Math.cos((hb - 30) * rad) + .24 * Math.cos(2 * hb * rad)
    + .32 * Math.cos((3 * hb + 6) * rad) - .2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + .015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + .045 * Cpb, SH = 1 + .015 * Cpb * T;
  const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
// OKLCH の色相（アクセントの帯を避けているかを見る）
function okHue(css) {
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = toRgb(css).map(lin);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const q = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + .4505937099 * q;
  const B = .0259040371 * l + .7827717662 * m - .8086757660 * q;
  return (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
}

const labs = ABILITIES.map((a) => labOf(a.color));
const hues = ABILITIES.map((a) => okHue(a.color));

console.log('10 色の内訳');
ABILITIES.forEach((a, k) => {
  const L = labs[k][0];
  console.log(`  ${a.id.padEnd(10)} ${a.color.padEnd(20)} 明度 L*=${L.toFixed(0)}`);
});

// 彩度（Lab の C*）。色を持たないマスは、色相の遠さではなく「色を持たないこと」で見分ける。
const chroma = (lab) => Math.hypot(lab[1], lab[2]);
const grey = ABILITIES.map((_, k) => k).filter((k) => chroma(labs[k]) < 10);
const tinted = ABILITIES.map((_, k) => k).filter((k) => !grey.includes(k));

// 色を持つものどうしは、知覚的な色差で見分ける
let worst = { d: Infinity };
for (const i of tinted) for (const j of tinted) {
  if (j <= i) continue;
  const d = dE00(labs[i], labs[j]);
  if (d < worst.d) worst = { d, i, j };
}
console.log(`\n最も近い 2 色: ${ABILITIES[worst.i].id} と ${ABILITIES[worst.j].id}  ΔE00=${worst.d.toFixed(1)}`);
// 案 A は 13.0（前の配色は 10.6）。これより下げない
ok(worst.d >= 12.5, `いちばん近い 2 色の差が ΔE00=${worst.d.toFixed(1)} しかない`);

// 色を持たないマスは、盤でただひとつ色を持たないこと自体が手がかり。
// 色差だけで測ると淡い色に近く見えるが、彩度の差が大きいので実際には紛れない。
console.log(`\n色を持たないマス ${grey.length} 種 / 色を持つマス ${tinted.length} 種`);
ok(grey.length <= 1, `色を持たないマスが ${grey.length} 種ある（1 種までのつもり）`);
for (const k of grey) {
  const c = chroma(labs[k]);
  const minTint = Math.min(...tinted.map((j) => chroma(labs[j])));
  const lightest = Math.max(...tinted.map((j) => labs[j][0]));
  let m = Infinity;
  for (const j of tinted) m = Math.min(m, dE(labs[k], labs[j]));
  ok(minTint > 15, `色を持つ側の最小彩度が C*=${minTint.toFixed(1)} しかなく、色なしと紛れる`);
  ok(labs[k][0] > lightest, `${ABILITIES[k].id}: 明度 ${labs[k][0].toFixed(0)} が、いちばん明るい色 ${lightest.toFixed(0)} を超えていない`);
  ok(m >= 18, `${ABILITIES[k].id}: 色差が ΔE=${m.toFixed(1)} しかない`);
  console.log(`  ${ABILITIES[k].id}: 彩度 C*=${c.toFixed(1)}（色を持つ側は最小 ${minTint.toFixed(1)}）、`
    + `明度 ${labs[k][0].toFixed(0)}（最も明るい色は ${lightest.toFixed(0)}）、色差は最小 ΔE=${m.toFixed(1)}`);
}

// アクセント（菫色）の帯を使っていない
for (let k = 0; k < hues.length; k++) {
  if (grey.includes(k)) continue;
  ok(hues[k] < 270 || hues[k] > 316, `${ABILITIES[k].id} の色相 ${hues[k].toFixed(0)}° がアクセントの帯に入っている`);
}
console.log('  アクセント（#b39cff、OKLCH 293°）の帯 270〜316° は使っていない');

// アイコンの黒に対して十分な明るさがあるか
const lum = (css) => { const [r, g, b] = toRgb(css).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return .2126 * r + .7152 * g + .0722 * b; };
// 絵柄と地のコントラスト。インクは全マス共通。半透明なので、地に重ねた色で見る。
const rgbOf = (css) => {
  if (!css.startsWith('rgb')) return toRgb(css);
  const [r, g, b, al = 1] = css.match(/[\d.]+/g).map(Number);   // rgb() は不透明
  return [r / 255, g / 255, b / 255, al];
};
const relLum = ([r, g, b]) => {
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
};
let minC = 99;
for (let k = 0; k < ABILITIES.length; k++) {
  const bg = rgbOf(ABILITIES[k].color);
  const ink = rgbOf(INK);
  const al = ink[3];
  const mixed = [0, 1, 2].map((j) => ink[j] * al + bg[j] * (1 - al));
  const [a1, a2] = [relLum(mixed) + .05, relLum(bg) + .05];
  const c = Math.max(a1, a2) / Math.min(a1, a2);
  minC = Math.min(minC, c);
  // インクは不透明（2026-10-31）。半透明のときは、混ぜた色でコントラストを見ていた（式はそのまま使える）。
  // 絵柄は小さな文字ではなく大きな図形なので、その基準（3:1）には十分な余裕がある。
  ok(c >= 4.0, `${ABILITIES[k].id}: 絵柄とのコントラストが ${c.toFixed(1)}:1`);
}
console.log(`  絵柄とのコントラストは最低 ${minC.toFixed(1)}:1（半透明のインクを地に重ねて実測）`);

// どのマスも、空きスロット（#17151d）よりはっきり明るいこと
for (let k = 0; k < ABILITIES.length; k++) {
  const d = dE(labs[k], rgb2lab([0x17, 0x15, 0x1d].map((v) => v / 255)));
  ok(d >= 15, `${ABILITIES[k].id}: 空きスロットとの差が ΔE=${d.toFixed(1)} しかない（マスに見えない）`);
}

// 盤面が変わっても色が変わらない
{
  const before = ABILITIES.map((_, k) => bgOf(k));
  W = H = 6; SIZE = 36; buildDom();
  for (const K of [2, 5, 10]) {
    types = K;
    for (let s = 1; s <= 30; s++) {
      newPuzzle(s);
      ABILITIES.forEach((a, k) => ok(bgOf(k) === before[k], `${a.id}: 盤面によって色が変わっている`));
    }
  }
  console.log('  盤面を変えても色は変わらない');
}

console.log(fail === 0 ? '\n固定パレット: 全チェック通過' : `\n失敗 ${fail} 件`);
