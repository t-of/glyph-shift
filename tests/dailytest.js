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

// 記録: 最初の 1 回だけ・60 日で切る・連続日数・古い形の読み替え
{
  const t = '2026-10-29';
  const cl = (ms, hint = false) => ({ state: 'cleared', ms, hint, moves: 9, stars: 3, rankable: !hint });
  let m = addDaily({}, t, { state: 'playing', ms: 5000, hint: false });
  m = addDaily(m, t, { state: 'playing', ms: 9000, hint: true });
  ok(m[t].ms === 9000 && m[t].hint, '途中の記録が進まない');
  m = addDaily(m, t, cl(83000));
  ok(m[t].state === 'cleared' && m[t].ms === 83000, 'クリアが書けない');
  m = addDaily(m, t, cl(20000));
  ok(m[t].ms === 83000, '2 回目のクリアで上書きした');
  m = addDaily(m, t, { state: 'playing', ms: 1, hint: false });
  ok(m[t].state === 'cleared', 'クリア後に途中で上書きした');
  m = addDaily(m, t, { state: 'revealed', ms: 1, hint: true });
  ok(m[t].state === 'cleared', 'クリア後に解説で上書きした');
  let r = addDaily({}, t, { state: 'revealed', ms: 4000, hint: true });
  r = addDaily(r, t, cl(5000));
  ok(r[t].state === 'revealed', '解説の日にクリアが書けた');

  // 古い形はクリア済み・時間なし（ランキング不可）
  const legacy = normDaily({ moves: 7, stars: 2, hint: false });
  ok(legacy.state === 'cleared' && legacy.ms === null && legacy.rankable === false && legacy.moves === 7, JSON.stringify(legacy));
  ok(dailyIsCleared({ moves: 1, stars: 1, hint: false }) && dailyIsClosed(legacy), '古い形がクリアに読めない');
  ok(normDaily({ state: 'cleared', ms: 5000, hint: false, moves: 3, stars: 3 }).rankable === true, 'rankable');
  ok(normDaily({ state: 'cleared', ms: 5000, hint: true, moves: 3, stars: 3 }).rankable === false, 'ヒントありが rankable');
  ok(normDaily({ state: 'revealed', ms: 5 }).hint === true && normDaily({ state: 'playing' }).ms === 0, '途中・解説の読み');
  ok(normDaily(null) === null && normDaily({ state: 'x' }) === null && normDaily({ moves: 'a' }) === null, '壊れた記録');
  localStorage.setItem('glyphshift.daily', JSON.stringify({ '2026-10-28': { moves: 7, stars: 2, hint: true }, '2026-10-29': { state: 'playing', ms: 3000, hint: true }, bad: { moves: 1 } }));
  const ld = loadDaily();
  ok(ld['2026-10-28'].state === 'cleared' && ld['2026-10-29'].state === 'playing' && !ld.bad, '読み込み');
  localStorage.removeItem('glyphshift.daily');

  const old = {};
  for (let i = 0; i < 100; i++) old[shiftDateKey(t, -i)] = { moves: 5, stars: 1, hint: false };
  const pr = pruneDaily(old, t);
  ok(Object.keys(pr).length === 60, `60 日で切れていない: ${Object.keys(pr).length}`);
  ok(pr[shiftDateKey(t, -59)] && !pr[shiftDateKey(t, -60)], '境目');
  ok(Object.keys(addDaily(old, t, cl(1))).length === 60, 'addDaily が切らない');

  const e = { moves: 1, stars: 1, hint: false };
  ok(dailyStreak({}, t) === 0, '空で 0');
  ok(dailyStreak({ [t]: e }, t) === 1, '今日だけで 1');
  ok(dailyStreak({ '2026-10-28': e, '2026-10-27': e, '2026-10-25': e }, t) === 2, '今日がまだなら昨日から数える');
  ok(dailyStreak({ [t]: e, '2026-10-28': e, '2026-10-27': e }, t) === 3, '今日を含めて 3');
  ok(dailyStreak({ [t]: e, '2026-10-27': e }, t) === 1, '途切れたら止まる');
  ok(dailyStreak({ '2026-10-27': e }, t) === 0, '昨日もなければ 0');
  ok(dailyStreak({ [t]: cl(1, true), '2026-10-28': cl(1) }, t) === 2, 'ヒントありは連続日数に入る');
  ok(dailyStreak({ [t]: { state: 'revealed', ms: 1, hint: true }, '2026-10-28': e }, t) === 1, '解説の日は数えない（昨日から）');
  ok(dailyStreak({ [t]: { state: 'playing', ms: 1, hint: false }, '2026-10-28': e }, t) === 1, '途中の日は数えない');
  console.log('  記録・60 日・連続日数・古い形  OK');
}

