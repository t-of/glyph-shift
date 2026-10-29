// 無料版と完全版の鍵: 無料の範囲の判定、ブロックの選び方、鍵が効かない場所では全部開いていること。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 鍵が効かない場所（Web 版・テスト環境）では全部開いている
{
  Entitlement._override(null);
  ok(!Entitlement.locksActive(), 'テスト環境で鍵が効いている');
  ok(Entitlement.isFull(), '鍵が効かない場所が完全版でない');
  ok(Entitlement.stageOpen(10, 13) && Entitlement.stageOpen(3, 2) && Entitlement.customOpen(), '鍵が効かない場所に閉じたものがある');
  ok(ABILITIES.every((ab) => Entitlement.blockOpen(ab.id)), '鍵が効かない場所でブロックが閉じている');
  ok(Entitlement.poolTag() === 'all', '印が all でない');
  console.log('  鍵が効かない場所では全部開いている  OK');
}

// 無料の範囲
{
  Entitlement._override({ locks: true, full: false });
  ok(Entitlement.locksActive() && !Entitlement.isFull(), '無料版にならない');
  for (let s = 3; s <= 10; s++) for (let k = 2; k <= 13; k++) {
    const want = s <= 6 && k <= 4;
    ok(Entitlement.stageOpen(s, k) === want, `${s}×${s} / ${k} 種の判定が違う`);
  }
  ok(!Entitlement.customOpen(), 'カスタムが開いている');
  const free = ABILITIES.filter((ab) => Entitlement.blockOpen(ab.id)).map((ab) => ab.id).sort().join();
  ok(free === ['swapLR', 'swapUD', 'swapD1', 'swapD2', 'crossCW', 'diagCW', 'none'].sort().join(), `無料ブロックが違う: ${free}`);
  ok(Entitlement.poolTag() === 'free', '印が free でない');
  console.log('  無料の範囲の判定  OK');

  // ランダム選びが無料のブロックに収まる（盤・種類数をいろいろ）
  for (const [s, k] of [[3, 2], [4, 3], [5, 4], [6, 4], [3, 4]]) {
    W = H = s; SIZE = s * s; buildDom(); forcedAbilities = null; types = k;
    for (let t = 0; t < 8; t++) {
      generate(1000 + t * 7919);
      const bad = [...new Set(tileAbility)].filter((a) => !Entitlement.blockOpen(ABILITIES[a].id));
      ok(!bad.length, `${s}×${s} / ${k} 種で無料外のブロックが出た: ${bad}`);
    }
  }
  console.log('  ブロックの選び方が無料の範囲に収まる  OK');

  // 保存したゴールのブロックの範囲の印が違えば作り直す
  W = H = 4; SIZE = 16; buildDom(); forcedAbilities = null; types = 3;
  const st = { seed: 12345, clears: 0 };
  Entitlement._override({ locks: true, full: true });
  const full = goalForStage(4, 3, st);
  ok(st.pool === 'all', 'all の印が付かない');
  Entitlement._override({ locks: true, full: false });
  const freeGoal = goalForStage(4, 3, st);
  ok(st.pool === 'free', 'free の印に変わらない');
  ok([...new Set(freeGoal)].every((a) => Entitlement.blockOpen(ABILITIES[a].id)), '作り直したゴールが無料の範囲に収まらない');
  ok(full.length === freeGoal.length, 'ゴールの長さが違う');
  console.log('  ゴールが範囲違いで混ざらない  OK');

  // 完全版にすると全部開く
  Entitlement._override({ locks: true, full: true });
  ok(Entitlement.stageOpen(10, 13) && Entitlement.customOpen() && Entitlement.blockOpen('ringCW'), '完全版で開かない');
  let called = 0;
  Entitlement.onChange(() => { called++; });
  Entitlement.setFull(true);
  ok(called === 1, 'onChange が呼ばれない');
  Entitlement._override(null);
  console.log('  完全版で全部開く・onChange  OK');
}

console.log(fail ? `失敗 ${fail} 件` : '全チェック通過');
