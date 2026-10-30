// 手数を決めた混ぜ方（scrambleBoard / generate）と、答えの手順（混ぜた手順の逆）の検証。
//   ・ちょうど n 手動かし、通った盤面はすべて違い、完成形に戻らない（直前の手を打ち消す手も無い）
//   ・同じ seed なら同じ盤・同じ手順。違う seed なら違う盤
//   ・答えの手順は、プレイヤーが手を打ったあとも（逆手順を足し、隣り合う打ち消しを取り除いて）今の盤から揃う
//   ・長方形・カスタム（指定のブロック）・今日の 1 問も同じ作り方
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const layoutKey = () => board.map((v) => tileAbility[v]).join(',');

// 完成形から手を順に打ち直して、通る盤面を数える
function replay() {
  const tbl = buildMoveTable();
  const b = Array.from({ length: SIZE }, (_, i) => i);
  const keys = [b.map((v) => tileAbility[v]).join(',')];
  let prev = null, consecutive = 0, undo = 0;
  for (const [i, dir] of scrambleMoves) {
    applyTo(b, tbl.cyc[tileAbility[b[i]]][i], dir);
    keys.push(b.map((v) => tileAbility[v]).join(','));
    if (prev && prev[0] === i) { consecutive++; if (dir === -prev[1] || tbl.cnt[tileAbility[b[i]]][i] === 1) undo++; }
    prev = [i, dir];
  }
  return { keys, b, consecutive, undo };
}

console.log('ちょうど n 手・通った盤面はすべて違う・完成形に戻らない');
{
  for (const [s, d] of [[3, 0], [4, 0], [4, 2], [5, 1], [6, 2], [7, 2], [8, 2]]) {
    const def = useStageSetup(s, d);
    for (let t = 0; t < 6; t++) {
      generate(100 + t * 977);
      const { keys, b, consecutive, undo } = replay();
      ok(scrambleMoves.length === def.n, `${s}×${s} ${DIFFS[d]}: ${scrambleMoves.length} 手（期待 ${def.n}）`);
      ok(new Set(keys).size === def.n + 1, `${s}×${s} ${DIFFS[d]}: 通った盤面が ${new Set(keys).size} 個（期待 ${def.n + 1}）`);
      ok(b.join() === board.join(), `${s}×${s} ${DIFFS[d]}: 手を打ち直した結果が盤と違う`);
      ok(!isSolved() && keys[keys.length - 1] !== keys[0], `${s}×${s} ${DIFFS[d]}: 完成形のまま`);
      ok(consecutive === 0 && undo === 0, `${s}×${s} ${DIFFS[d]}: 同じマスの連続 ${consecutive} / 打ち消し ${undo}`);
      ok(planCost(solution) === def.n, `${s}×${s} ${DIFFS[d]}: 答えの手数が ${planCost(solution)}（期待 ${def.n}）`);
    }
  }
  console.log('  OK');
}

console.log('同じ seed なら同じ盤、違う seed なら違う盤');
{
  useStageSetup(5, 1);
  generate(4242);
  const a = { b: layoutKey(), g: tileAbility.join(), m: JSON.stringify(scrambleMoves), s: JSON.stringify(solution) };
  generate(4242);
  ok(layoutKey() === a.b && tileAbility.join() === a.g && JSON.stringify(scrambleMoves) === a.m && JSON.stringify(solution) === a.s, '同じ seed で盤が変わった');
  const seen = new Set();
  for (let t = 0; t < 10; t++) { generate(7000 + t); seen.add(layoutKey() + '|' + tileAbility.join()); }
  ok(seen.size >= 9, `違う seed なのに同じ盤が多い（${seen.size} / 10）`);
  console.log('  OK');
}

