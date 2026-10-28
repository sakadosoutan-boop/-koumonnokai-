// 実際のブラウザー（Chromium）で画面を開く確認。実行: npm run test:browser
// jsdom のテストでは分からない「画面の外に出たボタン」「縦書きの設問が潰れる」「3D の初期化失敗」を拾う。
// 縦書きの字送りはフォントの縦書き情報に依存するため、確認では縦書き対応の日本語フォントを指定する。
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const page = 'file://' + path.resolve(__dirname, '..', process.argv[2] || 'index.html');
const KEY = 'kanbun-dojo:koumon:v1';
const FONT = '.km-vt, .km-stem { font-family: "Noto Serif CJK JP", "Noto Sans CJK JP", "IPAGothic", serif !important; }';

async function open(browser, viewport, view) {
  const p = await browser.newPage({ viewport });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(([key, view]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 2, view, classroom: true, instant: true }));
  }, [KEY, view]);
  await p.goto(page);
  await p.addStyleTag({ content: FONT });
  await p.waitForFunction(() => window.Koumon && window.Koumon._mode() === 'title');
  return { p, errors };
}
const inView = (p, selector) => p.$eval(selector, (e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
async function until(p, fn, arg, guard = 60) {
  for (let i = 0; i < guard; i++) {
    if (await p.evaluate(fn, arg)) return;
    // 台詞は「次へ」、章題は札、途中の決断は最初の選択肢で進める
    await p.evaluate(() => {
      const visible = (s) => { const e = document.querySelector(s); return e && e.offsetParent ? e : null; };
      const b = visible('.km-next') || visible('.km-opts .km-opt:not([disabled])');
      if (b) b.click(); else if (window.Koumon._mode() === 'card') document.querySelector('#km-card').click();
    });
    await p.waitForTimeout(150);
  }
  throw new Error('did not reach: ' + fn);
}

async function story(browser, name, viewport) {
  const { p, errors } = await open(browser, viewport, '2d');
  await p.click('[data-km="new"]');
  await until(p, () => window.Koumon._mode() === 'gen');
  assert.ok(await inView(p, '[data-km="gennext"]'), name + ': 原文の段の「次へ」が画面内にある');
  await p.click('.km-yaku');
  await p.waitForFunction(() => window.Koumon._mode() === 'ask');
  const stem = await p.$eval('.km-stem', (e) => e.getBoundingClientRect().height);
  assert.ok(stem > 60, name + ': 設問の漢文が縦に並ぶ（高さ ' + Math.round(stem) + 'px）');
  const wrong = await p.evaluate(() => { const n = window.Koumon._nodes()[window.Koumon._state().node].n; return n.o.findIndex((o) => !o.ok); });
  await p.click('[data-km="pick"][data-i="' + wrong + '"]');
  assert.ok(await p.isVisible('.km-fb-retry'), name + ': 授業モードの読み直し');
  const right = await p.evaluate(() => window.Koumon._nodes()[window.Koumon._state().node].n.o.findIndex((o) => o.ok));
  await p.click('[data-km="pick"][data-i="' + right + '"]');
  await p.waitForFunction(() => window.Koumon._mode() === 'feedback');
  assert.ok(await inView(p, '[data-km="fbnext"]'), name + ': 解説の「次へ」が画面内にある');
  await p.click('[data-km="quit"]');
  await p.click('[data-km="intro"]');
  assert.ok(await p.isVisible('.km-drama-card'), name + ': 導入の紙芝居');
  assert.ok(await inView(p, '[data-intro="cutnext"]'), name + ': 紙芝居の「次へ」が画面内にある');
  for (let i = 0; i < 4; i++) await p.click('[data-intro="cutnext"]');
  assert.ok(await p.isVisible('.km-intro-copy h2'), name + ': 紙芝居のあとに解説');
  await p.click('[data-intro="exit"]');
  await p.click('[data-km="record"]');
  assert.match(await p.inputValue('.km-record'), /読み直し帳/);
  assert.deepEqual(errors, [], name + ': ページのエラー');
  await p.close();
  console.log('ok', name);
}

async function stage3d(browser) {
  const { p, errors } = await open(browser, { width: 800, height: 600 }, '3d');
  const is3d = await p.evaluate(() => document.querySelector('#km').classList.contains('km-3d'));
  if (!is3d) { console.log('skip 3D: WebGL が使えない環境'); await p.close(); return; }
  await p.click('[data-km="new"]');
  await until(p, () => window.Koumon._mode() === 'say', null, 20);
  await p.waitForTimeout(1500);
  assert.deepEqual(errors, [], '3D: ページのエラー');
  await p.close();
  console.log('ok 3D stage');
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  try {
    await story(browser, 'PC 1440×800', { width: 1440, height: 800 });
    await story(browser, 'スマホ 390×844', { width: 390, height: 844 });
    if (!process.env.SKIP_3D) await stage3d(browser);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