// 時間の整形
{
  ok(fmtTime(0) === '0:00' && fmtTime(999) === '0:00' && fmtTime(1000) === '0:01', '秒の切り捨て');
  ok(fmtTime(83000) === '1:23' && fmtTime(600000) === '10:00' && fmtTime(3599999) === '59:59', '分:秒');
  ok(fmtTime(3600000) === '1:00:00' && fmtTime(3725000) === '1:02:05', '時間');
  ok(fmtTime(-5) === '0:00' && fmtTime(NaN) === '0:00', '負・NaN');
  ok(dailyResultLine(83000, false) === 'クリア 1:23', dailyResultLine(83000, false));
  ok(dailyResultLine(83000, true) === 'クリア 1:23（ヒントあり）', dailyResultLine(83000, true));
  ok(dailyResultLine(null, false) === 'クリア' && dailyResultLine(undefined, true) === 'クリア（ヒントあり）', '時間なし');
  console.log('  時間の整形  OK');
}

// 共有の文
{
  const goal = Uint8Array.from({ length: 25 }, (_, i) => [0, 1, 11, 12][i % 4]);
  const txt = dailyShareText({ key: '2026-10-29', ms: 83000, hint: false, goal, w: 5 });
  const L = txt.split('\n');
  ok(L[0] === 'ABILITILE 今日の1問 10/29', L[0]);
  ok(L[1] === 'クリア 1:23', L[1]);   // 手数・★は入れない。時間は入れる
  ok(L.length === 7 && L.slice(2).every((r) => [...r].length === 5), '絵文字が 5 行 5 列でない');
  ok(L[2] === '🟥🟧🔴⬜🟥', L[2]);
  const t2 = dailyShareText({ key: '2026-01-05', ms: 61000, hint: true, goal, w: 5 });
  ok(t2.split('\n')[0].endsWith('1/5') && t2.split('\n')[1] === 'クリア 1:01（ヒントあり）', t2.split('\n')[1]);
  const t3 = dailyShareText({ key: '2026-01-05', hint: false, goal, w: 5 });
  ok(t3.split('\n')[1] === 'クリア', t3.split('\n')[1]);
  ok(!/★|手/.test(txt), '手数・★が入った');
  const ids = Object.keys(SHARE_EMOJI);
  ok(ids.length === ABILITIES.length && new Set(Object.values(SHARE_EMOJI)).size === ids.length && ABILITIES.every((a) => SHARE_EMOJI[a.id]), '絵文字が 13 種で重なる／足りない');
  ok(!/[→↑↓←]/.test(txt), '手順を含む');
  console.log('  共有の文  OK');
}

