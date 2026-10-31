// カスタムで目標の柄を自分で置く: 置いた柄のとおりの盤ができる、動かせない柄は作れない、ほかの盤に持ち越さない
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);
const btn = (box, key, v) => box.children.find((b) => b.dataset[key] === String(v));
const id = (name) => ABILITIES.findIndex((a) => a.id === name);

W = H = 4; SIZE = 16; buildDom(); newPuzzle(3);
el('homeCustomBtn').fire('click', {});
ok(el('goalEditWrap').hidden, 'はじめから自分で置く形になっている');

// 自分で置く。今の盤のゴールから始まる
const start = [...tileAbility];
el('goalMode').fire('click', { target: btn(el('goalMode'), 'v', 1) });
ok(!el('goalEditWrap').hidden, '「自分で置く」で編集の盤が出ない');
ok(el('goalEdit').children.length === 16, `編集の盤のマスが ${el('goalEdit').children.length}（期待 16）`);
ok(pendGoal.cells.every((a, i) => a === start[i]), '今の盤のゴールから始まらない');

// ブロックを 3 つにして、塗る
pendPicked = new Set([id('swapLR'), id('crossCW'), id('none')]);
refreshCustom();
ok(el('goalBrush').children.length === 3, `置くブロックの列が ${el('goalBrush').children.length}（期待 3）`);
ok(pendGoal.cells.every((a) => pendPicked.has(a)), '選んでいないブロックのマスが残っている');
el('goalBrush').fire('click', { target: btn(el('goalBrush'), 'v', id('none')) });
for (const i of [0, 3, 12, 15]) el('goalEdit').fire('click', { target: el('goalEdit').children[i] });
el('goalBrush').fire('click', { target: btn(el('goalBrush'), 'v', id('crossCW')) });
for (const i of [5, 6, 9, 10]) el('goalEdit').fire('click', { target: el('goalEdit').children[i] });
const want = [...pendGoal.cells];
ok([0, 3, 12, 15].every((i) => want[i] === id('none')) && [5, 6, 9, 10].every((i) => want[i] === id('crossCW')), '塗ったマスが変わらない');
ok(!el('createBtn').disabled && el('goalNote').textContent === '', `作れるのに作れない: ${el('goalNote').textContent}`);

// 作る → 置いた柄のゴールで、混ぜた盤ができる
el('createBtn').fire('click', {});
ok(tileAbility.every((a, i) => a === want[i]), 'ゴールが置いた柄と違う');
ok(!isSolved(), '揃った盤で始まった');
ok(forcedGoal && forcedAbilities.length === new Set(want).size, '使うブロックが置いた柄と合わない');
for (const r of solution.map((x) => ({ ...x }))) for (let k = 0; k < r.n; k++) fire(r.i, 1);
ok(isSolved(), '答えの手順で揃わない');
// 次へ: 同じ柄で混ぜ直す
goNext();
ok(tileAbility.every((a, i) => a === want[i]) && !isSolved(), '次へで柄が変わった');
console.log('  置いた柄で盤ができる  OK');

// 動かせない柄は作れない
el('homeCustomBtn').fire('click', {});
ok(pendManual, '自分で置いた盤のあとに開くと、おまかせに戻っている');
el('goalBrush').fire('click', { target: btn(el('goalBrush'), 'v', id('none')) });
for (let i = 0; i < 16; i++) el('goalEdit').fire('click', { target: el('goalEdit').children[i] });
ok(el('createBtn').disabled && el('goalNote').textContent !== '', '1 種類だけの柄で作れる');
ok(!goalMovable(Array(9).fill(id('none')).map((a, i) => (i === 0 ? id('swapLR') : a)), 3, 3), '動かない柄を動かせると判定した');
ok(goalMovable([id('none'), id('swapLR'), id('none'), id('crossCW'), id('crossCW'), id('none'), id('none'), id('swapLR'), id('none')], 3, 3), '動かせる柄を動かせないと判定した');

// 大きさを変えると、重なるマスは残り、新しいマスは埋まる
pendPicked.add(id('swapLR')); refreshCustom();
el('goalBrush').fire('click', { target: btn(el('goalBrush'), 'v', id('swapLR')) });
el('goalEdit').fire('click', { target: el('goalEdit').children[0] });
pendA = 6; pendB = 4; refreshCustom();
ok(pendGoal.w === 6 && pendGoal.h === 4 && pendGoal.cells.length === 24, '大きさを変えても柄の大きさが変わらない');
ok(pendGoal.cells[0] === id('swapLR') && pendGoal.cells[1] === id('none'), '重なるマスが残らない');
ok(el('goalEdit').children.length === 24, '編集の盤のマスの数が変わらない');

// おまかせに戻すと、柄から選ぶ
el('goalMode').fire('click', { target: btn(el('goalMode'), 'v', 0) });
ok(el('goalEditWrap').hidden, 'おまかせで編集の盤が残る');
el('createBtn').fire('click', {});
ok(forcedGoal === null, 'おまかせなのに置いた柄を使っている');

// ステージ・今日の 1 問には持ち越さない
pendManual = true; pendA = pendB = 4; refreshCustom();
pendGoal.cells.fill(id('crossCW')); pendGoal.cells[0] = id('swapLR');
el('createBtn').fire('click', {});
playStage(4, 0);
ok(forcedGoal === null, 'ステージに置いた柄が残った');
console.log('  作れない柄・大きさの変更・持ち越し  OK');

console.log(fail === 0 ? '\n目標の柄を自分で置く: 全チェック通過' : `\n失敗 ${fail} 件`);
