// ---- 効果音 ----
// 音源ファイルは持たず、Web Audio API で都度合成する。
// file:// から開いても鳴り、読み込み待ちもない。
//
// AudioContext はユーザー操作より前には作らない（ブラウザの自動再生制限のため）。
// AudioContext が無い環境（テストなど）では、すべて何もしない。
const Sfx = (() => {
  const KEY = 'glyphshift.sound';
  let ctx = null;
  let on = true;

  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'off') on = false;
  } catch (e) { /* localStorage が使えない環境では既定のまま */ }

  const Ctor = typeof AudioContext !== 'undefined' ? AudioContext
    : typeof webkitAudioContext !== 'undefined' ? webkitAudioContext
    : null;

  // 音の種類はゲームの効果音として 'ambient'（Safari 16.4 以降）。
  // 'playback' だと音楽プレーヤー扱いになり、鳴るたびにダイナミックアイランドに音の印が出て、
  // ほかのアプリの曲も止まる（2026-10-30 オーナーの指摘で変えた）。'ambient' はマナーモードでは鳴らない。
  function setAudioSession() {
    try {
      if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'ambient';
    } catch (e) { /* 対応していない */ }
  }
  setAudioSession();

  // 鳴らす前に毎回、使える状態か確かめる。iPhone では裏に回る・電話・Siri などで
  // 'suspended' や 'interrupted' になり、そのままだと音が出ない（読み直すまで鳴らなかった）。
  // 戻せなければ作り直す。押した操作の中で呼ばれるので、再開も作り直しも許される。
  function ready() {
    if (!on || !Ctor) return null;
    if (ctx && ctx.state === 'closed') ctx = null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state !== 'running') {
      const c = ctx;
      try {
        const p = c.resume();
        if (p && typeof p.catch === 'function') p.catch(() => { if (ctx === c) { try { c.close(); } catch (e) { /* 閉じられなくてよい */ } ctx = null; } });
      } catch (e) { ctx = null; }
    }
    return ctx;
  }
  // 裏に回るときは止めておき、次に鳴らすときに再開する（iPhone で、戻ったあと無音のまま動き続けるのを防ぐ）
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* 止められなくてよい */ } }
    });
  }

  // 出力の手前に、音量をそろえて割れを防ぐコンプレッサーを 1 つ置く（作り直した ctx ごとに作る）。
  let chain = null;
  function out(c) {
    if (!chain || chain.c !== c) {
      const master = c.createGain();
      master.gain.value = 0.9;
      let tail = master;
      if (c.createDynamicsCompressor) {
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 6;
        comp.attack.value = 0.003;
        comp.release.value = 0.2;
        master.connect(comp);
        tail = comp;
      }
      tail.connect(c.destination);
      chain = { c, node: master, noise: null };
    }
    return chain.node;
  }
  // 白色雑音（2 秒ぶんを使い回す）
  function noiseBuf(c) {
    out(c);
    if (!chain.noise) {
      const n = Math.floor(c.sampleRate * 2);
      const b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      chain.noise = b;
    }
    return chain.noise;
  }

  // 丸い音をひとつ。bend は終わりの周波数の倍率。波形は主に正弦波で、倍音を少しだけ足す。
  function blip(freq, { dur = 0.1, type = 'sine', gain = 0.11, bend = 1, delay = 0, attack = 0.006 } = {}) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * bend), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out(c));
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  // 雑音をバンドパスに通した短い破裂。拍手の 1 粒や、ぽこっの頭に使う。
  function puff(freq, { dur = 0.03, gain = 0.1, q = 1.2, delay = 0, type = 'bandpass' } = {}) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuf(c);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out(c));
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  // 拍手。ばらばらの間隔の破裂をたくさん重ね、密度と音量が 1 本の山を描いて消える。
  function applause(delay, len, peak) {
    const n = Math.round(len * 55);
    for (let k = 0; k < n; k++) {
      const x = Math.random();                      // 0..1 の位置
      const env = Math.pow(Math.sin(Math.PI * Math.pow(x, 0.6)), 1.2);   // 早めに立ち上がり、ゆっくり消える
      if (Math.random() > env * 0.9 + 0.1) continue;
      puff(1200 + Math.random() * 2600, {
        dur: 0.015 + Math.random() * 0.03, q: 0.8 + Math.random() * 1.2,
        gain: peak * (0.25 + Math.random() * 0.75) * (0.3 + env * 0.7),
        delay: delay + x * len,
      });
    }
  }

  // 歓声。ゆるく揺れる低めの雑音を「わー」と膨らませる。
  function cheer(delay, len, peak) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuf(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(950, t + len * 0.4);
    f.frequency.linearRampToValueAtTime(700, t + len);
    const lfo = c.createOscillator();               // 周波数をゆるく揺らす
    const lg = c.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.value = 60;
    lfo.connect(lg).connect(f.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + len * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(out(c));
    src.start(t, Math.random());
    lfo.start(t);
    src.stop(t + len + 0.05);
    lfo.stop(t + len + 0.05);
  }

  // ブロックごとに違う音程にする。重なっても濁らないようペンタトニックから選ぶ。
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];

  return {
    get enabled() { return on; },

    set(v) {
      on = !!v;
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, on ? 'on' : 'off'); }
      catch (e) { /* 保存できなくても動作は変えない */ }
      if (on) {
        blip(NOTES[2], { dur: 0.09, gain: 0.07, bend: 0.9 });
        blip(NOTES[4], { dur: 0.12, gain: 0.07, bend: 0.95, delay: 0.07 });
      }
    },

    // 発動音「ぽこっ」。高めから素早く下がる短い正弦波に、ごく短い雑音の頭。逆回りは少し低くて長め。
    move(ability, dir) {
      const f = NOTES[ability % NOTES.length] * 0.5;
      if (dir < 0) {
        blip(f * 0.8, { dur: 0.13, gain: 0.2, bend: 0.5, attack: 0.004 });
        puff(500, { dur: 0.012, gain: 0.05, q: 0.9 });
      } else {
        blip(f, { dur: 0.1, gain: 0.2, bend: 0.55, attack: 0.004 });
        blip(f * 2, { dur: 0.04, gain: 0.04, bend: 0.6, attack: 0.002 });
        puff(900, { dur: 0.012, gain: 0.05, q: 0.9 });
      }
    },

    // 使えないマスを押したとき。丸い低い「ぼふっ」
    blocked() {
      blip(180, { dur: 0.12, gain: 0.14, bend: 0.55 });
      puff(300, { dur: 0.05, gain: 0.04, q: 0.7 });
    },

    // ヒント。ぽこっと同じ丸さの、上がる 2 音
    hint() {
      blip(1174.66, { dur: 0.07, gain: 0.07 });
      blip(1567.98, { dur: 0.1, gain: 0.06, delay: 0.07 });
    },

    // ベスト更新。完成の音のあとに、高い音をきらっと重ねる
    best() {
      [1318.51, 1567.98, 2093.0].forEach((f, k) => {
        blip(f, { dur: 0.25, gain: 0.07, delay: 0.5 + k * 0.08 });
        blip(f * 2, { dur: 0.12, gain: 0.015, delay: 0.5 + k * 0.08 });
      });
    },

    // 完成。「とぅるととん！」の上がるジングルに、歓声と拍手を重ねる。
    solved() {
      // とぅ・る・と・とーん（ド ミ ソ ソ ド↑）
      const seq = [[523.25, 0, 0.09], [659.25, 0.08, 0.09], [783.99, 0.16, 0.09], [783.99, 0.27, 0.09], [1046.50, 0.38, 0.5]];
      seq.forEach(([f, d, dur], k) => {
        const last = k === seq.length - 1;
        blip(f, { dur, gain: last ? 0.13 : 0.1, type: 'triangle', delay: d, bend: last ? 1 : 1.02 });
        blip(f * 2, { dur: dur * 0.8, gain: last ? 0.03 : 0.02, delay: d });
      });
      cheer(0.38, 1.4, 0.2);
      applause(0.4, 1.5, 0.14);
    },
  };
})();
