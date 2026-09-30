// ホームのステージ一覧: プレビューのゴールが実際の盤と一致すること、
// クリアで星（回数）が増え、次の盤面の seed が変わること。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// プレビューは混ぜる前のゴールだけを求める。実際に newPuzzle(同じ seed) した
// 盤のゴール（tileAbility）と、絵柄の並びが一致していなければ食い違って見える。
{
  for (const [s, k] of [[5, 3], [4, 2], [8, 5]]) {
    W = H = s; SIZE = s * s; buildDom();
    forcedAbilities = null; types = k;
    const st = stageFor(s, k);
    const preview = stageGoalPreview(s, k, st.seed);
    newPuzzle(st.seed);
    ok(preview.join(',') === tileAbility.join(','),
      `${s}×${s} / ${k} 種: プレビューのゴールが実際の盤（seed ${st.seed}）と一致しない`);
  }
  console.log('  プレビューのゴールが実際の盤と一致  OK');
}

// 自分でクリアすると、そのステージの星が 1 つ増え、次に出す seed が変わる。
// board を identity（board[i] = i）にすると必ず目標の柄になる（snapToGoal と同じ理屈）。
{
  const s = 5, k = 3;
  W = H = s; SIZE = s * s; buildDom();
  forcedAbilities = null; types = k;
  const st = stageFor(s, k);
  newPuzzle(st.seed);
  const seedBefore = st.seed;
  const clearsBefore = st.clears || 0;

  autoSolvedFlag = false;
  board = Array.from({ length: SIZE }, (_, i) => i);
  ok(isSolved(), 'identity の board が目標と判定されない（テストの前提が崩れている）');
  showClear();

  const after = stageFor(s, k);
  ok(after.clears === clearsBefore + 1, `クリア回数が ${after.clears}（期待 ${clearsBefore + 1}）`);
  ok(after.seed !== seedBefore, 'クリアしても seed が変わっていない');
  console.log(`  クリアで星が増える（${clearsBefore} → ${after.clears}）・seed が変わる  OK`);
}

// カードに描く盤（buildStageMini）は、実際のゴールと同じ色の並びになること。
// タイルの背景色は bgOf(能力) で決まるので、i 番目のスロットの中の .tile の
// background が goal[i] の色と一致していれば、絵柄の並びも一致している。
{
  for (const [s, k] of [[5, 3], [4, 2], [8, 5]]) {
    W = H = s; SIZE = s * s; buildDom();
    forcedAbilities = null; types = k;
    const st = stageFor(s, k);
    const goal = goalForStage(s, k, st);

    const mini = document.createElement('div');
    buildStageMini(mini, s, goal);
    ok(mini.children.length === s * s, `${s}×${s}: 描いたマス数が ${mini.children.length}（期待 ${s * s}）`);
    let mismatch = 0;
    for (let i = 0; i < goal.length; i++) {
      const tile = mini.children[i].children[0];
      if (tile.style.background !== bgOf(goal[i])) mismatch++;
    }
    ok(mismatch === 0, `${s}×${s} / ${k} 種: 描いた盤の色がゴールと ${mismatch} マスずれている`);
  }
  console.log('  カードに描く盤が実際のゴールと同じ並び  OK');
}

// 実際にそのステージで遊ぶと（st.goal を覚えると）、あとの一覧はその実際のゴールを使う。
// newPuzzle が引き直し（attempt > 0）を挟んでいても、覚えた実際のゴールとは必ず一致する。
{
  const s = 5, k = 3;
  W = H = s; SIZE = s * s; buildDom();
  forcedAbilities = null; types = k;
  const st = stageFor(s, k);
  newPuzzle(st.seed);
  st.goal = Array.from(tileAbility);   // stageListEl の click ハンドラと同じことをする

  ok(goalForStage(s, k, st).join(',') === tileAbility.join(','),
    '実際に遊んだあとの goalForStage が、そのときの tileAbility と一致しない');
  console.log('  遊んだあとは覚えた実際のゴールを使う  OK');

  // 自分でクリアして seed を引き直すと、古いゴールは使えなくなるので消える
  autoSolvedFlag = false;
  board = Array.from({ length: SIZE }, (_, i) => i);
  showClear();
  ok(stageFor(s, k).goal === undefined, 'クリアで seed を引き直したのに、古い goal が残っている');
  console.log('  クリアで seed を引き直すと古いゴールは消える  OK');
}

// 解説（自動）で揃えたときはステージのクリアに数えない（既存の clears[W] と同じ条件）
{
  const s = 5, k = 3;
  W = H = s; SIZE = s * s; buildDom();
  forcedAbilities = null; types = k;
  const st = stageFor(s, k);
  newPuzzle(st.seed);
  const clearsBefore = st.clears || 0;

  autoSolvedFlag = true;
  board = Array.from({ length: SIZE }, (_, i) => i);
  showClear();

  const after = stageFor(s, k);
  ok(after.clears === clearsBefore, `解説で揃えたのにクリア回数が増えた（${clearsBefore} → ${after.clears}）`);
  console.log('  解説で揃えたときは数えない  OK');
}

console.log(fail === 0 ? '\nステージ一覧: 全チェック通過' : `\n失敗 ${fail} 件`);
