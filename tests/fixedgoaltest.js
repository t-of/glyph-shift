// 8×8 名人は、ゴールが 13 種の斜めの縞に決まっていること（一覧の絵・実際の盤・覚えた古いゴールより優先）。
// ほかのステージのゴールは決まっていないこと。
let fail = 0;
const want = Array.from({ length: 64 }, (_, i) => ((i % 8) + Math.floor(i / 8)) % 13).join(',');
const st = stageFor(8, 5);
st.goal = Array(64).fill(0); st.pool = 'all';   // 前の版で覚えた別のゴール
if (goalForStage(8, 5, st).join(',') !== want) { console.log('  FAIL: 一覧の 8×8 名人のゴールが斜めの縞でない'); fail++; }
pendA = pendB = pendW = pendH = 8; pendDiff = 5; pendCustom = false;
seedInEl.value = String(st.seed);
startFromPending();
if (tileAbility.join(',') !== want) { console.log('  FAIL: 8×8 名人の盤のゴールが斜めの縞でない'); fail++; }
if (new Set(tileAbility).size !== 13) { console.log('  FAIL: 13 種がそろっていない'); fail++; }
if (isSolved()) { console.log('  FAIL: 盤が混ざっていない'); fail++; }
if (forcedAbilities) { console.log('  FAIL: ステージなのにカスタム扱い（forcedAbilities）になっている'); fail++; }
for (const s of STAGE_SIZES) for (let d = 0; d < DIFFS.length; d++) {
  const def = stageDef(s, d);
  if (def && def.goal && !(s === 8 && d === 5)) { console.log(`  FAIL: ${s}×${s} / ${DIFFS[d]} にも決まったゴールがある`); fail++; }
}
console.log(fail ? `\n決まったゴール: 失敗 ${fail} 件` : '\n決まったゴール: 全チェック通過');
