// ---- 画面の言葉（日本語・英語） ----
// 言語は起動したときに 1 回だけ決める。切り替えたら読み込み直す（途中で混ざらないように）。
//   1. URL の ?lang=en / ?lang=ja（確かめる用）
//   2. 設定で選んだもの（glyphshift.lang）
//   3. 端末の言語。日本語なら日本語、それ以外は英語
//
// script.js などの文言は I18n.L('日本語', 'English') でその場に並べて書く。
// index.html の文言は日本語をそのまま書き、英語はここの HTML に置く。
// 要素に data-i18n="キー" を付けると中身（innerHTML）を、data-i18n-aria="キー" を付けると
// aria-label（title があれば title も）を、data-i18n-ph="キー" を付けると placeholder を英語に替える。
const I18n = (() => {
  const KEY = 'glyphshift.lang';
  const LANGS = ['ja', 'en'];

  function detect() {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (LANGS.includes(q)) return q;
    } catch (e) { /* location が無い場所（テスト）では次へ */ }
    try {
      const saved = localStorage.getItem(KEY);
      if (LANGS.includes(saved)) return saved;
    } catch (e) { /* 保存が読めなければ端末の言語 */ }
    try {
      const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
      return String(list[0] || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
    } catch (e) { return 'ja'; }
  }

  const lang = detect();
  const L = (ja, en) => (lang === 'en' ? en : ja);

  const HTML = {
    pageTitle: 'ABILITILE — A Puzzle of Tiles with Abilities',
    home: 'Back to home',
    menuOpen: 'Open how to play and settings',
    setupTitle: 'Board settings',
    close: 'Close',
    custom: 'Custom<span class="lock-tag" id="customLock" hidden>Full version</span>',
    customNote: 'Make the board a rectangle and choose the blocks yourself',
    size: 'Size',
    sizeAria: 'Board size',
    sideA: 'Side',
    sideAAria: 'Side length',
    sideB: 'Other side',
    sideBAria: 'Other side length',
    useBlocks: 'Blocks',
    difficulty: 'Difficulty',
    seedPh: 'Random if empty',
    seedNote: 'Enter the same SEED to get the same board again.',
    create: 'Create with these settings',
    panelTitle: 'How to play &amp; settings',
    panelTabs: 'Switch view',
    rules: `<li>The glyph is the tile's <strong>ability</strong>. Press it to trigger it. The ability moves along with the tile.</li>
        <li>The tile you press stays put. Only the cells around it move.</li>
        <li><strong>Long-press</strong> (or right-click) a rotation to turn it <strong>the other way</strong>.</li>
        <li>The board doesn't wrap around. A tile <strong>can't be used</strong> where its effect would go off the board.</li>
        <li>Match the <strong>goal pattern</strong> to clear. Tiles with the same glyph are interchangeable.</li>`,
    tutorialAgain: 'Replay the tutorial',
    glyphLegendSum: 'How to read the glyphs',
    glyphLabel: 'Glyphs',
    glyphAria: 'Glyph style',
    glyphNote: 'Draws the same blocks in a different style. Switches right away; the board stays as it is.',
    sound: 'Sound',
    soundNote: 'Short sounds when you press, match and complete',
    langLabel: 'Language',
    catch: 'A puzzle where each glyph is an ability. Press a tile to trigger it.',
    start: 'Start',
    howto: 'How to play',
    install: 'Install app',
    share: 'Share',
    credit: 'An app by <a href="/">T.OF...</a> · <a href="https://t-of.github.io/contact/">Contact</a>',
    h1t: 'The glyph is the ability',
    h1p: 'Press a tile to trigger its glyph: the <strong>cells around it</strong> move. The tile you pressed stays put.',
    h1cap: 'The middle tile, “rotate the 4 sides clockwise”, has been pressed',
    h2t: 'Abilities move with their tiles',
    h2p: 'A tile that gets moved keeps its ability. Press the same spot again and something different happens.',
    h3t: 'Long-press to reverse',
    h3p: '<strong>Long-press</strong> (or right-click) to turn a rotation the other way. The board doesn\'t wrap, so a tile can\'t be used where its effect would go off the board.',
    h4t: 'Match the goal pattern',
    h4p: 'Arrange the colors like the “Goal” on the play screen to clear. Any tile with the same glyph will do.',
    h5t: 'Pick a stage',
    h5p: 'Stages on the home screen are <strong>board size × difficulty</strong> (harder means more scrambling moves and more kinds of blocks). Tap a card to start; each card shows how many times you\'ve cleared it. Boards you left halfway say “Continue”. Stuck? Use “Hint” and “Solution”.',
    gotIt: 'Got it',
    lockTitle: 'Available in the full version',
    lockPrice: '¥500 · one-time purchase',
    lockList: `<li>All 13 blocks</li>
      <li>6×6 Normal &amp; Hard, 7×7 and 8×8 boards</li>
      <li>Custom boards (up to 10×10)</li>
      <li>No ads</li>`,
    lockNote: 'Everything above unlocks as soon as you buy. Payment is made on Apple\'s purchase screen, and refunds follow Apple\'s rules.',
    lockStatus: 'Available in the iPhone app.',
    lockBuy: 'Buy (in the iPhone app)',
    lockRestore: 'Restore purchase (in the iPhone app)',
    lockRewardNote: 'Watch an ad to play <span id="lockRewardWhat">this stage</span> once.',
    lockReward: 'Watch an ad to play once',
    privacy: 'Privacy Policy',
    stages: 'Stages',
    homeCustom: 'Make a custom board',
    skip: 'Skip',
    goal: 'Goal',
    goalAria: 'Goal pattern',
    shareResult: 'Share result',
    hintAria: 'Show the next block to press',
    hint: 'Hint',
    solveAria: 'Show the solution (solve automatically)',
    solve: 'Solution',
    newAria: 'Make a new board with the same settings',
    newBoard: 'New board',
    goalCard: 'Goal pattern',
    confirmTitle: 'Solve automatically',
    confirmText: 'The board will move until it matches the goal.<br>You won\'t be able to solve this board yourself.',
    cancel: 'Cancel',
    confirmYes: 'Solve',
    transport: 'Solution playback',
    stepBack: 'Back one move',
    pause: 'Pause',
    stepNext: 'Forward one move',
    autoText: 'Solving…',
    quit: 'Stop',
  };

  // index.html の data-i18n* を英語に替える。日本語のときは何もしない（HTML がそのまま日本語）
  function apply(root) {
    document.documentElement.lang = lang;
    if (lang === 'ja') return;
    root = root || document;
    document.title = HTML.pageTitle;
    for (const el of root.querySelectorAll('[data-i18n]')) {
      const s = HTML[el.dataset.i18n];
      if (s !== undefined) el.innerHTML = s;
    }
    for (const el of root.querySelectorAll('[data-i18n-aria]')) {
      const s = HTML[el.dataset.i18nAria];
      if (s === undefined) continue;
      el.setAttribute('aria-label', s);
      if (el.title) el.title = s;
    }
    for (const el of root.querySelectorAll('[data-i18n-ph]')) {
      const s = HTML[el.dataset.i18nPh];
      if (s !== undefined) el.placeholder = s;
    }
  }

  // 設定で選んだ言語を覚えて読み込み直す
  function set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    try { localStorage.setItem(KEY, next); } catch (e) { /* 覚えられなくても、この読み込みでは切り替える */ }
    try {
      const u = new URL(location.href);
      u.searchParams.delete('lang');
      location.replace(u.toString());
    } catch (e) { location.reload(); }
  }

  return { lang, L, HTML, apply, set, LANGS };
})();
