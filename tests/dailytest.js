// 今日の 1 問: 日付 → seed、全ブロックから選ぶ、記録、連続日数、共有の文、クリアの流れ。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 日付 → seed は純粋で、日が変われば変わる
{
  ok(dailySeed('2026-10-29') === dailySeed('2026-10-29'), '同じ日付で seed が違う');
  const seen = new Set();
  let k = '2026-01-01';
  for (let i = 0; i < 1100; i++) { seen.add(dailySeed(k)); k = shiftDateKey(k, 1); }
  ok(seen.size === 1100, `日ごとに変わらない: ${seen.size}`);
  ok(dailySeed('2026-10-29') >= 0 && dailySeed('2026-10-29') < 1e9, 'seed の範囲');
  ok(dateKeyOf(new Date(2026, 9, 5)) === '2026-10-05', 'キーの形');
  ok(shiftDateKey('2026-03-01', -1) === '2026-02-28' && shiftDateKey('2026-12-31', 1) === '2027-01-01', '日付のずらし');
  console.log('  日付 → seed  OK');
}

// 無料版でも、今日の 1 問は全ブロックから選ばれる（ふつうの盤は無料のブロックだけ）
{
  Entitlement._override({ locks: true, full: false });
  W = H = 5; SIZE = 25; buildDom(); forcedAbilities = null; types = 4;
  let paid = 0, freeOnly = true;
  for (let i = 0; i < 60; i++) {
    newPuzzle(1000 + i, '2026-10-29');
    if (Array.from(tileAbility).some((a) => !Entitlement.blockOpen(ABILITIES[a].id))) paid++;
    ok(dailyKey === '2026-10-29', 'dailyKey が入らない');
    newPuzzle(1000 + i);
    if (Array.from(tileAbility).some((a) => !Entitlement.blockOpen(ABILITIES[a].id))) freeOnly = false;
    ok(dailyKey === null, '次の盤で dailyKey が残る');
  }
  ok(paid > 20, `完全版のブロックがあまり出ない: ${paid}/60`);
  ok(freeOnly, '通常の盤に有料ブロックが出た');
  // 同じ日は同じ盤
  newPuzzle(dailySeed('2026-10-29'), '2026-10-29'); const g1 = Array.from(tileAbility).join();
  newPuzzle(dailySeed('2026-10-29'), '2026-10-29'); ok(g1 === Array.from(tileAbility).join(), '同じ日で盤が違う');
  Entitlement._override(null);
  console.log('  全ブロックから選ぶ  OK');
}

// 記録: よいほうを残す・60 日で切る・連続日数
{
  const t = '2026-10-29';
  let m = addDaily({}, t, { moves: 12, stars: 2, hint: false });
  m = addDaily(m, t, { moves: 9, stars: 1, hint: false });
  ok(m[t].moves === 12 && m[t].stars === 2, '★が少ないほうで上書きした');
  m = addDaily(m, t, { moves: 10, stars: 2, hint: false });
  ok(m[t].moves === 10, '同じ★で手数が少ないほうが残らない');
  m = addDaily(m, t, { moves: 11, stars: 2, hint: true });
  ok(m[t].moves === 10, '同じ★で手数が多いほうに変わった');
  m = addDaily(m, t, { moves: 9, stars: 3, hint: false });
  ok(m[t].stars === 3, '★が多いほうに変わらない');

  const old = {};
  for (let i = 0; i < 100; i++) old[shiftDateKey(t, -i)] = { moves: 5, stars: 1, hint: false };
  const pr = pruneDaily(old, t);
  ok(Object.keys(pr).length === 60, `60 日で切れていない: ${Object.keys(pr).length}`);
  ok(pr[shiftDateKey(t, -59)] && !pr[shiftDateKey(t, -60)], '境目');
  ok(Object.keys(addDaily(old, t, { moves: 1, stars: 3, hint: false })).length === 60, 'addDaily が切らない');

  const e = { moves: 1, stars: 1, hint: false };
  ok(dailyStreak({}, t) === 0, '空で 0');
  ok(dailyStreak({ [t]: e }, t) === 1, '今日だけで 1');
  ok(dailyStreak({ '2026-10-28': e, '2026-10-27': e, '2026-10-25': e }, t) === 2, '今日がまだなら昨日から数える');
  ok(dailyStreak({ [t]: e, '2026-10-28': e, '2026-10-27': e }, t) === 3, '今日を含めて 3');
  ok(dailyStreak({ [t]: e, '2026-10-27': e }, t) === 1, '途切れたら止まる');
  ok(dailyStreak({ '2026-10-27': e }, t) === 0, '昨日もなければ 0');
  console.log('  記録・60 日・連続日数  OK');
}