console.log('プレイヤーが手を打っても、答えの手順は今の盤から揃う');
{
  for (const [s, d] of [[4, 1], [5, 2], [6, 1], [8, 2]]) {
    const def = useStageSetup(s, d);
    for (let t = 0; t < 5; t++) {
      newPuzzle(300 + t * 13);
      const before = planCost(activeRuns());
      // 逆に打って戻す手は、答えの手順から取り除かれる（隣り合う打ち消し）
      const cells0 = legalCells();
      const i0 = cells0[0];
      const startRuns = JSON.stringify(solution);
      applyMoveState(i0, 1); applyMoveState(i0, -1);
      ok(JSON.stringify(solution) === startRuns, `${s}×${s}: 押して戻したのに手順が変わった`);
      // ランダムに何手か打つ（向きもばらばら）
      const rng = mulberry32(900 + t);
      const P = 3 + Math.floor(rng() * 6);
      for (let q = 0; q < P; q++) {
        const cells = legalCells();
        applyMoveState(cells[Math.floor(rng() * cells.length)], rng() < 0.5 ? 1 : -1);
      }
      const known = planCost(activeRuns());
      ok(known <= before + P, `${s}×${s}: 打った ${P} 手のあと、答えが ${known} 手（最初 ${before} 手 + ${P}）`);
      let guard = 0;
      while (!isSolved() && guard++ < 500) {
        const r = activeRuns()[0];
        if (!r) break;
        applyMoveState(r.i, r.n <= r.order - r.n ? 1 : -1);
      }
      ok(isSolved(), `${s}×${s} ${DIFFS[d]}: ${P} 手打ったあと、答えの手順で揃わない`);
      ok(guard - 1 <= known, `${s}×${s}: 揃うまでに ${guard - 1} 手（見込み ${known}）`);
    }
  }
  console.log('  OK');
}

console.log('長方形・カスタム（指定のブロック）・今日の 1 問も同じ作り方');
{
  // 長方形 + 指定のブロック
  W = 6; H = 4; SIZE = 24; buildDom();
  forcedAbilities = [abId('swapLR'), abId('crossCW'), abId('none'), abId('diagCW')];
  types = 4; scrambleN = movesFor(6, 4, 1);
  generate(55);
  ok(scrambleMoves.length === scrambleN && !isSolved(), `カスタム: ${scrambleMoves.length} 手（期待 ${scrambleN}）`);
  ok([...new Set(tileAbility)].every((a) => forcedAbilities.includes(a)), 'カスタム: 指定外のブロックが出た');
  ok(new Set(replay().keys).size === scrambleN + 1, 'カスタム: 通った盤面が重なる');
  forcedAbilities = null;

  // 動かせるものが「何も起きない」以外に 1 種しかない指定（動くマスが少ない）でも作れる
  W = H = 4; SIZE = 16; buildDom();
  forcedAbilities = [abId('swapLR'), abId('none')];
  types = 2; scrambleN = 4;
  generate(56);
  ok(scrambleMoves.length >= 1 && !isSolved(), `動くマスが少ない組: ${scrambleMoves.length} 手`);
  forcedAbilities = null;

  // 今日の 1 問: 同じ日なら同じ盤。5×5 ふつうと同じ手数・種類数。全ブロックから
  W = H = DAILY_SIZE; SIZE = DAILY_SIZE * DAILY_SIZE; buildDom(); types = DAILY_TYPES; scrambleN = DAILY_MOVES; curDiff = DAILY_DIFF;
  newPuzzle(dailySeed('2026-10-30'), '2026-10-30');
  const d1 = layoutKey() + '|' + tileAbility.join();
  newPuzzle(dailySeed('2026-10-30'), '2026-10-30');
  ok(d1 === layoutKey() + '|' + tileAbility.join(), '今日の 1 問が同じ日で変わる');
  ok(scrambleMoves.length === DAILY_MOVES && new Set(tileAbility).size === DAILY_TYPES, `今日の 1 問: ${scrambleMoves.length} 手 / ${new Set(tileAbility).size} 種`);
  ok(DAILY_SIZE === 5 && DAILY_MOVES === stageDef(5, 1).n && DAILY_TYPES === stageDef(5, 1).k, '今日の 1 問が 5×5 ふつうと違う');
  console.log('  OK');
}

console.log(fail === 0 ? '\n手数を決めた混ぜ方: 全チェック通過' : `\n失敗 ${fail} 件`);
