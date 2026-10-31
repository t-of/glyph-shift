// 無料版と完全版の鍵: 無料の範囲の判定、ブロックの選び方、鍵が効かない場所では全部開いていること。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 鍵が効かない場所（Web 版・テスト環境）では全部開いている
{
  Entitlement._override(null);
  ok(!Entitlement.locksActive(), 'テスト環境で鍵が効いている');
  ok(Entitlement.isFull(), '鍵が効かない場所が完全版でない');
  ok(Entitlement.stageOpen(8, 2) && Entitlement.stageOpen(3, 0) && Entitlement.customOpen(), '鍵が効かない場所に閉じたものがある');
  ok(ABILITIES.every((ab) => Entitlement.blockOpen(ab.id)), '鍵が効かない場所でブロックが閉じている');
  ok(Entitlement.poolTag() === 'all', '印が all でない');
  console.log('  鍵が効かない場所では全部開いている  OK');
}

// 無料の範囲
{
  Entitlement._override({ locks: true, full: false });
  ok(Entitlement.locksActive() && !Entitlement.isFull(), '無料版にならない');
  // 無料: 3×3（練習）、4×4・5×5 の上の行、6×6 のやさしい。完全版: 6×6 のふつう・むずかしい、7×7、8×8、下の行（上級〜名人）
  for (const s of STAGE_SIZES) for (let d = 0; d < DIFFS.length; d++) {
    if (!stageDef(s, d)) continue;
    const want = d < 3 && (s <= 5 || (s === 6 && d === 0));
    ok(Entitlement.stageOpen(s, d) === want, `${s}×${s} / ${DIFFS[d]} の判定が違う`);
  }
  ok(Entitlement.stageOpen(6, 0) && !Entitlement.stageOpen(6, 1) && !Entitlement.stageOpen(6, 2), '6×6 の境目が違う');
  ok(Entitlement.stageOpen(5, 2) && Entitlement.stageOpen(3, 0) && !Entitlement.stageOpen(7, 0) && !Entitlement.stageOpen(8, 0), '大きさの境目が違う');
  // どの無料ステージも、無料のブロックだけで盤が作れる（表の種類数が無料ブロックの数 7 以下）
  for (const s of STAGE_SIZES) for (let d = 0; d < DIFFS.length; d++) {
    if (stageDef(s, d) && Entitlement.stageOpen(s, d)) ok(stageDef(s, d).k <= Entitlement.FREE_BLOCKS.length, `${s}×${s} / ${DIFFS[d]} が無料のブロック数を超える`);
  }
  ok(!Entitlement.customOpen(), 'カスタムが開いている');
  const free = ABILITIES.filter((ab) => Entitlement.blockOpen(ab.id)).map((ab) => ab.id).sort().join();
  ok(free === ['swapLR', 'swapUD', 'swapD1', 'swapD2', 'crossCW', 'diagCW', 'none'].sort().join(), `無料ブロックが違う: ${free}`);
  ok(Entitlement.poolTag() === 'free', '印が free でない');
  console.log('  無料の範囲の判定  OK');

  // ランダム選びが無料のブロックに収まる（盤・種類数をいろいろ）
  for (const [s, d] of [[3, 0], [4, 1], [5, 2], [6, 0], [3, 2], [5, 0]]) {
    useStageSetup(s, d);
    for (let t = 0; t < 8; t++) {
      generate(1000 + t * 7919);
      const bad = [...new Set(tileAbility)].filter((a) => !Entitlement.blockOpen(ABILITIES[a].id));
      ok(!bad.length, `${s}×${s} / ${DIFFS[d]} で無料外のブロックが出た: ${bad}`);
    }
  }
  console.log('  ブロックの選び方が無料の範囲に収まる  OK');

  // 保存したゴールのブロックの範囲の印が違えば作り直す
  useStageSetup(4, 1);
  const st = { seed: 12345, clears: 0 };
  Entitlement._override({ locks: true, full: true });
  const full = goalForStage(4, 1, st);
  ok(st.pool === 'all', 'all の印が付かない');
  Entitlement._override({ locks: true, full: false });
  const freeGoal = goalForStage(4, 1, st);
  ok(st.pool === 'free', 'free の印に変わらない');
  ok([...new Set(freeGoal)].every((a) => Entitlement.blockOpen(ABILITIES[a].id)), '作り直したゴールが無料の範囲に収まらない');
  ok(full.length === freeGoal.length, 'ゴールの長さが違う');
  console.log('  ゴールが範囲違いで混ざらない  OK');

  // 鍵つきのステージの絵は全ブロックで作る（買ったあとも同じ絵のまま遊べる）
  const lockedSt = { seed: 777, clears: 0 };
  const lockedGoal = goalForStage(7, 1, lockedSt);
  ok(lockedSt.pool === 'all', '鍵つきのステージが all の印にならない');
  let paid = false;
  for (let t = 0; t < 6 && !paid; t++) {
    const g = goalForStage(7, 1, { seed: 5000 + t, clears: 0 });
    paid = g.some((a) => !Entitlement.FREE_BLOCKS.includes(ABILITIES[a].id));
  }
  ok(paid, '鍵つきのステージの絵に完全版のブロックが出ない');
  Entitlement._override({ locks: true, full: true });
  ok(goalForStage(7, 1, lockedSt).join() === lockedGoal.join(), '買ったあとに鍵つきのステージの絵が変わる');
  Entitlement._override({ locks: true, full: false });
  console.log('  鍵つきのステージの絵は全ブロック  OK');

  // 完全版にすると全部開く
  Entitlement._override({ locks: true, full: true });
  ok(Entitlement.stageOpen(8, 2) && Entitlement.stageOpen(6, 1) && Entitlement.customOpen() && Entitlement.blockOpen('ringCW'), '完全版で開かない');
  let called = 0;
  Entitlement.onChange(() => { called++; });
  Entitlement.setFull(true);
  ok(called === 1, 'onChange が呼ばれない');
  Entitlement._override(null);
  console.log('  完全版で全部開く・onChange  OK');
}