// クリアの流れ: 最初の 1 回だけ記録・ステージに数えない・解説は文字なし・par 後着で★が付く・イベント
{
  daily = {}; localStorage.removeItem('glyphshift.daily');
  const key = todayKey();
  W = H = 5; SIZE = 25; buildDom(); forcedAbilities = null; types = 4;
  const st = stageFor(5, 4); const c0 = st.clears || 0, p0 = st.perfect || 0;
  const solvedBoard = () => { board = Array.from({ length: SIZE }, (_, i) => i); };
  let fired = [];
  window.dispatchEvent = (ev) => { if (ev.type === 'abilitile:daily-clear') fired.push(ev.detail); };
  window.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o.detail; } };
  globalThis.CustomEvent = window.CustomEvent;
  show(playEl);

  // 解説で揃えた（確認を通らずに揃った場合も）→ 解説の記録。クリア・共有・イベントは無い
  newPuzzle(dailySeed(key), key);
  par = { cost: 4, optimal: true }; autoSolvedFlag = true; solvedBoard(); moves = 4; showClear();
  ok(daily[key] && daily[key].state === 'revealed' && shareBtnEl.hidden && !fired.length, `解説: ${JSON.stringify(daily[key])}`);
  ok(logEl.textContent === '', logEl.textContent);
  ok(dailyStreak(daily, key) === 0, '解説の日が連続日数に入った');
  daily = {};

  // 自分で揃えた（ヒントなし）
  clockNow = () => 0;
  newPuzzle(dailySeed(key), key);
  clockNow = () => 83500;   // 数え始めから 83.5 秒
  par = { cost: 4, optimal: true }; autoSolvedFlag = false; solvedBoard(); moves = 6; showClear();
  const rec = daily[key];
  ok(rec && rec.state === 'cleared' && rec.moves === 6 && rec.stars === 2 && rec.ms === 83500 && rec.rankable === true && rec.hint === false, `記録: ${JSON.stringify(rec)}`);
  ok(!shareBtnEl.hidden, '共有ボタンが出ない');
  ok(logEl.textContent === 'クリア 1:23', logEl.textContent);
  ok(fired.length === 1 && fired[0].key === key && fired[0].ms === 83500 && fired[0].rankable === true, `イベント: ${JSON.stringify(fired)}`);
  ok(stageFor(5, 4).clears === c0 && (stageFor(5, 4).perfect || 0) === p0, 'ステージのクリアに数えた');
  ok(JSON.parse(localStorage.getItem('glyphshift.daily'))[key].state === 'cleared', '保存されていない');

  // 1 日 1 回: カードからもう一度始めても新しく遊べない。記録は変わらない
  startDaily();
  ok(locked && dailyReview && gridEl.classList.contains('cleared'), 'クリア後にまた遊べる');
  ok(logEl.textContent === 'クリア 1:23' && !shareBtnEl.hidden, `結果の画面: ${logEl.textContent}`);
  ok(Array.from(board).every((v, i) => v === i), '揃った盤でない');
  showHint();
  ok(confirmEl.hidden, '結果の画面でヒントの確認が出た');
  askAutoSolve(); ok(confirmEl.hidden, '結果の画面で解説の確認が出た');
  askRegenerate(); ok(confirmEl.hidden, '今日の 1 問で新しい盤にするが出た');
  ok(document.getElementById('panelNew').hidden === true, '「新しい盤にする」が隠れない');
  moves = 0; fire(0, 1);   // 押しても動かない（locked）
  ok(Array.from(board).every((v, i) => v === i), '結果の画面で盤が動いた');
  ok(daily[key].ms === 83500 && daily[key].state === 'cleared', '見ただけで記録が変わった');
  // もう一度揃えても（別経路で showClear が走っても）2 回目は記録しない
  dailyReview = false; locked = false; fired = [];
  par = { cost: 4, optimal: true }; autoSolvedFlag = false; moves = 1; clockNow = () => 1000; showClear();
  ok(daily[key].ms === 83500 && !fired.length, '2 回目で上書き・通知した');
  dailyReview = true;

  // 解説の日も新しく遊べない
  daily = { [key]: { state: 'revealed', ms: 12000, hint: true } };
  startDaily();
  ok(locked && dailyReview && logEl.textContent === '' && shareBtnEl.hidden, `解説の日の画面: ${logEl.textContent}`);
  ok(dailyInProgress() === false, '解説の日が途中扱い');
  goHome();

  // ヒントを使って自分で揃える: クリア・連続日数に入る、rankable でない
  daily = {}; fired = [];
  newPuzzle(dailySeed(key), key); clockNow = () => 0; dailyLoadRecord(); show(playEl);
  hintUsed = true; clockNow = () => 45000;
  par = { cost: 4, optimal: true }; autoSolvedFlag = false; solvedBoard(); moves = 4; showClear();
  ok(daily[key].state === 'cleared' && daily[key].hint === true && daily[key].rankable === false, JSON.stringify(daily[key]));
  ok(logEl.textContent === 'クリア 0:45（ヒントあり）', logEl.textContent);
  ok(dailyStreak(daily, key) === 1, 'ヒントありが連続日数に入らない');
  ok(fired.length === 1 && fired[0].rankable === false, 'rankable:false の通知');
  daily = {};

  newPuzzle(dailySeed(key), key); show(playEl);
  par = undefined; autoSolvedFlag = false; hintUsed = false; solvedBoard(); moves = 4; showClear();
  ok(daily[key].moves === 4 && daily[key].stars === 0, `par 待ちの先書き: ${JSON.stringify(daily[key])}`);
  resolvePar({ cost: 4, optimal: true });
  ok(daily[key].stars === 3, `par が届いて★が付かない: ${JSON.stringify(daily[key])}`);
  ok(stageFor(5, 4).clears === c0 && (stageFor(5, 4).perfect || 0) === p0, 'par 後にステージの perfect が増えた');

  newPuzzle();   // 通常の盤は daily を引きずらない
  ok(shareBtnEl.hidden && dailyKey === null, '通常の盤で共有ボタン／dailyKey が残る');
  ok(document.getElementById('panelNew').hidden === false, '通常の盤で「新しい盤にする」が出ない');
  par = { cost: 4, optimal: true }; autoSolvedFlag = false; solvedBoard(); moves = 4; showClear();
  ok(Object.keys(daily).length === 1 && daily[key].moves === 4, '通常の盤が daily に記録された');
  ok(/^クリア \d+:\d\d/.test(logEl.textContent), `通常の盤の行に時間が無い: ${logEl.textContent}`);
  delete window.dispatchEvent; delete window.CustomEvent; delete globalThis.CustomEvent;
  console.log('  クリアの流れ・1 日 1 回  OK');
}

