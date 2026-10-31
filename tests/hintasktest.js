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

// 札: 長押しの手は「長押し」、2 回以上は「×n」、1 回押すだけは札なし
{
  const one = { i: 0, n: 1, order: 4 }, two = { i: 0, n: 2, order: 4 }, hold = { i: 0, n: 3, order: 4 }, swap = { i: 0, n: 1, order: 2 };
  const tagFor = (r) => {
    hintPlan = { runs: [r] }; solution = [r];
    locked = false;
    blinkHint();
    const s = slots.find((x) => x._cls.has('hinted'));
    return s ? (s.dataset.hint || '') : null;
  };
  // 揃っていない盤のまま、手順だけ差し替えて札を見る
  ok(tagFor(one) === '', `1 回押すだけなのに札: ${tagFor(one)}`);
  ok(tagFor(two) === '×2', `2 回押すときの札が違う: ${tagFor(two)}`);
  ok(tagFor(hold) === '長押し', `長押しの札が違う: ${tagFor(hold)}`);
  ok(slots[0]._cls.has('hold'), '長押しの手で光の色が変わらない');
  ok(tagFor({ i: 0, n: 2, order: 8 }) === '×2' && tagFor({ i: 0, n: 6, order: 8 }) === '長押し ×2', '8 回で一周する手の札が違う');
  ok(tagFor(swap) === '', `入れ替えの手に札: ${tagFor(swap)}`);
  clearHint();
  ok(slots.every((s) => s.dataset.hint === undefined), '消したあとも札が残る');
}
console.log('  札  OK');

// 練習・今日の 1 問はこの確かめを出さない（今日の 1 問は別の文の確かめ）
{
  startTutorial();
  hintUsed = false;
  el('hintBtn').fire('click', {});
  ok(confirmEl.hidden, '練習でヒントの確かめが出た');
  goHome();
}
console.log(fail === 0 ? '\nヒントの確かめと札: 全チェック通過' : `\n失敗 ${fail} 件`);
