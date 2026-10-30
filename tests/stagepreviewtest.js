// ホームのプレビュー（stageGoalPreview）が、全ステージで実際に開いた盤のゴールと一致すること。
// 小さい盤ではゴールの引き直しが起きるので、fixed の数例だけでは見逃す。
let fail = 0;
useStageSetup(4, 0); newPuzzle(1);
for (const s of STAGE_SIZES) for (let d = 0; d < DIFFS.length; d++) {
  const st = stageFor(s, d);
  const preview = stageGoalPreview(s, d, st.seed).join(',');
  pendA = pendB = pendW = pendH = s; pendDiff = d; pendCustom = false;
  seedInEl.value = String(st.seed);
  startFromPending();
  if (tileAbility.join(',') !== preview) { console.log(`  FAIL: ${s}×${s} / ${DIFFS[d]}（seed ${st.seed}）でプレビューと実際の盤が違う`); fail++; }
  if (types !== stageDef(s, d).k || scrambleN !== stageDef(s, d).n) { console.log(`  FAIL: ${s}×${s} / ${DIFFS[d]} の手数・種類数が表と違う`); fail++; }
}
console.log(fail ? `\nプレビューの一致: 失敗 ${fail} 件` : '\nプレビューの一致: 全チェック通過');
