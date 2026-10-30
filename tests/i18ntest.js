// 英語版: index.html の data-i18n* のキーが辞書にそろっているか、英語で起動したとき日本語が残らないか。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const JA = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

// ふつうに読み込んだ世界（navigator が無い）は日本語
ok(I18n.lang === 'ja', `既定が日本語でない: ${I18n.lang}`);
ok(I18n.L('あ', 'a') === 'あ', 'L が日本語を返さない');

// index.html のキーと辞書
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const used = new Set();
  for (const m of html.matchAll(/data-i18n(?:-aria|-ph)?="([^"]+)"/g)) used.add(m[1]);
  for (const k of used) ok(k in I18n.HTML, `辞書にないキー: ${k}`);
  for (const k of Object.keys(I18n.HTML)) {
    if (k !== 'pageTitle') ok(used.has(k), `index.html で使っていないキー: ${k}`);
    ok(!JA.test(I18n.HTML[k]), `英語の辞書に日本語: ${k}`);
  }
  // 中身を替える要素に id つきの子があれば、英語の側にも同じ id がある（script.js が拾う）
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>/g)) {
    const body = html.slice(m.index + m[0].length, html.indexOf(`</${m[1]}>`, m.index));
    for (const id of body.matchAll(/id="([^"]+)"/g)) ok(I18n.HTML[m[2]].includes(`id="${id[1]}"`), `${m[2]} の英語に id="${id[1]}" がない`);
  }
  console.log(`  キー ${used.size} 個  OK`);
}

// 英語で起動した世界
{
  const ctx = {
    console, Math, Number, String, Array, Object, Boolean, Symbol, JSON, Date, Error, RegExp,
    Set, Map, WeakMap, WeakSet, Promise, Proxy, Reflect, isNaN, parseInt, parseFloat, performance,
    Uint8Array, Int8Array, Uint16Array, Int16Array, Int32Array, Uint32Array, Float64Array,
    require, process, __dirname, URLSearchParams: require('url').URLSearchParams,
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  run('tests/_env.js');
  ctx.navigator = { languages: ['en-US'], language: 'en-US' };
  ctx.document.querySelectorAll = () => [];   // 代わり物の document には無い（apply が使う）
  for (const f of ['i18n.js', 'sound.js', 'patterns.js', 'glyphs.js', 'solver.js', 'entitlement.js', 'rewards.js', 'script.js']) run(f);
  const E = (expr) => vm.runInContext(expr, ctx);
  ok(E('I18n.lang') === 'en', '英語の端末で英語にならない');
  ok(E('document.documentElement.lang') === 'en', 'html の lang が en にならない');
  const texts = E(`[
    ...ABILITIES.map((a) => a.name), ...Object.values(INFO).map((i) => i.text), ...FAMILIES.map((f) => f.label),
    ...DIFFS, ...TABS.map((t) => t.label),
    ...Glyphs.STYLES.flatMap((s) => [s.name, s.note, ...s.legend]),
    ...TUTORIAL_STAGES.map((t) => t.text),
  ]`);
  for (const t of texts) ok(!JA.test(t), `英語に日本語が残る: ${t}`);
  const share = E(`dailyShareText({ key: '2026-10-29', moves: 9, stars: 3, par: { cost: 9, optimal: true }, hint: true, goal: [0, 1, 2, 3], w: 2 })`);
  ok(share.startsWith('ABILITILE Daily 10/29\nSolved\n'), `共有の文: ${share}`);
  ok(E('movesEn(1)') === '1 move' && E('timesEn(2)') === 'twice' && E('monthDayEn(10, 29)') === 'Oct 29', '英語の数え方');
  console.log(`  英語の文言 ${texts.length} 個  OK`);
}

console.log(fail ? `失敗 ${fail} 件` : '通過');