// 時間: 盤を初めて見た時刻から時計どおり（裏・ホーム・閉じても止まらない）。保存・復元
{
  daily = {}; localStorage.removeItem('glyphshift.daily');
  const key = todayKey();
  W = H = 5; SIZE = 25; buildDom(); forcedAbilities = null; types = 4;
  let now = 1000; clockNow = () => now;
  const saved = () => (JSON.parse(localStorage.getItem('glyphshift.daily') || '{}')[key] || {});
  startDaily({ confirmed: true });   // 盤が出る → t0 が決まる
  ok(dailySince !== null && saved().t0 === 1000, `盤が出ても t0 が残らない: ${JSON.stringify(saved())}`);
  now += 5000; ok(dailyElapsed() === 5000, `5 秒: ${dailyElapsed()}`);
  // 数秒ごとの保存
  now += 3000; flushTimers();
  ok(saved().state === 'playing' && saved().ms === 8000, `定期保存: ${JSON.stringify(saved())}`);
  // 裏に回っても時間は進む（保存の刻みだけ止まる）
  document.hidden = true; dailyClockSync();
  ok(dailySince === null && saved().ms === 8000, '裏で保存されない');
  now += 600000; ok(dailyElapsed() === 608000, `裏のあいだ止まった: ${dailyElapsed()}`);
  document.hidden = false; dailyClockSync();
  ok(dailySince !== null, '戻っても保存の刻みが再開しない');
  // アプリを閉じても進む（ホームのボタンで戻るのは「やめる」。下の別の塊）
  show(titleEl);
  now += 2000; ok(dailyElapsed() === 610000, `閉じているあいだ止まった: ${dailyElapsed()}`);
  // 開き直し（記録だけ残して、変数を捨てた状態）→ 同じ t0 から数える
  dailyMs = 0; dailyT0 = null; dailyKey = null;
  daily = loadDaily();
  startDaily();
  ok(dailyElapsed() === 610000 && dailySince !== null, `開き直しで t0 が戻らない: ${dailyElapsed()}`);
  // t0 の無い古い途中の記録は、いまから ms を引いた時刻を t0 にする
  daily = { [key]: { state: 'playing', ms: 7000, hint: false } }; dailyKey = null;
  startDaily();
  ok(dailyElapsed() === 7000, `古い途中の記録: ${dailyElapsed()}`);
  now += 1000; ok(dailyElapsed() === 8000, '古い途中の記録から進まない');
  // 端末の時計を戻されても負にならない
  now -= 999999; ok(dailyElapsed() === 0, `時計を戻すと負: ${dailyElapsed()}`);
  now += 999999;
  // 設定の盤（ステージ）を遊んでいる間は数えない
  newPuzzle(); ok(dailySince === null, '通常の盤で数えている');
  // 日付をまたいでも始めた日のキーで記録する
  const k1 = shiftDateKey(key, -1);
  dailyKey = null; newPuzzle(dailySeed(k1), k1); show(playEl);
  ok(dailyKey === k1 && dailySince !== null, '昨日の盤');
  now += 4000; dailyClockStop();
  ok(daily[k1] && daily[k1].ms === 4000 && daily[k1].state === 'playing', `始めた日で記録: ${JSON.stringify(daily[k1])}`);
  // クリアすると、クリアの瞬間で止まって以降進まない
  daily = {}; localStorage.removeItem('glyphshift.daily');
  now = 0; newPuzzle(dailySeed(key), key); show(playEl);
  now = 30000; board = Array.from({ length: SIZE }, (_, i) => i); par = { cost: 4, optimal: true }; autoSolvedFlag = false; moves = 4; showClear();
  now = 90000; ok(daily[key].ms === 30000 && dailyElapsed() === 30000 && dailySince === null, `クリアで止まらない: ${JSON.stringify(daily[key])}`);
  ok(dailyShouldRun() === false, 'クリア後に数える');
  clockNow = () => performance.now();
  console.log('  時間（裏で止まる・保存・続きから）  OK');
}