// ストア（StoreKit）をつなぐ: 答えが来たらそれだけを信じる。購入・復元・返金
(async () => {
  const mk = (state) => ({
    price: async () => '¥500',
    check: async () => { if (state.fail) throw new Error('offline'); return state.full; },
    purchase: async () => state.next,
    restore: async () => state.full,
  });
  const st = { full: false, next: 'cancelled', fail: false };
  Entitlement._override({ locks: true });          // full は決めない（ストアと控えの経路を通す）
  Entitlement._resetStore();
  try { localStorage.setItem('glyphshift.full', '1'); } catch (e) { /* テスト環境に無ければ無視 */ }
  Entitlement.attachStore(mk(st));
  ok(Entitlement.hasStore(), 'ストアがつながらない');
  ok(await Entitlement.storePrice() === '¥500', '値段が取れない');
  let n = 0; Entitlement.onChange(() => { n++; });
  // 控えが「完全版」でも、ストアが「違う」と答えたら鍵が戻る
  await Entitlement.refreshFromStore();
  ok(!Entitlement.isFull(), 'ストアの答え（未購入）で控えを上書きしない');
  // 購入: キャンセルでは変わらない、成功で開く
  ok(await Entitlement.purchase() === 'cancelled' && !Entitlement.isFull(), 'キャンセルで開いた');
  st.next = 'purchased'; st.full = true;
  const before = n;
  ok(await Entitlement.purchase() === 'purchased' && Entitlement.isFull() && n === before + 1, '購入で開かない');
  // 返金・取り消し: 次の確認で閉じる
  st.full = false;
  await Entitlement.refreshFromStore();
  ok(!Entitlement.isFull(), '返金で鍵が戻らない');
  // 確認できないとき（通信エラー）は今の表示のまま
  st.full = true; await Entitlement.restore();
  ok(Entitlement.isFull(), '復元で開かない');
  st.fail = true; st.full = false;
  await Entitlement.refreshFromStore();
  ok(Entitlement.isFull(), '確認できないのに表示を変えた');
  Entitlement._resetStore(); Entitlement._override(null);
  console.log('  ストア（購入・復元・返金・確認失敗）  OK');
  console.log(fail ? `失敗 ${fail} 件` : '全チェック通過');
})();
