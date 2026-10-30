// ステージの表の検証: どの（大きさ × 難しさ）も、その種類数の柄が作れて、決めた手数で盤が作れること。
// 「何も起きない」ブロックは種類数が 3 以下でも混ざってよいこと。設定パネルの難しさの選び方。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 表の形: 3×3（練習）と 4×4〜8×8、各 3 段、手数と種類数は上の段ほど大きく、種類数は 8 以下
{
  ok(STAGE_SIZES.join() === '3,4,5,6,7,8', `大きさが ${STAGE_SIZES}`);
  for (const s of STAGE_SIZES) {
    let pn = 0, pk = 0;
    for (let d = 0; d < DIFFS.length; d++) {
      const def = stageDef(s, d);
      ok(def && def.n > pn && def.k >= pk, `${s}×${s} の ${DIFFS[d]} が上がっていない`);
      ok(def.k >= 2 && def.k <= 8, `${s}×${s} の ${DIFFS[d]} の種類数が ${def.k}`);
      ok(typeAvailable(s, s, def.k), `${s}×${s} で ${def.k} 種の柄が作れない`);
      pn = def.n; pk = def.k;
    }
  }
  ok(!stageDef(9, 0) && !stageDef(10, 2), '9×9・10×10 がステージに残っている');
  console.log('  ステージの表の形  OK');
}

// どのステージも、決めた手数で盤が作れる（答えの手数 = 混ぜた手数、完成済みでない）
{
  for (const s of STAGE_SIZES) for (let d = 0; d < DIFFS.length; d++) {
    const def = useStageSetup(s, d);
    for (let t = 0; t < 4; t++) {
      generate(500 + t * 31);
      ok(!isSolved(), `${s}×${s} ${DIFFS[d]}: 完成済みの盤ができた`);
      ok(scrambleMoves.length === def.n, `${s}×${s} ${DIFFS[d]}: 混ぜた手が ${scrambleMoves.length}（期待 ${def.n}）`);
      ok(new Set(tileAbility).size === def.k, `${s}×${s} ${DIFFS[d]}: 種類数が ${new Set(tileAbility).size}（期待 ${def.k}）`);
      // 3×3 は通れる盤面が少なく、引き直しがかさむと同じマスの連続を許すので n より短くなることがある（min 以上は保つ）
      if (s === 3) ok(planCost(solution) <= def.n && planCost(solution) >= def.min, `${s}×${s} ${DIFFS[d]}: 答えの手数が ${planCost(solution)}（期待 ${def.min}〜${def.n}）`);
      else ok(planCost(solution) === def.n, `${s}×${s} ${DIFFS[d]}: 答えの手数が ${planCost(solution)}（期待 ${def.n}）`);
    }
  }
  console.log('  全ステージで決めた手数の盤ができる  OK');
}

// 「何も起きない」は種類数が 3 以下でも混ざる。混ざった盤でも、決めた手数ぶん動かせて完成済みにならない。
{
  let withBlank = 0, total = 0;
  for (const [s, d] of [[4, 0], [4, 1], [5, 0], [6, 0]]) {
    const def = useStageSetup(s, d);
    ok(def.k <= 3, `テストの前提: ${s}×${s} ${DIFFS[d]} は 3 種以下のはず`);
    for (let t = 0; t < 40; t++) {
      generate(9000 + t * 17);
      total++;
      const blank = [...new Set(tileAbility)].some((a) => isBlank(a));
      if (blank) {
        withBlank++;
        ok(!isSolved(), `何も起きないを含む盤が完成済み（${s}×${s}）`);
        ok(scrambleMoves.length === def.n, `何も起きないを含む盤で混ぜた手が ${scrambleMoves.length}（期待 ${def.n}）`);
        ok([...new Set(tileAbility)].some((a) => !isBlank(a) && legalCells().length > 0), '動かせるブロックが無い');
      }
    }
  }
  ok(withBlank > 0, `3 種以下の盤で「何も起きない」が一度も混ざらなかった（${total} 盤）`);
  console.log(`  3 種以下でも「何も起きない」が混ざる（${withBlank} / ${total} 盤）  OK`);
}

// 設定パネルの難しさの説明: ブロックの種類数だけ（手数は出さない）。カスタムは選んだ数
{
  setPanel('setup', true);
  pendA = pendB = pendW = pendH = 5; pendDiff = 2; pendCustom = false;
  refreshDiffSeg();
  const d5 = stageDef(5, 2);
  ok(diffNoteEl.textContent.includes(`${d5.k} 種`) && !/\d+ 手/.test(diffNoteEl.textContent), `説明が「${diffNoteEl.textContent}」`);
  pendCustom = true; pendW = 9; pendH = 7; pendDiff = 1; pendPicked = new Set([0, 1, 2, 3]);
  refreshDiffSeg();
  ok(diffNoteEl.textContent.includes('4 種') && !/\d+ 手/.test(diffNoteEl.textContent), `カスタムの説明が「${diffNoteEl.textContent}」`);
  ok(movesFor(10, 10, 2) === stageDef(8, 2).n && movesFor(3, 3, 0) === stageDef(3, 0).n, 'カスタムの手数の借り方が違う');
  console.log('  設定パネルの難しさの説明  OK');
}

// カスタム（9×9・13 種まで）も決めた手数で作れる
{
  W = H = 10; SIZE = 100; buildDom(); types = 10; forcedAbilities = null; scrambleN = movesFor(10, 10, 2);
  generate(3);
  ok(new Set(tileAbility).size === 10, `10×10 で ${new Set(tileAbility).size} 種`);
  ok(!isSolved(), '10×10 が完成済み');
  ok(legalCells().length > 0, '10×10 に合法手がない');
  ok(planCost(solution) === scrambleN, `10×10 の答えが ${planCost(solution)} 手（期待 ${scrambleN}）`);
  console.log(`  10×10 / 10 種: ${scrambleN} 手で生成できる  OK`);
}

console.log(fail === 0 ? '\nステージの表: 全チェック通過' : `\n失敗 ${fail} 件`);
