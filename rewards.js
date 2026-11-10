// 広告まわりの判定と、iOS 版（native/native.js）とのつなぎ口。
// 広告そのもの（AdMob）はここに無い。Web 版では何も出ない。iOS 版の native.js が attach() で広告の出し方を渡す。
//
// 決まり（本部の docs/private/launch/abilitile-appstore.md §2）:
//   - 全画面は、自分で揃えたクリア（今日の 1 問も含む。「解説」で揃えたものは数えない）の通算 6 回目から、3 回に 1 回。
//     出すのはクリアの画面を離れるとき（「次へ」「ホーム」を押したあと）。揃った瞬間には出さない（2026-10-30 オーナー）。
//   - ごほうび広告は、鍵つきのステージ（カスタム含む）を 1 回遊べる権利。貯めない（Entitlement の ticket）。
const Rewards = (() => {
  const COUNT_KEY = 'glyphshift.adClears';   // 自分で揃えた回数（通算）
  const FREE_CLEARS = 5;                     // 最初の 5 回は出さない
  const EVERY = 3;                           // それ以降は 3 回に 1 回
  const FREE_HINTS = 1;                      // 無料版のヒントは 1 盤 1 回まで。2 回目からは広告を 1 回見ると、その盤は使い放題

  // n 回目（1 から数える）のクリアのあとに全画面を出すか。n=6, 9, 12, …
  const interstitialDue = (n) => Number.isInteger(n) && n > FREE_CLEARS && (n - FREE_CLEARS - 1) % EVERY === 0;

  const readCount = () => {
    try {
      const n = Number(localStorage.getItem(COUNT_KEY));
      return Number.isInteger(n) && n > 0 ? n : 0;
    } catch (e) { return 0; }
  };
  const writeCount = (n) => { try { localStorage.setItem(COUNT_KEY, String(n)); } catch (e) { /* 数えられなくても遊べる */ } };

  // 自分で揃えたクリアを 1 回数えて、'abilitile:clear' を送る。detail = { count, due, daily, hint }
  // 送るだけ。広告を出すかどうか（完全版か・iOS か）は受け手（native.js）が決める。
  // hint（ヒントを使ったか）は、iOS 版がレビューのお願いを出す回を選ぶのに使う（ヒントなしで揃えた気持ちのいいときだけ）
  function recordClear(daily, hint) {
    const count = readCount() + 1;
    writeCount(count);
    const detail = { count, due: interstitialDue(count), daily: !!daily, hint: !!hint };
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('abilitile:clear', { detail }));
    } catch (e) { /* 通知できなくても遊べる */ }
    return detail;
  }

  // クリアの画面を離れるときに呼ぶ（script.js が、出す回のクリアのあとにだけ呼ぶ）。'abilitile:interstitial' を送る。
  // 出すかどうか（完全版・iOS・読み込み済みか）は受け手が決める。遊びは待たせない（次の盤はすぐ始まり、広告がその上に出る）。
  function requestInterstitial() {
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('abilitile:interstitial'));
    } catch (e) { /* 通知できなくても遊べる */ }
  }

  // ヒントの門（画面を持たない）。'free' ならそのまま使える、'ad' なら広告の確認を出す。
  // ctx = { locks, full, available, tutorial, clears, used, open, ticketBoard }
  //   locks: 鍵が効くか（iOS 版）  full: 完全版  available: 広告の口があるか  tutorial: 練習中
  //   clears: 自分で揃えた回数（通算）  used: この盤で新しく光らせた回数  open: この盤で広告を見て開いたか
  //   ticketBoard: 広告の券で始めた盤
  // 順は「制限しない場合 → 開いている → 無料の回数が残っている → 広告」。コインを入れるときは、最後の 2 つの間に足す。
  function hintGate(ctx) {
    const c = ctx || {};
    if (!c.locks || c.full || !c.available || c.tutorial || c.ticketBoard) return 'free';
    if (!(c.clears >= FREE_CLEARS)) return 'free';   // 最初の 5 回までは今までどおり
    if (c.open) return 'free';
    if ((c.used || 0) < FREE_HINTS) return 'free';
    return 'ad';
  }

  // ---- ごほうび広告の口 ----
  // provider = { show(): Promise<'earned'|'dismissed'|'failed'> }  見終わって報酬が出たときだけ 'earned'
  let provider = null;
  const listeners = [];
  const attach = (p) => { provider = p; for (const fn of listeners) { try { fn(); } catch (e) { /* 他の受け手を止めない */ } } };
  const onAttach = (fn) => { listeners.push(fn); if (provider) fn(); };
  const available = () => !!provider;
  async function watch() {
    if (!provider) return 'failed';
    try { const r = await provider.show(); return r === 'failed' ? 'failed' : outcome(r); } catch (e) { return 'failed'; }   // 読み込めないときは 'failed' のまま返す
  }
  // 提供元の答えのうち、報酬が出た 'earned' だけを通す
  const outcome = (r) => (r === 'earned' ? 'earned' : 'dismissed');

  return { FREE_CLEARS, EVERY, FREE_HINTS, hintGate, interstitialDue, recordClear, requestInterstitial, attach, onAttach, available, watch, outcome, _count: readCount };
})();
if (typeof window !== 'undefined') window.Rewards = Rewards;
