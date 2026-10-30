// リポジトリの場所に依らないよう、根の位置を自分で求める
const __root = require('path').join(__dirname, '..');
// ハンバーガーの中身が「遊び方 / ブロック / 設定」の 3 タブになっているかの検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

const SECS = { rule: 'secRule', block: 'secBlock', config: 'secConfig' };
const btn = {};
for (const b of el('panelTabs').querySelectorAll('button')) btn[b.dataset.v] = b;

console.log('タブ:', Object.keys(btn).join(' / '));
ok(Object.keys(btn).length === 3, `タブが ${Object.keys(btn).length} 個`);

// 1. 最初はルールが出ていて、他は隠れている
const onlyShown = (key) =>
  Object.entries(SECS).every(([k, id]) => el(id).hidden === (k !== key));
ok(onlyShown('rule'), '最初にルールだけが出ていない');
ok(btn.rule.getAttribute('aria-selected') === 'true', 'ルールのタブが選択表示になっていない');

// 2. 押すと切り替わる
for (const key of ['block', 'config', 'rule']) {
  el('panelTabs').fire('click', { target: btn[key] });
  ok(onlyShown(key), `${key} を押しても ${key} だけにならない`);
  ok(btn[key].getAttribute('aria-selected') === 'true', `${key} が選択表示になっていない`);
  ok(btn[key].tabIndex === 0, `${key} がキーボードで届く状態になっていない`);
  const others = Object.keys(SECS).filter((k) => k !== key);
  ok(others.every((k) => btn[k].tabIndex === -1), `${key} 以外がタブ移動から外れていない`);
}

// 3. 左右キーで移れる
el('panelTabs').fire('keydown', { key: 'ArrowRight', preventDefault() {} });
ok(onlyShown('block'), '→ キーで次のタブに移らない');
el('panelTabs').fire('keydown', { key: 'ArrowLeft', preventDefault() {} });
ok(onlyShown('rule'), '← キーで前のタブに戻らない');
el('panelTabs').fire('keydown', { key: 'ArrowLeft', preventDefault() {} });
ok(onlyShown('config'), '端から ← キーで反対の端に回らない');

// 4-5. どの区画に何が入っているかは、実際の index.html を読んで確かめる
//      （テスト台は HTML を解釈しないので、入れ子はここでしか見られない）
{
  const html = require('fs').readFileSync(__root + '/index.html', 'utf8');
  const between = (from, to) => {
    const a = html.indexOf(from);
    const b = to ? html.indexOf(to, a) : html.length;
    return a < 0 ? '' : html.slice(a, b < 0 ? html.length : b);
  };
  const secRule = between('id="secRule"', 'id="secBlock"');
  const secBlock = between('id="secBlock"', 'id="secConfig"');
  const secConfig = between('id="secConfig"', '</aside>');
  const setup = between('id="setup"', 'id="panel"');

  ok(secRule.includes('id="panelHowto"') && secRule.includes('id="panelTutorial"'), '遊び方の区画にボタンが無い');
  ok(!secRule.includes('class="howto"'), '遊び方の箇条書きがパネルに残っている（本体はシート 1 つ）');
  ok(secBlock.includes('id="panelBody"'), 'ブロックの区画に一覧が無い');
  ok(secBlock.includes('id="glyphLegend"'), 'ブロックの区画に絵柄の読み方が無い');
  ok(!secConfig.includes('id="glyphSeg"'), '設定の区画に絵柄の選びが残っている（1 種だけにした）');
  ok(secConfig.includes('id="soundChk"'), '設定の区画に効果音が無い');
  ok(!setup.includes('id="glyphSeg"'), '盤面の設定にまだ絵柄が残っている');
  ok(setup.includes('id="sideA"') && setup.includes('id="createBtn"'), '盤面の設定から辺の項目が消えている');
}

// 6. 読み方は選んでいる絵柄の説明になっている
const legendText = () => [...el('glyphLegend').children].map((li) => li.innerHTML);
const sameAs = (id) => {
  const want = Glyphs.byId(id).legend;
  const got = legendText();
  return got.length === want.length && got.every((v, i) => v === want[i]);
};
ok(sameAs('dots'), '最初の読み方が点図の説明になっていない');

// 7. 効果音の入切は設定タブにだけあり、上のバーからは無くなっている
const wasOn = Sfx.enabled;
el('soundChk').checked = false;
el('soundChk').fire('change', {});
ok(Sfx.enabled === false, '設定から切っても効果音が止まらない');
el('soundChk').checked = true;
el('soundChk').fire('change', {});
ok(Sfx.enabled === true, '設定から戻せない');
Sfx.set(wasOn);
{
  const html = require('fs').readFileSync(__root + '/index.html', 'utf8');
  const rail = html.slice(html.indexOf('class="rail-actions"'), html.indexOf('</header>'));
  ok(!rail.includes('soundBtn'), '上のバーに効果音のボタンが残っている');
  ok(!rail.includes('setupBtn') && rail.includes('menuBtn'), '上のバーに盤面の設定が残っている／遊び方が消えている');
}

console.log(fail ? `\nパネルの構成: 失敗 ${fail} 件` : '\nパネルの構成: 全チェック通過');
