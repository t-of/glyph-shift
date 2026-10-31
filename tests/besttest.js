// ベスト更新の演出（2026-10-31）: 初めてのクリアは普通の行、前より速ければ NEW BEST・金色の波、遅ければベストを添える。
// ヒントを使った回はベストに入れない
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
let now = 0; clockNow = () => now;
const solveIn = (ms, hint = false) => {
  now = 1000; playStage(4, 0); show(playEl); stageClockSync();
  hintUsed = hint;
  now = 1000 + ms;
  board = Array.from({ length: SIZE }, (_, i) => i); par = { cost: 4, optimal: true }; autoSolvedFlag = false; moves = 4;
  showClear();
};
const st = () => stageFor(4, 0);
// 仮の DOM は replaceChildren で textContent が変わらないので、演出の行は子から読む
const line = () => (logEl._cls.has('best-line') ? logEl.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join('') : logEl.textContent);
{
  delete stages['4d0'];
  solveIn(30000);
  ok(st().best === 30000 && line() === 'クリア 0:30' && !gridEl._cls.has('best'), `初めて: ${st().best} ${line()}`);
  solveIn(42000);
  ok(st().best === 30000 && line() === 'クリア 0:42 ・ ベスト 0:30' && !gridEl._cls.has('best'), `遅い回: ${line()}`);
  solveIn(17500);
  ok(st().best === 17500 && gridEl._cls.has('best') && logEl._cls.has('best-line'), '速い回で演出が出ない');
  ok(/NEW BEST/.test(line()) && /0:17/.test(line()) && /−12\.5 秒/.test(line()), `更新の行: ${line()}`);
  solveIn(5000, true);
  ok(st().best === 17500 && /ヒントあり/.test(line()) && !gridEl._cls.has('best'), `ヒントの回がベストに入った: ${st().best}`);
  ok(st().recent.join() === '30000,42000,17500', `直近の記録: ${st().recent}`);
  // 次の盤では演出の印が残らない
  playStage(4, 0);
  ok(!gridEl._cls.has('best') && !logEl._cls.has('best-line'), `次の盤に演出の印が残った: ${[...gridEl._cls]} / ${[...logEl._cls]}`);
  console.log('  ベスト更新の演出  OK');
}
clockNow = () => performance.now();
console.log(fail ? `失敗 ${fail} 件` : '通過');
