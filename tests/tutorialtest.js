// 最初のチュートリアル: 5 面の最短手数、無料のブロックだけ、記録がある人には出さない、★・回数に数えない
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);
const idOf = (a) => ABILITIES[a].id;

// 1) 5 面それぞれの最短手数と、使うブロック
{
  ok(TUTORIAL_STAGES.length === 5, `面の数 ${TUTORIAL_STAGES.length}`);
  const want = [1, 2, 1, 3, 4];
  TUTORIAL_STAGES.forEach((def, n) => {
    const b = tutorialBoard(def);
    loadFixedPuzzle(b);
    ok(W === def.w && H === def.h, `${n + 1} 面の盤の大きさ`);
    ok(!isSolved(), `${n + 1} 面が最初から揃っている`);
    const start = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]);
    const goal = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]);
    const res = Solver.solvePuzzle(problem, start, goal, 8000);
    const cost = planCost(Solver.planToRuns(problem, res.plan, start));
    ok(res.optimal, `${n + 1} 面の最短が確定していない`);
    ok(cost === want[n], `${n + 1} 面の最短 ${cost} 手（期待 ${want[n]}）`);
    ok(def.moves === want[n], `${n + 1} 面の定義の手数 ${def.moves}`);
    const used = new Set(tileAbility.map(idOf));
    ok([...used].every((id) => Entitlement.FREE_BLOCKS.includes(id)), `${n + 1} 面に無料でないブロック ${[...used]}`);
    // 手で決めた並びのとおりになっている
    ok(tileAbility.map((a) => Object.keys(TUT_CHAR).find((c) => TUT_CHAR[c] === idOf(a))).join('') === def.goal, `${n + 1} 面の目標`);
    ok(board.map((v) => Object.keys(TUT_CHAR).find((c) => TUT_CHAR[c] === idOf(tileAbility[v]))).join('') === def.start, `${n + 1} 面の開始の並び`);
    // 保険の手順（solution）も同じ手数
    ok(planCost(solution) === want[n], `${n + 1} 面の手順の手数 ${planCost(solution)}`);
  });
  // 3 面: 押すと 3 回、長押しなら 1 回
  loadFixedPuzzle(tutorialBoard(TUTORIAL_STAGES[2]));
  ok(solution.length === 1 && solution[0].n === 3 && solution[0].order === 4, '3 面は 3 回押す形（＝長押し 1 回）になっていない');
  // 2 面: 1 手目で能力のあるタイルが動き、2 手目で動いた先から使う
  loadFixedPuzzle(tutorialBoard(TUTORIAL_STAGES[1]));
  ok(solution.length === 2 && solution[0].i !== solution[1].i, '2 面が別々のマスを押す 2 手になっていない');
  console.log('  5 面の最短手数（1・2・1・3・4）と無料のブロックだけ: OK');
}

// 2) 記録がある人には出さない
{
  const reset = () => { localStorage.clear(); for (const k of Object.keys(stages)) delete stages[k]; for (const k of Object.keys(clears)) delete clears[k]; for (const k of Object.keys(daily)) delete daily[k]; };
  reset();
  ok(shouldShowTutorial(), '空の状態で出ない');
  stageFor(4, 2);   // 一覧を描くだけでも stages は書かれる
  ok(shouldShowTutorial(), '一覧を描いただけで出なくなる');
  stages['4x2'].clears = 1;
  ok(!shouldShowTutorial(), 'ステージの記録があるのに出る');
  reset();
  clears[4] = 3;
  ok(!shouldShowTutorial(), '旧仕様のクリア数があるのに出る');
  reset();
  daily['2026-10-29'] = { moves: 5, stars: 3, hint: false };
  ok(!shouldShowTutorial(), '今日の 1 問の記録があるのに出る');
  reset();
  localStorage.setItem('glyphshift.tutorial', 'done');
  ok(!shouldShowTutorial(), '済んだ印があるのに出る');
  reset();
  console.log('  記録がある人・済んだ人には出ない: OK');
}

// 3) 最後まで進めてもクリアの回数・★・広告の回数に数えない。終えたら済んだ印と通常の盤
{
  localStorage.clear();
  const got = [];
  const winPrev = globalThis.window;
  globalThis.window = { dispatchEvent: (e) => got.push(e.detail), Rewards };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o.detail; } };
  startTutorial();
  ok(!el('tutBar').hidden && el('play').hidden === false, '練習の画面が出ない');
  for (let n = 0; n < 5; n++) {
    ok(tutorial && tutorial.idx === n, `${n + 1} 面目に居ない（${tutorial && tutorial.idx}）`);
    let guard = 0;
    while (!locked && activeRuns().length && guard++ < 20) {
      const r = activeRuns()[0];
      fire(r.i, r.n <= r.order - r.n ? 1 : -1);
    }
    ok(isSolved() && locked, `${n + 1} 面が揃わない`);
    ok(el('log').textContent === 'できた！', `揃った表示 ${el('log').textContent}`);
    flushTimers();
  }
  ok(tutorial === null, '最後まで進めても練習が終わらない');
  ok(el('title').hidden === false, 'ホームに着かない');
  ok(localStorage.getItem('glyphshift.tutorial') === 'done', '済んだ印が残らない');
  ok(Rewards._count() === 0 && localStorage.getItem('glyphshift.adClears') === null, `広告の回数に数えた ${Rewards._count()}`);
  ok(got.length === 0, '広告の知らせが飛んだ');
  ok(!hasPlayRecords(), 'ステージ・今日の 1 問の記録が付いた');
  ok(localStorage.getItem('glyphshift.clears') === null && localStorage.getItem('glyphshift.daily') === null, '記録が書かれた');
  ok(W === 4 && H === 4 && types === 2 && !isSolved() && run.i === -1, '終わったあとの盤が通常に戻っていない');
  ok(!shouldShowTutorial(), '終えたのにまた出る');
  globalThis.window = winPrev;
  delete globalThis.CustomEvent;
  console.log('  5 面を進めてホームへ。★・回数・広告に数えない: OK');
}

// 4) スキップ
{
  localStorage.clear();
  startTutorial();
  el('tutSkip').fire('click', {});
  ok(tutorial === null && el('title').hidden === false, 'スキップでホームに着かない');
  ok(localStorage.getItem('glyphshift.tutorial') === 'done', 'スキップで印が残らない');
  startTutorial();   // 「もう一度」
  ok(tutorial && tutorial.idx === 0, 'もう一度が始まらない');
  goHome();
  console.log('  スキップと、もう一度: OK');
}

console.log(fail ? `失敗 ${fail} 件` : '全チェック通過');
