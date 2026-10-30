// 「選んでも盤面は変わらず、作成で初めて変わる」ことの検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// セグメントのボタンをスタブ上に用意する（実物は HTML 側にある）
const addBtns = (id, vals) => {
  const box = document.getElementById(id);
  box.replaceChildren();
  const made = {};
  for (const v of vals) {
    const b = document.createElement('button');
    b.dataset.v = String(v);
    box.append(b);
    made[v] = b;
  }
  return made;
};
const sizeBtns = addBtns('sizeSeg', [4, 5, 6]);
const diffBtns = addBtns('diffSeg', [0, 1, 2]);

const before = { W, H, SIZE, types, scrambleN, board: [...board], tiles: [...tileAbility] };
ok(W === 4 && types === 2, `初期状態が想定と違う: W=${W} types=${types}`);
ok(scrambleN === 4, `初期の手数が ${scrambleN}`);

// 1. 設定パネルを開いても盤面は変わらない
document.getElementById('homeCustomBtn').fire('click', {});
ok(same(board, before.board), 'パネルを開いただけで盤面が変わった');

// 2. サイズを選んでも盤面は変わらない
document.getElementById('sizeSeg').fire('click', { target: sizeBtns[6] });
ok(W === before.W, `サイズ選択だけで W が変わった: ${W}`);
ok(SIZE === before.SIZE, `サイズ選択だけで SIZE が変わった: ${SIZE}`);
ok(same(board, before.board), 'サイズ選択だけで盤面が変わった');
ok(same(tileAbility, before.tiles), 'サイズ選択だけでブロック構成が変わった');

// 3. 難しさを選んでも盤面は変わらない
document.getElementById('diffSeg').fire('click', { target: diffBtns[2] });
ok(types === before.types && scrambleN === before.scrambleN, `難しさ選択だけで types / scrambleN が変わった: ${types} / ${scrambleN}`);
ok(same(board, before.board), '難しさ選択だけで盤面が変わった');

// 4. 選択はボタンの押下状態に反映されている
ok(sizeBtns[6].getAttribute('aria-pressed') === 'true', 'サイズ 6 が選択表示になっていない');
ok(sizeBtns[4].getAttribute('aria-pressed') === 'false', 'サイズ 4 の選択表示が残っている');
ok(diffBtns[2].getAttribute('aria-pressed') === 'true', '難しさ「むずかしい」が選択表示になっていない');

// 5. 「作成」を押すと反映される
document.getElementById('seedIn').value = '4242';
document.getElementById('createBtn').fire('click', {});
ok(W === 6 && SIZE === 36, `作成後に反映されていない: W=${W} SIZE=${SIZE}`);
ok(types === stageDef(6, 2).k && scrambleN === stageDef(6, 2).n, `作成後に types / 手数が反映されていない: ${types} / ${scrambleN}`);
ok(new Set(tileAbility).size === stageDef(6, 2).k, `ブロック数が表と違う: ${new Set(tileAbility).size}`);
ok(planCost(solution) <= scrambleN && planCost(solution) >= scrambleN - 2, `答えの手数が ${planCost(solution)}（混ぜた手数 ${scrambleN}）`);
ok(board.length === 36, `盤面の大きさが ${board.length}`);
ok(!isSolved(), '作成直後に完成している');
ok(document.getElementById('seedOut').textContent === '4242', `SEED が反映されていない: ${document.getElementById('seedOut').textContent}`);

// 6. 作成するとパネルは閉じる
ok(!document.getElementById('setup')._cls.has('open'), '作成後もパネルが開いたまま');

// 7. 同じ SEED なら同じ盤面が出る
const madeBoard = [...board], madeTiles = [...tileAbility];
document.getElementById('homeCustomBtn').fire('click', {});
document.getElementById('seedIn').value = '4242';
document.getElementById('createBtn').fire('click', {});
ok(same(board, madeBoard) && same(tileAbility, madeTiles), '同じ SEED なのに違う盤面になった');

// 8. パネルを開き直すと、選択は今の盤面の設定に戻っている
document.getElementById('sizeSeg').fire('click', { target: sizeBtns[4] });
document.getElementById('homeCustomBtn').fire('click', {});  // 閉じる
document.getElementById('homeCustomBtn').fire('click', {});  // 開き直す
ok(sizeBtns[6].getAttribute('aria-pressed') === 'true', '開き直したとき現在のサイズが選択されていない');
ok(document.getElementById('seedIn').value === '', 'SEED 欄が空に戻っていない');

console.log(fail === 0 ? '設定パネルの検証: 全チェック通過' : `失敗 ${fail} 件`);