// ヒント・解説の確認と保存
{
  daily = {}; localStorage.removeItem('glyphshift.daily');
  const key = todayKey();
  W = H = 5; SIZE = 25; buildDom(); forcedAbilities = null; types = 4;
  let now = 0; clockNow = () => now;
  const saved = () => (JSON.parse(localStorage.getItem('glyphshift.daily') || '{}')[key] || {});
  startDaily({ confirmed: true }); now = 7000;

  // 初めてのヒント: 確認が出る。はいを押すまで使ったことにならない
  showHint();
  ok(!confirmEl.hidden && /ランキング/.test(confirmTextEl.innerHTML), `確認が出ない: ${confirmTextEl.innerHTML}`);
  ok(!hintUsed && !saved().hint, '確認だけでヒントを使ったことになった');
  closeConfirm();   // やめる
  ok(!hintUsed && !saved().hint, 'やめたのに使ったことになった');
  showHint(); const yes = confirmAction; yes();
  ok(hintUsed && saved().hint === true && saved().state === 'playing' && saved().ms === 7000, `ヒントが保存されない: ${JSON.stringify(saved())}`);
  ok(confirmEl.hidden, '確認が閉じない');
  // 2 回目からは確認を出さない
  showHint(); ok(confirmEl.hidden, '2 回目も確認が出た');
  // 閉じて開き直してもヒントの印は消えない（やり直しても元に戻らない）
  show(titleEl); daily = loadDaily(); hintUsed = false;   // アプリを閉じて開き直す
  startDaily();
  ok(hintUsed === true, 'やり直しでヒントの印が消えた');
  showHint(); ok(confirmEl.hidden, 'やり直したら確認がまた出た');
  // ヒントありで揃えるとランキングに載らない
  par = { cost: 4, optimal: true }; autoSolvedFlag = false; board = Array.from({ length: SIZE }, (_, i) => i); moves = 4; now = 20000; showClear();
  ok(daily[key].state === 'cleared' && daily[key].rankable === false && daily[key].hint === true && daily[key].ms === 20000, JSON.stringify(daily[key]));

  // 解説: 確認 → はいで保存（revealed）。やめれば何も起きない
  daily = {}; localStorage.removeItem('glyphshift.daily'); now = 0;
  startDaily({ confirmed: true }); now = 3000;
  askAutoSolve();
  ok(!confirmEl.hidden && /クリアになりません/.test(confirmTextEl.innerHTML), `解説の確認: ${confirmTextEl.innerHTML}`);
  ok(!saved().state || saved().state === 'playing', '確認だけで解説の記録になった');
  closeConfirm(); ok(!autoSolving && saved().state !== 'revealed', 'やめたのに解説になった');
  askAutoSolve(); confirmAction();
  ok(saved().state === 'revealed' && saved().hint === true && saved().ms === 3000, `解説が保存されない: ${JSON.stringify(saved())}`);
  ok(dailySince === null, '解説のあとも数えている');
  stopAutoSolve();
  // 閉じて開き直す → 新しく遊べない
  goHome(); daily = loadDaily();
  startDaily();
  ok(locked && dailyReview && logEl.textContent === '', `解説の日にまた遊べる: ${logEl.textContent}`);
  ok(dailyIsClosed(daily[key]) && !dailyIsCleared(daily[key]), '解説がクリア扱い');
  // カード
  goHome();
  const card = stageListEl.querySelector('.daily-item');
  ok(card.children[1].children[1].textContent === '' && /解説を見た/.test(card.getAttribute('aria-label')), `カード: ${card.children[1].children[1].textContent}`);

  // 通常の盤ではヒントに確認を出さない
  newPuzzle(); showHint(); ok(confirmEl.hidden, '通常の盤でヒントの確認が出た');
  clockNow = () => performance.now();
  console.log('  ヒント・解説の確認と保存  OK');
}

