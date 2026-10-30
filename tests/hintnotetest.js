// ヒントに添える「残り何手か」の出し方の検証。
//
// 残りの手数は、短い手順のときだけ意味がある（HINT_SHOW_MAX 以下）。
// 手数を決めて混ぜた盤の答えは短いので手数を出す。そうでない盤の保険の手順は 1 万手を超えることがあり、
// それを「残り 18317 手」と出しても遊ぶ人には何の情報でもない。
const __root = require('path').join(__dirname, '..');
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const note = () => logEl.textContent;
const bigNumber = (s) => (s.match(/\d+/g) || []).map(Number).find((n) => n >= 1000);

useStageSetup(5, 1); newPuzzle(2);
requestSolve();
const shortRuns = activeRuns().map((r) => ({ ...r }));   // 混ぜた手順の逆（短い）
// 手数を決めずに混ぜた盤の保険の手順を模した、長すぎる手順（中身は文言の確認にしか使わない）
const longRuns = Array.from({ length: 400 }, (_, q) => ({ i: q % 2, n: 1, order: 2 }));

console.log('探して見つけた手順のとき');
{
  // 最短だと確定できた場合
  hintPlan = { runs: activeRuns(), optimal: true, ms: 1, method: 'bidirectional' };
  hintBusy = false;
  blinkHint();
  ok(note().includes('最短'), `最短と出ない: ${note()}`);
  ok(/最短 \d+ 手/.test(note()), `手数が出ていない: ${note()}`);
  console.log(`  最短が確定: 「${note()}」`);

  // 探したが最短とは確定できない場合
  hintPlan = { runs: activeRuns(), optimal: false, ms: 1, method: 'constructive' };
  blinkHint();
  ok(!note().includes('最短'), `確定していないのに最短と出る: ${note()}`);
  ok(/残り \d+ 手/.test(note()), `手数が出ていない: ${note()}`);
  console.log(`  最短と確定できない: 「${note()}」`);
}

console.log('\n混ぜた手順の逆だけでも、短いので手数を出す');
{
  solution = shortRuns.map((r) => ({ ...r }));
  hintPlan = null;
  hintBusy = true;
  blinkHint();
  ok(/残り \d+ 手/.test(note()) && !note().includes('最短'), `混ぜた手順の逆で手数が出ない: ${note()}`);
  ok(/(押す|長押し) ×\d+/.test(note()), `押す回数の案内が消えている: ${note()}`);
  console.log(`  探索中でも: 「${note()}」`);
}

console.log('\n長すぎる保険の手順のときは数字を出さない');
{
  solution = longRuns.map((r) => ({ ...r }));
  hintPlan = null;
  // まだ裏で探している
  hintBusy = true;
  blinkHint();
  ok(!/残り|最短/.test(note()), `意味のない手数を出している: ${note()}`);
  ok(note().includes('探しています'), `探している旨が出ない: ${note()}`);
  ok(/(押す|長押し) ×\d+/.test(note()), `押す回数の案内が消えている: ${note()}`);
  console.log(`  探索中: 「${note()}」`);

  // 探し終えても見つからなかった（Worker が無い環境など）
  hintBusy = false;
  blinkHint();
  ok(!/残り|最短/.test(note()), `意味のない手数を出している: ${note()}`);
  ok(/(押す|長押し) ×\d+/.test(note()), `押す回数が出ない: ${note()}`);
  console.log(`  見つからず: 「${note()}」`);

  // 手順そのものがまだ無いとき
  solution = [];
  hintPlan = null;
  blinkHint();
  ok(!/残り|最短/.test(note()), `手順が無いのに手数を出している: ${note()}`);
  console.log(`  手順なし: 「${note()}」`);
}

console.log('\n探し直しで見つかったら、出したままの案内を新しくする');
{
  solution = longRuns.map((r) => ({ ...r }));
  hintPlan = null;
  hintBusy = true;
  blinkHint();
  const before = note();
  ok(before.includes('探しています'), '前提が崩れている');
  // 裏の探索が短い手順を持って返ってきた場面を作る
  hintPlan = { runs: shortRuns.map((r) => ({ ...r })), optimal: false, ms: 1, method: 'constructive' };
  finishSolve(solveId, null, false);
  ok(note() !== before, '見つかったのに案内が古いまま');
  ok(note().includes('短い手順あり'), `知らせが出ない: ${note()}`);
  console.log(`  見つかった後: 「${note()}」`);

  // 光らせる場所は動かさない（押した時点で決めたものを尊重する）
  ok(slots.filter((s) => s._cls.has('hinted')).length <= 1, '点滅が増えている');
}

console.log('\n大きい盤でも、手数を決めて混ぜた盤は短い手数を出す');
for (const [w, d, s] of [[8, 2, 5], [7, 2, 3], [8, 1, 1]]) {
  useStageSetup(w, d); newPuzzle(s);
  hintPlan = null;
  showHint();
  const n = bigNumber(note());
  ok(n === undefined, `${w}×${w} ${DIFFS[d]}: ${n} という数字を出している → ${note()}`);
  ok(/残り \d+ 手/.test(note()), `${w}×${w} ${DIFFS[d]}: 手数が出ない → ${note()}`);
  console.log(`  ${w}×${w} ${DIFFS[d]}: 「${note()}」`);
}

console.log(fail === 0 ? '\nヒントの案内: 全チェック通過' : `\n失敗 ${fail} 件`);
