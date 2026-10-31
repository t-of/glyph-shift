// 説明パネルの中身を検証する
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const walk = (el, out = []) => { for (const c of el.children || []) { if (typeof c === 'object') { out.push(c); walk(c, out); } } return out; };

for (const size of [4, 5, 6]) {
  W = H = size; SIZE = W * H; buildDom();
  newPuzzle(42);

  const body = document.getElementById('panelBody');
  const all = walk(body);
  const blks = all.filter((e) => e._cls.has('blk'));
  ok(blks.length === ABILITIES.length, `${size}×${size}: ブロック数 ${blks.length}（期待 ${ABILITIES.length}）`);

  // 「入れ替え」「回転」などの系統の見出しは出さない（2026-10-30 オーナー）
  const titles = all.filter((e) => e._cls.has('fam-title'));
  ok(titles.length === 0, `${size}×${size}: 系統の見出しが ${titles.length} 個出ている（出さない）`);

  // 「使用中」バッジの数が、このパズルで使う能力の種類数と一致するか
  const badges = all.filter((e) => e._cls.has('used')).length;
  ok(badges === new Set(tileAbility).size, `${size}×${size}: 使用中バッジ ${badges}（期待 ${new Set(tileAbility).size}）`);
  ok(blks.filter((b) => b._cls.has('dim')).length === ABILITIES.length - badges, `${size}×${size}: 未使用の淡色表示の数が合わない`);

  // 使える位置の地図は出さない（2026-10-31 オーナー）
  ok(!all.some((e) => e._cls.has('blk-map')), `${size}×${size}: 使える位置の地図が残っている`);

  console.log(`${size}×${size}: ブロック ${blks.length} 件、系統 ${titles.join(' / ')}、使用中 ${badges} 件`);
}
console.log(fail === 0 ? '\n説明パネルの中身: 全チェック通過' : `\n失敗 ${fail} 件`);
