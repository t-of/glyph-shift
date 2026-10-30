// ★の判定と、クリア表示・記録。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 境目: par 10 → ★★★ ≤10, ★★ ≤15, ★ それ以外
{
  ok(starRating(10, 10, false) === 3, 'par ちょうどは ★★★');
  ok(starRating(11, 10, false) === 2, 'par+1 は ★★');
  ok(starRating(15, 10, false) === 2, 'par×1.5 は ★★');
  ok(starRating(16, 10, false) === 1, 'par×1.5 超は ★');
  ok(starRating(5, 3, false) === 2 && starRating(6, 3, false) === 1, 'ceil(4.5)=5 が境目');
  ok(starRating(10, 10, true) === 2, 'ヒント使用は最大 ★★');
  ok(starRating(16, 10, true) === 1, 'ヒント使用でも低いものは据え置き');
  ok(starRating(3, 0, false) === null && starRating(3, null, false) === null, 'par なしは null');
  console.log('  ★の判定の境目  OK');
}

// クリア表示と perfect の記録（par を直接与える）
{
  const s = 5, k = 0;
  useStageSetup(s, k);
  const st = stageFor(s, k);
  newPuzzle(st.seed);
  const before = st.perfect || 0;
  par = { cost: 4, optimal: true };
  moves = 4; hintUsed = false; autoSolvedFlag = false;
  board = Array.from({ length: SIZE }, (_, i) => i);
  showClear();
  ok(/★★★.*最短 4/.test(logEl.textContent), `表示: ${logEl.textContent}`);
  ok(stageFor(s, k).perfect === before + 1, 'perfect が増えていない');

  newPuzzle(stageFor(s, k).seed);
  par = { cost: 4, optimal: false };
  hintUsed = true; autoSolvedFlag = false;
  board = Array.from({ length: SIZE }, (_, i) => i);
  moves = 3; showClear();
  ok(/目安 4/.test(logEl.textContent) && /3 手/.test(logEl.textContent) && !/★★★/.test(logEl.textContent), `表示: ${logEl.textContent}`);
  ok(stageFor(s, k).perfect === before + 1, 'ヒント使用で perfect が増えた');

  newPuzzle(stageFor(s, k).seed);
  par = null; autoSolvedFlag = false;
  board = Array.from({ length: SIZE }, (_, i) => i);
  moves = 7; showClear();
  ok(!/★/.test(logEl.textContent) && /7 手/.test(logEl.textContent), `par なし: ${logEl.textContent}`);

  // 評価中 → 届いたら書き換え + 記録
  newPuzzle(stageFor(s, k).seed);
  par = undefined; autoSolvedFlag = false; hintUsed = false;
  board = Array.from({ length: SIZE }, (_, i) => i);
  moves = 2; showClear();
  ok(/…/.test(logEl.textContent) && !/★/.test(logEl.textContent), `評価中の印が出ない: ${logEl.textContent}`);
  resolvePar({ cost: 5, optimal: true });
  ok(/★★★/.test(logEl.textContent) && stageFor(s, k).perfect === before + 2, `届いた後: ${logEl.textContent}`);

  // 解説で揃えたら★なし
  newPuzzle(stageFor(s, k).seed);
  par = { cost: 4, optimal: true }; autoSolvedFlag = true;
  board = Array.from({ length: SIZE }, (_, i) => i);
  showClear();
  ok(!/★/.test(logEl.textContent), '解説で★が出た');
  console.log('  クリア表示・perfect の記録  OK');
}
console.log(fail ? `失敗 ${fail} 件` : '通過');