// 始める前の確認・プレイ時間の表示・途中でやめたら記録なし（2026-10-30 オーナー）
{
  daily = {}; localStorage.removeItem('glyphshift.daily');
  const key = todayKey();
  W = H = 5; SIZE = 25; buildDom(); forcedAbilities = null; types = 4;
  let now = 0; clockNow = () => now;
  const saved = () => (JSON.parse(localStorage.getItem('glyphshift.daily') || '{}')[key] || {});
  goHome(); dailyKey = null;
  // まだ始めていない日は、確認を出してから始める。やめれば何も起きない
  startDaily();
  ok(!confirmEl.hidden && /時間が動き出します/.test(confirmTextEl.innerHTML) && dailyKey === null && !saved().state, `始める前の確認: ${confirmTextEl.innerHTML}`);
  closeConfirm(); ok(dailyKey === null && !saved().state, 'やめたのに始まった');
  startDaily(); confirmAction();
  ok(confirmEl.hidden && dailyKey === key && saved().state === 'playing' && dailySince !== null, `始まらない: ${JSON.stringify(saved())}`);
  // プレイ時間の表示
  const clockEl = document.getElementById('dailyClock'), clockText = document.getElementById('dailyClockText');
  now = 65000; renderDailyClock();
  ok(!clockEl.hidden && clockText.textContent === '1:05', `プレイ時間: ${clockEl.hidden} ${clockText.textContent}`);
  // 途中の記録がある日（アプリを開き直した）は確認なしで続ける
  show(titleEl); dailyKey = null; daily = loadDaily();
  startDaily(); ok(confirmEl.hidden && dailyKey === key, '途中の日に始める確認が出た');
  // ホームへ戻る: 確認 → いいえなら続ける、はいなら記録なしで閉じる
  goHome();
  ok(!confirmEl.hidden && /記録は残りません/.test(confirmTextEl.innerHTML) && !playEl.hidden, `やめる確認: ${confirmTextEl.innerHTML}`);
  closeConfirm(); ok(saved().state === 'playing' && !playEl.hidden, 'いいえでやめた');
  now = 90000; goHome(); confirmAction();
  ok(saved().state === 'abandoned' && saved().ms === 90000 && playEl.hidden && dailySince === null, `やめた記録: ${JSON.stringify(saved())}`);
  ok(!dailyIsCleared(daily[key]) && dailyIsClosed(daily[key]) && dailyStreak(daily, key) === 0, 'やめた日がクリア扱い');
  // やめた日も遊べる。確認なし・時間なし・記録なし（2026-10-30 オーナー）
  startDaily();
  ok(confirmEl.hidden && !locked && !dailyReview && dailyKey === key && clockEl.hidden && dailySince === null, `やめた日に遊べない: ${locked} ${dailyReview}`);
  showHint(); ok(confirmEl.hidden && hintUsed, 'やめた日にヒントの確認が出た');
  askAutoSolve(); ok(!/クリアになりません/.test(confirmTextEl.innerHTML), 'やめた日に今日の 1 問の解説の確認が出た'); closeConfirm();
  now = 120000; board = Array.from({ length: SIZE }, (_, i) => i); par = { cost: 4, optimal: true }; autoSolvedFlag = false; moves = 4; showClear();
  ok(saved().state === 'abandoned' && saved().ms === 90000 && logEl.textContent === 'クリア' && shareBtnEl.hidden, `やめた日のクリアで記録が変わった: ${JSON.stringify(saved())} ${logEl.textContent}`);
  // クリアのあとは確認なしでホームへ戻れる。途中でも確認は出ない
  goHome(); ok(confirmEl.hidden && playEl.hidden, 'やめた日のクリアから戻るのに確認が出た');
  startDaily(); goHome(); ok(confirmEl.hidden && playEl.hidden, 'やめた日の途中で戻るのに確認が出た');
  ok(stageListEl.querySelector('.daily-item').children[1].children[1].textContent === '' && /記録なし/.test(stageListEl.querySelector('.daily-item').getAttribute('aria-label')), 'カードにやめた文字が出た／読み上げにない');
  // クリアした日は時間が止まって表示される
  daily = {}; localStorage.removeItem('glyphshift.daily'); now = 0; dailyKey = null;
  startDaily({ confirmed: true }); now = 42000;
  board = Array.from({ length: SIZE }, (_, i) => i); par = { cost: 4, optimal: true }; autoSolvedFlag = false; moves = 4; showClear();
  now = 99000; renderDailyClock();
  ok(!clockEl.hidden && clockText.textContent === '0:42', `クリアの時間: ${clockText.textContent}`);
  goHome(); ok(confirmEl.hidden, 'クリアのあとに確認が出た');
  // 通常の盤では出さない
  newPuzzle(); show(playEl); ok(!clockEl.hidden, '通常の盤でプレイ時間が出ない（ステージも時間を測る。2026-10-31）');
  daily = {}; localStorage.removeItem('glyphshift.daily');
  clockNow = () => performance.now();
  console.log('  始める確認・プレイ時間・途中でやめる  OK');
}

