// par（★の基準）の先読みが、ヒント・手・解説・再生成の割り込みで失われたり
// 別の盤のものが入ったりしないか。Worker は手で返事を配る偽物にする。
// par は盤が出た時点で、混ぜた手順の逆の長さで入っている。探索の返事で短くなることはあっても、長くはならない。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

globalThis.Blob = function () {};
globalThis.URL = { createObjectURL: () => 'blob:x' };
let posts = [];   // solve の依頼（届いた順）
globalThis.Worker = function () {
  this.postMessage = (m) => { if (m.type === 'solve') posts.push(m); };
  this.terminate = () => {};
};
const reply = (m, partial = false) => {
  const res = Solver.solvePuzzle(problem, m.start, m.goal, 800, m.fallback);
  worker.onmessage({ data: { id: m.id, res, partial } });
  return res;
};
const fresh = (seed, s = 5) => {
  workerBroken = false; posts = [];
  useStageSetup(s, 1); newPuzzle(seed);
};

// 1) 先読み中にヒントを押しても、先読みの返事で par が入る
{
  fresh(21);
  ok(posts.length === 1 && par && par.cost === planCost(solution) && !par.optimal, `先読みが出ていない ${posts.length} / ${JSON.stringify(par)}`);
  const pm = posts[0];
  el('hintBtn').fire('click', {});
  ok(posts.length === 1, `ヒントが別の依頼を出した ${posts.length}`);
  reply(pm);
  ok(par && par.cost > 0 && par.cost <= scrambleN, 'ヒント中に par が失われた');
  ok(slots.some((s) => s._cls.has('hinted')), 'ヒントが光らない');
  console.log('  先読み中のヒント: par が残る');
}

// 2) 途中経過のあとにヒント → 最終の返事で par
{
  fresh(22);
  const pm = posts[0];
  const c0 = par.cost;
  reply(pm, true);
  ok(par && par.cost === c0, '途中経過で par が変わった');
  el('hintBtn').fire('click', {});
  reply(pm);
  ok(par && par.cost > 0 && par.cost <= c0, '途中経過のあとのヒントで par が失われた');
  console.log('  途中経過後のヒント: par が残る');
}

// 3) par が決まった直後にヒント → 次のヒント依頼の返事が par を壊さない
{
  fresh(23);
  const pm = posts[0];
  reply(pm);
  const c = par.cost;
  el('hintBtn').fire('click', {});
  ok(posts.length === 2, `ヒント依頼 ${posts.length}`);
  reply(posts[1]);
  ok(par && par.cost === c, 'ヒントの返事で par が変わった');
  console.log('  par 後のヒント: par は変わらない');
}

// 4) 先読み中に手を打ってクリアしても、par で★が付く
{
  fresh(24, 3);
  const pm = posts[0];
  el('hintBtn').fire('click', {});
  board = Array.from({ length: SIZE }, (_, i) => i);
  moves = 1; hintUsed = false; autoSolvedFlag = false;
  showClear();
  ok(!/…/.test(logEl.textContent) && /★/.test(logEl.textContent), `先読み中でも★が付くはず: ${logEl.textContent}`);
  const shown = logEl.textContent, p0 = par.cost;
  reply(pm);
  ok(/★/.test(logEl.textContent) && par.cost === p0, `届いたあとで表示や par が動いた: ${logEl.textContent}`);
  console.log('  先読み中のクリア: すぐ★（あとから動かない）');
}

// 5) 先読み中に解説（揃える）を開いても par が入る
{
  fresh(21);
  const pm = posts[0];
  el('solveBtn').fire('click', {});
  el('confirmYes').fire('click', {});
  ok(posts.length === 1, `解説が別の依頼を出した ${posts.length}`);
  reply(pm);
  ok(par && par.cost > 0 && par.cost <= scrambleN, '解説中に par が失われた');
  console.log('  先読み中の解説: par が残る');
}

// 6) 再生成したら古い返事は捨て、新しい盤の par だけが入る
{
  fresh(21);
  const old = posts[0];
  const oldWorker = worker;
  newPuzzle(23);
  const nw = posts[posts.length - 1];
  const c1 = planCost(solution);
  ok(nw !== old && par && par.cost === c1, '再生成で par が新しい盤のものにならない');
  oldWorker.onmessage({ data: { id: old.id, res: { plan: [], optimal: true, method: 'solved', ms: 0 }, partial: false } });
  ok(par && par.cost === c1, '古い盤の返事が par に入った');
  reply(nw);
  ok(par && par.cost > 0 && par.cost <= c1, '新しい盤の par が入らない');
  console.log('  再生成: 古い返事は捨て、新しい par が入る');
}
// 7) 先読み中に手を打っても par は初期配置のもの。ヒントの返事で par は動かない
{
  fresh(21);
  const pm = posts[0];
  for (let i = 0; i < SIZE; i++) if (cyclesAt(i)) { fire(i, 1); break; }
  el('hintBtn').fire('click', {});
  const c0 = par.cost;
  const res = reply(pm);
  const found = planCost(Solver.planToRuns(problem, res.plan, pm.start));
  ok(par && par.cost === Math.min(c0, found), `手のあとの par ${JSON.stringify(par)}（初期配置の答え ${c0} / 探索 ${found}）`);
  console.log('  先読み中の手: par は初期配置のまま');
}

// 8) ヒントの依頼の返事が、再生成のあとに届いても par に触らない
{
  fresh(21);
  reply(posts[0]);
  el('hintBtn').fire('click', {});
  const hm = posts[1], oldWorker = worker;
  newPuzzle(23);
  oldWorker.onmessage({ data: { id: hm.id, res: { plan: [], optimal: true, method: 'solved', ms: 0 }, partial: false } });
  ok(par && par.cost === planCost(solution), '古いヒントの返事が新しい盤の par に入った');
  reply(posts[posts.length - 1]);
  ok(par && par.cost > 0, '再生成後の par が入らない');
  console.log('  再生成後の古いヒントの返事: 捨てる');
}
console.log(fail === 0 ? '\npar の先読み: 全チェック通過' : `\n失敗 ${fail} 件`);
