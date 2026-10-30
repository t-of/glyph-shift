// tools/stagebench.js の出力（<dir>/s<大きさ>d<難しさ>.jsonl）を表にまとめる。
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const med = (xs) => { const y = [...xs].sort((p, q) => p - q); return y.length ? y[Math.floor(y.length / 2)] : '-'; };
const NAMES = ['やさしい', 'ふつう', 'むずかしい'];
console.log('盤  難しさ    混ぜた手数  種類  見つかった手数（中央値 / 最小〜最大）  ヒントで揃う  3 手動かしてから');
for (const s of [3, 4, 5, 6, 7, 8]) for (const d of [0, 1, 2]) {
  const f = path.join(dir, `s${s}d${d}.jsonl`);
  if (!fs.existsSync(f)) continue;
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
  if (!rows.length) continue;
  const found = rows.map((r) => r.found);
  console.log(`${s}×${s} ${NAMES[d].padEnd(5, '　')} ${String(med(rows.map((r) => r.scramble))).padStart(6)} ${String(med(rows.map((r) => r.types))).padStart(8)}  ${String(med(found)).padStart(6)} / ${Math.min(...found)}〜${Math.max(...found)}  ${rows.filter((r) => r.walk).length}/${rows.length}  ${rows.filter((r) => r.walk3).length}/${rows.length}  動かない柄あり ${rows.filter((r) => r.blank).length}`);
}
