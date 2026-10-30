// ステージ（大きさ × 難しさ）の計測。Node で実行する。
//   node tools/stagebench.js <一辺> <難しさ 0〜2> <盤面数> [予算ms] [最初のSEED] [手数] [種類数]
// 例: node tools/stagebench.js 5 1 8 3000     (5×5 ふつう)
// 手数・種類数を渡すと、表を上書きして測る（表の調整用）。
//
// 1 盤ごとに JSON を 1 行出す:
//   scramble   混ぜた手順の逆の手数（= 盤が出た時点の答え）
//   found      アプリと同じ予算で探索したときに見つかった手数（混ぜた手順の逆を保険に渡す）
//   walk       ヒントの手順をそのまま押していって揃うか（盤の最初から）
//   walk3      ランダムに 3 手動かしたあとでも、ヒントの手順で揃うか
// 最後に要約を出す。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const { solverModule } = require(path.join(root, 'solver.js'));

const stub = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (k === 'length') return 0;
    if (k === Symbol.iterator) return function* () {};
    if (k === 'hidden') return true;
    if (k === 'textContent' || k === 'value' || k === 'innerHTML') return '';
    return stub();
  },
  set: () => true, apply: () => stub(), construct: () => stub(),
});

const ctx = {
  console, performance, Math, Number, String, Array, Uint8Array, Int8Array, Map, Set, Symbol, Object,
  setTimeout: () => 0, clearTimeout() {},
  document: stub(), matchMedia: () => ({ matches: true }),
  solverModule, solverWorkerMain() {},
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['sound.js', 'glyphs.js', 'entitlement.js', 'rewards.js', 'script.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

vm.runInContext(`
  globalThis.__new = (s, d, seed, n, k) => {
    const def = stageDef(s, d);
    W = H = s; SIZE = s * s; types = k || def.k; scrambleN = n || def.n; curDiff = d; forcedAbilities = null;
    buildDom();
    newPuzzle(seed);
    return {
      P: problem,
      start: Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]),
      goal: Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]),
      fallback: Solver.runsToPlan(solution),
      scramble: planCost(solution),
      types: new Set(tileAbility).size,
      blank: [...new Set(tileAbility)].some((a) => isBlank(a)),
    };
  };
  // ランダムに r 手動かしてから、ヒントの手順（activeRuns の先頭）を押し続けて揃うか
  globalThis.__walk = (r, rseed) => {
    const rng = mulberry32(rseed);
    for (let q = 0; q < r; q++) {
      const cells = legalCells();
      applyMoveState(cells[Math.floor(rng() * cells.length)], rng() < 0.5 ? 1 : -1);
    }
    const known0 = isSolved() ? 0 : planCost(activeRuns());
    let steps = 0;
    while (!isSolved() && steps < 3000) {
      const rs = activeRuns();
      if (!rs.length) break;
      const x = rs[0];
      applyMoveState(x.i, x.n <= x.order - x.n ? 1 : -1);
      steps++;
    }
    return { solved: isSolved(), steps, known0 };
  };
`, ctx);

const a = process.argv.slice(2).map(Number);
const [s, d, trials, budgetArg, seedArg, nArg, kArg] = a;
const budget = budgetArg || 3000;
const seed0 = seedArg || 1000;
const api = solverModule();
const rows = [];
for (let t = 0; t < trials; t++) {
  const p = ctx.__new(s, d, seed0 + t, nArg, kArg);
  const r = api.solvePuzzle(p.P, p.start, p.goal, budget, p.fallback);
  const found = r.plan ? api.planCost(p.P, r.plan, p.start) : -1;
  // ヒントの手順は、探索の結果を使わなくても（混ぜた手順の逆だけでも）揃うこと
  const w0 = ctx.__walk(0, 1);
  ctx.__new(s, d, seed0 + t, nArg, kArg);
  const w3 = ctx.__walk(3, 7 + t);
  const row = { s, d, seed: seed0 + t, types: p.types, blank: p.blank, scramble: p.scramble, found, method: r.method, optimal: !!r.optimal, ms: Math.round(r.ms), walk: w0.solved, walk3: w3.solved, walk3known: w3.known0, walk3steps: w3.steps };
  rows.push(row);
  console.log(JSON.stringify(row));
}
const med = (xs) => { const y = [...xs].sort((p, q) => p - q); return y.length ? y[Math.floor(y.length / 2)] : null; };
console.log(`要約 ${s}x${s} d=${d} scramble 中央値=${med(rows.map((r) => r.scramble))} found 中央値=${med(rows.map((r) => r.found))} 最大=${Math.max(...rows.map((r) => r.found))} walk=${rows.filter((r) => r.walk).length}/${rows.length} walk3=${rows.filter((r) => r.walk3).length}/${rows.length}`);
