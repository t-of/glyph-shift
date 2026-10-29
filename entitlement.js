// 無料版と完全版の鍵。
// 鍵が効くのは iOS アプリ（Capacitor）の中だけ。Web 版は今までどおり全部遊べる。
// 開発の確かめ用に、localhost だけ ?locks=1（鍵を効かせる）と ?full=1（完全版にする）を受け付ける。
//
// 「買った」かどうかはストアが決める（RULES §13）。いまは仮に localStorage を見ているが、
// あとで StoreKit の結果に差し替える。差し替えるのは readFull() の 1 か所だけ。
const Entitlement = (() => {
  const FULL_KEY = 'glyphshift.full';   // 仮。購入の実装が入ったらネイティブ側の値に置き換える

  // 無料で遊べる範囲
  const FREE_BLOCKS = ['swapLR', 'swapUD', 'swapD1', 'swapD2', 'crossCW', 'diagCW', 'none'];
  const FREE_MAX_SIZE = 6;     // 正方形 3〜6
  const FREE_MAX_TYPES = 4;    // 使う種類 2〜4

  // テスト用の差し替え。{ locks, full } を入れると環境の判定より優先する。
  let override = null;
  const listeners = [];

  const query = () => {
    try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); }
  };
  const isLocalhost = () => {
    try { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname); } catch (e) { return false; }
  };

  function locksActive() {
    if (override && 'locks' in override) return !!override.locks;
    const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
    return isLocalhost() && query().get('locks') === '1';
  }

  // 仮の置き場。ここだけ差し替えればよい。
  function readFull() {
    if (isLocalhost() && query().get('full') === '1') return true;
    try { return localStorage.getItem(FULL_KEY) === '1'; } catch (e) { return false; }
  }

  function isFull() {
    if (!locksActive()) return true;
    if (override && 'full' in override) return !!override.full;
    return readFull();
  }

  const onChange = (fn) => { listeners.push(fn); };
  const notify = () => { for (const fn of listeners) { try { fn(isFull()); } catch (e) { /* 他の受け手を止めない */ } } };

  // 購入・復元の結果を入れる口（あとで StoreKit から呼ぶ。いまは仮の置き場に書く）
  function setFull(v) {
    try { localStorage.setItem(FULL_KEY, v ? '1' : '0'); } catch (e) { /* 保存できなくても今の画面は変わる */ }
    notify();
  }

  const restricted = () => locksActive() && !isFull();
  const blockOpen = (id) => !restricted() || FREE_BLOCKS.includes(id);
  const stageOpen = (s, k) => !restricted() || (s >= 3 && s <= FREE_MAX_SIZE && k >= 2 && k <= FREE_MAX_TYPES);
  const customOpen = () => !restricted();
  // ゴールを作ったときのブロックの範囲の印（保存したゴールが範囲違いで混ざらないように）
  const poolTag = () => (restricted() ? 'free' : 'all');

  return {
    FREE_BLOCKS, locksActive, isFull, onChange, setFull,
    blockOpen, stageOpen, customOpen, poolTag,
    _override: (o) => { override = o; },
  };
})();
if (typeof window !== 'undefined') window.Entitlement = Entitlement;
