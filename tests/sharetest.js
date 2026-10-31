// 盤の共有（盤コード）の検証: 送って読むと同じ盤になる、壊れたコードは入らない、受け取った盤の扱い、無料版の鍵
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);
const colorsNow = () => board.map((_, i) => abilityAt(i));

// 盤を作って、始めの盤をそのままコードにして読み直す
console.log('送って読むと同じ盤');
for (const [w, h, k] of [[3, 3, 2], [4, 4, 3], [5, 5, 6], [7, 4, 8], [8, 8, 13], [10, 10, 13]]) {
  W = w; H = h; SIZE = w * h; buildDom();
  forcedAbilities = null; types = k; scrambleN = 30;
  newPuzzle(1234 + w * 10 + h);
  const goal = [...tileAbility], start = colorsNow();
  const { code } = currentBoardCode();
  ok(/^A1-[A-Za-z0-9_-]+$/.test(code), `${w}×${h}: コードの形が違う ${code}`);
  const dec = decodeBoard(`友達から\n盤コード: ${code}\nアプリで遊べます`);   // メッセージごと貼っても読める
  ok(dec && dec.w === w && dec.h === h, `${w}×${h}: 大きさが戻らない`);
  ok(dec && dec.ms === null, `${w}×${h}: 解いていないのに時間が付いた`);
  const def = dec && checkSharedRuns(dec);
  ok(!!def, `${w}×${h}: 手順の確かめで落ちた`);
  if (!def) continue;
  ok(W === w && H === h && SIZE === w * h, `${w}×${h}: 確かめで今の大きさが変わった`);
  loadFixedPuzzle(def, { ms: null });
  ok(tileAbility.every((a, i) => a === goal[i]), `${w}×${h}: ゴールが違う`);
  ok(colorsNow().every((a, i) => a === start[i]), `${w}×${h}: 混ぜた盤が違う`);
  ok(!isSolved(), `${w}×${h}: 揃った盤で始まった`);
  ok(solution.length > 0 && solution.every((r) => r.order >= 2), `${w}×${h}: 答えの手順が入らない`);
  ok(sharedFrom && el('panelNew').hidden, `${w}×${h}: 受け取った盤で「新しい盤にする」が出ている`);
  console.log(`  ${w}×${h}・${k} 種: ${code.length} 文字  OK`);
}

console.log('時間');
{
  const dec = decodeBoard(encodeBoard({ w: 3, h: 3, goal: [0, 0, 0, 1, 1, 1, 0, 0, 0], start: [0, 0, 0, 1, 1, 1, 0, 0, 0], runs: [{ i: 4, n: 1 }], ms: 83456 }));
  ok(dec && dec.ms === 83460, `時間が戻らない（${dec && dec.ms}）`);
  ok(sharedResultLine(80000, false, 83460).includes('速い'), '速いときの行が違う');
  ok(sharedResultLine(90000, false, 83460).includes('1:23.46'), '遅いときに送った人の時間が出ない');
  ok(!sharedResultLine(80000, true, 83460).includes('送った人'), 'ヒントを使ったのに比べている');
  ok(boardShareText('A1-xxxx', 83460).includes('1:23.46') && boardShareText('A1-xxxx', null).includes('A1-xxxx'), '送る文が違う');
}

console.log('壊れたコード');
{
  W = H = 5; SIZE = 25; buildDom(); forcedAbilities = null; types = 5; scrambleN = 20;
  newPuzzle(77);
  const { code } = currentBoardCode();
  ok(decodeBoard('') === null && decodeBoard('こんにちは') === null, '空・関係ない文が読めた');
  ok(decodeBoard(code.slice(0, -3)) === null, '途中で切れたコードが読めた');
  const bad = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11);
  ok(decodeBoard(bad) === null, '1 文字違うコードが読めた');
  // 合計を合わせたうえで手順だけ壊したものは、確かめで落ちる
  const dec = decodeBoard(code);
  dec.runs = dec.runs.slice(1);
  ok(checkSharedRuns(dec) === null, '解けない手順の盤が入った');
  ok(checkSharedRuns({ ...decodeBoard(code), runs: [{ i: 99, n: 1 }] }) === null, '盤の外のマスの手順が入った');
}

console.log('貼って遊ぶ・記録に数えない');
{
  W = H = 4; SIZE = 16; buildDom(); forcedAbilities = null; types = 3; scrambleN = 12; curDiff = 0;
  newPuzzle(4242);
  const { code } = currentBoardCode();
  const before = JSON.stringify(stages);
  el('codeIn').value = code;
  el('codePlay').fire('click', {});
  ok(sharedFrom !== null, '貼って「遊ぶ」で受け取った盤にならない');
  ok(el('codeErr').textContent === '', `読めたのにエラーが出た: ${el('codeErr').textContent}`);
  // 答えの手順どおりに押して揃える
  const runs = solution.map((r) => ({ ...r }));
  for (const r of runs) for (let k = 0; k < r.n; k++) fire(r.i, 1);
  ok(isSolved(), '答えの手順で揃わない');
  ok(JSON.stringify(stages) === before, '受け取った盤のクリアがステージの記録に入った');
  ok(nextBtnEl.hidden, '受け取った盤に「次へ」が出ている');
  ok(!el('shareBoardBtn').hidden, 'クリアのあとに「この盤を送る」が出ない');
  el('codeIn').value = 'A1-abcdefgh';
  el('codePlay').fire('click', {});
  ok(el('codeErr').textContent !== '', '読めないコードでエラーが出ない');
  // 新しい盤を作ると、受け取った盤ではなくなる
  newPuzzle(5);
  ok(sharedFrom === null && !el('panelNew').hidden, '新しい盤で受け取った盤の印が残った');
}

console.log('無料版の鍵');
{
  Entitlement._override({ locks: true, full: false });
  ok(Entitlement.sharedOpen(5, 5, ['swapLR', 'none']), '5×5・無料のブロックの盤が閉じている');
  ok(!Entitlement.sharedOpen(6, 5, ['swapLR']), '辺 6 の盤が開いている');
  ok(!Entitlement.sharedOpen(4, 4, ['ringHalf']), '完全版のブロックの盤が開いている');
  // 完全版の範囲の盤を貼ると、遊ばずに案内を開く。広告で権利を得たら遊べる
  W = H = 7; SIZE = 49; buildDom(); forcedAbilities = null; types = 4; scrambleN = 20;
  newPuzzle(99);
  const { code } = currentBoardCode();
  W = H = 4; SIZE = 16; buildDom(); newPuzzle(1);
  el('codeIn').value = code;
  el('codePlay').fire('click', {});
  ok(sharedFrom === null && W === 4, '無料版で完全版の範囲の盤が始まった');
  Entitlement.grantTicket();
  playShared(checkSharedRuns(decodeBoard(code)));
  ok(sharedFrom !== null && W === 7, '広告の権利で始まらない');
  ok(!Entitlement.hasTicket(), '始めたのに権利が残っている');
  Entitlement._override(null);
}

console.log(fail === 0 ? '\n盤の共有: 全チェック通過' : `\n失敗 ${fail} 件`);
