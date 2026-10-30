let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

// 最短と確定できる盤面では「最短」と出る。
// 最初のヒントは、混ぜた手順の逆の次の 1 手をすぐ光らせる（探索を待たない）。探索が最短と確かめたあとの
// ヒントから「最短」と出る。
useStageSetup(4, 0); newPuzzle(3);
showHint();
ok(slots.some((s) => s._cls.has('hinted')), '最初のヒントがすぐ光らない');
ok(hintPlan && hintPlan.optimal, '4×4 2 色で最短が出ていない');
showHint();
ok(el('log').textContent.includes('最短'), `表示: ${el('log').textContent}`);
ok(!/残り/.test(el('log').textContent), '最短なのに「残り」と出ている');
console.log(`  最短が確定した場合: 「${el('log').textContent}」`);

// 押すたびに毎回計算し直している
{
  const first = hintPlan;
  fire(activeRuns()[0].i);
  showHint();
  ok(hintPlan !== first, 'ヒントを押しても計算し直していない');
  console.log('  ヒントを押すたびに今の盤面から計算し直す: OK');
}

// 確定できない盤面では但し書きが出る（手数は短い手順なので出す）
{
  useStageSetup(8, 2); newPuzzle(5);
  showHint();
  ok(planCost(activeRuns()) > 0 && planCost(activeRuns()) <= scrambleN, '大きい盤で手順が出ない');
  showHint();
  const t = el('log').textContent;
  if (hintPlan && hintPlan.optimal && activeRuns() === hintPlan.runs) {
    console.log('  （この盤面はたまたま最短が確定した）');
  } else {
    ok(/残り \d+ 手/.test(t) && !t.includes('最短'), `表示: ${t}`);
    console.log(`  最短と確定できない場合: 「${t}」`);
  }
}
console.log(fail === 0 ? '手順の質の表示: 全チェック通過' : `失敗 ${fail} 件`);