// カードの表示: 未挑戦・途中・クリア（時間つき）・解説を見た
{
  const key = todayKey();
  const stateText = () => stageListEl.querySelector('.daily-item').children[1].children[1].textContent;
  daily = {}; newPuzzle(); renderStageList(); ok(stateText() === '' && /未挑戦/.test(stageListEl.querySelector('.daily-item').getAttribute('aria-label')), `未挑戦: ${stateText()}`);
  daily = { [key]: { state: 'playing', ms: 5000, hint: false } }; renderStageList(); ok(stateText() === '' && stageListEl.querySelector('.daily-item').classList.contains('resume') && /途中/.test(stageListEl.querySelector('.daily-item').getAttribute('aria-label')), `途中: ${stateText()}`);
  daily = { [key]: { state: 'cleared', ms: 83000, hint: false, moves: 5, stars: 3, rankable: true } }; renderStageList(); ok(stateText() === 'クリア 1:23.00', stateText());
  ok(fmtTimeCs(83456) === '1:23.45' && fmtTimeCs(5) === '0:00.00' && fmtTimeCs(3723990) === '1:02:03.99', `100 分の 1 秒: ${fmtTimeCs(83456)}`);
  daily = { [key]: { moves: 5, stars: 3, hint: false } }; renderStageList(); ok(stateText() === 'クリア', `古い形: ${stateText()}`);
  daily = { [key]: { state: 'revealed', ms: 5000, hint: true } }; renderStageList(); ok(stateText() === '', stateText());
  daily = {};
  console.log('  カードの表示  OK');
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
  ok(card.children[1].children[0].children.map((t) => t.children[0].textContent).join('') === 'TODAY', 'カードの題（タイルの TODAY）');
  Entitlement._override(null);
  console.log('  ホームのカード  OK');
}

// 遊び始めの案内は出さない（画面の文字を減らした）
{
  ok(readyLine() === '', `案内が出ている: ${readyLine()}`);
  console.log('  遊び始めの案内なし  OK');
}
console.log(fail ? `失敗 ${fail} 件` : '通過');
