// ABILITILE
// 各タイルには「能力」が絵柄として描かれている。押すとその能力が発動する。
// 能力は座標ではなくタイルに属するので、タイルが動けば能力も一緒に動く。
//
// 盤の端はつながっていない。効果の及ぶマスが盤の外に出てしまう位置では、
// そのタイルは能力を使えない（＝押しても何も起きない）。
//
// 解けることの保証:
//   (1) すべての能力は「自分自身は動かさない（周りを動かす）」。
//   (2) 使えるかどうかは 能力 と 位置 だけで決まる。
//   発動しても自分は同じマスに残るので、一度使えた手は発動後も必ず使える。
//   よって同じマスを押し続ければ必ず元の盤面に戻せる = どの手も取り消せる。
//   完成状態から合法手だけで崩して初期盤面を作るので、完成へ戻る手順が必ず存在する。
//   同時に「直前に打った手がそのまま残る」ので、手詰まり（合法手ゼロ）にもならない。

// 画面の言葉。I18n.L('日本語', 'English') で、起動時に決めた言語のほうを使う（i18n.js）。
// 計測の道具など i18n.js を読まない場所では日本語のまま。
const L = typeof I18n !== 'undefined' ? I18n.L : (ja) => ja;
// index.html の文言を、要素を拾う前に替えておく（中に id つきの要素を含むものがある）
if (typeof I18n !== 'undefined') I18n.apply();

// 盤は長方形にできる。W が横、H が縦のマス数。正方形はその特別な場合。
let W = 4;
let H = 4;
let SIZE = W * H;

const idx = (x, y) => y * W + x;
const xOf = (i) => i % W;
const yOf = (i) => Math.floor(i / W);
const inB = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 能力定義 ----
// cells: 効果を受けるマスを絶対座標 [x, y] のサイクルで返す。
//        [a, b, c] は a の中身 → b、b → c、c → a という移動（2 個なら入れ替え）。
//        1 マスでも盤の外に出るか、自分のマスを含む場合は「使えない」と判定される。
const ABILITIES = [
  { id: 'swapLR', color: '#ffa289', name: L('左右の隣どうしを入れ替え', 'Swap left & right neighbors'),
    cells: (x, y) => [[[x - 1, y], [x + 1, y]]] },

  { id: 'swapUD', color: '#fc9000', name: L('上下の隣どうしを入れ替え', 'Swap upper & lower neighbors'),
    cells: (x, y) => [[[x, y - 1], [x, y + 1]]] },

  { id: 'swapD1', color: '#f9b800', name: L('左上と右下を入れ替え', 'Swap upper-left & lower-right'),
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y + 1]]] },

  { id: 'swapD2', color: '#bab448', name: L('右上と左下を入れ替え', 'Swap upper-right & lower-left'),
    cells: (x, y) => [[[x + 1, y - 1], [x - 1, y + 1]]] },

  { id: 'crossCW', color: '#a4d857', name: L('上下左右の 4 マスを時計回り', 'Rotate the 4 sides clockwise'),
    cells: (x, y) => [[[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]] },

  { id: 'diagCW', color: '#65c77a', name: L('斜め 4 マスを時計回り', 'Rotate the 4 corners clockwise'),
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y - 1], [x + 1, y + 1], [x - 1, y + 1]]] },

  { id: 'ringCW', color: '#00e0bd', name: L('周囲 8 マスを時計回り', 'Rotate all 8 neighbors clockwise'),
    cells: (x, y) => [[[x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x + 1, y],
                       [x + 1, y + 1], [x, y + 1], [x - 1, y + 1], [x - 1, y]]] },

  // 以下は回転の半分ぶん。向かい合うマスどうしが同時に入れ替わる。
  // それぞれ crossCW を 2 回、diagCW を 2 回、ringCW を 4 回使ったのと同じ動き。
  { id: 'crossHalf', color: '#00c5d3', name: L('上下と左右を同時に入れ替え', 'Swap up/down and left/right at once'),
    cells: (x, y) => [[[x, y - 1], [x, y + 1]], [[x + 1, y], [x - 1, y]]] },

  { id: 'diagHalf', color: '#a5c1ff', name: L('斜めの対角どうしを同時に入れ替え', 'Swap both diagonal pairs at once'),
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y + 1]], [[x + 1, y - 1], [x - 1, y + 1]]] },

  // 斜め 4 マス（四角の 4 すみ）の、上下どうし・左右どうし。
  // 「斜めの対角どうし」と合わせて、4 すみの入れ替え 3 通りが揃う。
  { id: 'sqUD', color: '#df82fb', name: L('四角のすみを上下で入れ替え', 'Swap the corners top ↔ bottom'),
    cells: (x, y) => [[[x - 1, y - 1], [x - 1, y + 1]], [[x + 1, y - 1], [x + 1, y + 1]]] },

  { id: 'sqLR', color: '#ffa0dd', name: L('四角のすみを左右で入れ替え', 'Swap the corners left ↔ right'),
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y - 1]], [[x - 1, y + 1], [x + 1, y + 1]]] },

  { id: 'ringHalf', color: '#ff7f9e', name: L('周囲 8 マスを向かいどうしで入れ替え', 'Swap all 8 neighbors with their opposites'),
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y + 1]], [[x, y - 1], [x, y + 1]],
                      [[x + 1, y - 1], [x - 1, y + 1]], [[x + 1, y], [x - 1, y]]] },

  // 何も起きないマス。押しても動かないが、まわりのマスからは動かされる。
  // 色だけは持つので、目標の柄の一色として数えられる。
  // 見分けの手がかりは色相の遠さではなく「盤でただひとつの無彩色」であること
  // （OKLCH の彩度 0.005、ほかの 12 色は最小でも 0.09）と、いちばん明るいこと。
  { id: 'none', color: '#f1f1ed', name: L('何も起きない', 'Does nothing'),
    cells: () => [] },

];

// 説明パネル用。系統と、効果および使える条件のくわしい説明。
const FAMILIES = [
  { key: 'swap', label: L('入れ替え', 'Swap') },
  { key: 'rot',  label: L('回転', 'Rotate') },
  { key: 'half', label: L('半回転', 'Half turn') },
  { key: 'none', label: L('能力なし', 'No ability') },
];

const INFO = {
  swapLR: { fam: 'swap', text: L('自分の左隣と右隣を入れ替える。自分は真ん中に残る。左右どちらかの隣が盤の外になる左端・右端の列では使えない。',
    "Swaps the tiles to its left and right. It stays in the middle. Can't be used in the leftmost or rightmost column, where one neighbor is off the board.") },
  swapUD: { fam: 'swap', text: L('自分の上と下を入れ替える。自分は真ん中に残る。上下どちらかが盤の外になる最上段・最下段では使えない。',
    "Swaps the tiles above and below. It stays in the middle. Can't be used in the top or bottom row, where one of them is off the board.") },
  swapD1: { fam: 'swap', text: L('自分の左上と右下を入れ替える。左端・右端の列と、最上段・最下段では使えない。',
    "Swaps the tiles at its upper left and lower right. Can't be used in the leftmost or rightmost column, or the top or bottom row.") },
  swapD2: { fam: 'swap', text: L('自分の右上と左下を入れ替える。左端・右端の列と、最上段・最下段では使えない。',
    "Swaps the tiles at its upper right and lower left. Can't be used in the leftmost or rightmost column, or the top or bottom row.") },
  crossCW: { fam: 'rot', text: L('上・右・下・左の 4 マスを、その順に 1 つずつ送る。上の中身が右へ、右が下へ、下が左へ、左が上へ。4 方向すべてが盤内である必要がある。',
    'Moves the 4 tiles above, right, below and left one step in that order: top goes right, right goes down, bottom goes left, left goes up. All 4 directions must be on the board.') },
  diagCW: { fam: 'rot', text: L('左上・右上・右下・左下の 4 マスを、その順に 1 つずつ送る。斜め 4 方向すべてが盤内である必要がある。',
    'Moves the 4 diagonal tiles (upper left, upper right, lower right, lower left) one step in that order. All 4 diagonals must be on the board.') },
  ringCW: { fam: 'rot', text: L('自分を囲む 8 マス全部を時計回りに 1 つずつ送る。一度に動く数が最も多い。盤の内側でしか使えない。',
    'Moves all 8 surrounding tiles one step clockwise. Moves the most tiles at once. Works only away from the edges.') },
  crossHalf: { fam: 'half', text: L('上と下、右と左を同時に入れ替える。上下左右を時計回りに 2 回送ったのと同じ動き。4 方向すべてが盤内である必要がある。',
    'Swaps top with bottom and right with left at the same time. Same as rotating the 4 sides clockwise twice. All 4 directions must be on the board.') },
  diagHalf: { fam: 'half', text: L('左上と右下、右上と左下を同時に入れ替える。斜め 4 マスを時計回りに 2 回送ったのと同じ動き。斜め 4 方向すべてが盤内である必要がある。',
    'Swaps upper left with lower right and upper right with lower left at the same time. Same as rotating the 4 corners clockwise twice. All 4 diagonals must be on the board.') },
  sqUD: { fam: 'half', text: L('斜め 4 マス（四角の 4 すみ）を、上下どうしで入れ替える。左上と左下、右上と右下。斜め 4 方向すべてが盤内である必要がある。',
    'Swaps the 4 diagonal tiles (the corners of the square) top with bottom: upper left with lower left, upper right with lower right. All 4 diagonals must be on the board.') },
  sqLR: { fam: 'half', text: L('斜め 4 マス（四角の 4 すみ）を、左右どうしで入れ替える。左上と右上、左下と右下。斜め 4 方向すべてが盤内である必要がある。',
    'Swaps the 4 diagonal tiles (the corners of the square) left with right: upper left with upper right, lower left with lower right. All 4 diagonals must be on the board.') },
  none: { fam: 'none', text: L('押しても何も起きない。まわりのマスから動かされるだけ。盤のどこにあっても使えない。',
    "Nothing happens when pressed. It only gets moved by the tiles around it. Can't be used anywhere on the board.") },
  ringHalf: { fam: 'half', text: L('自分を囲む 8 マスを、向かい合うものどうしで一斉に入れ替える。周囲 8 マスを時計回りに 4 回送ったのと同じ動き。盤の内側でしか使えない。',
    'Swaps each of the 8 surrounding tiles with the one opposite it, all at once. Same as rotating all 8 neighbors clockwise 4 times. Works only away from the edges.') },
};

// 能力が使えるなら影響するマスのサイクルを、使えないなら null を返す。
// 動かすマスが 1 つも無い能力（何も起きないマス）も、押せないものとして null を返す。
function cyclesOf(abIndex, x, y) {
  const self = idx(x, y);
  const out = [];
  for (const cyc of ABILITIES[abIndex].cells(x, y)) {
    const mapped = [];
    for (const [cx, cy] of cyc) {
      if (!inB(cx, cy)) return null;       // 盤の外 → 使えない
      const c = idx(cx, cy);
      if (c === self) return null;         // 自分が動いてしまう → 使えない
      mapped.push(c);
    }
    out.push(mapped);
  }
  return out.length ? out : null;
}

// ---- アイコン描画 ----
// 描き方そのものは glyphs.js が持つ。ここは「今どれを使うか」だけを覚える。
const Glyphs = glyphStyles();

// 絵柄は点図の 1 種だけ（2026-10-30 オーナー。設定から選ぶのをやめた）。前に選んでいた人の保存値は読まない
const glyphStyle = Glyphs.DEFAULT;

// 能力そのものから描く。cells(0, 0) が「中身をどう送るか」を relative に返す。
const iconSvg = (abIndex) => Glyphs.draw(glyphStyle, ABILITIES[abIndex].cells(0, 0), bgOf(abIndex));

// 色は能力に固定せず、盤面ごとに割り当てる。
// 能力が 12 種あるので固定の色相だと近い色が同居しうるが、柄合わせでは
// 色の見分けやすさが最優先なので、使う分だけ等間隔に配る。
// UI のアクセント（菫色）と紛れないよう、その帯は飛ばす。
// 色は能力ごとに固定する。長く遊ぶと色でブロックを覚えられるようにするため。
// 12 種あるので色相だけでは詰まる。色相は保ったまま彩度と明度を探索で調整し、
// いちばん近い 2 色の知覚的な差（CIELAB の ΔE）を 35 まで広げてある。
// 「四角のすみ」2 種を足すときは、色で覚えている人のために既存 10 色を動かさず、
// 残りの空きから 2 色だけを探した。
// 彩度は 72% までに抑えて、画面が毒々しくならないようにしている。
// UI のアクセントと紛れる菫色の帯（248〜292°）は使っていない。
const bgOf = (abIndex) => ABILITIES[abIndex].color;
const INK = 'rgba(10, 12, 20, .82)';

// ---- 柄（目標の並び） ----
// 盤の横 W・縦 H と使うブロック数 K から作れる柄。fn は各マスの色番号（0〜K-1）を返す。
// 先に柄を決めてから、その柄が必要とする個数ぶんだけブロックを用意するので、
// 目標はつねに実際に作れる配置になる。
const PATTERNS = [
  { id: 'diag',   ok: () => true,
    label: (k) => (k === 2 ? '市松模様' : '斜めじま'),
    fn: (x, y, w, h, k) => (x + y) % k },

  { id: 'bands',  ok: (w, h, k) => Math.min(w, h) >= k * 2,
    label: () => '太い斜めじま',
    fn: (x, y, w, h, k) => Math.floor((x + y) / 2) % k },

  { id: 'rows',   ok: () => true,
    label: () => '横じま',
    fn: (x, y, w, h, k) => y % k },

  { id: 'cols',   ok: () => true,
    label: () => '縦じま',
    fn: (x, y, w, h, k) => x % k },

  { id: 'rings',  ok: (w, h, k) => Math.ceil(Math.min(w, h) / 2) >= k,
    label: () => '同心の枠',
    fn: (x, y, w, h, k) => Math.min(x, y, w - 1 - x, h - 1 - y) % k },

  { id: 'frame',  ok: (w, h, k) => k === 2 && Math.min(w, h) >= 3,
    label: () => '額縁',
    fn: (x, y, w, h) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 0 : 1) },

  { id: 'halves', ok: (w, h, k) => k === 2,
    label: () => '上下二分割',
    fn: (x, y, w, h) => (y >= Math.floor(h / 2) ? 1 : 0) },

  { id: 'quads',  ok: (w, h, k) => k === 4,
    label: () => '四分割',
    fn: (x, y, w, h) => (y >= Math.floor(h / 2) ? 2 : 0) + (x >= Math.floor(w / 2) ? 1 : 0) },
];

// ---- 図鑑の柄を取り込む ----
// patterns.js（~/dev/tilezukan から持ち込んだもの）の 26 柄を足す。
// 向こうは f(i, j, ...) で i が行・j が列、こちらは fn(x, y, ...) で x が列・y が行。
// 取り込むときに入れ替える。
//
// 使えるかどうかは ok では判定しない。柄によって出せる色数の上限が違い
// （枡繋ぎは輪が ⌈n/2⌉ 本しかない等）、実際に並べてみないと分からないため、
// candidatePatterns の「k 色すべてが出るか」に任せる。
let patternSeed = 0;   // 種つきの柄に渡す。盤面ごとに変える。
let forcedAbilities = null;   // カスタムで指定されたブロック。null なら毎回ランダムに選ぶ。

if (typeof tilePatterns === 'function') {
  for (const p of tilePatterns().PATTERNS) {
    PATTERNS.push({
      id: p.id,
      ok: () => true,
      label: () => p.name,
      // 図鑑の柄は正方形が前提（回転対称など）。長方形では大きい方を一辺とする
      // 正方形の柄を作り、その左上を切り出して使う。
      fn: (x, y, w, h, k) => p.f(y, x, Math.max(w, h), k, patternSeed),
    });
  }
}

// 予備の並べ方。左上から順に色を送っていくだけで柄とは呼べないが、
// マス数さえ足りれば必ず全色が出る。正規の柄が 1 つも作れないときだけ使う。
const FALLBACK = {
  id: 'serial',
  ok: (w, h, k) => k <= w * h,
  label: () => '順送り',
  fn: (x, y, w, h, k) => (y * w + x) % k,
};

// このサイズとブロック数で実際に作れる柄を洗い出す。
// ・全色が出ない柄は除外（盤に対して色数が多いと色が余る）
// ・配置が完全に一致する柄は 1 つにまとめる
//   （例: 4×4 では「額縁」と「同心の枠」が同じ配置になり、
//     両方残すとその柄だけ 2 倍の確率で出てしまう）
function candidatePatterns(w, h, k) {
  const out = [];
  const seen = new Set();
  for (const p of PATTERNS) {
    if (!p.ok(w, h, k)) continue;
    const layout = Array.from({ length: w * h }, (_, i) => p.fn(i % w, Math.floor(i / w), w, h, k));
    if (new Set(layout).size !== k) continue;
    const sig = layout.join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(p);
  }
  // 小さい盤に色数が多いと、どの柄も全色を出せないことがある。
  // その場合だけ予備の並べ方に落として、組み合わせ自体は選べるようにする。
  if (!out.length && FALLBACK.ok(w, h, k)) out.push(FALLBACK);
  return out;
}

