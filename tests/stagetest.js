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
