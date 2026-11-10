// ヒントの門: 無料版は 1 盤 1 回まで、2 回目から広告を見るとその盤は使い放題。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);
const base = { locks: true, full: false, available: true, tutorial: false, clears: 5, used: 1, open: false, ticketBoard: false };
const gate = (o) => Rewards.hintGate({ ...base, ...o });

// 門の表
{
  ok(gate({}) === 'ad', '無料版の 2 回目が広告にならない');
  ok(gate({ used: 0 }) === 'free', '1 回目が無料でない');
  ok(gate({ locks: false }) === 'free', 'Web 版が無制限でない');
  ok(gate({ full: true }) === 'free', '完全版が無制限でない');
  ok(gate({ tutorial: true }) === 'free', 'チュートリアルが無制限でない');
  ok(gate({ clears: 4 }) === 'free' && gate({ clears: 0 }) === 'free', '最初の 5 回が無制限でない');
  ok(gate({ available: false }) === 'free', '広告の口が無いのに取り上げた');
  ok(gate({ ticketBoard: true }) === 'free', '券の盤が無制限でない');
  ok(gate({ open: true, used: 9 }) === 'free', '開いた盤が無制限でない');
  console.log('  門の表  OK');
}

const fakeAd = (answer) => { let n = 0; Rewards.attach({ show: async () => { n++; return answer; } }); return () => n; };
const setup = (seed) => { W = H = 4; SIZE = 16; buildDom(); forcedAbilities = null; types = 3; scrambleN = 10; newPuzzle(seed); };
const lit = () => slots.some((s) => s._cls.has('hinted'));

{
  Entitlement._override({ locks: true, full: false });
  localStorage.setItem('glyphshift.adClears', '5');

  // 数え方と広告の答え
  {
    const shown = fakeAd('earned');
    setup(11);
    ok(el('hintAd').hidden, '始めから札が出ている');
    el('hintBtn').fire('click', {});   // 1 回目: タイムの確認
    confirmAction();
    ok(lit() && hintsSpent === 1, '1 回目が光らない');
    ok(el('hintAd').hidden, '押し直しの前から札が出ている');
    el('hintBtn').fire('click', {});   // 動かす前の押し直しは数えない・広告も出ない
    ok(confirmEl.hidden && hintsSpent === 1, '押し直しで数えた／確認が出た');
    // 1 手動かす
    const r = activeRuns()[0]; fire(r.i, 1); fire(r.i, -1);
    moves = Math.max(moves, 1);
    syncHintAd();
    ok(!el('hintAd').hidden, '1 手動かしたあとに札が出ない');
    ok(el('hintBtn').getAttribute('aria-label') === '広告を見てヒントを開く', '読み上げが変わらない');
    el('hintBtn').fire('click', {});
    ok(!confirmEl.hidden && !hintOpen, '2 回目に広告の確認が出ない');
    confirmAction();   // 広告の答えは hintAdAnswered で受ける（非同期の待ちは実行台が待たないため、答えを直接渡す）
    hintAdAnswered('earned');
    ok(hintOpen, 'earned で開かない');
    ok(lit() && hintsSpent === 2, 'earned のあとすぐ光らない');
    ok(el('hintAd').hidden, '見終わったのに札が残る');
    // 開いた盤は確認なしで何回でも
    const r2 = activeRuns()[0]; if (r2) { fire(r2.i, 1); moves++; }
    el('hintBtn').fire('click', {});
    ok(confirmEl.hidden, '開いた盤でまた広告になった');
    // 盤が変わると戻る
    setup(12);
    ok(!hintOpen && hintsSpent === 0 && el('hintAd').hidden, '盤が変わっても戻らない');
    console.log('  数え方と earned  OK');
  }

  // failed でも開く、dismissed は開かない
  for (const [ans, opens] of [['failed', true], ['dismissed', false]]) {
    fakeAd(ans); setup(11);
    hintsSpent = 1; hintAtMoves = -1; hintUsed = true; moves = 1; syncHintAd();
    el('hintBtn').fire('click', {});
    ok(!confirmEl.hidden, `${ans}: 確認が出ない`);
    confirmAction(); hintAdAnswered(ans);
    ok(hintOpen === opens, `${ans}: 開き方が違う`);
    ok(lit() === opens, `${ans}: 光り方が違う`);
  }
  console.log('  failed / dismissed  OK');

  // 今日の 1 問: 確認が 2 つ続かない（2 回目は広告の確認だけ）
  {
    fakeAd('earned'); setup(11);
    dailyKey = '2026-11-11';
    hintUsed = true; hintsSpent = 1; hintAtMoves = -1; moves = 1; syncHintAd();
    el('hintBtn').fire('click', {});
    ok(!confirmEl.hidden && el('confirmYes').textContent === '見る', '今日の 1 問で広告の確認が出ない');
    confirmAction(); hintAdAnswered('earned');
    ok(confirmEl.hidden && hintOpen, '今日の 1 問で確認が続けて出た');
    dailyKey = null;
    console.log('  今日の 1 問  OK');
  }

  // 券で始めた盤は開いている
  {
    fakeAd('earned'); Entitlement.grantTicket();
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'script.js'), 'utf8');
    ok((src.match(/hasTicket\(\)\) \{ hintOpen = true/g) || []).length === 2, '券の盤で開く処理が 2 か所に無い');
    Entitlement.useTicket();
  }

  // 全画面は、ヒントの広告を見た盤でもふつうの回数の決まりどおり
  {
    ok(Rewards.interstitialDue(6) && !/hintOpen[^\n]*interstitial|interstitial[^\n]*hintOpen/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'script.js'), 'utf8')), '全画面の決まりがヒントの広告で変わっている');
  }

  Entitlement._override(null);
}
console.log(fail ? `失敗 ${fail} 件` : '全チェック通過');