// 選べる盤のサイズとブロック数（カスタムの辺は 3〜10、使うブロックは 13 種まで）
const SIZES = [3, 4, 5, 6, 7, 8, 9, 10];
const TYPE_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// ---- ステージの表（大きさ × 難しさ）----
// 難しさは「完成形から混ぜる手数 n」と「使うブロックの種類数 k」をまとめて上げる。
// 手数を決めて混ぜるので、答えの手数はおよそ n（大きさによらない）。
// 大きさ 3 は練習（一覧では 1 行）。9×9・10×10 はカスタムだけで選べる。
// 数字は tools/stagebench.js の計測（アプリのヒントと同じ 3 秒の探索で見つかる手数）で決めた。
// 英語の数え方（日本語は「手」「回」をそのまま付ける）
const movesEn = (n) => `${n} move${n === 1 ? '' : 's'}`;
const timesEn = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const monthDayEn = (m, d) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`;
const DIFFS = L(['やさしい', 'ふつう', 'むずかしい'], ['Easy', 'Normal', 'Hard']);
// 一覧では難しさを、サイズによらない通しの ★1〜5 で出す（2026-10-30 オーナー。文字を減らし、
// どのサイズでも同じ ★ なら同じくらいの難しさにする）。混ぜる手数で決める。名前は読み上げ用に残す
const STAR_STEPS = [5, 10, 16, 22];   // この手数まで ★1、★2、★3、★4。それより多いと ★5
const starsForMoves = (n) => 1 + STAR_STEPS.filter((t) => n > t).length;
const diffMark = (n) => '★'.repeat(starsForMoves(n));
const STAGE_TABLE = {
  3: [{ n: 3, k: 2, min: 2 }, { n: 5, k: 3, min: 3 }, { n: 7, k: 4, min: 4 }],
  4: [{ n: 4, k: 2 }, { n: 8, k: 3 }, { n: 12, k: 4 }],
  5: [{ n: 6, k: 3 }, { n: 14, k: 4 }, { n: 17, k: 5 }],
  6: [{ n: 9, k: 3 }, { n: 15, k: 5 }, { n: 20, k: 6 }],
  7: [{ n: 11, k: 4 }, { n: 17, k: 6 }, { n: 24, k: 7 }],
  8: [{ n: 13, k: 4 }, { n: 22, k: 6 }, { n: 30, k: 8 }],
};
const STAGE_SIZES = [3, 4, 5, 6, 7, 8];
// 3×3 は通れる盤面が少なく、混ぜても近道ができて 1 手で揃うことが多い。min は「最短がこの手数以上の盤だけ使う」
// （小さい盤だけ、盤を作るときに最短を求めて確かめる。generate の minMoves）
const stageDef = (s, d) => {
  const e = STAGE_TABLE[s] && STAGE_TABLE[s][d];
  return e ? { s, d, n: e.n, k: e.k, min: e.min || 0, key: `${s}d${d}` } : null;
};
// カスタムの盤は、長い辺に近い大きさの表から混ぜる手数だけを借りる
const movesFor = (w, h, d) => stageDef(Math.min(8, Math.max(3, Math.max(w, h))), d).n;

// そのサイズで、そのブロック数の柄が作れるか
const typeAvailable = (w, h, k) => k <= ABILITIES.length && k <= w * h && candidatePatterns(w, h, k).length > 0;

// ---- 状態 ----
// 一様に混ぜ切るときの手数（mixBoard 用。今の盤の作り方は scrambleBoard で、手数は scrambleN）。
// 厳密に測った混合時間の最大はマス数あたり 82 手だったので、2 倍以上の余裕を見て 200 倍。
const scrambleSteps = () => 200 * SIZE;

let types = 2;          // 使うブロック数
let scrambleN = 4;      // 完成形から動かす手数（盤を作るとき）
let curDiff = 0;        // いま遊んでいる盤の難しさ（0〜2）。ステージの記録に使う
let scrambleMoves = []; // 直近に作った盤を混ぜた手の並び [[マス, 向き], ...]
let seed = 0;
let tileAbility = [];  // tileAbility[v] = タイル v の能力インデックス
let board = [];        // board[i] = マス i にあるタイルの値
// 手数は「押した回数」ではなく「正味の操作量」で数える。
// 同じマスを連続で押している間は 1 つのまとまり（run）として扱い、
// 位数 k の能力を j 回押したぶんのコストを min(j mod k, k - j mod k) とする。
// 例: 時計回り 4 マス回転（位数 4）を 3 回 → 反時計回り 1 回ぶんなので 1 手。
//     入れ替え（位数 2）を 2 回 → 元に戻るので 0 手。
let moves = 0;   // 確定済みの手数（完成時にだけ表示する）
let run = { i: -1, d: 0, order: 1 };

// 解答例。{ i: マス, n: 押す回数, order: 位数 } の並びで、
// 先頭から順に押していけば必ず目標の柄になる。
// プレイヤーが手を打つたびに追従させるので、途中からでも有効。
let solution = [];
let locked = false;

const slots = [];
const tiles = [];

const gridEl = document.getElementById('grid');
const goalGridEl = document.getElementById('goalGrid');
const goalTopEl = document.getElementById('goalTopGrid');
const legendSheetListEl = document.getElementById('legendSheetList');
const seedOutEl = document.getElementById('seedOut');
const logEl = document.getElementById('log');
const shareBtnEl = document.getElementById('shareDailyBtn');

const abilityAt = (i) => tileAbility[board[i]];
const cyclesAt = (i) => cyclesOf(abilityAt(i), xOf(i), yOf(i));

// 目標は「タイル v がマス v にある」状態。ただし同じ能力のタイルは互換なので、
// 並びが目標と同じ絵柄になっていればクリアとする。
const isSolved = () => board.every((_, i) => abilityAt(i) === tileAbility[i]);

const legalCells = () => {
  const out = [];
  for (let i = 0; i < SIZE; i++) if (cyclesAt(i)) out.push(i);
  return out;
};

// ---- DOM ----
function buildDom() {
  // --nx / --ny / --cell はルートに置く。盤面エリアの幅計算（style.css）からも参照するため。
  const root = document.documentElement.style;
  root.setProperty('--nx', W);
  root.setProperty('--ny', H);
  const long = Math.max(W, H);
  const cell = long >= 9 ? 46 : long >= 7 ? 54 : long === 6 ? 64 : 72;
  root.setProperty('--cell', `${cell}px`);
  // 目標の柄はサイドバー（250px）に収める
  root.setProperty('--mini-cell', `${Math.min(30, Math.floor((228 - 4 * (W - 1)) / W))}px`);
  gridEl.replaceChildren();
  slots.length = 0;
  tiles.length = 0;

  // キーボード・読み上げでも遊べるよう、マスはボタンとして扱う。Tab で入るのは 1 マスだけ（矢印で動く）
  gridEl.setAttribute('role', 'group');
  gridEl.setAttribute('aria-label', L('盤。矢印で動かし、Enter で押す、Shift+Enter で長押し', 'Board. Arrow keys to move, Enter to tap, Shift+Enter to hold'));
  for (let i = 0; i < SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.i = String(i);
    slot.setAttribute('role', 'button');
    slot.tabIndex = i === 0 ? 0 : -1;
    slot.style.setProperty('--d', String(Math.floor(i / W) + i % W));   // クリアの波の遅れ（左上から右下へ）
    gridEl.append(slot);
    slots[i] = slot;
  }
  for (let v = 0; v < SIZE; v++) {
    const t = document.createElement('div');
    t.className = 'tile';
    tiles[v] = t;
  }
}

function paintTiles() {
  for (let v = 0; v < SIZE; v++) {
    const ab = tileAbility[v];
    tiles[v].style.background = bgOf(ab);
    tiles[v].style.color = INK;
    tiles[v].innerHTML = iconSvg(ab);
  }
}

function placeTiles() {
  // 同じスロットにいるタイルは触らない。ノードを挿入し直すと
  // そのタイルの CSS アニメーションが再生されてしまうため。
  for (let i = 0; i < SIZE; i++) {
    const t = tiles[board[i]];
    if (t.parentNode !== slots[i]) slots[i].append(t);
  }
}

// 端に寄っていて能力を使えないタイルを暗くする
// もともと能力を持たないマスか（置き場所によらず、いつでも押せない）
const isBlank = (ab) => !ABILITIES[ab].cells(0, 0).length;

function markUsable() {
  let usable = 0;
  for (let i = 0; i < SIZE; i++) {
    const t = tiles[board[i]];
    const ab = abilityAt(i);
    const ok = !!cyclesAt(i);
    slots[i].setAttribute('aria-label', L(`${ABILITIES[ab].name}、${Math.floor(i / W) + 1} 行 ${i % W + 1} 列`, `${ABILITIES[ab].name}, row ${Math.floor(i / W) + 1}, column ${i % W + 1}`));
    slots[i].setAttribute('aria-disabled', String(!ok));
    if (ok) { t.classList.remove('off', 'blank'); t.title = ABILITIES[ab].name; usable++; }
    else if (isBlank(ab)) {
      // 能力そのものが無いマス。位置のせいではないので、暗くする印は付けない
      t.classList.remove('off');
      t.classList.add('blank');
      t.title = ABILITIES[ab].name;
    } else {
      t.classList.remove('blank');
      t.classList.add('off');
      t.title = ABILITIES[ab].name + L('（この位置では盤の外に出るので使えない）', ' (unusable here: it would go off the board)');
    }
  }
  return usable;
}

function renderGoal() {
  goalGridEl.replaceChildren();
  goalTopEl.replaceChildren();
  for (let i = 0; i < SIZE; i++) {
    for (const host of [goalGridEl, goalTopEl]) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const t = document.createElement('div');
      t.className = 'tile';
      t.style.background = bgOf(tileAbility[i]);
      t.style.color = INK;
      t.innerHTML = iconSvg(tileAbility[i]);
      slot.append(t);
      host.append(slot);
    }
  }
}

function renderLegend() {
  legendSheetListEl.replaceChildren();
  for (const ab of [...new Set(tileAbility)].sort((a, b) => a - b)) {
    {
      const li = document.createElement('li');
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.background = bgOf(ab);
      chip.style.color = INK;
      chip.innerHTML = iconSvg(ab);
      const txt = document.createElement('span');
      txt.textContent = ABILITIES[ab].name;
      li.append(chip, txt);
      legendSheetListEl.append(li);
    }
  }
}

// ---- ヒント ----
// 押したときに一度だけ、次に押すべきマスを点滅させる。状態は持たない。
const HINT_BLINK_MS = 2600;
let hintTimer = null;

function clearHint() {
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  for (const slot of slots) slot.classList.remove('hinted', 'hold');
}

function blinkHint() {
  clearHint();
  if (locked || isSolved() || autoSolving) return;
  const plan = activeRuns();
  if (!plan.length) return;
  const r = plan[0];
  slots[r.i].classList.add('hinted');
  // 押す場所は盤の光で見せ、文字は出さない（2026-10-30 オーナー）。長押しのほうが近いときは光の色を変える
  const back = r.order - r.n;
  if (r.n > back) slots[r.i].classList.add('hold');
  // 残りの手数は、短い手順のときだけ意味がある。
  // 混ぜた手順の逆は手数を決めて混ぜた盤なら短い（その手数どまり）が、そうでない盤の保険の手順は
  // 1 万手を超えることがあり、それを「残り 18317 手」と出しても詰んだように見えるだけ。
  // 光らせる手自体は正しいので、長すぎるときは数字だけ伏せる。
  // 残りの手数は出さない（手数は画面に書かない）。長い保険の手順で裏で探しているときだけ、そう添える。
  const real = planCost(plan) <= HINT_SHOW_MAX;
  logEl.textContent = !real && hintBusy ? HINT_SEARCHING : '';
  hintTimer = setTimeout(clearHint, HINT_BLINK_MS);
}

// 1 回押したら光るのは 1 か所きり。あとから別のマスへ飛ばさない。
const HINT_SEARCHING = L('探しています…', 'Searching…');

function hintAfterSolve() {
  blinkHint();
  // 探し終わっても光らせるものが無かったとき（その間に完成した等）、案内を戻す
  if (logEl.textContent === HINT_SEARCHING) logEl.textContent = readyLine();
}

function showHint() {
  if (autoSolving || locked || isSolved()) return;
  // 今日の 1 問で初めてヒントを使うときだけ確認する（使った時点で保存。ランキングには載らない）
  if (dailyKey && !tutorial && !hintUsed && !dailyFree()) {
    askConfirm(L('ヒントを使う', 'Use a hint'),
      L('ヒントを使うと、<strong>今日のランキングには載りません</strong>。<br>クリアの記録と連続日数には入ります。',
        'If you use a hint, you <strong>won\'t appear in today\'s ranking</strong>.<br>It still counts as a clear and keeps your streak.'),
      L('使う', 'Use'), () => { closeConfirm(); markDailyHint(); showHint(); });
    return;
  }
  hintUsed = true;
  Sfx.hint();
  if (hintPlan || (activeRuns().length && planCost(activeRuns()) <= HINT_SHOW_MAX)) {
    // もう使える手順がある（混ぜた手順の逆、または探して見つけたもの）。それをそのまま見せる。
    // 計算し直しはこれまでどおり毎回やるが、受け取っても点滅は動かさない
    // （光らせる場所は押した時点で決める。あとから別のマスへ飛ばさない）。
    blinkHint();
    requestSolve(null);
    return;
  }
  // 使える手順がまだ無い（手数を決めずに混ぜた盤の保険の手順しか無い）。ここで見せると
  // 数千手の遠回りの 1 手目を指すことになり、探索が終わった途端に
  // 別のマスへ飛ぶ。見せずに、探し終わってから一度だけ光らせる。
  clearHint();
  logEl.textContent = HINT_SEARCHING;
  requestSolve(hintAfterSolve);
}

// ---- 説明パネル ----
function renderPanel() {
  document.getElementById('blockTotal').textContent = L(`全 ${ABILITIES.length} 種`, `${ABILITIES.length} blocks in all`);
  const body = document.getElementById('panelBody');
  const used = new Set(tileAbility);
  body.replaceChildren();

  for (const fam of FAMILIES) {
    const ids = ABILITIES.map((ab, k) => [ab, k]).filter(([ab]) => INFO[ab.id].fam === fam.key);
    const sec = document.createElement('section');
    const h = document.createElement('p');
    h.className = 'fam-title';
    h.textContent = L(`${fam.label}（${ids.length} 種）`, `${fam.label} (${ids.length})`);
    const list = document.createElement('div');
    list.className = 'fam-list';

    for (const [ab, k] of ids) {
      const row = document.createElement('div');
      row.className = used.has(k) ? 'blk' : 'blk dim';

      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.background = bgOf(k);
      chip.style.color = INK;
      chip.innerHTML = iconSvg(k);

      const main = document.createElement('div');
      main.className = 'blk-main';

      const name = document.createElement('div');
      name.className = 'blk-name';
      name.append(ab.name);
      if (used.has(k)) {
        const tag = document.createElement('span');
        tag.className = 'used';
        tag.textContent = L('このパズルで使用中', 'In this puzzle');
        name.append(tag);
      }

      const detail = document.createElement('p');
      detail.className = 'blk-detail';
      detail.textContent = INFO[ab.id].text;

      // このサイズの盤で使える位置
      const where = document.createElement('div');
      where.className = 'blk-where';
      const map = document.createElement('div');
      map.className = 'blk-map';
      map.style.gridTemplateColumns = `repeat(${W}, 8px)`;
      let on = 0;
      for (let i = 0; i < SIZE; i++) {
        const cell = document.createElement('i');
        if (cyclesOf(k, xOf(i), yOf(i))) { cell.className = 'on'; on++; }
        map.append(cell);
      }
      const note = document.createElement('span');
      note.textContent = L(`使える位置 ${on} / ${SIZE}`, `Usable on ${on} / ${SIZE}`);
      map.setAttribute('role', 'img');
      map.setAttribute('aria-label', L(`${W}×${H} の盤で使える位置は ${on} マス`, `Usable on ${on} cells of a ${W}×${H} board`));
      where.append(map, note);

      main.append(name, detail, where);
      row.append(chip, main);
      list.append(row);
    }
    sec.append(h, list);
    body.append(sec);
  }
}

// ---- 置換の適用（FLIP アニメーション付き） ----
function applyTo(b, cycles, dir = 1) {
  for (const cyc of cycles) {
    if (dir > 0) {
      const last = b[cyc[cyc.length - 1]];
      for (let k = cyc.length - 1; k > 0; k--) b[cyc[k]] = b[cyc[k - 1]];
      b[cyc[0]] = last;
    } else {
      const first = b[cyc[0]];
      for (let k = 0; k < cyc.length - 1; k++) b[cyc[k]] = b[cyc[k + 1]];
      b[cyc[cyc.length - 1]] = first;
    }
  }
}

// 盤面を書き換えて、動いたタイルだけを滑らせる。
//
// 滑る時間は呼び出し側から指定する。ms に 0 を渡すと滑らせずに置き換える。
// 置換をスライドで見せる以上、途中はタイルが敷き詰まらず下のマスが覗く。
// 1 手ずつなら動く数も距離も小さいので気にならないが、自動再生で何十手も
// まとめて動かすと画面じゅうに隙間が出る。そこは滑らせない方が静かで速い。
function animatePlacement(mutate, ms = 300) {
  // 前の手のアニメーションが残っていると変形後の座標を測ってしまい、
  // 動いていないタイルにも差分が出て震える。測る前に必ず打ち切る。
  for (const t of tiles) for (const a of t.getAnimations()) a.cancel();

  if (!ms) {                      // 滑らせずに置き換える
    mutate();
    placeTiles();
    markUsable();
    return;
  }

  const before = new Map();
  for (const t of tiles) before.set(t, t.getBoundingClientRect());

  mutate();
  placeTiles();
  markUsable();

  for (const t of tiles) {
    const a = before.get(t);
    const b = t.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (!dx && !dy) continue;
    t.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: ms, easing: 'cubic-bezier(.2,.75,.3,1)' }
    );
  }
}

const applyAnimated = (cycles, dir = 1) => animatePlacement(() => applyTo(board, cycles, dir));

// 発動したマスを光らせる。スロットは動かないのでクラスで問題ない。
function flashSlot(i, dir = 1) {
  slots[i].classList.remove('fired', 'back');
  void slots[i].offsetWidth; // アニメーション再生のための reflow
  slots[i].classList.add('fired');
  if (dir < 0) slots[i].classList.add('back');
}

// 使えないマスを揺らす。クラスを付けっぱなしにすると、あとでタイルが
// 動くたびにノード再挿入でアニメーションが再生されてしまうため、
// クラスではなくアニメーション API を使って痕跡を残さない。
function shakeTile(i) {
  const t = tiles[board[i]];
  for (const a of t.getAnimations()) a.cancel();
  t.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
     { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
    { duration: 300, easing: 'ease' }
  );
}

// ---- 手数 ----
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;

// 置換の位数（何回繰り返すと元に戻るか）= 各サイクル長の最小公倍数
const orderOf = (cycles) => cycles.reduce((a, c) => lcm(a, c.length), 1);

// 連続押しのまとまりを確定して手数に加える。
// d は向きこみの累計（押すたび +1、長押しは -1）。位数で丸めて、近い側を手数とする。
function commitRun() {
  if (run.d !== 0) {
    const r = ((run.d % run.order) + run.order) % run.order;
    moves += Math.min(r, run.order - r);
  }
  run = { i: -1, d: 0, order: 1 };
}

// ---- 解答例 ----
// プレイヤーが 1 手打ったぶんを手順に反映する。
// 手順の先頭と同じマスなら 1 回ぶん消化、違うマスなら打ち消す手順を先頭に足す。
// これで「先頭から順に押せば解ける」という性質が常に保たれる。
// runs[k].n は「そのマスをあと何回“順方向に”進めればよいか」。
// 長押し（dir = -1）は逆向きに 1 つ進めたことになるので、残りは 1 増える。
function advanceRuns(runs, i, dir, order) {
  const wrap = (v) => ((v % order) + order) % order;
  const first = runs[0];
  if (first && first.i === i) {
    first.n = wrap(first.n - dir);
    if (first.n === 0) runs.shift();
  } else {
    runs.unshift({ i, n: wrap(-dir), order });
  }
}

// ---- 探索による手順（solver.js） ----
// 解法は solver.js の純粋な関数。通常は Web Worker の中で動かし、画面を止めない。
// Worker が作れない環境では同じ関数をメインスレッドで短い予算で呼ぶ。
// 見つかれば最短、無理なら短くした一例。使えないときは逆手順のまま。
const Solver = solverModule();

// 盤面ごとの「問題の記述」。能力 × マスのサイクルと位数を先に引いておく。
function buildProblem() {
  const cyc = [], ord = [];
  for (let a = 0; a < ABILITIES.length; a++) {
    const per = Array.from({ length: SIZE }, (_, i) => cyclesOf(a, xOf(i), yOf(i)));
    cyc.push(per);
    ord.push(per.map((c) => (c ? orderOf(c) : 0)));
  }
  return { W, H, N: W, SIZE, cyc, ord };
}

let problem = null;
let hintPlan = null;    // { runs, optimal, ms, method }
let hintBusy = false;
let solveId = 0;        // 進行中の依頼の番号。盤面が変わったら古い返事を捨てる
let solveDones = [];    // 返事が来たら呼ぶもの
let movesWhileSolving = []; // 計算中に打った手。返ってきた手順に追いつかせる
let solveStart = null;      // 依頼したときの並び。返ってきた手順はここから始まる
// 盤が出ているあいだ、裏で探し続ける（より短い手順が見つかるたびに差し替える）。
// 続けるたびに予算を倍にする。打った手で盤が変わったら（数手ごとに）やり直す。
let improveRound = 0;       // 何回続けたか
let improveTimer = null;
let movesSinceImprove = 0;  // 最後に探し始めてから打った手
const IMPROVE_BUDGETS = [6000, 12000, 24000, 48000];
const HINT_SHOW_MAX = 100;  // これを超える手順は、手数を出さない

// 基準手数（par）。盤が出た時点で分かっている最短の手順の長さ。
// 混ぜた手順の逆の長さで始まり、盤が出た直後の裏の探索（初期配置から）で
// もっと短い手順が見つかれば、それに変わる。ヒントの手順（hintPlan）とは別物で、打った手では変わらない。
//   undefined = 計算中（答えの手順が無い盤だけ） / null = 無し / { cost, optimal }
let par = null;
let parWanted = false;      // 次に出す依頼が、par 用の先読みか
let parId = 0;              // par 用の依頼の番号
let hintUsed = false;       // この盤でヒントを使ったか
let clearPending = null;    // par を待ったままクリアしたときの { moves, hintUsed }

// 盤の下の案内。タッチの端末では「タップ」と言う。
// 遊び始めの案内は出さない（遊び方は練習で覚える。画面の文字を減らす）
function readyLine() {
  return '';
}

// ---- 今日の 1 問 ----
// 端末の日付（ローカルの年月日）から seed を決める。同じ日は誰でも同じ盤。5×5・ふつう（10 手・4 種）で、
// ブロックは全 13 種から選ぶ（無料版でも完全版のブロックが出る＝試す場）。
const DAILY_KEY = 'glyphshift.daily';
// 今日の 1 問は 5×5 の「ふつう」と同じ手数・種類数
const DAILY_SIZE = 5;
const DAILY_DIFF = 1;
const DAILY_TYPES = STAGE_TABLE[DAILY_SIZE][DAILY_DIFF].k;
const DAILY_MOVES = STAGE_TABLE[DAILY_SIZE][DAILY_DIFF].n;
const DAILY_KEEP_DAYS = 60;
const pad2 = (n) => String(n).padStart(2, '0');
const dateKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// 日付のキー（YYYY-MM-DD）を days 日ずらす（ローカル暦で数える）
function shiftDateKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKeyOf(new Date(y, m - 1, d + days));
}
// 日付 → seed（純粋）。同じ日付なら必ず同じ、日が変われば変わる。0〜1e9 未満。
function dailySeed(key) {
  let h = 0x811c9dc5;
  const str = `abilitile-daily-${key}`;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) % 1e9;
}
// 今日の 1 問の記録 1 日ぶん（2026-10-30 から）。
//   { state: 'playing'|'cleared'|'revealed'|'abandoned', ms, hint, moves, stars, rankable }（途中は t0 = 盤を初めて見た時刻も）
//   playing = 途中（時間とヒントだけ残す） / cleared = 自分で揃えた / revealed = 解説を見た（クリアにならない）
//   abandoned = 途中でホームへ戻った（記録なし。その日はもう挑戦できない。2026-10-30 オーナー）
// 古い形 { moves, stars, hint } は「クリア済み・時間なし」として読む。
function normDaily(e) {
  if (!e || typeof e !== 'object') return null;
  const ms = Number.isFinite(e.ms) && e.ms >= 0 ? Math.floor(e.ms) : null;
  const hint = !!e.hint;
  if (e.state === 'playing') return { state: 'playing', ms: ms || 0, hint, ...(Number.isFinite(e.t0) ? { t0: e.t0 } : {}) };
  if (e.state === 'revealed') return { state: 'revealed', ms: ms || 0, hint: true };
  if (e.state === 'abandoned') return { state: 'abandoned', ms: ms || 0, hint };
  if (e.state !== undefined && e.state !== 'cleared') return null;
  if (!Number.isFinite(e.moves)) return null;
  // ランキングに載せられるのは、時間があって、ヒントなしで揃えたものだけ
  return { state: 'cleared', ms, hint, moves: e.moves, stars: e.stars | 0, rankable: ms !== null && !hint && e.rankable !== false };
}
const dailyIsCleared = (e) => !!e && (e.state === undefined || e.state === 'cleared');
const dailyIsClosed = (e) => !!e && e.state !== 'playing';   // クリア・解説・途中でやめたで、その日はもう遊べない
// 時間の整形。1 時間未満は m:ss、それ以上は h:mm:ss（秒は切り捨て）。
function fmtTime(ms) {
  const t = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60;
  return h ? `${h}:${pad2(m)}:${pad2(sec)}` : `${m}:${pad2(sec)}`;
}
// 今日の 1 問のクリアの行・共有の 2 行目（純粋）。ms が無い（古い記録）なら時間は出さない。
function dailyResultLine(ms, hint) {
  const t = Number.isFinite(ms) ? ` ${fmtTime(ms)}` : '';
  return L(`クリア${t}${hint ? '（ヒントあり）' : ''}`, `Solved${t}${hint ? ' (hint used)' : ''}`);
}
// 直近 DAILY_KEEP_DAYS 日（今日を含む）だけ残す。
function pruneDaily(map, todayKey) {
  const cutoff = shiftDateKey(todayKey, -(DAILY_KEEP_DAYS - 1));
  const out = {};
  for (const k of Object.keys(map)) if (k >= cutoff) out[k] = map[k];
  return out;
}
// 記録を足した新しい map（元は変えない）。その日にクリア・解説の記録があればそれが先（最初の 1 回だけが記録）。
// 途中（playing）は上書きして進める。
function addDaily(map, todayKey, entry) {
  if (dailyIsClosed(map[todayKey])) return pruneDaily({ ...map }, todayKey);
  return pruneDaily({ ...map, [todayKey]: entry }, todayKey);
}
// 連続日数。今日（まだなら昨日）から遡って、クリアした日が続く数。解説を見た日・途中の日は数えない。
function dailyStreak(map, todayKey) {
  let k = dailyIsCleared(map[todayKey]) ? todayKey : shiftDateKey(todayKey, -1);
  let n = 0;
  while (dailyIsCleared(map[k])) { n++; k = shiftDateKey(k, -1); }
  return n;
}
// 共有用の絵文字。ブロックごとに色の近い四角を割り当てる（13 種で重ならない）。
const SHARE_EMOJI = {
  swapLR: '🟥', swapUD: '🟧', swapD1: '🟨', swapD2: '🟫', crossCW: '🟩', diagCW: '🟢', ringCW: '🔷',
  crossHalf: '🔹', diagHalf: '🟦', sqUD: '🟪', sqLR: '🟣', ringHalf: '🔴', none: '⬜',
};
// 共有の文（純粋）。答えの手順は入れない。手数・★は入れず、時間とヒントの有無だけ。
function dailyShareText({ key, ms, hint, goal, w }) {
  const [, m, d] = key.split('-').map(Number);
  const line = dailyResultLine(ms, hint);
  const rows = [];
  for (let y = 0; y * w < goal.length; y++) {
    rows.push(Array.from(goal.slice(y * w, y * w + w), (a) => SHARE_EMOJI[ABILITIES[a].id] || '⬛').join(''));
  }
  return [L(`ABILITILE 今日の1問 ${m}/${d}`, `ABILITILE Daily ${m}/${d}`), line, ...rows].join('\n');
}
function loadDaily() {
  try {
    const v = JSON.parse(localStorage.getItem(DAILY_KEY));
    if (!v || typeof v !== 'object') return {};
    const out = {};
    for (const k of Object.keys(v)) {
      const e = normDaily(v[k]);
      if (/^\d{4}-\d\d-\d\d$/.test(k) && e) out[k] = e;
    }
    return out;
  } catch (e) { return {}; }
}
let daily = loadDaily();
function saveDaily() {
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(daily)); }
  catch (e) { /* 保存できなくても遊べる */ }
}
let dailyKey = null;   // いま遊んでいる盤が今日の 1 問なら、その日付（始めた日。日付をまたいでもその日の記録）。そうでなければ null
let dailyReview = false;   // 解いた・解説を見た日の盤を見ているだけ（押せない）

// 時間。今日の 1 問の盤を初めて見た時刻（t0、端末の時計）から、時計どおりに数える（2026-10-30 オーナー）。
// ホームに戻っても・アプリを裏にしても・閉じても止まらない（盤を見て外で考える抜け道をふさぐ）。
// t0 は daily[dailyKey] に保存し、開き直しても同じ t0 から数える。揃った瞬間の ms を記録する。
let dailyMs = 0;            // t0 の無い古い途中の記録の時間（読み込むときに t0 へ置き換える）
let dailyT0 = null;         // 盤を初めて見た時刻（clockNow の値）
let dailySince = null;      // 盤が出ていて、途中の記録を数秒ごとに保存しているあいだ true
let dailyTickTimer = null;
// プレイ時間の表示（下の renderDailyClock）。盤より先に読み込まれるので、ここで決めておく
const dailyClockEl = typeof document !== 'undefined' ? document.getElementById('dailyClock') : null;
const dailyClockTextEl = typeof document !== 'undefined' ? document.getElementById('dailyClockText') : null;
let dailyClockView = null;
let clockNow = () => Date.now();   // テストで差し替える
const DAILY_SAVE_MS = 3000;
// 端末の時計を戻されても負にしない
const dailyElapsed = () => dailyT0 !== null ? Math.max(0, Math.floor(clockNow() - dailyT0)) : Math.floor(dailyMs);
function dailyShouldRun() {
  if (!dailyKey || dailyReview || tutorial || locked || playEl.hidden) return false;
  if (typeof document !== 'undefined' && document.hidden) return false;
  const e = daily[dailyKey];
  return !e || e.state === 'playing';
}
// いまの時間・ヒントを途中の記録として書く（クリア・解説の記録がある日は触らない）
function dailyPersist() {
  if (!dailyKey || dailyReview) return;
  daily = addDaily(daily, dailyKey, { state: 'playing', ms: dailyElapsed(), t0: dailyT0, hint: !!hintUsed });
  saveDaily();
}
function dailyScheduleTick() {
  if (dailyTickTimer) return;
  dailyTickTimer = setTimeout(() => {
    dailyTickTimer = null;
    if (dailySince === null) return;
    dailyPersist();
    dailyScheduleTick();
  }, DAILY_SAVE_MS);
}
// 盤が出たら t0 を決める（まだなら）。保存の刻みは盤が出ているあいだだけ回す。時間そのものは止まらない
function dailyClockSync() {
  const run = dailyShouldRun();
  if (run && dailyT0 === null) { dailyT0 = clockNow() - dailyMs; dailyMs = 0; dailyPersist(); }
  if (run && dailySince === null) { dailySince = true; dailyScheduleTick(); }
  else if (!run && dailySince !== null) dailyClockStop();
  dailyClockViewSync();
}
// 保存の刻みを止めて、いまの時間を保存する（時間は時計どおりに進み続ける）
function dailyClockStop() {
  if (dailyTickTimer) { clearTimeout(dailyTickTimer); dailyTickTimer = null; }
  if (dailySince === null) return;
  dailySince = null;
  dailyPersist();
}
// 盤が変わったとき。その日の記録から t0・ヒントを読み込む（beginBoard が呼ぶ）
function dailyLoadRecord() {
  dailyMs = 0; dailyT0 = null; dailySince = null; dailyReview = false;
  if (dailyTickTimer) { clearTimeout(dailyTickTimer); dailyTickTimer = null; }
  const e = dailyKey ? daily[dailyKey] : null;
  if (e) {
    hintUsed = !!e.hint;
    if (e.state === 'playing' && Number.isFinite(e.t0)) dailyT0 = e.t0;
    else if (e.state === 'playing') dailyT0 = clockNow() - (e.ms || 0);   // t0 の無い古い途中の記録
    else dailyMs = e.ms || 0;
  }
  const pn = document.getElementById('panelNew');
  if (pn && !tutorial) pn.hidden = !!dailyKey;   // 「新しい盤にする」は今日の 1 問では出さない
  dailyClockSync();
}
// ヒントを使った。その場で保存する（閉じても消えない）
function markDailyHint() {
  hintUsed = true;
  dailyPersist();
}
// 解説を見る。その日はクリアにならない。その場で保存する
function markDailyRevealed() {
  if (!dailyKey) return;
  dailyMs = dailyElapsed(); dailyT0 = null;
  dailyClockStop();
  hintUsed = true;
  daily = addDaily(daily, dailyKey, { state: 'revealed', ms: dailyElapsed(), hint: true });
  saveDaily();
}
// 途中でホームへ戻った。その日は記録なしで閉じる（時間を競うので、盤を見てから出直すのを防ぐ）
function markDailyAbandoned() {
  if (!dailyKey || dailyIsClosed(daily[dailyKey])) return;
  const ms = dailyElapsed();
  dailyMs = ms; dailyT0 = null;
  dailyClockStop();
  daily = addDaily(daily, dailyKey, { state: 'abandoned', ms, hint: !!hintUsed });
  saveDaily();
}
// 途中でやめた日の盤。記録・時間・ランキングなしで、同じ盤を何度でも遊べる（2026-10-30 オーナー）
const dailyFree = () => !!dailyKey && !!daily[dailyKey] && daily[dailyKey].state === 'abandoned';
// いま今日の 1 問を時間を数えながら遊んでいるか（やめるときに確認する）
const dailyLive = () => !!dailyKey && !dailyReview && !tutorial && !isSolved() && !autoSolving && !dailyIsClosed(daily[dailyKey]);

// プレイ時間の表示。今日の 1 問の盤が出ているあいだ 1 秒ごとに書き換える。閉じた日は記録の時間で止める
function renderDailyClock() {
  if (!dailyClockEl) return;
  const rec = dailyKey ? daily[dailyKey] : null;
  const on = !!dailyKey && !tutorial && !(rec && rec.state === 'revealed') && !(rec && rec.state === 'abandoned');
  dailyClockEl.hidden = !on;
  if (!on) return;
  const ms = dailyIsClosed(rec) ? rec.ms : dailyElapsed();
  dailyClockTextEl.textContent = fmtTime(ms);
  dailyClockEl.setAttribute('aria-label', L(`プレイ時間 ${fmtTime(ms)}`, `Time ${fmtTime(ms)}`));
}
function dailyClockViewSync() {
  renderDailyClock();
  const run = dailyShouldRun() && !isSolved();
  if (run && !dailyClockView) dailyClockView = setTimeout(() => { dailyClockView = null; dailyClockViewSync(); }, 1000);
  else if (!run && dailyClockView) { clearTimeout(dailyClockView); dailyClockView = null; }
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', dailyClockSync);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', dailyClockStop);
  window.addEventListener('pageshow', dailyClockSync);
}

// ★の判定。par が無ければ null（★を出さない）。ヒントを使った盤は最大 ★★。
function starRating(moves, parCost, usedHint) {
  if (!(parCost > 0)) return null;
  let n = moves <= parCost ? 3 : moves <= Math.ceil(parCost * 1.5) ? 2 : 1;
  if (usedHint && n > 2) n = 2;
  return n;
}

// Worker の中で長めに探索する。同期で動かすときは画面が固まるので短くする。
// 大きい盤や色数の多い盤は難しいので、Worker では時間を足す（最大 7 秒）。
const HINT_BUDGET_SYNC = 1200;
const hintBudgetWorker = () => 3000 + (SIZE >= 49 ? 2500 : 0) + (types >= 6 ? 1500 : 0);
// 逆手順しか出せなかった盤だけ、裏でこの時間まで探し直す。
// 難しい盤は、終盤で確定マスを崩して直す手順にたどり着くまでに時間が要る。
// 実測では、行き詰まっていた 4 盤が 45 秒で 2 盤、60 秒で 4 盤とも解けた
// （1 万手超の逆手順が 275〜450 手になる）。ふつうの盤はここまで来ないので、
// この時間を使うのは行き詰まった盤だけ。途中経過は届くので、よりよい手順が
// 見つかった時点で差し替わる。
const HINT_BUDGET_LONG = 60000;

let worker = null;
let workerBroken = false;   // この環境では Worker が使えないと分かったら、もう試さない

function makeWorker() {
  if (worker) { worker.terminate(); worker = null; }
  if (workerBroken) return;
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return;
  try {
    const src = `${solverModule.toString()}\n${solverWorkerMain.toString()}\nsolverWorkerMain();`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = (e) => finishSolve(e.data.id, e.data.res, !!e.data.partial);
    worker.onerror = () => { worker = null; workerBroken = true; fallbackToSync(); };
  } catch (e) {
    worker = null;
    workerBroken = true;
  }
}

// Worker が使えなくなったときに、待っている依頼を同期で片付ける。
// そのままだと待ち手が誰にも応えられず、ヒントも「揃える」も無反応になる。
function fallbackToSync() {
  if (!hintBusy) return;
  hintBusy = false;
  if (par === undefined) resolvePar(null);
  const pending = solveDones;
  solveDones = [];
  if (!pending.length) return;
  const first = pending.shift();
  solveDones = pending;
  requestSolve(first.f, first.final);
}

function solveSnapshot() {
  return {
    start: Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]),
    goal: Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]),
    fallback: Solver.runsToPlan(activeRuns()),   // いま分かっている最短の手順。探索の結果がこれより悪いことは無い
  };
}

// 返事を受け取る。途中経過（partial）なら手順だけ差し替えて、計算は続いているものとして扱う。
// 手順が本当に目標へ着くかを確かめる。
// ソルバーは盤の形を正方形として見積もる部分があり、長方形では
// 見当違いの手順を返しうる。着かないものは黙って捨てて保険に任せる。
function planReachesGoal(plan, startLay) {
  const lay = Uint8Array.from(startLay);
  for (const [i, dir] of plan) {
    const cyc = problem.cyc[lay[i]][i];
    if (!cyc) return false;
    applyTo(lay, cyc, dir);
  }
  for (let i = 0; i < SIZE; i++) if (lay[i] !== tileAbility[i]) return false;
  return true;
}

function finishSolve(id, res, partial = false) {
  if (id !== solveId) return; // 盤面が変わった後の返事
  if (res && res.plan && !planReachesGoal(res.plan, solveStart)) res = null;
  if (id === parId && !partial && (!locked || clearPending)) {
    // 盤が出た時点の par を、探索で見つかった手順で更新する（短くなったときだけ）
    parId = 0;
    const c = res && res.plan ? planCost(Solver.planToRuns(problem, res.plan, solveStart)) : Infinity;
    const cur = par || null;
    if (!cur || c < cur.cost) resolvePar(c < Infinity ? { cost: c, optimal: !!res.optimal } : null);
    else if (c === cur.cost && res.optimal && !cur.optimal) resolvePar({ cost: c, optimal: true });
    else resolvePar(cur);
  }
  if (res && res.plan) {
    const plan = { runs: Solver.planToRuns(problem, res.plan, solveStart), optimal: res.optimal, ms: Math.round(res.ms), method: res.method };
    // 計算しているあいだに打った手ぶんだけ手順を進める
    for (const [i, dir, order] of movesWhileSolving) followPlan(plan, i, dir, order);
    // 今わかっている最短の手順（activeRuns）より短いときだけ差し替える。
    // 同じ長さで、探索のほうが「最短」と保証できるときも差し替える（表示のため）。
    const cost = planCost(plan.runs);
    const known = planCost(activeRuns());
    const sameButProven = cost === known && plan.optimal && !(hintPlan && hintPlan.optimal && activeRuns() === hintPlan.runs);
    if (cost < known || sameButProven || (!hintPlan && !solution.length)) hintPlan = plan;
  }
  if (!partial) {
    hintBusy = false;
    movesWhileSolving = [];
    // 探し直しで短い手順が見つかったら「探しています…」を消す（文字は出さない）。
    // 光らせる場所は動かさない（押した時点で決めたものを尊重する）。
    if (hintPlan && logEl.textContent === HINT_SEARCHING) logEl.textContent = '';
    scheduleImprove(res);
  }
  // 待っている人には最初の返事で応える（ヒントの点滅には十分）。最終結果を待つものは残す。
  const dones = solveDones;
  solveDones = partial ? dones.filter((d) => d.final) : [];
  for (const d of dones) if (!partial || !d.final) d.f();
}

// 盤が出ているあいだ、予算を倍にしながら今の盤から探し直し続ける。
// 最短と分かった・手順が十分短い・解説や完成で盤を動かさなくなった、のどれかで止める。
function scheduleImprove(res) {
  if (improveTimer) { clearTimeout(improveTimer); improveTimer = null; }
  if (!worker || tutorial || locked || autoSolving || isSolved()) return;
  if (res && res.optimal) return;                         // 最短と分かった
  if (planCost(activeRuns()) <= 2) return;                // これ以上縮めようがない
  if (improveRound >= IMPROVE_BUDGETS.length) return;
  const budget = IMPROVE_BUDGETS[improveRound++];
  movesSinceImprove = 0;
  improveTimer = setTimeout(() => {
    improveTimer = null;
    if (!hintBusy && worker && !locked && !autoSolving && !isSolved()) requestSolve(null, false, true, budget);
  }, 250);
}

// done は最初の返事（途中経過でもよい）で呼ぶ。final を付けると最終結果まで待つ。
function requestSolve(done, final = false, background = false, budget = 0) {
  if (done) solveDones.push({ f: done, final });
  if (hintBusy) return;
  // Worker が無い環境では同期で解くことになる。先読みのためだけに
  // 盤面を出すたび画面を止めるのは割に合わないので、そのときは見送る。
  if (background && !worker) return;
  hintBusy = true;
  const id = ++solveId;
  if (parWanted) { parWanted = false; parId = id; if (!par) par = undefined; }
  movesWhileSolving = [];
  const snap = solveSnapshot();
  solveStart = snap.start;
  if (worker) {
    const budgetMs = budget || hintBudgetWorker();
    worker.postMessage({ type: 'solve', id, start: snap.start, goal: snap.goal, budget: budgetMs, fallback: snap.fallback });
    // 返事が来ないまま黙り込む環境（file:// で Blob の Worker が止められる等）への保険。
    // 待つ時間は、そのとき渡した予算に合わせる。決め打ちにすると、長く探し直している
    // 最中に打ち切って Worker を壊れた扱いにしてしまう（以後ぜんぶ同期処理に落ちる）。
    setTimeout(() => {
      if (!hintBusy || solveId !== id) return;
      if (worker) { worker.terminate(); worker = null; }
      workerBroken = true;
      fallbackToSync();
    }, budgetMs + 2000);
  } else {
    // 同期処理なので、呼び出し側が先に画面を描けるよう一拍ずらす
    setTimeout(() => finishSolve(id, Solver.solvePuzzle(problem, snap.start, snap.goal, HINT_BUDGET_SYNC, snap.fallback)), 16);
  }
}

// 手順の持ち主（hintPlan）に 1 手を反映する。手順どおりでなければ「最短」の看板を下ろす。
function followPlan(plan, i, dir, order) {
  const before = planCost(plan.runs);
  advanceRuns(plan.runs, i, dir, order);
  if (planCost(plan.runs) >= before) plan.optimal = false;
}

// いま分かっている最短の手順。混ぜた手順の逆（solution）と、探索で見つけた手順（hintPlan）のうち、
// 短いほう（同じ長さなら solution）。どちらも打った手に追従させてあるので、いつでも今の盤から使える。
const activeRuns = () => (hintPlan && (!solution.length || planCost(hintPlan.runs) < planCost(solution)) ? hintPlan.runs : solution);

// 手順の長さは「まとまりの数」ではなく手数で数える。
// 1 つのまとまりは押す向きを選べるので、少ない側の回数がその手数になる。
const planCost = (runs) => runs.reduce((a, r) => a + Math.min(r.n, r.order - r.n), 0);

// ---- 操作 ----
// dir: +1 = 押す（順方向） / -1 = 長押し（逆方向）
// 1 手ぶんの状態更新だけを行う。描画と音は呼び出し側でまとめる。
// 自動再生では何手かをひとまとめに動かすので、ここを分けておく。
function applyMoveState(i, dir) {
  const cycles = cyclesAt(i);
  if (!cycles) return false;
  // 押したマスが変わったら、それまでの連続押しを確定する
  if (i !== run.i) {
    commitRun();
    run = { i, d: 0, order: orderOf(cycles) };
  }
  run.d += dir;

  advanceRuns(solution, i, dir, run.order);
  if (hintPlan) followPlan(hintPlan, i, dir, run.order);
  if (hintBusy) movesWhileSolving.push([i, dir, run.order]);

  applyTo(board, cycles, dir);
  // 盤が変わったので、探し直しの連鎖が止まっていたら数手ごとに仕切り直す
  if (!autoSolving && ++movesSinceImprove >= 4 && !hintBusy && !improveTimer && worker && !tutorial) {
    improveRound = 0;
    scheduleImprove(null);
  }
  return true;
}

function fire(i, dir = 1) {
  if (locked) return;
  if (!cyclesAt(i)) {
    shakeTile(i);
    Sfx.blocked();
    return;   // 揺れと音だけで伝え、文字は出さない（2026-10-30 オーナー）
  }
  const ab = abilityAt(i);   // 使ったタイルは動かないので、前後で変わらない
  animatePlacement(() => applyMoveState(i, dir));
  Sfx.move(ab, dir);
  logEl.textContent = '';   // 押したブロックの表示も、押したマスの縁の合図も出さない（2026-10-30 オーナー）
  clearHint(); // 示した手はもう古いので消す
  if (isSolved()) showClear();
  else if (tutorial) tutMark();
}


// クリアの行。手数も★の評価も出さない（2026-10-30 オーナー）。揃ったことは盤の光と音で見せる。
// 引数は前のまま（呼ぶ側を変えない）。par・★は記録には残るが、画面には出さない。
const DAILY_REVEALED_LINE = '';   // 解説を見た日も文字を出さない（2026-10-30 オーナー）
const DAILY_ABANDONED_LINE = '';   // 途中でやめた日は文字を出さない（2026-10-30 オーナー）
function clearLine(n, used) {
  return L('クリア', 'Clear');
}

// par が決まった。クリアを済ませて待っていたなら、行を書き換えて ★★★ を記録する。
function resolvePar(p) {
  par = p;
  if (!clearPending) return;
  const c = clearPending;
  clearPending = null;
  if (dailyKey) { setDailyStars(c.moves, c.hintUsed, p); return; }   // 行は先に出してある
  logEl.textContent = clearLine(c.moves, c.hintUsed);
  if (p && W === H && !forcedAbilities && starRating(c.moves, p.cost, c.hintUsed) === 3) recordPerfect();
}

// 今日の 1 問のクリアを記録する。最初の 1 回だけ（その日に記録があれば何もしない）。
// par がまだ分からないときは ★ なしで先に残し、届いたら setDailyStars が書き足す。
function recordDaily(n, used, p, ms) {
  if (dailyIsClosed(daily[dailyKey])) return;
  const stars = p ? starRating(n, p.cost, used) || 0 : 0;
  const rankable = !used;
  daily = addDaily(daily, dailyKey, { state: 'cleared', ms, hint: !!used, moves: n, stars, rankable });
  saveDaily();
  // 後で Game Center に送る入口。受ける側は今は無い
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('abilitile:daily-clear', { detail: { key: dailyKey, ms, rankable } }));
    }
  } catch (e) { /* 通知できなくても記録は残る */ }
}
function setDailyStars(n, used, p) {
  const e = daily[dailyKey];
  if (!dailyIsCleared(e)) return;
  e.stars = p ? starRating(n, p.cost, used) || 0 : 0;
  saveDaily();
}

function recordPerfect() {
  if (!stageDef(W, curDiff)) return;
  const st = stageFor(W, curDiff);
  st.perfect = (st.perfect || 0) + 1;
  saveStages();
}

function showClear() {
  if (tutorial) { tutorialCleared(); return; }   // 練習の盤は、★・回数・広告の数のどれにも数えない
  commitRun();
  Sfx.solved();
  if (dailyKey) { dailyMs = dailyElapsed(); dailyT0 = null; dailyClockStop(); }   // 揃った瞬間の時間で止める（locked にする前に）
  locked = true;
  // 解説を見ているあいだは、揃ったあとも操作バーを残す。戻って見直せるようにするため。
  // 閉じるのは「やめる」を押したときだけ。
  stopAutoSolve();   // 解説で揃ったときも、そのままクリアの画面へ（見直しのバーは出さない）
  clearHint();

  gridEl.classList.remove('cleared');
  void gridEl.offsetWidth; // アニメーション再生のための reflow
  gridEl.classList.add('cleared');

  logEl.classList.add('done');
  setClearBar(true);
  // 今日の 1 問: 解説を見ていたら（確認を通らずに揃った場合も含め）その日は解説の記録にする
  if (dailyKey && autoSolvedFlag && !dailyIsClosed(daily[dailyKey])) markDailyRevealed();
  const dayRevealed = !!dailyKey && daily[dailyKey] && daily[dailyKey].state === 'revealed';
  const ranked = !!dailyKey && !dailyFree();   // やめた日の盤は、時間・共有なしのふつうのクリアの行
  logEl.textContent = (autoSolvedFlag || dayRevealed)
    ? (ranked ? DAILY_REVEALED_LINE : '')   // 解説で揃ったときは文字を出さない（2026-10-30 オーナー）
    : ranked ? dailyResultLine(dailyElapsed(), hintUsed) : clearLine(moves, hintUsed);
  clearPending = (!autoSolvedFlag && !dayRevealed && par === undefined) ? { moves, hintUsed } : null;
  shareBtnEl.hidden = !(ranked && !autoSolvedFlag && !dayRevealed);

  // 自分で揃えた回数を数える（全画面の広告の間隔に使う。iOS 版だけが受け取る）。「解説」で揃えたものは数えない
  if (!autoSolvedFlag && !dayRevealed) adDue = Rewards.recordClear(!!dailyKey).due;

  // 今日の 1 問は、自分で揃えたときだけ日ごとの記録に残す（ステージの記録には数えない）
  if (dailyKey) { if (!autoSolvedFlag && !dayRevealed) recordDaily(moves, hintUsed, par || null, dailyElapsed()); dailyClockViewSync(); return; }

  // 自分で揃えた、正方形・カスタムでない盤だけをステージのクリアに数える。
  // 「解説」で揃えたものは遊んで解いたとは言えないので数えない。
  if (!autoSolvedFlag && W === H && !forcedAbilities) {
    clears[W] = (clears[W] || 0) + 1;   // 旧仕様の記録。消さずに足しておく
    try { localStorage.setItem(CLEARS_KEY, JSON.stringify(clears)); } catch (e) { /* 保存できなくても遊べる */ }

    if (!stageDef(W, curDiff)) return;
    const st = stageFor(W, curDiff);
    st.clears = (st.clears || 0) + 1;
    if (par && starRating(moves, par.cost, hintUsed) === 3) st.perfect = (st.perfect || 0) + 1;
    st.seed = Math.floor(Math.random() * 1e9);   // 次はゴールの柄が変わる
    delete st.goal;                              // 上の seed が変わった時点で古いゴールになる
    saveStages();
  }
}

// クリアのあとの「次へ」「ホーム」。ボタンの列（ヒント・解説・再生成）と入れ替える。
// 今日の 1 問は次の盤が無いので「次へ」を出さない（共有とホーム）。
const clearBarEl = document.getElementById('clearBar');
let adDue = false;   // このクリアの画面を離れるときに全画面広告を出す回か（Rewards が数える）
// クリアの画面を離れる（次へ・ホーム）。出す回なら広告を頼む。広告は次の画面の上に出る。
function leaveClear() {
  if (!adDue) return;
  adDue = false;
  Rewards.requestInterstitial();
}
const nextBtnEl = document.getElementById('nextBtn');
function setClearBar(on) {
  document.getElementById('play').classList.toggle('is-clear', on);   // playEl はこの下で決まるので直接引く
  nextBtnEl.hidden = on && !!dailyKey;
}
// 次の盤。ステージなら同じステージの次の柄（鍵つきなら完全版の案内）、カスタムなら同じ設定で作り直す。
function goNext() {
  if (dailyKey) { goHome(); return; }
  // 鍵つきなら完全版の案内を開くだけ。購入の画面に広告を重ねないよう、ここでは広告を頼まない（RULES §13）
  if (W === H && !forcedAbilities && stageDef(W, curDiff)) {
    if (!Entitlement.stageOpen(W, curDiff)) { openLockSheet({ s: W, d: curDiff }); return; }
    const st = stageFor(W, curDiff);
    if (autoSolvedFlag) { st.seed = Math.floor(Math.random() * 1e9); delete st.goal; saveStages(); }   // 解説で揃えた盤も次は別の柄
    playStage(W, curDiff);
  } else {
    if (forcedAbilities && !Entitlement.customOpen()) { openLockSheet(); return; }
    newPuzzle();
  }
  leaveClear();   // 次の盤を出してから。広告はその上に出て、閉じれば続きから遊べる
}
nextBtnEl.addEventListener('click', goNext);
document.getElementById('clearHomeBtn').addEventListener('click', goHome);

// ---- 解説（自動で揃える） ----
// 手順どおりに 1 手ずつ押していく。1 手ごとに手順を読み直すので、
// 途中で解き直しが入っても破綻しない。止める・戻す操作は無く、最後まで自動で進む（2026-10-30 オーナー）。
// 止めるのは Esc か、ホームへ戻ったときだけ。
let autoSolving = false;   // 解説を開いているか
let autoPlaying = false;   // 勝手に進んでいるか（始める前の手順の計算中は false）
let autoStep = null;        // 始めるときに決めた進め方 { interval, chunk }
let autoSolvedFlag = false;
let autoTimer = null;

// 1 手ずつ見せられる上限。これを超える手順は一気に揃える。
// 混ぜ切った大きい盤では、保険の手順が数千〜数万手になることがあるため。
// どの盤面でも順に揃える。ただし保険の手順は 1 万手を超えることがあるので、
// 1 手ずつ止まっていると終わらない。飛ばさずに、長いほど 1 回で多く進めて速くする。
// 目安としてだいたいこの時間で終わる。
const AUTO_TOTAL_MS = 18000;

// ペースは始めるときに一度だけ決める。毎回の残りから決め直すと、
// 終盤が 1 手ずつの遅い進みになって全体が何倍にも延びる。
function autoPace(total) {
  const interval = total <= 60 ? 340 : 120;
  const ticks = Math.max(1, Math.round(AUTO_TOTAL_MS / interval));
  return { interval, chunk: Math.max(1, Math.ceil(total / ticks)) };
}

const confirmEl = document.getElementById('confirmOverlay');
const confirmTitleEl = document.getElementById('confirmTitle');
const confirmTextEl = document.getElementById('confirmText');
const confirmYesEl = document.getElementById('confirmYes');
let confirmAction = null;   // 「はい」を押したときにすること

// 確認画面はひとつを使い回す。見出し・本文・決定ボタンの文言を差し替える。
// 取り消しのボタンはふだん「やめる」。決定が「やめる」の確認では noLabel（「続ける」など）を渡す
function askConfirm(title, text, yesLabel, action, noLabel) {
  confirmTitleEl.textContent = title;
  confirmTextEl.innerHTML = text;
  confirmYesEl.textContent = yesLabel;
  document.getElementById('confirmNo').textContent = noLabel || L('やめる', 'Cancel');
  confirmAction = action;
  if (confirmEl.hidden && typeof document.activeElement !== 'undefined') confirmReturn = document.activeElement;
  confirmEl.hidden = false;
  document.getElementById('confirmNo').focus();
}
let confirmReturn = null;   // 確認を閉じたらフォーカスを戻す先
// 確認が出ているあいだは Tab を 2 つのボタンの中で回す（後ろの盤やボタンへ出ない）
confirmEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const no = document.getElementById('confirmNo');
  const first = no, last = confirmYesEl;
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

function closeConfirm() {
  const wasOpen = !confirmEl.hidden;
  confirmEl.hidden = true;
  confirmAction = null;
  const back = confirmReturn;
  confirmReturn = null;
  if (wasOpen && back && back.isConnected !== false && typeof back.focus === 'function') back.focus();
}

function askAutoSolve() {
  if (autoSolving || locked) return;
  if (dailyKey && !tutorial && (!daily[dailyKey] || daily[dailyKey].state === 'playing')) {
    askConfirm(L('解説を見る', 'Show the solution'),
      L('解説を見ると、<strong>今日の 1 問はクリアになりません</strong>。<br>ランキングにも載らず、あとからやり直すこともできません。',
        'If you view the solution, <strong>today\'s puzzle won\'t count as cleared</strong>.<br>You won\'t appear in the ranking, and you can\'t retry it later.'),
      L('見る', 'Show'), () => { closeConfirm(); markDailyRevealed(); startAutoSolve(); });
    return;
  }
  askConfirm(L('解説を見る', 'Show the solution'),
    L('目標の柄まで、盤面が<strong>自動で動きます</strong>。<br>この盤面は自分で解けなくなります。',
      'The board will <strong>move by itself</strong> until it matches the goal.<br>You won\'t be able to solve this board yourself.'),
    L('見る', 'Show'), startAutoSolve);
}

// 盤面を作り直す。サイズとブロック数の設定は据え置きで、
// 使うブロックの組み合わせも目標の柄も引き直す。
// 揃えたあとに次へ進む手段でもあるので、完成していても押せる。
function askRegenerate() {
  if (autoSolving || dailyKey) return;   // 今日の 1 問は作り直せない
  askConfirm(L('新しい盤面を作る', 'Make a new board'),
    L('サイズと難しさはそのままで、'
      + '<strong>使うブロックも目標の柄も</strong>選び直します。<br>今の盤面は元に戻せません。',
      'Keeps the size and difficulty, and picks <strong>new blocks and a new goal</strong>.<br>The current board can\'t be brought back.'),
    L('作る', 'Make'), () => { closeConfirm(); newPuzzle(); });
}

const AUTO_THINKING = L('手順を計算しています…', 'Working out the moves…');
function startAutoSolve() {
  closeConfirm();
  if (autoSolving || locked) return;
  // 手順の計算が終わるまで入力を受けないよう、先に解説モードに入る
  autoSolving = true;
  autoPlaying = false;
  const go = () => {
    if (!autoSolving) return;              // 計算中に「やめる」を押した
    if (locked || isSolved()) { stopAutoSolve(); return; }
    // 手順がまったく無いときだけは、そのまま完成形へ動かす
    if (!activeRuns().length) { stopAutoSolve(); autoSolvedFlag = true; snapToGoal(); return; }
    autoStep = autoPace(planCost(activeRuns()));
    if (logEl.textContent === AUTO_THINKING) logEl.textContent = '';
    playAuto();
  };
  // 使える短い手順がもうあれば、探索の終わりを待たずにそれで始める（裏の探索はそのまま続く）
  if (activeRuns().length && planCost(activeRuns()) <= HINT_SHOW_MAX) { go(); return; }
  logEl.textContent = AUTO_THINKING;   // 手順の計算に時間がかかる盤だけ、盤の下に出す
  requestSolve(go, true);
}

// 手順どおりに count 手すすめる。戻せるように、進めた手は控えておく。
function advanceAuto(count, slide) {
  let last = null;
  animatePlacement(() => {
    for (let c = 0; c < count; c++) {
      const runs = activeRuns();
      if (!runs.length) break;
      const r = runs[0];
      // 順方向に n 回進めるか、逆方向に (位数 - n) 回進めるか、少ない側を選ぶ
      const dir = r.n <= r.order - r.n ? 1 : -1;
      const ab = abilityAt(r.i);
      if (!applyMoveState(r.i, dir)) break;
      last = { i: r.i, dir, ab };
    }
  }, slide);
  if (last) {
    flashSlot(last.i, last.dir);
    Sfx.move(last.ab, last.dir);      // 音は 1 回ぶんだけ
    autoSolvedFlag = true;
  }
  return last;
}

function playAuto() {
  if (!autoSolving || locked || isSolved()) return;
  autoPlaying = true;
  stepAuto();
}

function pauseAuto() {
  autoPlaying = false;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
}

function stepAuto() {
  autoTimer = null;
  if (!autoSolving || !autoPlaying) return;
  if (locked || isSolved() || !activeRuns().length) { pauseAuto(); return; }

  if (!autoStep) autoStep = autoPace(planCost(activeRuns()));
  const { interval, chunk } = autoStep;

  // まとめて進めるぶんも 1 回の滑らかな移動として見せる。
  // 手順の順番どおりに進むので、揃っていく過程はそのまま見える。
  // 追える大きさのときだけ滑らせる。次の刻みが来る前に必ず到着させる。
  // まとめて動かすときは滑らせない（途中の隙間が目立つうえ、追えもしない）。
  advanceAuto(chunk, chunk <= 3 ? Math.min(300, Math.round(interval * 0.75)) : 0);
  if (isSolved()) { showClear(); return; }
  autoTimer = setTimeout(stepAuto, interval);
}

// 完成形へ直接動かす。タイルが元の位置に戻る配置は必ず目標の柄になる。
function snapToGoal() {
  animatePlacement(() => { board = Array.from({ length: SIZE }, (_, i) => i); });
  showClear();
}

function stopAutoSolve() {
  autoSolving = false;
  autoPlaying = false;
  autoStep = null;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  if (logEl.textContent === AUTO_THINKING) logEl.textContent = '';
}

// 新しい盤面が出るときの入り。transform を使うが、手を打てば
// applyAnimated が既存のアニメーションを打ち切るので FLIP とは衝突しない。
function dealIn() {
  const still = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) return;
  for (let i = 0; i < SIZE; i++) {
    tiles[board[i]].animate(
      [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }],
      { duration: 300, delay: (xOf(i) + yOf(i)) * 20, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }
    );
  }
}

// ---- 混ぜ方 ----
// 盤面ごとに (能力, マス) の手を先に引いておく。混ぜるときに何度も使う。
function buildMoveTable() {
  const cyc = [];
  const cnt = [];
  for (let a = 0; a < ABILITIES.length; a++) {
    const per = Array.from({ length: SIZE }, (_, i) => cyclesOf(a, xOf(i), yOf(i)));
    cyc.push(per);
    // 位数 2 の手は順逆が同じ結果になるので 1 通りと数える
    cnt.push(per.map((c) => (c ? (orderOf(c) === 2 ? 1 : 2) : 0)));
  }
  return { cyc, cnt };
}

// その盤面で打てる手の総数（向きこみ）
function degreeOf(b, tbl) {
  let d = 0;
  for (let i = 0; i < SIZE; i++) d += tbl.cnt[tileAbility[b[i]]][i];
  return d;
}

// 打てる手を通し番号で取り出す
function nthMove(b, tbl, d) {
  for (let i = 0; i < SIZE; i++) {
    const c = tbl.cnt[tileAbility[b[i]]][i];
    if (d < c) return [i, c === 1 || d === 0 ? 1 : -1];
    d -= c;
  }
  return null;
}

// 完成状態から混ぜる。
//
// 「打てる手から等確率で 1 つ」だけだと、打てる手が多い盤面ほど居座りやすくなり、
// いくら混ぜても一様分布にならない（厳密に計算すると全変動距離 0.06〜0.07 の偏りが残る）。
// そこで Metropolis 補正を入れる。次数の比で採択すれば詳細釣り合いが成り立ち、
// 定常分布はちょうど一様＝エントロピー最大になる。
function mixBoard(b, tbl, steps, rng, rec) {
  let deg = degreeOf(b, tbl);
  // どのマスも押せない組み合わせ（能力なしが多い盤など）。混ざらないので何もしない。
  // 呼び出し側は「混ぜたのに完成のまま」を見て引き直す。
  if (!deg) return;
  for (let t = 0; t < steps; t++) {
    const [i, dir] = nthMove(b, tbl, Math.floor(rng() * deg));
    const cyc = tbl.cyc[tileAbility[b[i]]][i];
    applyTo(b, cyc, dir);
    const next = degreeOf(b, tbl);
    if (rng() < Math.min(1, deg / next)) { deg = next; rec.push([i, dir]); }
    else applyTo(b, cyc, -dir);   // 棄却したので戻す
  }
}

// 1 手ずつの並びを「このマスを n 回押す」という形にまとめる。
// 位数はその時点の盤面で決まるので、順に進めながら求める。
function movesToRuns(mvs, startBoard, tbl) {
  const b = Uint8Array.from(startBoard);
  const runs = [];
  for (const [i, dir] of mvs) {
    const cyc = tbl.cyc[tileAbility[b[i]]][i];
    const order = orderOf(cyc);
    const last = runs[runs.length - 1];
    if (last && last.i === i) {
      last.n = (((last.n + (dir > 0 ? 1 : order - 1)) % order) + order) % order;
      if (last.n === 0) runs.pop();
    } else {
      runs.push({ i, n: dir > 0 ? 1 : order - 1, order });
    }
    applyTo(b, cyc, dir);
  }
  return runs;
}

// 混ぜた道筋から、同じ盤面に戻った区間を取り除く。
// 混ぜた手数そのままだと保険の手順が長すぎるため。
// 切り詰めたときは捨てた区間の記録も消す。残すと、あとでその盤面に戻ったときに
// 配列を穴あきのまま伸ばしてしまう。
function removeLoops(path, tbl) {
  const lay = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]);
  const layKey = () => String.fromCharCode.apply(null, lay);
  const keyAt = [layKey()];
  const seen = new Map([[keyAt[0], 0]]);
  const out = [];
  for (const mv of path) {
    applyTo(lay, tbl.cyc[lay[mv[0]]][mv[0]], mv[1]);
    out.push(mv);
    const k = layKey();
    const prev = seen.get(k);
    if (prev !== undefined) {
      for (let j = prev + 1; j < out.length; j++) seen.delete(keyAt[j]);
      out.length = prev;
      keyAt.length = prev + 1;
    } else {
      seen.set(k, out.length);
      keyAt[out.length] = k;
    }
  }
  return out;
}

// 柄と使うブロックを rng から決めて、混ぜる前のゴールの並びを返す（タイル v の能力 = マス v の色）。
// newPuzzle 本体と、ホームのステージ一覧のゴールのプレビュー（混ぜない）の両方から呼ぶので、
// 実際に遊ぶ盤のゴールと必ず一致する。cands は candidatePatterns の結果を先に渡す
// （newPuzzle は同じ K で何度も呼ぶので、外で 1 回だけ求める）。
// forced を渡す（カスタム）ときだけ、指定した組をシャッフルして使う。
function pickGoal(w, h, k, cands, rng, forced, attempt) {
  const pat = cands[Math.floor(rng() * cands.length)];

  // 使うブロックを k 種類選ぶ。カスタムで指定があればそれを使う。
  // ただし指定した組ではどの柄も崩せないことがありうるので、
  // 一定回数を超えたらランダム選びに戻して必ず終わらせる。
  let picked;
  if (forced && attempt < 200) {
    picked = [...forced];
    for (let a = picked.length - 1; a > 0; a--) {
      const j = Math.floor(rng() * (a + 1));
      [picked[a], picked[j]] = [picked[j], picked[a]];
    }
  } else {
    // 「何も起きない」も、色数によらず混ぜる。手数を決めて混ぜるので（scrambleBoard）、
    // 動かないマスが多くても決めた手数ぶんは必ず動かせる。動かせない組は generate が引き直す。
    // 無料版（鍵が効いていて完全版でない）は、無料のブロックの中からだけ選ぶ。
    const pool = ABILITIES.map((_, a) => a)
      .filter((a) => previewAllBlocks || Entitlement.blockOpen(ABILITIES[a].id));
    for (let a = pool.length - 1; a > 0; a--) {
      const j = Math.floor(rng() * (a + 1));
      [pool[a], pool[j]] = [pool[j], pool[a]];
    }
    picked = pool.slice(0, k);
  }

  return Array.from({ length: w * h }, (_, i) => picked[pat.fn(i % w, Math.floor(i / w), w, h, k)]);
}

// ---- 生成 ----
// 完成状態から、ちょうど n 手だけ動かして盤を作る（手数を決めて混ぜる）。
// 直前の手を打ち消すだけの手と、これまでに通った盤面（絵柄の並び）に戻る手は選ばない。
// そのため答えまでの手数はほぼ n になり、混ぜた手順の逆がそのまま「n 手の答え」になる。
// 同じマスを続けて押す手も選ばない（続けて押すと 1 手に数えられて、手数が n より減るため）。
// relax を付けると、同じマスの連続を許す（動かせるマスが少ない組で、どうしても進まないときの保険）。
// n 手ぶん進めなかったら null（盤は途中のまま。呼び出し側が組を引き直す）。
// b は完成状態（b[i] = i）から始める。結果は b にそのまま入り、動かした手の並びを返す。
function scrambleBoard(b, tbl, n, rng, relax = false) {
  const keyNow = () => String.fromCharCode.apply(null, b.map((v) => tileAbility[v]));
  const seen = new Set([keyNow()]);
  const path = [];
  for (let t = 0; t < n; t++) {
    const prev = path[path.length - 1];
    const cand = [];
    for (let i = 0; i < SIZE; i++) {
      const a = tileAbility[b[i]];
      if (!tbl.cyc[a][i]) continue;
      const two = tbl.cnt[a][i] === 1;   // 位数 2 は順逆が同じ
      for (const dir of two ? [1] : [1, -1]) {
        if (prev && prev[0] === i && (!relax || two || dir === -prev[1])) continue;
        cand.push([i, dir]);
      }
    }
    let moved = false;
    while (cand.length) {
      const j = Math.floor(rng() * cand.length);
      const [i, dir] = cand[j];
      const cyc = tbl.cyc[tileAbility[b[i]]][i];
      applyTo(b, cyc, dir);
      const k = keyNow();
      if (!seen.has(k)) { seen.add(k); path.push([i, dir]); moved = true; break; }
      applyTo(b, cyc, -dir);             // 通った盤面に戻るので取り消す
      cand[j] = cand[cand.length - 1];
      cand.pop();
    }
    if (!moved) return null;
  }
  return path;
}

// seed からゴール（tileAbility）と混ぜた盤（board）と答えの手順（solution）を決める。
// 今の W / H / types / scrambleN / forcedAbilities を使う。newPuzzle と、ホームのプレビュー
// （stageGoalPreview）が同じここを通るので、プレビューと実際の盤が必ず一致する。
// 答え（solution）は混ぜた手順の逆。盤が出たあとの探索で、これより短いものが見つかれば差し替わる。
function generate(seedValue) {
  const rng = mulberry32(seedValue);
  const K = Math.min(forcedAbilities ? forcedAbilities.length : types, SIZE, ABILITIES.length);

  patternSeed = Math.floor(rng() * 1e9);   // 種つきの柄を盤面ごとに変える
  const cands = candidatePatterns(W, H, K);

  // 3×3 だけ、最短が min 手より短い盤は引き直す（最短は探索ですぐ分かる）。引き直しは 300 回まで
  const def3 = W === 3 && H === 3 ? stageDef(3, curDiff) : null;
  const minMoves = def3 ? def3.min : 0;
  let shortTries = 0, fails = 0;   // fails は「手数ぶん進めなかった」回数（短すぎて引き直した回は数えない）

  for (let attempt = 0; ; attempt++) {
    // 柄と使うブロックを rng から決める。タイル v の能力 = 完成時にマス v に来る色。
    tileAbility = pickGoal(W, H, K, cands, rng, forcedAbilities, attempt);

    // 動かせるマスが無い・決めた手数ぶん進めない組（指定の組や小さい盤）は引き直す。
    // 3×3 は通れる盤面が少なく、手数ぶん進める組は 1 ～ 3 割しかない（盤が小さいので引き直しは軽い）。
    // 引き直しがかさむ（大きい盤ではまず起きない）ときは、同じマスの連続を許し、
    // それでもだめなら手数を減らしてでも必ず終わらせる。
    const n = fails < 200 ? scrambleN : Math.max(1, scrambleN - Math.floor((fails - 200) / 5));
    const tbl = buildMoveTable();
    board = Array.from({ length: SIZE }, (_, i) => i);
    const path = scrambleBoard(board, tbl, n, rng, fails >= 100);
    if (path && path.length && !isSolved()) {
      scrambleMoves = path;
      const back = [];
      for (let q = path.length - 1; q >= 0; q--) back.push([path[q][0], -path[q][1]]);
      solution = movesToRuns(back, board, tbl);
      if (minMoves && shortTries < 300) {
        const start = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]);
        const goal = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]);
        const res = Solver.solvePuzzle(buildProblem(), start, goal, 200);
        if (res && res.optimal && res.plan && Solver.planCost(buildProblem(), res.plan, start) < minMoves) {
          shortTries++; fails = 0; continue;   // 手数ぶんは進めたので、進めなかった回数は数え直す
        }
      }
      break;
    }
    fails++;
  }
}

// dailyOn に日付のキーを渡すと今日の 1 問（全ブロックから選ぶ）。
function newPuzzle(useSeed, dailyOn) {
  dailyClockStop();   // 前の盤が今日の 1 問なら、その日の記録へ時間を残してから切り替える
  seed = Number.isFinite(useSeed) ? useSeed : Math.floor(Math.random() * 1e9);
  dailyKey = typeof dailyOn === 'string' ? dailyOn : null;
  previewAllBlocks = !!dailyKey;
  try { generate(seed); } finally { previewAllBlocks = false; }
  beginBoard();
}

// generate（または固定の盤）で決めた tileAbility・board・solution から、遊ぶ状態を作り直す。
function beginBoard() {
  shareBtnEl.hidden = true;

  stopAutoSolve();
  autoSolvedFlag = false;
  closeConfirm();
  gridEl.classList.remove('cleared');
  logEl.classList.remove('done');
  setClearBar(false);
  moves = 0;
  run = { i: -1, d: 0, order: 1 };
  hintPlan = null;
  if (improveTimer) { clearTimeout(improveTimer); improveTimer = null; }
  improveRound = 0; movesSinceImprove = 0;
  // par は、混ぜた手順の逆（答えの手順）の長さから始める。探索でもっと短いものが見つかれば変わる
  par = solution.length ? { cost: planCost(solution), optimal: false } : null;
  parWanted = false; parId = 0; hintUsed = false; clearPending = null;
  locked = false;
  dailyLoadRecord();   // 今日の 1 問なら、記録の時間・ヒントを引き継ぐ

  // 解法の準備。計算中の Worker は捨てて作り直す（古い盤面の計算を待たないため）
  problem = buildProblem();
  solveId++;
  hintBusy = false;
  solveDones = [];
  movesWhileSolving = [];
  makeWorker();
  if (worker) worker.postMessage({ type: 'init', problem });

  paintTiles();
  renderGoal();
  renderLegend();
  renderPanel();
  placeTiles();
  markUsable();
  clearHint();
  dealIn();
  seedOutEl.textContent = String(seed);
  document.getElementById('seedIn').value = String(seed);
  logEl.textContent = readyLine();

  // 先に裏で解いておく。ヒントを押したときに待たせないため。
  parWanted = true;
  requestSolve(null, false, true);
  parWanted = false;   // 先読みを見送った（Worker が無い）ときは par 無し
}


// ---- 配線 ----
// 押す = 順方向、長押し（または右クリック）= 逆方向。
// 位数 2 の入れ替えは順逆が同じ結果になるので、実質は回転のブロック向け。
//
// 注意: タッチ端末では、自前の長押しタイマーとは別にブラウザ自身も長押しで
// contextmenu を出す。どちらが先に来ても 1 回しか発動しないよう、
// 「この押下ではもう発動した」という印を 1 つだけ持って両方で見る。
const LONG_PRESS_MS = 400;
let pressCell = -1;
let pressTimer = null;
let pressHandled = true;

function endPress() {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  setPressing(null);
}
// 指が触れているマスに印を付けて、タイルを沈める（iOS は :active が効かないことがあるので JS で付ける）
let pressingSlot = null;
function setPressing(slot) {
  if (pressingSlot && pressingSlot !== slot) pressingSlot.classList.remove('pressing');
  pressingSlot = slot;
  if (slot) slot.classList.add('pressing');
}

// この押下でまだ発動していなければ 1 回だけ発動する
function firePress(i, dir) {
  if (pressHandled || i < 0) return;
  pressHandled = true;
  endPress();
  fire(i, dir);
}

gridEl.addEventListener('pointerdown', (e) => {
  if (autoSolving) return;
  const slot = e.target.closest('.slot');
  if (!slot) return;
  endPress();
  pressCell = Number(slot.dataset.i);
  pressHandled = false;              // ここから 1 回だけ発動できる
  if (!locked) setPressing(slot);
  if (e.button !== 0) return;        // 右クリックは contextmenu 側で扱う
  pressTimer = setTimeout(() => {
    pressTimer = null;
    firePress(pressCell, -1);        // 長押し = 逆方向
  }, LONG_PRESS_MS);
});

gridEl.addEventListener('pointerup', () => {
  if (autoSolving) return;
  endPress();
  firePress(pressCell, 1);           // 短く離した = 順方向
});

// 指やカーソルが外れたら、この押下では何も発動させない
const abortPress = () => { endPress(); pressHandled = true; };
gridEl.addEventListener('pointercancel', abortPress);
gridEl.addEventListener('pointerleave', abortPress);

// キーボード: 矢印でマスを移る（Tab で入るのは今いる 1 マスだけ）。Enter・Space で押す、Shift を足すと長押し（逆方向）
gridEl.addEventListener('keydown', (e) => {
  const slot = e.target.closest && e.target.closest('.slot');
  if (!slot) return;
  const i = Number(slot.dataset.i);
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -W, ArrowDown: W }[e.key];
  if (step !== undefined) {
    const j = i + step;
    const sameRow = Math.abs(step) !== 1 || Math.floor(j / W) === Math.floor(i / W);
    if (j >= 0 && j < SIZE && sameRow) {
      slots[i].tabIndex = -1;
      slots[j].tabIndex = 0;
      slots[j].focus();
    }
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (autoSolving || e.repeat) return;
    if (!locked) { setPressing(slots[i]); setTimeout(() => { if (pressingSlot === slots[i]) setPressing(null); }, 110); }
    fire(i, e.shiftKey ? -1 : 1);
  }
});

gridEl.addEventListener('contextmenu', (e) => {
  const slot = e.target.closest('.slot');
  if (!slot) return;
  e.preventDefault();                // 長押しのメニューは常に抑止する
  if (autoSolving) return;
  // 右クリックでも長押しでも、contextmenu の前に必ず pointerdown が来る。
  // ここで押下の有無に関わらず発動できるようにすると、
  // 「押したまま外へ出たら発動しない」という保証が壊れるので、印に従うだけにする。
  firePress(pressCell, -1);
});

document.getElementById('hintBtn').addEventListener('click', showHint);

// ---- パネルのタブ ----
// ブロックの一覧が長いので、遊び方・ブロック・設定は積まずに切り替える。
const panelTabsEl = document.getElementById('panelTabs');
const TABS = [
  { key: 'rule', label: L('遊び方', 'How to play'), sec: 'secRule' },
  { key: 'block', label: L('ブロック', 'Blocks'), sec: 'secBlock' },
  { key: 'config', label: L('設定', 'Settings'), sec: 'secConfig' },
];
let panelTab = TABS[0].key;

for (const t of TABS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = `tab${t.key[0].toUpperCase()}${t.key.slice(1)}`;
  b.dataset.v = t.key;
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-controls', t.sec);
  b.textContent = t.label;
  panelTabsEl.append(b);
}

function setPanelTab(key, focus = false) {
  if (!TABS.some((t) => t.key === key)) return;
  panelTab = key;
  for (const b of panelTabsEl.querySelectorAll('button')) {
    const on = b.dataset.v === key;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
  for (const t of TABS) document.getElementById(t.sec).hidden = t.key !== key;
  document.getElementById('panel').scrollTop = 0;   // 前のタブの読みかけ位置を持ち越さない
}

setPanelTab(panelTab);

panelTabsEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setPanelTab(b.dataset.v);
});
// タブは左右キーで移れるのが決まりごと
panelTabsEl.addEventListener('keydown', (e) => {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const at = TABS.findIndex((t) => t.key === panelTab);
  setPanelTab(TABS[(at + step + TABS.length) % TABS.length].key, true);
});

// ---- 絵柄の読み方 ----
// 「絵柄の読み方」は描き方ごとに変わる。選んでいるものの説明に差し替える。
function renderGlyphLegend() {
  const ul = document.getElementById('glyphLegend');
  ul.replaceChildren();
  for (const line of Glyphs.byId(glyphStyle).legend) {
    const li = document.createElement('li');
    li.innerHTML = line;
    ul.append(li);
  }
}

renderGlyphLegend();

// ---- 見本の盤（スタートと遊び方） ----
// まん中の「上下左右を時計回り」を押す前と後。上下左右の 4 枚が時計回りに 1 つずつ移る。
const abId = (id) => ABILITIES.findIndex((ab) => ab.id === id);
const DEMO_BEFORE = ['none', 'swapLR', 'none', 'ringCW', 'crossCW', 'swapUD', 'none', 'diagCW', 'none'].map(abId);
const DEMO_AFTER = ['none', 'ringCW', 'none', 'diagCW', 'crossCW', 'swapLR', 'none', 'swapUD', 'none'].map(abId);

function renderDemos() {
  for (const [id, abs] of [['startDemo', DEMO_BEFORE], ['howtoBefore', DEMO_BEFORE], ['howtoAfter', DEMO_AFTER]]) {
    const el = document.getElementById(id);
    el.replaceChildren();
    abs.forEach((ab, i) => {
      const slot = document.createElement('div');
      slot.className = i === 4 ? 'slot press' : 'slot';
      const t = document.createElement('div');
      t.className = 'tile';
      t.style.background = bgOf(ab);
      t.style.color = INK;
      t.innerHTML = iconSvg(ab);
      slot.append(t);
      el.append(slot);
    });
  }
}
renderDemos();

// ---- 効果音 ----
// 入切は説明パネルの設定にある。
const soundChk = document.getElementById('soundChk');

function markSound() { soundChk.checked = Sfx.enabled; }
soundChk.addEventListener('change', () => { Sfx.set(soundChk.checked); markSound(); });

// 振動の入切（iOS アプリの中だけ。振動そのものは native.js が、鳴らす直前にこの保存を見て決める）
const hapticsRowEl = document.getElementById('hapticsRow');
const hapticsChk = document.getElementById('hapticsChk');
const HAPTICS_KEY = 'glyphshift.haptics';   // '0' で切。無ければ入
const inNativeApp = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
if (inNativeApp) {
  hapticsRowEl.hidden = false;
  try { hapticsChk.checked = localStorage.getItem(HAPTICS_KEY) !== '0'; } catch (e) { /* 読めなければ入のまま */ }
  hapticsChk.addEventListener('change', () => {
    try { localStorage.setItem(HAPTICS_KEY, hapticsChk.checked ? '1' : '0'); } catch (e) { /* 保存できなくても今回は効く */ }
  });
}

// 画面の明暗。'dark'（既定）/ 'light' / 'auto'（端末に合わせ、変わったら追う）。index.html の head にも同じ規則の先読みがある
const THEME_KEY = 'glyphshift.theme';
const themeSegEl = document.getElementById('themeSeg');
const themeMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
function themeSetting() {
  let t = 'dark';
  try { t = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { /* 読めなければ暗いまま */ }
  return ['dark', 'light', 'auto'].includes(t) ? t : 'dark';
}
function applyTheme() {
  const t = themeSetting();
  const light = t === 'light' || (t === 'auto' && !!themeMQ && themeMQ.matches);
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', light ? '#f4f3f6' : '#131217');
  for (const b of themeSegEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === t));
}
themeSegEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try { localStorage.setItem(THEME_KEY, b.dataset.v); } catch (err) { /* 保存できなくても今回は効く */ }
  applyTheme();
});
if (themeMQ) {
  if (themeMQ.addEventListener) themeMQ.addEventListener('change', () => { if (themeSetting() === 'auto') applyTheme(); });
  else if (themeMQ.addListener) themeMQ.addListener(() => { if (themeSetting() === 'auto') applyTheme(); });
}
applyTheme();

// 言語。選ぶと覚えて読み込み直す（i18n.js。途中で言葉が混ざらないように）
const langSegEl = document.getElementById('langSeg');
if (typeof I18n !== 'undefined') {
  for (const b of langSegEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === I18n.lang));
  langSegEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) I18n.set(b.dataset.v);
  });
}
markSound();


document.getElementById('solveBtn').addEventListener('click', askAutoSolve);
// 「新しい盤にする」はメニューの遊び方タブにある。確認を出す前にパネルを閉じる（解説中は何もしない）
document.getElementById('panelNew').addEventListener('click', () => {
  if (autoSolving) return;
  setPanel('panel', false);
  askRegenerate();
});
confirmYesEl.addEventListener('click', () => { const a = confirmAction; if (a) a(); });
document.getElementById('confirmNo').addEventListener('click', closeConfirm);

// ---- パネルの開閉 ----
// 設定パネルとブロック説明パネルを同じ仕組みで扱う。片方を開くともう片方は閉じる。
const backdropEl = document.getElementById('panelBackdrop');

const PANELS = {
  setup: {
    el: document.getElementById('setup'),
    btn: document.getElementById('homeCustomBtn'),
    close: document.getElementById('setupClose'),
    label: L('カスタム', 'custom'),
    onOpen: syncSetup,
    // 無料版は開かずに完全版の案内を出す（Web 版は鍵が無いので普通に開く）
    gate: () => Entitlement.customOpen() || (openLockSheet('custom'), false),
  },
  panel: {
    el: document.getElementById('panel'),
    btn: document.getElementById('menuBtn'),
    close: document.getElementById('panelClose'),
    label: L('遊び方と設定', 'how to play and settings'),
  },
};

const isOpen = (key) => PANELS[key].el.classList.contains('open');

function setPanel(key, open) {
  for (const [k, p] of Object.entries(PANELS)) {
    const on = open && k === key;
    p.el.classList.toggle('open', on);
    p.el.setAttribute('aria-hidden', String(!on));
    p.btn.setAttribute('aria-expanded', String(on));
    p.btn.setAttribute('aria-label', L(`${p.label}を${on ? '閉じる' : '開く'}`, `${on ? 'Close' : 'Open'} ${p.label}`));
  }
  backdropEl.hidden = !open;
  document.body.classList.toggle('no-scroll', open); // 背景のスクロールを止める
  if (open) {
    PANELS[key].onOpen?.();
    PANELS[key].close.focus();
  } else {
    (panelOpener && !panelOpener.closest('[hidden]') ? panelOpener : PANELS[key].btn).focus();
    panelOpener = null;
  }
}
// ホームの「設定」から開いたときは、閉じたらそのボタンへ戻す（右上のメニューはホームでは隠れている）
let panelOpener = null;
document.getElementById('homeConfigBtn').addEventListener('click', (e) => {
  panelOpener = e.currentTarget;
  setPanelTab('config');
  setPanel('panel', true);
});

for (const [key, p] of Object.entries(PANELS)) {
  p.btn.addEventListener('click', () => {
    if (!isOpen(key) && p.gate && !p.gate()) return;
    setPanel(key, !isOpen(key));
  });
  p.close.addEventListener('click', () => setPanel(key, false));
}
backdropEl.addEventListener('click', () => {
  for (const key of Object.keys(PANELS)) if (isOpen(key)) setPanel(key, false);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!confirmEl.hidden) { closeConfirm(); return; }
  if (autoSolving) { stopAutoSolve(); return; }
  for (const key of Object.keys(PANELS)) if (isOpen(key)) setPanel(key, false);
});

// ---- 盤面の設定 ----
// 選んだ内容はいったん保留し、「作成」を押したときだけ盤面に反映する。
// 辺は 2 つ選ぶだけ。長いほうを横にするので、盤が縦長になることはない。
// 縦長だとスマホの画面に収まらないため。
let pendA = W;
let pendB = H;
let pendW = W;
let pendH = H;
let pendDiff = curDiff;       // 難しさ（0〜2）。手数（と、カスタムでなければ種類数）が決まる
let pendCustom = false;
let pendPicked = new Set();   // カスタムで選んだブロック

const seedInEl = document.getElementById('seedIn');
const diffSegEl = document.getElementById('diffSeg');
const diffNoteEl = document.getElementById('diffNote');
const createBtnEl = document.getElementById('createBtn');
const sideAEl = document.getElementById('sideA');
const sideBEl = document.getElementById('sideB');
const sizeNoteEl = document.getElementById('sizeNote');
const pickerEl = document.getElementById('blockPicker');
const pickNoteEl = document.getElementById('pickNote');

function markSeg(el, value) {
  for (const b of el.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(Number(b.dataset.v) === value));
  }
}

function fillSeg(el, values, label) {
  el.replaceChildren();
  for (const v of values) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = String(v);
    b.textContent = label(v);
    b.setAttribute('aria-pressed', 'false');
    el.append(b);
  }
}

// 難しさの説明（ブロックの種類数だけ。手数は画面に出さない）。カスタムでは種類数は自分で選んだ数
function refreshDiffSeg() {
  markSeg(diffSegEl, pendDiff);
  syncLocks();
  const def = stageDef(pendW, pendDiff);
  const k = pendCustom ? pendPicked.size : def ? def.k : 0;
  diffNoteEl.textContent = k ? L(`ブロック ${k} 種`, `${k} kinds of blocks`) : '';
}

// カスタムのブロック選び
function fillPicker() {
  pickerEl.replaceChildren();
  ABILITIES.forEach((ab, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = String(k);
    b.title = ab.name;
    b.setAttribute('aria-label', ab.name);
    b.style.background = bgOf(k);
    b.style.color = INK;
    b.innerHTML = iconSvg(k);
    pickerEl.append(b);
  });
}

function refreshPicker() {
  for (const b of pickerEl.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(pendPicked.has(Number(b.dataset.v))));
  }
  const n = pendPicked.size;
  const max = Math.min(ABILITIES.length, pendW * pendH);
  pickNoteEl.textContent = n < 2
    ? L('2 種類以上えらんでください。', 'Choose at least 2 kinds.')
    : n > max
      ? L(`${pendW}×${pendH} には ${max} 種類までしか置けません。`, `A ${pendW}×${pendH} board fits at most ${max} kinds.`)
      : L(`${n} 種類をえらんでいます。`, `${n} kinds selected.`);
}

// カスタムの表示を切り替える
function refreshCustom() {
  applySides();
  refreshPicker();
  refreshDiffSeg();
  createBtnEl.disabled = pendCustom && !customReady();
}

const customReady = () => pendPicked.size >= 2 && pendPicked.size <= Math.min(ABILITIES.length, pendW * pendH);

// 選んだ 2 辺から盤の形を決める。長いほうが横。
function applySides() {
  pendW = Math.max(pendA, pendB);
  pendH = Math.min(pendA, pendB);
  markSeg(sideAEl, pendA);
  markSeg(sideBEl, pendB);
  sizeNoteEl.textContent = pendW === pendH
    ? L(`${pendW}×${pendW} の正方形になります。`, `A ${pendW}×${pendW} square.`)
    : L(`長いほうが横になります。→ 横 ${pendW} × 縦 ${pendH}`, `The longer side runs across → ${pendW} wide × ${pendH} tall`);
}

// パネルを開くたびに、今の盤面の設定に合わせ直す
function syncSetup() {
  pendA = W;
  pendB = H;
  pendW = W;
  pendH = H;
  pendDiff = curDiff;
  pendCustom = true;   // パネルはいつもカスタム
  pendPicked = new Set(forcedAbilities || [...new Set(tileAbility)]);
  seedInEl.value = '';
  refreshCustom();
}

fillSeg(diffSegEl, [0, 1, 2], (v) => DIFFS[v]);
fillSeg(sideAEl, SIZES, (v) => String(v));
fillSeg(sideBEl, SIZES, (v) => String(v));
fillPicker();

diffSegEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.classList.contains('locked')) { openLockSheet(); return; }
  pendDiff = Number(b.dataset.v);
  refreshDiffSeg();
});
for (const [el, set] of [[sideAEl, (v) => { pendA = v; }], [sideBEl, (v) => { pendB = v; }]]) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    set(Number(b.dataset.v));
    refreshCustom();
  });
}
pickerEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const k = Number(b.dataset.v);
  if (pendPicked.has(k)) pendPicked.delete(k); else pendPicked.add(k);
  refreshPicker();
  refreshDiffSeg();
  createBtnEl.disabled = !customReady();
});
// 設定パネルの鍵つき（無料の範囲の外）を押せなくして、印を付ける。カスタムの入口（ホームのボタン）には鍵の札を出す。
function syncLocks() {
  for (const b of diffSegEl.querySelectorAll('button')) {
    const lk = pendCustom ? !Entitlement.customOpen() : !Entitlement.stageOpen(pendW, Number(b.dataset.v));
    b.classList.toggle('locked', lk);
    b.setAttribute('aria-disabled', String(lk));
  }
  const tag = document.getElementById('customLock');
  if (tag) tag.hidden = Entitlement.customOpen();
}

// pend* の内容で盤面を作り直す。「この設定で作成」（カスタム含む）と
// ホームの「はじめる」の両方から呼ぶ。
let lastStartPool = 'all';   // 直前に始めた盤が使えるブロックの範囲の印（ごほうびで始めた盤は 'all'）
function startFromPending() {
  if (pendCustom && !customReady()) return;
  if (pendCustom ? !Entitlement.customOpen() : !Entitlement.stageOpen(pendW, pendDiff)) { openLockSheet(pendCustom ? 'custom' : 'setting'); return; }
  if (pendW !== W || pendH !== H) {
    W = pendW;
    H = pendH;
    SIZE = W * H;
    buildDom();
  }
  if (pendCustom) {
    forcedAbilities = [...pendPicked].sort((a, b) => a - b);
    types = forcedAbilities.length;
    scrambleN = movesFor(pendW, pendH, pendDiff);
  } else {
    forcedAbilities = null;
    const def = stageDef(pendW, pendDiff);
    types = def.k;
    scrambleN = def.n;
  }
  curDiff = pendDiff;
  const v = parseInt(seedInEl.value, 10);
  lastStartPool = Entitlement.poolTag();
  newPuzzle(Number.isFinite(v) ? v : undefined);
  Entitlement.useTicket();   // ごほうびの権利は、盤を始めたら使い切り
}

createBtnEl.addEventListener('click', () => {
  if (pendCustom && !customReady()) return;
  startFromPending();
  setPanel('setup', false);
  show(playEl);
});

// ---- ホーム（ステージ一覧） ----
// サイズごとのクリア数（旧仕様からの記録。画面には出さないが、捨てずに残す）。
const CLEARS_KEY = 'glyphshift.clears';
function loadClears() {
  try {
    const v = JSON.parse(localStorage.getItem(CLEARS_KEY));
    return v && typeof v === 'object' ? v : {};
  } catch (e) { return {}; }
}
const clears = loadClears();

// ステージ（正方形のサイズ×難しさの組）ごとに、盤面を決める seed と
// クリアした回数を持つ。キーは "5d1" のように「サイズd難しさ（0〜2）」。
// 自分でクリアする（解説を使わない）たびに、その組の seed を新しく引き直す
// ので、次にその項目を選ぶとゴールの柄が変わる。
// 旧仕様（サイズ×種類数）のキー "5x3" は読まずに残すだけ（どこからも参照しない）。
const STAGES_KEY = 'glyphshift.stages';
function loadStages() {
  try {
    const v = JSON.parse(localStorage.getItem(STAGES_KEY));
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    // 1 件ずつ形をそろえる（壊れた値で seed が毎回変わったり、回数が文字になったりしないように）
    const out = {};
    for (const [k, st] of Object.entries(v)) {
      if (!st || typeof st !== 'object' || !Number.isFinite(st.seed)) continue;
      out[k] = { ...st, clears: Number.isFinite(st.clears) ? st.clears : 0, ...(st.perfect !== undefined ? { perfect: Number.isFinite(st.perfect) ? st.perfect : 0 } : {}) };
    }
    return out;
  } catch (e) { return {}; }
}
function saveStages() {
  try { localStorage.setItem(STAGES_KEY, JSON.stringify(stages)); }
  catch (e) { /* 保存できなくても遊べる */ }
}
const stages = loadStages();

// そのステージの記録を取り出す。まだ遊んでいなければ、ここで seed を 1 つ引いて覚える。
function stageFor(s, d) {
  const key = `${s}d${d}`;
  let st = stages[key];
  if (!st || typeof st !== 'object') { st = { seed: Math.floor(Math.random() * 1e9), clears: 0 }; stages[key] = st; saveStages(); }
  return st;
}

// そのステージの seed から、実際に遊ぶ盤のゴールを求める（一覧のプレビュー用）。
// newPuzzle と同じ generate を通すので、引き直し（小さい盤で、どう混ぜても崩れない
// ゴールを引いたとき）まで含めて実際の盤と一致する。
// 鍵つきのステージは、一覧の絵だけ全ブロックで描く（完全版で何が遊べるかを見せる）。
let previewAllBlocks = false;
function stageGoalPreview(s, d, seed, allBlocks = false) {
  // generate は対局の状態を書き換えるので、今の対局を退避して戻す
  const saved = { W, H, SIZE, types, scrambleN, scrambleMoves, forcedAbilities, patternSeed, tileAbility, board, solution, curDiff };
  const def = stageDef(s, d);
  W = H = s; SIZE = s * s; types = def.k; scrambleN = def.n; forcedAbilities = null; curDiff = d;
  previewAllBlocks = allBlocks;
  try { generate(seed); } finally { previewAllBlocks = false; }
  const goal = tileAbility;
  ({ W, H, SIZE, types, scrambleN, scrambleMoves, forcedAbilities, patternSeed, tileAbility, board, solution, curDiff } = saved);
  return goal;
}

// 求めたゴールは st.goal に覚えておき、次からは混ぜ直さずに使う（seed が変わると消える）。
function goalForStage(s, d, st) {
  // goal は、使えるブロックの範囲（無料／全部）の印 pool と一緒に覚える。印が違えば作り直す
  // （無料の範囲で作ったゴールと全ブロックで作ったゴールが混ざらないように。印の無い古い記録は全部）。
  // 鍵つきのステージは全ブロックの印で作る（買ったあと、見ていた絵のまま遊べる）。
  const tag = Entitlement.stageOpen(s, d) ? Entitlement.poolTag() : 'all';
  if (!(Array.isArray(st.goal) && st.goal.length === s * s && (st.pool || 'all') === tag)) {
    st.goal = stageGoalPreview(s, d, st.seed, tag === 'all'); st.pool = tag; saveStages();
  }
  return st.goal;
}

// いま盤に残っている対局が、そのステージの途中か（ホームに戻っても盤は作り直さずに残してある）。
// 一度でも押していて、まだ揃っていないものだけ。seed が違えば別の盤（再生成・クリア後）。
const inProgress = (s, d) =>
  W === s && H === s && curDiff === d && !forcedAbilities && !dailyKey && !tutorial
  && seed === stageFor(s, d).seed && run.i >= 0 && !isSolved();

// 一覧のカードの記録（2026-10-30 オーナー。文字を減らす）。クリアしたかはカードの縁の色で見せる。
// 2 回目からはカードの隅に回数の数字を出す。
// 文字の言い方はカードの読み上げ（aria-label）に残す。
const clearsMark = (n) => n >= 2 ? String(n) : '';
const clearsLabel = (st) =>
  st.clears
    ? L(`クリア ${st.clears} 回`, `cleared ${timesEn(st.clears)}`)
    : L('未クリア', 'not cleared');

// ---- ステージのミニ盤（カードの絵柄）----
// ゲーム画面と同じ .slot/.tile（立体タイル・アイコン）で描く。カードごとに
// --nx/--ny/--cell/--gap を設定するだけで、見た目は style.css の .stage-mini /
// .mini .tile 共有ルールに任せる（描き方そのものは新しく作らない）。
// セルの大きさはサイズが大きいほど小さくするが、360 幅でも読めるよう 14px は下回らない。
const stageCellPx = (s) => Math.max(14, Math.min(34, Math.round(150 / s)));
const stageGapPx = (cell) => Math.max(1, Math.round(cell / 10));

function buildStageMini(container, s, goal) {
  const cell = stageCellPx(s);
  container.style.setProperty('--nx', s);
  container.style.setProperty('--ny', s);
  container.style.setProperty('--cell', `${cell}px`);
  container.style.setProperty('--gap', `${stageGapPx(cell)}px`);
  container.replaceChildren();
  for (const ab of goal) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const t = document.createElement('div');
    t.className = 'tile';
    t.style.background = bgOf(ab);
    t.style.color = INK;
    t.innerHTML = iconSvg(ab);
    slot.append(t);
    container.append(slot);
  }
}

// 画面に入ったカードだけ描く（約 90 面ぶんを一度に描くと重いため）。
// IntersectionObserver が無い環境（テストなど）では、その場ですぐ描く。
const stageMiniPending = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
let stageObserver = null;

function makeStageObserver() {
  if (typeof IntersectionObserver === 'undefined' || !stageMiniPending) return null;
  return new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      stageObserver.unobserve(en.target);
      const req = stageMiniPending.get(en.target);
      if (!req) continue;
      stageMiniPending.delete(en.target);
      buildStageMini(en.target, req.s, goalForStage(req.s, req.d, stageFor(req.s, req.d)));
    }
  }, { rootMargin: '640px 240px' }); // 縦スクロールでも横スクロールでも、少し手前から描き始める
}

const stageListEl = document.getElementById('stageList');

// ---- 完全版の案内（鍵つきを押したとき）----
const lockSheetEl = document.getElementById('lockSheet');
// what: どこから開いたか。{ s, d }（ステージ）か 'custom' / 'setting'（設定パネル）。ごほうび広告のあとの始め方が変わる
let lockWhat = 'setting';
const lockRewardEl = document.getElementById('lockReward');
const lockRewardNoteEl = document.getElementById('lockRewardNote');
const lockPrivacyEl = document.getElementById('lockPrivacy');
function openLockSheet(what = 'setting') {
  lockWhat = what;
  // ごほうび広告の口は、iOS 版で広告が使えるときだけ（Web 版・完全版・広告が使えない間は出さない）
  // 設定の「完全版について」から開いたとき（'info'）は、遊ぶ盤が無いので出さない
  const can = what !== 'info' && Rewards.available() && Entitlement.locksActive() && !Entitlement.isFull();
  lockRewardEl.hidden = lockRewardNoteEl.hidden = !can;
  lockPrivacyEl.hidden = !Entitlement.adsActive();
  document.getElementById('lockRewardWhat').textContent = typeof what === 'object' ? L('このステージ', 'this stage') : L('この設定の盤', 'a board with these settings');
  syncLockOwned();
  lockSheetEl.showModal?.();
}
function closeLockSheet() { lockSheetEl.close?.(); }
// 購入済みなら、案内シートの購入ボタンは隠して「購入済み」を出す（復元は残す）
function syncLockOwned() {
  const full = Entitlement.isFull();
  document.getElementById('lockOwned').hidden = !full;
  document.getElementById('lockBuy').hidden = full;
}
// 設定タブの「完全版」の欄。鍵が効くとき（iOS 版）だけ出す
const fullFieldEl = document.getElementById('fullField');
function syncFullField() {
  fullFieldEl.hidden = !Entitlement.locksActive();
  document.getElementById('fullState').textContent = Entitlement.isFull()
    ? L('購入済み。ありがとうございます', 'Purchased. Thank you!')
    : L('¥500・1 回の買い切り', '¥500 · one-time purchase');
}
document.getElementById('fullAbout').addEventListener('click', () => { openLockSheet('info'); });
document.getElementById('lockClose').addEventListener('click', closeLockSheet);
document.getElementById('lockOk').addEventListener('click', closeLockSheet);
lockSheetEl.addEventListener('click', (e) => { if (e.target === lockSheetEl) closeLockSheet(); });
// 完全版になったら、一覧の鍵をその場で外す（案内も閉じる）
// クリアの画面の下のプライバシーポリシー。広告が出る人だけ（表示そのものは #log.done のあいだだけ、CSS で決める）
const adPrivacyEl = document.getElementById('adPrivacy');
const syncAdPrivacy = () => { adPrivacyEl.hidden = !Entitlement.adsActive(); };
syncAdPrivacy();
syncFullField();
Entitlement.onChange(() => { closeLockSheet(); renderStageList(); syncLocks(); syncAdPrivacy(); syncFullField(); });
syncLocks();   // ホームの「カスタムで作る」の鍵の札を、起動時の状態に合わせる

// ごほうび広告: 見終わったら、そのステージを 1 回だけ遊べる（その場で始める。権利は貯めない）
let rewardBusy = false;
lockRewardEl.addEventListener('click', async () => {
  if (rewardBusy) return;
  rewardBusy = true;
  lockRewardEl.disabled = true;
  const what = lockWhat;
  try {
    const r = await Rewards.watch();
    if (r === 'earned' && !Entitlement.isFull()) {
      Entitlement.grantTicket();   // 鍵が開く。onChange でシートも閉じる
      if (typeof what === 'object') playStage(what.s, what.d);
    } else {
      const st = document.getElementById('lockStatus');
      if (st) st.textContent = r === 'failed'
        ? L('広告を読み込めませんでした。時間をおいてもう一度お試しください。', 'Couldn\'t load the ad. Please try again later.')
        : L('広告を最後まで見ると遊べます。', 'Watch the ad to the end to play.');
    }
  } finally { rewardBusy = false; lockRewardEl.disabled = false; }
});

// ---- 今日の 1 問（ホームのカードと始め方）----
const todayKey = () => dateKeyOf(new Date());
const dailyInProgress = () =>
  !!dailyKey && dailyKey === todayKey() && W === DAILY_SIZE && H === DAILY_SIZE && run.i >= 0 && !isSolved()
  && !dailyReview && (!daily[dailyKey] || daily[dailyKey].state === 'playing');

function startDaily(opts = {}) {
  const key = todayKey();
  if (dailyInProgress()) { show(playEl); return; }   // 途中の盤をそのまま続ける
  // まだ始めていない日は、時間を数えはじめる前に確かめる（途中の記録がある日はそのまま続ける）
  if (!daily[key] && !opts.confirmed) {
    askConfirm(L('今日の 1 問を始める', 'Start today\'s puzzle'),
      L('「始める」を押すと<strong>時間が動き出します</strong>。挑戦は 1 日 1 回です。<br>ヒントを使うとランキングに載らず、途中でホームに戻ると記録は残りません。',
        'The <strong>timer starts</strong> when you tap Start. One try per day.<br>Using a hint keeps you off the ranking, and going home midway leaves no record.'),
      L('始める', 'Start'), () => { closeConfirm(); startDaily({ confirmed: true }); });
    return;
  }
  pendA = pendB = pendW = pendH = DAILY_SIZE;
  pendDiff = DAILY_DIFF;
  pendCustom = false;
  if (W !== DAILY_SIZE || H !== DAILY_SIZE) { W = H = DAILY_SIZE; SIZE = W * H; buildDom(); }
  forcedAbilities = null;
  types = DAILY_TYPES;
  scrambleN = DAILY_MOVES;
  curDiff = DAILY_DIFF;
  newPuzzle(dailySeed(key), key);
  // 1 日 1 回。解いた日・解説を見た日は、揃った盤と結果を見るだけ
  if (dailyIsClosed(daily[key]) && !dailyFree()) showDailyResult(daily[key]);   // やめた日はそのまま遊べる（記録なし）
  show(playEl);
}

// 解いた日・解説を見た日の画面。揃った盤を見せて、押せない（locked）。クリアのときだけ共有ボタンが出る。
function showDailyResult(rec) {
  dailyReview = true;
  dailyClockStop();
  board = Array.from({ length: SIZE }, (_, i) => i);
  placeTiles();
  markUsable();
  locked = true;
  moves = rec.moves || 0;
  gridEl.classList.add('cleared');
  logEl.classList.add('done');
  setClearBar(true);
  logEl.textContent = dailyIsCleared(rec) ? dailyResultLine(rec.ms, rec.hint)
    : rec.state === 'abandoned' ? DAILY_ABANDONED_LINE : DAILY_REVEALED_LINE;
  shareBtnEl.hidden = !dailyIsCleared(rec);
  clearPending = null;
}

// 今日の盤のゴール（カードの絵）。newPuzzle と同じ generate を通すので実際の盤と一致する。
// 日付ごとに 1 回だけ求めて覚える。
let dailyGoalCache = null;
function dailyGoal(key) {
  if (!dailyGoalCache || dailyGoalCache.key !== key) {
    dailyGoalCache = { key, goal: stageGoalPreview(DAILY_SIZE, DAILY_DIFF, dailySeed(key), true) };
  }
  return dailyGoalCache.goal;
}

function renderDailyCard() {
  const key = todayKey();
  const [, m, d] = key.split('-').map(Number);
  const rec = daily[key];
  const resume = dailyInProgress();

  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'stage-item daily-item';
  if (resume) item.classList.add('resume');

  const mini = document.createElement('div');
  mini.className = 'stage-mini';
  buildStageMini(mini, DAILY_SIZE, dailyGoal(key));

  const body = document.createElement('span');
  body.className = 'daily-body';
  const title = document.createElement('span');
  title.className = 'daily-title';
  // 見出しは名前のロゴと同じ 1 字 1 タイルの「TODAY」（日英共通。2026-10-30 オーナー「今日の 1 問は格好よくない」）
  title.classList.add('wm');
  title.setAttribute('aria-hidden', 'true');
  for (const [ch, cls, c] of [['T'], ['O'], ['D', 'wm-on wm-t1', '#65c77a'], ['A'], ['Y']]) {
    const t = document.createElement('span');
    t.className = 'wm-ch' + (cls ? ' ' + cls : '');
    if (c) t.style.setProperty('--c', c);
    const i = document.createElement('i');
    i.textContent = ch;
    t.append(i);
    title.append(t);
  }
  const state = document.createElement('span');
  state.className = 'stage-stars';
  // 途中・未挑戦は文字を出さず、途中はカードの縁（resume）で見せる（2026-10-30 オーナー）。読み上げには残す。
  // 「続きから」の札も出さない（ステージのカードも同じ）
  const playing = !dailyIsClosed(rec) && (resume || (rec && rec.ms > 0));
  const stateLabel = dailyIsCleared(rec)
    ? L(`クリア${Number.isFinite(rec.ms) ? ' ' + fmtTime(rec.ms) : ''}`, `cleared${Number.isFinite(rec.ms) ? ' ' + fmtTime(rec.ms) : ''}`)
    : rec && rec.state === 'revealed' ? L('解説を見た', 'solution viewed')
    : rec && rec.state === 'abandoned' ? L('記録なし', 'no record')
    : playing ? L('途中', 'in progress') : L('未挑戦', 'not played');
  state.textContent = (playing || !rec || rec.state === 'abandoned' || rec.state === 'revealed') ? '' : stateLabel;   // やめた日・解説を見た日も文字なし（読み上げには残す）
  if (playing) item.classList.add('resume');
  body.append(title, state);   // 日付と大きさは出さない（2026-10-30 オーナー。読み上げには残す）
  const streak = dailyStreak(daily, key);
  if (streak >= 2) {
    const sk = document.createElement('span');
    sk.className = 'daily-streak';
    sk.textContent = L(`${streak} 日連続`, `${streak}-day streak`);
    body.append(sk);
  }
  item.append(mini, body);
  item.setAttribute('aria-label', L(`今日の 1 問、${m}月${d}日、${stateLabel}${streak >= 2 ? `、${streak} 日連続` : ''}`,
    `Daily puzzle, ${monthDayEn(m, d)}, ${stateLabel}${streak >= 2 ? `, ${streak}-day streak` : ''}`));
  item.addEventListener('click', () => startDaily());
  return item;
}

shareBtnEl.addEventListener('click', () => {
  if (!dailyKey) return;
  const rec = daily[dailyKey];
  if (!dailyIsCleared(rec)) return;
  const text = dailyShareText({ key: dailyKey, ms: rec.ms, hint: rec.hint, goal: tileAbility, w: W });
  if (typeof WebAppKit !== 'undefined' && WebAppKit.share) WebAppKit.share({ text });
});

function renderStageList() {
  stageListEl.replaceChildren();
  if (stageObserver) stageObserver.disconnect();
  stageObserver = makeStageObserver();
  const dsec = document.createElement('div');
  dsec.className = 'stage-size daily-sec';
  dsec.append(renderDailyCard());
  stageListEl.append(dsec);

  for (const s of STAGE_SIZES) {
    const sec = document.createElement('div');
    sec.className = 'stage-size';
    const head = document.createElement('h2');
    head.className = 'stage-size-head';
    head.append(`${s}×${s}`);   // サイズの見出しは画面には出さない（ミニ盤で分かる。2026-10-30 オーナー）。読み上げ用に残す
    head.classList.add('sr-only');

    const row = document.createElement('div');
    row.className = 'stage-row';
    for (let d = 0; d < DIFFS.length; d++) {
      const def = stageDef(s, d);
      const st = stageFor(s, d);

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'stage-item';
      item.dataset.s = String(s);
      item.dataset.d = String(d);
      const locked = !Entitlement.stageOpen(s, d);
      const resume = !locked && inProgress(s, d);
      if (resume) item.classList.add('resume');
      if (locked) item.classList.add('locked');
      const name = L(`${s}×${s}、${DIFFS[d]}（${def.n} 手・${def.k} 種）`, `${s}×${s}, ${DIFFS[d]} (${def.n} moves, ${def.k} kinds)`);
      item.setAttribute('aria-label', locked
        ? name + L('、完全版で遊べます', ', in the full version')
        : name + L('、', ', ') + clearsLabel(st) + (resume ? L('、続きから', ', continue') : ''));

      const mini = document.createElement('div');
      mini.className = 'stage-mini';
      // 幅・高さが決まらず行の高さが詰まらないよう、描く前からセルの大きさだけは決めておく
      const cell = stageCellPx(s);
      mini.style.setProperty('--nx', s);
      mini.style.setProperty('--ny', s);
      mini.style.setProperty('--cell', `${cell}px`);
      mini.style.setProperty('--gap', `${stageGapPx(cell)}px`);
      if (stageObserver) { stageMiniPending.set(mini, { s, d }); stageObserver.observe(mini); }
      else buildStageMini(mini, s, goalForStage(s, d, st));

      const meta = document.createElement('span');
      meta.className = 'stage-meta';
      meta.textContent = diffMark(def.n);
      meta.classList.add('stage-diff');
      if (st.clears > 0) item.classList.add('cleared');

      item.append(mini, meta);
      const count = clearsMark(st.clears);
      if (count && !locked) {
        const badge = document.createElement('span');
        badge.className = 'stage-count';
        badge.textContent = count;
        item.append(badge);
      }
      if (locked) {
        const lock = document.createElement('span');
        lock.className = 'stage-lock';
        lock.textContent = L('完全版', 'Full');
        item.append(lock);
      }
      row.append(item);
    }
    sec.append(head, row);
    stageListEl.append(sec);
  }
}

stageListEl.addEventListener('click', (e) => {
  const item = e.target.closest('.stage-item');
  if (!item || item.classList.contains('daily-item')) return;   // 今日の 1 問は自分のハンドラで始める
  const s = Number(item.dataset.s);
  const d = Number(item.dataset.d);
  if (!stageDef(s, d)) return;
  if (!Entitlement.stageOpen(s, d)) { openLockSheet({ s, d }); return; }
  playStage(s, d);
});

function playStage(s, d) {
  const st = stageFor(s, d);
  if (inProgress(s, d)) { show(playEl); return; }   // 途中の盤をそのまま続ける
  pendA = pendB = pendW = pendH = s;
  pendDiff = d;
  pendCustom = false;
  seedInEl.value = String(st.seed);
  startFromPending();
  st.goal = Array.from(tileAbility);   // 実際に生成されたゴールを覚えておく（次の一覧でずれないように）
  st.pool = lastStartPool;
  saveStages();
  show(playEl);
}

const titleEl = document.getElementById('title');
const playEl = document.getElementById('play');

const startEl = document.getElementById('start');

function show(screen) {
  startEl.hidden = screen !== startEl;
  titleEl.hidden = screen !== titleEl;
  playEl.hidden = screen !== playEl;
  menuBtnEl.hidden = screen !== playEl;
  document.body.classList.toggle('no-rail', screen !== playEl);   // 上の帯は遊ぶ画面だけ（2026-10-30 オーナー）
  document.getElementById('panel').classList.toggle('at-home', screen !== playEl);   // 盤が無い間は「今のパズル」前提の表示を隠す
  homeBtnEl.hidden = screen !== playEl;
  dailyClockSync();   // 盤の画面が出ているあいだだけ時間を数える
  if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
}

function goHome() {
  // 今日の 1 問を遊んでいる途中なら、やめると記録が残らないことを確かめてから
  if (dailyLive()) {
    askConfirm(L('今日の 1 問をやめる', 'Quit today\'s puzzle'),
      L('今やめると、<strong>今日の記録は残りません</strong>。<br>今日はもう挑戦できません。',
        'If you quit now, <strong>today\'s result won\'t be recorded</strong>.<br>You can\'t try again today.'),
      L('やめる', 'Quit'), () => { closeConfirm(); markDailyAbandoned(); goHome(); }, L('続ける', 'Keep playing'));
    return;
  }
  const fromClear = document.getElementById('play').classList.contains('is-clear');
  endTutorial();
  stopAutoSolve();
  closeConfirm();
  clearHint();
  Entitlement.dropTicket();   // ごほうびの 1 回は、ホームに戻ると鍵つきに戻る（貯めない）
  setPanel('setup', false);
  setPanel('panel', false);
  renderStageList();
  show(titleEl);
  if (fromClear) leaveClear();   // ホームを出してから広告を頼む
}

const menuBtnEl = document.getElementById('menuBtn');
const homeBtnEl = document.getElementById('homeBtn');
homeBtnEl.addEventListener('click', goHome);
document.getElementById('logoBtn').addEventListener('click', goHome);

document.getElementById('startBtn').addEventListener('click', () => { if (shouldShowTutorial()) startTutorial(); else show(titleEl); });

// ---- 遊び方（スタートとホーム） ----
// 説明の本体はこのシートだけ。パネルの「遊び方」タブからはここを開く。
// <dialog> の showModal で、Esc・フォーカスの閉じ込め・背景の操作止めを任せる。
const howtoEl = document.getElementById('howto');
function openHowto() { howtoEl.showModal?.(); }
function closeHowto() { howtoEl.close?.(); }
document.getElementById('startHowtoBtn').addEventListener('click', openHowto);
document.getElementById('homeHowtoBtn').addEventListener('click', openHowto);
document.getElementById('panelHowto').addEventListener('click', openHowto);   // パネルは開いたまま重ねる。閉じればパネルに戻る
document.getElementById('howtoClose').addEventListener('click', closeHowto);

// 使うブロックの動きは、目標の柄の横の ⓘ から開くシートで見る（画面にはいつも出さない）
const legendSheetEl = document.getElementById('legendSheet');
for (const id of ['legendBtn', 'legendBtnSide']) document.getElementById(id).addEventListener('click', () => legendSheetEl.showModal?.());
document.getElementById('legendClose').addEventListener('click', () => legendSheetEl.close?.());
legendSheetEl.addEventListener('click', (e) => { if (e.target === legendSheetEl) legendSheetEl.close?.(); });
document.getElementById('howtoOk').addEventListener('click', closeHowto);
howtoEl.addEventListener('click', (e) => { if (e.target === howtoEl) closeHowto(); });   // 枠の外を押したら閉じる

// ---- 最初のチュートリアル ----
// 初めて起動したとき（スタートの「はじめる」）だけ、決まった盤 5 面で遊び方を覚えてもらう。
// 盤は手で決めた固定のもので、generate を通さない。揃えても★・クリアの回数・今日の 1 問・広告の回数には数えない。
// 終えた・飛ばしたら localStorage の glyphshift.tutorial に覚え、次からは出さない（メニューの「遊び方」から呼べる）。
// 文字は能力: N 何も起きない / L 左右の入れ替え / U 上下の入れ替え / C 上下左右の回転 / a 左上と右下 / b 右上と左下 / d 斜め 4 マスの回転。
// すべて無料版のブロック（entitlement.js の FREE_BLOCKS）。a b d は色だけの目印で、盤のへりでは使えない。
// mark: auto 次に押すマスを光らせる / goal 目標の柄を光らせる / hint ヒントのボタンを光らせる / 無し 印なし
const TUTORIAL_KEY = 'glyphshift.tutorial';
const TUT_CHAR = { N: 'none', L: 'swapLR', U: 'swapUD', C: 'crossCW', a: 'swapD1', b: 'swapD2', d: 'diagCW' };
const TUTORIAL_STAGES = [
  // 1 押す: 1 手
  { w: 3, h: 3, text: L('光っているタイルを押そう', 'Press the glowing tile'), mark: 'auto', moves: 1,
    goal: 'NNNaLdNNN', start: 'NNNdLaNNN' },
  // 2 能力はタイルと一緒に動く: 2 手（上下の入れ替えで左右の入れ替えのタイルが下へ動き、動いた先で使う）
  { w: 3, h: 3, text: L('能力は、タイルと一緒に動く', 'Abilities move with their tiles'), mark: 'auto', moves: 2,
    goal: 'NNNNUNaLb', start: 'NLNNUNbNa' },
  // 3 長押しで逆回し: 押すと 3 回、長押しなら 1 回
  { w: 3, h: 3, text: L('長押しで、逆向きに回る', 'Long-press to turn the other way'), mark: 'auto', moves: 1,
    goal: 'NaNdCbNNN', start: 'NdNNCaNbN' },
  // 4 組み合わせる: 2 種のブロック、3 手
  { w: 3, h: 3, text: L('目標の柄に揃えよう', 'Match the goal pattern'), mark: 'goal', moves: 3,
    goal: 'aLbNCNNNN', start: 'bNaNCNNLN' },
  // 5 困ったらヒント: 4×4、2 種のブロック、4 手
  { w: 4, h: 4, text: L('迷ったら、ヒント', 'Stuck? Try a hint'), mark: 'hint', moves: 4,
    goal: 'aNNbNCLNNNNNdNNa', start: 'NNabNCNNNLNNdNNa' },
];

// 能力の文字の並び 2 つから、loadFixedPuzzle に渡す盤を作る。
// 同じ能力のタイルは目標のマス番号の若い順に値を割り振る（目標は「タイル v がマス v」）。
function tutorialBoard(def) {
  const ab = (ch) => abId(TUT_CHAR[ch]);
  const ta = Array.from(def.goal, ab);
  const pool = {};
  ta.forEach((a, v) => { (pool[a] ||= []).push(v); });
  const bd = Array.from(def.start, (ch) => pool[ab(ch)].shift());
  return { w: def.w, h: def.h, tileAbility: ta, board: bd };
}

// 固定の盤を読み込む。generate は通さない。最短の手順は solver で求めて、印とヒントの手順に使う。
function loadFixedPuzzle({ w, h, tileAbility: ta, board: bd }) {
  if (w !== W || h !== H) { W = w; H = h; SIZE = w * h; buildDom(); }
  forcedAbilities = null;
  types = new Set(ta).size;
  tileAbility = Array.from(ta);
  board = Array.from(bd);
  seed = 0;
  dailyClockStop();
  dailyKey = null;
  problem = buildProblem();
  const start = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]);
  const goal = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]);
  const res = Solver.solvePuzzle(problem, start, goal, 1500);
  solution = res && res.plan ? Solver.planToRuns(problem, res.plan, start) : [];
  beginBoard();
}

let tutorial = null;   // 練習中は { idx, timer }。そうでなければ null
const tutBarEl = document.getElementById('tutBar');
const tutStepEl = document.getElementById('tutStep');
const tutTextEl = document.getElementById('tutText');
const tutGoalWrapEl = document.getElementById('tutGoalWrap');
const tutGoalEl = document.getElementById('tutGoal');
const goalCardEl = document.getElementById('goalCard');
const hintBtnEl = document.getElementById('hintBtn');
const tutHiddenEls = [document.getElementById('solveBtn'), document.getElementById('panelNew')];

// 遊んだ記録があるか（クリアした・今日の 1 問を解いた）。一覧を描くだけでも stages は書かれるので、中身を見る。
function hasPlayRecords() {
  const some = (o, f) => !!o && typeof o === 'object' && Object.values(o).some(f);
  return some(stages, (st) => st && (st.clears > 0 || st.perfect > 0)) || some(clears, (n) => n > 0) || some(daily, () => true);
}
function tutorialDone() {
  try { return localStorage.getItem(TUTORIAL_KEY) !== null; } catch (e) { return false; }
}
// 最初の「はじめる」で出すか。済んでいる人、遊んだ記録がある人には自動では出さない。
const shouldShowTutorial = () => !tutorialDone() && !hasPlayRecords();

function loadTutorialStage() {
  const def = TUTORIAL_STAGES[tutorial.idx];
  loadFixedPuzzle(tutorialBoard(def));
  tutStepEl.textContent = `${tutorial.idx + 1} / ${TUTORIAL_STAGES.length}`;
  tutTextEl.textContent = def.text;
  buildStageMini(tutGoalEl, W, tileAbility);
  goalCardEl.classList.toggle('tut-glow', def.mark === 'goal');
  tutGoalWrapEl.classList.toggle('tut-glow', def.mark === 'goal');
  hintBtnEl.classList.toggle('tut-glow', def.mark === 'hint');
  tutMark();
}

// 次に押すマスに印（ヒントの点滅と同じ見た目で、消えずに残す）。
function tutMark() {
  clearHint();
  const def = TUTORIAL_STAGES[tutorial.idx];
  if (def.mark !== 'auto' || locked || isSolved()) return;
  const r = activeRuns()[0];
  if (!r) return;
  slots[r.i].classList.add('hinted');
  const back = r.order - r.n;
  logEl.textContent = r.n <= back
    ? L(r.n === 1 ? '光っているタイルを押す' : `光っているタイルを ${r.n} 回押す`, `Press the glowing tile${r.n === 1 ? '' : ' ' + timesEn(r.n)}`)
    : L(back === 1 ? '光っているタイルを長押し' : `光っているタイルを ${back} 回長押し`, `Long-press the glowing tile${back === 1 ? '' : ' ' + timesEn(back)}`);
}

function startTutorial() {
  closeHowto();
  setPanel('setup', false);
  setPanel('panel', false);
  if (tutorial) clearTimeout(tutorial.timer);
  tutorial = { idx: 0, timer: null };
  tutBarEl.hidden = false;
  for (const b of tutHiddenEls) b.hidden = true;
  loadTutorialStage();
  show(playEl);
}

// 揃った。短く知らせて、少しあとに次の面へ（最後はホームへ）。数えるものは何も無い。
function tutorialCleared() {
  commitRun();
  Sfx.solved();
  locked = true;
  clearHint();
  gridEl.classList.remove('cleared');
  void gridEl.offsetWidth;
  gridEl.classList.add('cleared');
  logEl.classList.add('done');
  logEl.textContent = L('できた！', 'Nice!');
  tutorial.timer = setTimeout(tutorialNext, 1100);
}

function tutorialNext() {
  if (!tutorial) return;
  if (tutorial.idx + 1 >= TUTORIAL_STAGES.length) { goHome(); return; }
  tutorial.idx++;
  tutorial.timer = null;
  loadTutorialStage();
}

// 練習を終える（最後まで・スキップ・ホームへ戻る、どれでも）。済んだ印を残し、盤を通常の初期状態に戻す。
function endTutorial() {
  if (!tutorial) return;
  clearTimeout(tutorial.timer);
  tutorial = null;
  try { localStorage.setItem(TUTORIAL_KEY, 'done'); } catch (e) { /* 覚えられなくても遊べる */ }
  tutBarEl.hidden = true;
  goalCardEl.classList.remove('tut-glow');
  tutGoalWrapEl.classList.remove('tut-glow');
  hintBtnEl.classList.remove('tut-glow');
  for (const b of tutHiddenEls) b.hidden = false;
  W = H = 4; SIZE = 16; buildDom();
  types = STAGE_TABLE[4][0].k; scrambleN = STAGE_TABLE[4][0].n; curDiff = 0;
  newPuzzle();
}

// 「もう一度」。途中の盤があれば、先に確認する。
function replayTutorial() {
  if (!tutorial && !playEl.hidden && run.i >= 0 && !isSolved()) {
    setPanel('panel', false);
    askConfirm(L('チュートリアルをもう一度', 'Replay the tutorial'), L('今の盤は消えます。', 'The current board will be lost.'), L('はじめる', 'Start'), () => { closeConfirm(); startTutorial(); });
    return;
  }
  startTutorial();
}
document.getElementById('tutSkip').addEventListener('click', goHome);
document.getElementById('howtoTutorial').addEventListener('click', replayTutorial);
document.getElementById('panelTutorial').addEventListener('click', replayTutorial);

// はじめから 1 問ぶん作っておく。ホーム画面の裏で用意しておけば、
// 「はじめる」を押した瞬間にも真っさらな盤面（buildDom 直後の空の板）を
// 見せずに済む。ホームの一覧も初期値（4×4・2 種）と同じ盤で始まる。
buildDom();
renderStageList();
newPuzzle();

// 2 回目からはスタートを飛ばしてホームから始める（初めての人だけスタート → 「はじめる」）。
// 同じ同期の流れの中で切り替えるので、スタートが一瞬映ることはない。
// iOS 版の記録の控え（native.js）は戻したら 1 回読み直すので、その後のこの判定で正しく分かれる。
if (!shouldShowTutorial()) show(titleEl);
