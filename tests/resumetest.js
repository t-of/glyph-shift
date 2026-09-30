// プレイ途中でホームに戻っても盤が残り、同じステージを押すと続きから遊べること。
// 一覧のカードには「続きから」が出る。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const list = document.getElementById('stageList');
const clickStage = (s, k) => {
  const item = { dataset: { s: String(s), k: String(k) } };
  list.fire('click', { target: { closest: () => item } });
};
const findItem = (s, k) => list.querySelectorAll('.stage-item').find((it) => it.dataset.s === String(s) && it.dataset.k === String(k));

clickStage(4, 3);
const i = legalCells()[0];
fire(i, 1);
const after = Array.from(board);
goHome();
const item = findItem(4, 3);
ok(item && item.classList.contains('resume'), '途中のステージのカードに「続きから」が付いていない');
ok(item && item.getAttribute('aria-label').includes('続きから'), '読み上げに「続きから」が入っていない');
const other = findItem(4, 2);
ok(other && !other.classList.contains('resume'), '触っていないステージにまで「続きから」が付いている');

clickStage(4, 3);
ok(Array.from(board).join(',') === after.join(','), '同じステージを開き直すと盤が作り直されている');

// 別のステージを開くと、そちらの新しい盤になり、前の盤の「続きから」は消える
clickStage(5, 3);
goHome();
ok(!findItem(4, 3).classList.contains('resume'), '別の盤を始めたのに前のステージに「続きから」が残っている');

console.log(fail ? `\n続きから: 失敗 ${fail} 件` : '\n続きから: 全チェック通過');
