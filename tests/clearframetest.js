// ホームのステージの金色の枠: ヒントなしで揃えたことがあるときだけ付く
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const walk = (el, out = []) => { for (const c of el.children || []) { if (typeof c === 'object') { out.push(c); walk(c, out); } } return out; };
const cardOf = (s, d) => {
  renderStageList();
  return walk(document.getElementById('stageList')).find((e) => e.dataset && e.dataset.s === String(s) && e.dataset.d === String(d));
};

const solveNow = () => { for (const r of solution.map((x) => ({ ...x }))) for (let k = 0; k < r.n; k++) fire(r.i, 1); };

// ヒントを使って揃えた → 回数は増えるが枠は付かない
playStage(4, 1);
hintUsed = true;
solveNow();
ok(isSolved() && stageFor(4, 1).clears === 1, 'ヒントありのクリアが数えられていない');
ok(!cardOf(4, 1)._cls.has('cleared'), 'ヒントを使ったクリアだけで金色の枠が付いた');

// ヒントなしで揃えた → 枠が付く
playStage(4, 1);
solveNow();
ok(Number.isFinite(stageFor(4, 1).best), 'ヒントなしで揃えたのにベストが無い');
ok(cardOf(4, 1)._cls.has('cleared'), 'ヒントなしで揃えたのに金色の枠が付かない');

console.log(fail === 0 ? '\nクリアの枠: 全チェック通過' : `\n失敗 ${fail} 件`);
