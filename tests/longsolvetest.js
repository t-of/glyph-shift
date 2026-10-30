// 盤が出ているあいだ、裏で探し続けることの検証。
//   ・探索が終わるたびに、予算を倍にしながら今の盤から探し直す（IMPROVE_BUDGETS の回数まで）
//   ・最短と分かったら止める
//   ・今わかっている手順より短いときだけ差し替える（同じ長さ・長いものでは変えない）
//   ・新しい盤にすると連鎖がやり直しになる。数手打つと、止まった連鎖が再開する
//   ・見張りのタイマーは、そのとき渡した予算に合わせる
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

useStageSetup(5, 2);

// Worker の代わり物。依頼を溜めておいて、こちらから好きな返事を返す。
// newPuzzle は計算中の Worker を捨てて作り直すので、盤を出したあとに差し替える。
const sent = [];
const arm = (seed) => {
  newPuzzle(seed);
  worker = { postMessage: (m) => sent.push(m), terminate: () => {} };
  workerBroken = false;
  hintBusy = false;      // 盤を出したときの先読みは、この検証では見ない
  solveDones = [];
  improveRound = 0;
  sent.length = 0;
};
const noBetter = () => ({ plan: Solver.runsToPlan(solution), optimal: false, method: 'reverse', ms: 10 });

console.log('探索が終わるたびに、予算を倍にして探し直す');
{
  arm(1);
  requestSolve(null, false);
  ok(sent.length === 1, `最初の依頼が出ていない（${sent.length} 件）`);
  ok(sent[0].budget === hintBudgetWorker(), `最初の予算が ${sent[0].budget}（期待 ${hintBudgetWorker()}）`);
  for (let r = 0; r < IMPROVE_BUDGETS.length; r++) {
    finishSolve(sent[r].id, noBetter(), false);
    ok(sent.length === r + 2, `${r + 1} 回目の探し直しが出ていない（${sent.length} 件）`);
    ok(sent[r + 1] && sent[r + 1].budget === IMPROVE_BUDGETS[r], `${r + 1} 回目の予算が ${sent[r + 1] && sent[r + 1].budget}（期待 ${IMPROVE_BUDGETS[r]}）`);
    ok(sent[r + 1] && sent[r + 1].fallback.length === planCost(solution), '探し直しの保険が今の最短の手順でない');
  }
  finishSolve(sent[sent.length - 1].id, noBetter(), false);
  ok(sent.length === IMPROVE_BUDGETS.length + 1, `回数を超えて探し直している（${sent.length} 件）`);
  console.log(`  予算 ${IMPROVE_BUDGETS.join(' → ')}ms と続けて止まる  OK`);

  // 止まったあと、数手打つと連鎖が再開する
  const n0 = sent.length;
  let pressed = 0;
  for (let i = 0; i < SIZE && pressed < 4; i++) if (cyclesAt(i)) { fire(i, 1); pressed++; }
  ok(sent.length === n0 + 1 && sent[n0].budget === IMPROVE_BUDGETS[0], `数手打っても連鎖が再開しない（${sent.length - n0} 件）`);
  ok(sent[n0] && Array.from(sent[n0].start).join() === Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]).join(), '再開の依頼が今の盤から始まっていない');
  console.log('  数手打つと再開  OK');
}

console.log('最短と分かったら止める・短い手順が見つかったら差し替える');
{
  // 混ぜた手順の逆と同じ長さの手順では差し替えない
  arm(2);
  requestSolve(null, false);
  finishSolve(sent[0].id, { plan: Solver.runsToPlan(solution), optimal: false, method: 'constructive', ms: 10 }, false);
  ok(hintPlan === null, '同じ長さで差し替えた');
}
{
  // 本物の探索を回して、混ぜた手順より短い手順が見つかる盤で、差し替わることを見る
  let swapped = false;
  for (let seed = 1; seed < 40 && !swapped; seed++) {
    useStageSetup(5, 1);
    arm(seed);
    parWanted = true;      // 盤が出た直後の先読みと同じ扱い（par を更新する）
    requestSolve(null, false);
    const m = sent[0];
    const res = Solver.solvePuzzle(problem, m.start, m.goal, 1500, m.fallback);
    const before = planCost(solution);
    finishSolve(m.id, res, false);
    const found = res.plan ? planCost(Solver.planToRuns(problem, res.plan, m.start)) : Infinity;
    if (found < before) {
      swapped = true;
      ok(hintPlan && planCost(hintPlan.runs) === found, `短い手順（${found} < ${before}）に差し替わらない`);
      ok(planCost(activeRuns()) === found, 'activeRuns が短いほうでない');
      ok(par && par.cost === found, `par が ${par && par.cost}（期待 ${found}）`);
      if (res.optimal) ok(sent.length === 1, '最短と分かったのに探し直している');
      // 打った手でも手順が追従して、最後に揃う
      let guard = 0;
      while (!isSolved() && guard++ < 200) {
        const r = activeRuns()[0];
        applyMoveState(r.i, r.n <= r.order - r.n ? 1 : -1);
      }
      ok(isSolved(), '差し替えた手順をたどっても揃わない');
    } else {
      ok(hintPlan === null || planCost(hintPlan.runs) >= before, '短くないのに差し替えた');
    }
  }
  ok(swapped, '探索で短くなる盤が見つからなかった（検証できていない）');
  console.log('  短いときだけ差し替わり、たどれば揃う  OK');
}

console.log('新しい盤にすると連鎖がやり直しになる');
{
  useStageSetup(5, 2);
  arm(3);
  requestSolve(null, false);
  finishSolve(sent[0].id, noBetter(), false);
  ok(improveRound === 1, `1 回目のあとの数が ${improveRound}`);
  newPuzzle(4);
  ok(improveRound === 0, '新しい盤で連鎖が戻らない');
  console.log('  盤ごとにやり直し  OK');
}

console.log('保険のタイマーは、そのとき渡した予算に合わせる');
{
  // 決め打ちだと、長く探し直している最中に打ち切って Worker を壊れた扱いにしてしまう。
  const delays = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { delays.push(ms); return realSetTimeout(fn, ms); };
  arm(5);
  requestSolve(null, false);
  const shortDelays = delays.filter((d) => d >= 1000);
  ok(shortDelays.some((d) => d === hintBudgetWorker() + 2000),
    `ふつうの依頼の見張りが ${shortDelays}（期待 ${hintBudgetWorker() + 2000}）`);

  delays.length = 0;
  finishSolve(sent[0].id, noBetter(), false);
  const longDelays = delays.filter((d) => d >= 1000);
  ok(longDelays.some((d) => d === IMPROVE_BUDGETS[0] + 2000),
    `探し直しの見張りが ${longDelays}（期待 ${IMPROVE_BUDGETS[0] + 2000}）`);
  ok(!longDelays.some((d) => d < IMPROVE_BUDGETS[0]),
    `探し直しより短い見張りがある: ${longDelays}`);
  globalThis.setTimeout = realSetTimeout;
  console.log(`  ふつう ${hintBudgetWorker() + 2000}ms / 探し直し ${IMPROVE_BUDGETS[0] + 2000}ms  OK`);
}

console.log(fail === 0 ? '\n裏での探し直し: 全チェック通過' : `\n失敗 ${fail} 件`);
