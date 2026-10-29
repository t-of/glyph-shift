// 広告まわりの判定: 全画面の間隔（最初の 5 回は出さない、以降 3 回に 1 回）、クリアの数え方、ごほうびの 1 回きり。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 全画面を出す回: 6, 9, 12, …
{
  const due = [];
  for (let n = 0; n <= 30; n++) if (Rewards.interstitialDue(n)) due.push(n);
  ok(due.join() === [6, 9, 12, 15, 18, 21, 24, 27, 30].join(), `出す回が違う: ${due}`);
  ok(![1, 2, 3, 4, 5].some(Rewards.interstitialDue), '最初の 5 回に出る');
  ok(!Rewards.interstitialDue(-3) && !Rewards.interstitialDue(NaN) && !Rewards.interstitialDue(6.5) && !Rewards.interstitialDue(undefined), '変な値で出る');
  console.log('  全画面の間隔（6 回目から 3 回に 1 回）  OK');
}

// 数える・知らせる
{
  localStorage.removeItem('glyphshift.adClears');
  const got = [];
  globalThis.window = { dispatchEvent: (e) => got.push(e.detail) };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o.detail; } };
  const seq = [];
  for (let i = 0; i < 7; i++) seq.push(Rewards.recordClear(i === 2));
  ok(seq.map((d) => d.count).join() === '1,2,3,4,5,6,7', '回数が数えられない');
  ok(seq.map((d) => d.due).join() === 'false,false,false,false,false,true,false', '6 回目だけ出す印にならない');
  ok(seq[2].daily === true && seq[3].daily === false, '今日の 1 問の印が違う');
  ok(got.length === 7 && got[5].due === true, '知らせが届かない');
  ok(Rewards._count() === 7, '回数が保存されない');
  delete globalThis.window; delete globalThis.CustomEvent;
  console.log('  クリアの数え方と知らせ  OK');
}

// 自分で揃えると数え、解説で揃えると数えない
{
  localStorage.removeItem('glyphshift.adClears');
  W = H = 4; SIZE = 16; buildDom(); types = 2; newPuzzle(3);
  requestSolve();
  let guard = 0;
  while (!locked && activeRuns().length && guard++ < 400) {
    const r = activeRuns()[0];
    fire(r.i, r.n <= r.order - r.n ? 1 : -1);
  }
  ok(isSolved() && Rewards._count() === 1, `自分で揃えたのに数えていない: ${Rewards._count()}`);
  autoSolvedFlag = true; showClear(); autoSolvedFlag = false;
  ok(Rewards._count() === 1, '解説で揃えたものを数えた');
  console.log('  自分で揃えたときだけ数える  OK');
}

// ごほうびの口（報酬が出たときだけ earned。広告が無ければ使えない）
{
  ok(!Rewards.available(), '広告が無いのに使える');
  ok(Rewards.outcome('earned') === 'earned' && Rewards.outcome('dismissed') === 'dismissed' && Rewards.outcome(undefined) === 'dismissed' && Rewards.outcome('x') === 'dismissed', '報酬の判定が違う');
  Rewards.attach({ show: async () => 'earned' });
  ok(Rewards.available(), '広告をつないでも使えない');
  console.log('  ごほうび広告の口  OK');
}

// 1 回きりの権利
{
  Entitlement._override({ locks: true, full: false });
  let changes = 0; Entitlement.onChange(() => { changes++; });
  ok(!Entitlement.stageOpen(8, 5) && !Entitlement.customOpen() && !Entitlement.hasTicket(), '無料版で最初から開いている');
  Entitlement.grantTicket();
  ok(Entitlement.hasTicket() && Entitlement.stageOpen(8, 5) && Entitlement.customOpen() && Entitlement.blockOpen('swapAll8') !== false, '権利で開かない');
  ok(!Entitlement.isFull(), '権利で完全版になった（広告が止まる）');
  ok(Entitlement.poolTag() === 'all', '権利のあいだ印が all でない');
  Entitlement.grantTicket();   // 貯めない
  Entitlement.useTicket();
  ok(!Entitlement.hasTicket() && !Entitlement.stageOpen(8, 5), '使ったあとも開いている');
  Entitlement.useTicket();     // 2 回使っても何も起きない
  ok(changes === 2, `知らせの回数が違う: ${changes}`);
  Entitlement.grantTicket(); Entitlement.dropTicket();
  ok(!Entitlement.hasTicket() && !Entitlement.stageOpen(10, 13), 'ホームに戻っても残る');
  // 完全版には要らない
  Entitlement._override({ locks: true, full: true });
  Entitlement.grantTicket();
  ok(!Entitlement.hasTicket(), '完全版で権利が付いた');
  Entitlement._override(null);
  console.log('  ごほうびの 1 回きり  OK');
}
console.log(fail ? `失敗 ${fail} 件` : '全チェック通過');
