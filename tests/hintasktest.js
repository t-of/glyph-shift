// ヒントの確かめと札: ステージで初めてのヒントは確かめる、2 回目からは聞かない、長押しの手には札が付く
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

W = H = 4; SIZE = 16; buildDom(); forcedAbilities = null; types = 3; scrambleN = 10;
newPuzzle(11);
el('hintBtn').fire('click', {});
ok(!confirmEl.hidden, 'ステージで初めてのヒントに確かめが出ない');
ok(!hintUsed, '確かめの前にヒントを使ったことになった');
el('confirmNo').fire('click', {});
ok(confirmEl.hidden && !hintUsed, '「やめる」でヒントを使ったことになった');
el('hintBtn').fire('click', {});
confirmAction();
ok(hintUsed && confirmEl.hidden, '「使う」でヒントが出ない');
ok(slots.some((s) => s._cls.has('hinted')), '光るマスが無い');
el('hintBtn').fire('click', {});
ok(confirmEl.hidden, '2 回目のヒントでまた確かめた');
console.log('  確かめ  OK');

// 回数の点: 2 回以上押す手だけ data-hint-n が付く。長押しの手は hold（光の輪とタイルの動きは CSS）
{
  const tagFor = (r) => {
    hintPlan = { runs: [r] }; solution = [r];
    locked = false;
    blinkHint();
    const s = slots.find((x) => x._cls.has('hinted'));
    return s ? (s.dataset.hintN || '') : null;
  };
  ok(tagFor({ i: 0, n: 1, order: 4 }) === '', '1 回押すだけなのに点が付く');
  ok(!slots[0]._cls.has('hold'), '押す手が長押しになっている');
  ok(tagFor({ i: 0, n: 2, order: 4 }) === '2', '2 回押す手の点が 2 でない');
  ok(tagFor({ i: 0, n: 3, order: 4 }) === '' && slots[0]._cls.has('hold'), '長押し 1 回の手が違う');
  ok(tagFor({ i: 0, n: 6, order: 8 }) === '2' && slots[0]._cls.has('hold'), '長押し 2 回の手が違う');
  ok(tagFor({ i: 0, n: 1, order: 2 }) === '', '入れ替えの手に点が付く');
  clearHint();
  ok(slots.every((s) => s.dataset.hintN === undefined), '消したあとも点が残る');
  ok(!require('fs').readFileSync(require('path').join(__dirname, '..', 'script.js'), 'utf8').includes("L('長押し', 'Hold')"), '長押しの文字の札が残っている');
}
console.log('  回数の点  OK');

// 押すたびに点が 1 つ減る: ヒントのマスを続けて押すと光らせ直し、そのマスを押し終えたら次は教えない
{
  W = H = 5; SIZE = 25; buildDom(); forcedAbilities = null; types = 4; scrambleN = 14;
  // 揃った盤から、4 回で一周するマスを 2 回戻して「そのマスを 2 回押せば揃う」盤を作る
  let found = false;
  for (let sd = 1; sd < 200 && !found; sd++) {
    newPuzzle(sd);
    board = Array.from({ length: SIZE }, (_, k) => k);
    const i = legalCells().find((c) => orderOf(cyclesAt(c)) >= 4);
    if (i === undefined) continue;
    const order = orderOf(cyclesAt(i));
    applyTo(board, cyclesAt(i), -1); applyTo(board, cyclesAt(i), -1);
    if (isSolved()) continue;
    found = true;
    solution = [{ i, n: 2, order }]; hintPlan = null; hintUsed = true; locked = false;
    run = { i: -1, d: 0, order: 1 };
    blinkHint();
    ok(slots[i].dataset.hintN === '2', `始めの点が ${slots[i].dataset.hintN}（期待 2）`);
    fire(i, 1);
    ok(slots[i]._cls.has('hinted'), '続けて押すマスなのに光らせ直さない');
    ok(slots[i].dataset.hintN === undefined, `残り 1 回なのに点が ${slots[i].dataset.hintN}`);
    fire(i, 1);
    ok(isSolved() && !slots.some((s) => s._cls.has('hinted')), '押し終えても揃わないか、光が残る');
  }
  ok(found, '4 回で一周するマスのある盤が見つからない');
}
console.log('  押すたびに減る  OK');

// 練習・今日の 1 問はこの確かめを出さない（今日の 1 問は別の文の確かめ）
{
  startTutorial();
  hintUsed = false;
  el('hintBtn').fire('click', {});
  ok(confirmEl.hidden, '練習でヒントの確かめが出た');
  goHome();
}
console.log(fail === 0 ? '\nヒントの確かめと札: 全チェック通過' : `\n失敗 ${fail} 件`);
