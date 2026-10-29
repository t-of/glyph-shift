// 無料版と完全版の鍵。
// 鍵が効くのは iOS アプリ（Capacitor）の中だけ。Web 版は今までどおり全部遊べる。
// 開発の確かめ用に、localhost だけ ?locks=1（鍵を効かせる）と ?full=1（完全版にする）を受け付ける。
//
// 「買った」かどうかはストアが決める（RULES §13）。iOS 版では native.js が attachStore() でストア
// （StoreKit）をつなぎ、起動時とバックグラウンドから戻ったときに権利を確かめて結果を setFull に入れる。
// ストアの答えが来たあとは、その答えだけを信じる。localStorage は答えが来る前（起動直後）の表示の控え。
// Web 版にはストアがなく、鍵も効かない。
const Entitlement = (() => {
  const FULL_KEY = 'glyphshift.full';   // 起動直後の表示のための控え。ストアの答えで上書きする

  // 無料で遊べる範囲
  const FREE_BLOCKS = ['swapLR', 'swapUD', 'swapD1', 'swapD2', 'crossCW', 'diagCW', 'none'];
  const FREE_MAX_SIZE = 6;     // 正方形 3〜6
  const FREE_MAX_TYPES = 4;    // 使う種類 2〜4

  // テスト用の差し替え。{ locks, full } を入れると環境の判定より優先する。
  let override = null;
  const listeners = [];
  let store = null;        // attachStore で渡されるストア
  let storeFull = null;    // ストアが最後に答えた「完全版か」。null は未確認

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

  function readFull() {
    if (isLocalhost() && query().get('full') === '1') return true;
    if (storeFull !== null) return storeFull;   // ストアの答えが来たら、控えは見ない
    try { return localStorage.getItem(FULL_KEY) === '1'; } catch (e) { return false; }
  }

  function isFull() {
    if (!locksActive()) return true;
    if (override && 'full' in override) return !!override.full;
    return readFull();
  }

  const onChange = (fn) => { listeners.push(fn); };
  const notify = () => { for (const fn of listeners) { try { fn(isFull()); } catch (e) { /* 他の受け手を止めない */ } } };

  // 購入・復元・権利の確認の結果を入れる口。控えに書き、変わったときだけ知らせる
  function setFull(v) {
    const was = isFull();
    try { localStorage.setItem(FULL_KEY, v ? '1' : '0'); } catch (e) { /* 保存できなくても今の画面は変わる */ }
    if (store) storeFull = !!v;
    if (isFull() !== was || !store) notify();
  }

  // ---- ストア（iOS の StoreKit。native.js から渡す）----
  // store = { price(): Promise<string|null>, check(): Promise<boolean>, purchase(): Promise<'purchased'|'cancelled'|'pending'>, restore(): Promise<boolean> }
  // 失敗は例外（reject）で返す。
  function attachStore(s) { store = s; }
  const hasStore = () => !!store;
  const storePrice = () => (store ? store.price().catch(() => null) : Promise.resolve(null));
  // 権利の確認。確認できなかったとき（通信・ストアの不調）は今の表示を変えない
  async function refreshFromStore() {
    if (!store) return isFull();
    try { setFull(await store.check()); } catch (e) { /* 確認できないときは控えのまま */ }
    return isFull();
  }
  async function purchase() {
    if (!store) throw new Error('no store');
    const r = await store.purchase();
    if (r === 'purchased') setFull(true);
    return r;
  }
  async function restore() {
    if (!store) throw new Error('no store');
    const full = await store.restore();
    setFull(full);
    return full;
  }

  const restricted = () => locksActive() && !isFull();
  const blockOpen = (id) => !restricted() || FREE_BLOCKS.includes(id);
  const stageOpen = (s, k) => !restricted() || (s >= 3 && s <= FREE_MAX_SIZE && k >= 2 && k <= FREE_MAX_TYPES);
  const customOpen = () => !restricted();
  // ゴールを作ったときのブロックの範囲の印（保存したゴールが範囲違いで混ざらないように）
  const poolTag = () => (restricted() ? 'free' : 'all');

  return {
    FREE_BLOCKS, locksActive, isFull, onChange, setFull,
    attachStore, hasStore, storePrice, refreshFromStore, purchase, restore,
    blockOpen, stageOpen, customOpen, poolTag,
    _override: (o) => { override = o; },
    _resetStore: () => { store = null; storeFull = null; },
  };
})();
if (typeof window !== 'undefined') window.Entitlement = Entitlement;