// 共有の文
{
  const goal = Uint8Array.from({ length: 25 }, (_, i) => [0, 1, 11, 12][i % 4]);
  const txt = dailyShareText({ key: '2026-10-29', moves: 9, stars: 3, par: { cost: 9, optimal: true }, hint: false, goal, w: 5 });
  const L = txt.split('\n');
  ok(L[0] === 'ABILITILE 今日の1問 10/29', L[0]);
  ok(L[1] === '★★★ 9手（最短 9手）', L[1]);
  ok(L.length === 7 && L.slice(2).every((r) => [...r].length === 5), '絵文字が 5 行 5 列でない');
  ok(L[2] === '🟥🟧🟣⬜🟥', L[2]);
  const t2 = dailyShareText({ key: '2026-01-05', moves: 14, stars: 2, par: { cost: 10, optimal: false }, hint: true, goal, w: 5 });
  ok(t2.split('\n')[0].endsWith('1/5') && t2.split('\n')[1] === '★★ 14手（目安 10手）（ヒントあり）', t2.split('\n')[1]);
  const t3 = dailyShareText({ key: '2026-01-05', moves: 14, stars: 0, par: null, hint: false, goal, w: 5 });
  ok(t3.split('\n')[1] === '14手', t3.split('\n')[1]);
  const ids = Object.keys(SHARE_EMOJI);
  ok(ids.length === ABILITIES.length && new Set(Object.values(SHARE_EMOJI)).size === ids.length && ABILITIES.every((a) => SHARE_EMOJI[a.id]), '絵文字が 13 種で重なる／足りない');
  ok(!/[→↑↓←]/.test(txt), '手順を含む');
  console.log('  共有の文  OK');
}

// クリアの流れ: 記録される・ステージに数えない・解説は記録しない・par 後着で★が付く
{
  daily = {}; 
  const key = todayKey();
  W = H = 5; SIZE = 25; buildDom(); forcedAbilities = null; types = 4;
  const st = stageFor(5, 4); const c0 = st.clears || 0, p0 = st.perfect || 0;
  const solvedBoard = () => { board = Array.from({ length: SIZE }, (_, i) => i); };

  newPuzzle(dailySeed(key), key);
  par = { cost: 4, optimal: true }; autoSolvedFlag = true; solvedBoard(); moves = 4; showClear();
  ok(!daily[key] && shareBtnEl.hidden, '解説で揃えたのに記録・共有が出た');

  newPuzzle(dailySeed(key), key);
  par = { cost: 4, optimal: true }; autoSolvedFlag = false; hintUsed = false; solvedBoard(); moves = 6; showClear();
  ok(daily[key] && daily[key].moves === 6 && daily[key].stars === 2, `記録: ${JSON.stringify(daily[key])}`);
  ok(!shareBtnEl.hidden, '共有ボタンが出ない');
  ok(stageFor(5, 4).clears === c0 && (stageFor(5, 4).perfect || 0) === p0, 'ステージのクリアに数えた');

  newPuzzle(dailySeed(key), key);
  par = { cost: 4, optimal: true }; autoSolvedFlag = false; solvedBoard(); moves = 9; showClear();
  ok(daily[key].moves === 6, '悪い結果で上書きした');
  daily = {};

  newPuzzle(dailySeed(key), key);
  par = undefined; autoSolvedFlag = false; hintUsed = false; solvedBoard(); moves = 4; showClear();
  ok(daily[key].moves === 4 && daily[key].stars === 0, `par 待ちの先書き: ${JSON.stringify(daily[key])}`);
  resolvePar({ cost: 4, optimal: true });
  ok(daily[key].stars === 3, `par が届いて★が付かない: ${JSON.stringify(daily[key])}`);
  ok(stageFor(5, 4).clears === c0 && (stageFor(5, 4).perfect || 0) === p0, 'par 後にステージの perfect が増えた');

  newPuzzle();   // 通常の盤は daily を引きずらない
  ok(shareBtnEl.hidden && dailyKey === null, '通常の盤で共有ボタン／dailyKey が残る');
  par = { cost: 4, optimal: true }; autoSolvedFlag = false; solvedBoard(); moves = 4; showClear();
  ok(daily[key].moves === 4 && Object.keys(daily).length === 1, '通常の盤が daily に記録された');
  console.log('  クリアの流れ  OK');
}

// ホームのカード: 一覧の共通ハンドラ（鍵の案内）に巻き込まれない
{
  Entitlement._override({ locks: true, full: false });
  let opened = 0; lockSheetEl.showModal = () => { opened++; };
  renderStageList();
  const card = stageListEl.querySelector('.daily-item');
  ok(!!card && stageListEl.children[0].children[0] === card, '今日の 1 問のカードが一番上にない');
  stageListEl.fire('click', { target: card });   // 実ブラウザではカードの click が一覧へ泡立つ
  ok(opened === 0, 'カードの click で完全版の案内が開いた');
  ok(/今日の 1 問/.test(card.children[1].children[0].textContent), 'カードの題');
  Entitlement._override(null);
  console.log('  ホームのカード  OK');
}

// 遊び始めの案内は出さない（画面の文字を減らした）
{
  ok(readyLine() === '', `案内が出ている: ${readyLine()}`);
  console.log('  遊び始めの案内なし  OK');
}
console.log(fail ? `失敗 ${fail} 件` : '通過');
