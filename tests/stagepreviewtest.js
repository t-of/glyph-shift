// ホームのプレビュー（stageGoalPreview）が、全ステージで実際に開いた盤のゴールと一致すること。
// 小さい盤ではゴールの引き直しが起きるので、fixed の数例だけでは見逃す。
let fail = 0;
W = H = 4; SIZE = 16; buildDom(); types = 2; forcedAbilities = null; newPuzzle(1);
for (const s of SIZES) for (const k of TYPE_COUNTS) {
  if (!typeAvailable(s, s, k)) continue;
  const st = stageFor(s, k);
  const preview = stageGoalPreview(s, k, st.seed).join(',');
  pendA = pendB = pendW = pendH = s; pendTypes = k; pendCustom = false;
  seedInEl.value = String(st.seed);
  startFromPending();
  if (tileAbility.join(',') !== preview) { console.log(`  FAIL: ${s}×${s} / ${k} 種（seed ${st.seed}）でプレビューと実際の盤が違う`); fail++; }
}
console.log(fail ? `\nプレビューの一致: 失敗 ${fail} 件` : '\nプレビューの一致: 全チェック通過');
