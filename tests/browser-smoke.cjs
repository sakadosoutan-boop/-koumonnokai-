// 実際のブラウザー（Chromium）で画面を開く確認。実行: npm run test:browser
// jsdom のテストでは分からない「画面の外に出たボタン」「縦書きの設問が潰れる」「3D の初期化失敗」を拾う。
// 縦書きの字送りはフォントの縦書き情報に依存するため、確認では縦書き対応の日本語フォントを指定する。
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const page = 'file://' + path.resolve(__dirname, '..', process.argv[2] || 'index.html');
const KEY = 'kanbun-dojo:koumon:v1';
const FONT = '.km-vt, .km-stem { font-family: "Noto Serif CJK JP", "Noto Sans CJK JP", "IPAGothic", serif !important; }';

async function open(browser, viewport, view, quality) {
  const p = await browser.newPage({ viewport });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(([key, view]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 2, view, classroom: true, instant: true }));
  }, [KEY, view]);
  if (quality) await p.addInitScript((q) => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => q === 'low' ? 2 : 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => q === 'low' ? 2 : 8 });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    if (q === 'high') {
      // Headless Windows exposes a touch event property on desktop contexts.
      // Emulate a non-touch desktop so this test exercises the actual high LOD.
      let proto = window;
      while (proto) { if (Object.prototype.hasOwnProperty.call(proto, 'ontouchstart')) delete proto.ontouchstart; proto = Object.getPrototypeOf(proto); }
    }
  }, quality);
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
  assert.notEqual(await p.evaluate(() => window.Koumon._mode()), 'gen', name + ': 本文の余白を押すと進む');
  // 本編（第一幕「鴻門に謝す」）の漢文つきの読解へ
  await p.evaluate(() => window.Koumon._go('c2-14'));
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
  await p.click('[data-intro="cutnext"]');
  await p.click('.km-drama-notes');
  assert.ok(await p.isVisible('.km-intro-copy h2'), name + ': 「解説を読む」で解説');
  // 解説の図の欄：上（年表）が切れず、下（凡例）までスクロールで届く
  for (let i = 0; i < 7; i++) {
    await p.evaluate((i) => { document.querySelector(`[data-intro="step"][data-step="${i}"]`).click(); document.querySelector('[data-intro="view"][data-view="notes"]').click(); }, i);
    const fit = await p.evaluate(() => {
      const v = document.querySelector('.km-intro-visual'), vr = v.getBoundingClientRect();
      const top = document.querySelector('.km-timeline').getBoundingClientRect().top >= vr.top - 1;
      v.scrollTop = v.scrollHeight;
      const bottom = document.querySelector('.km-map-legend').getBoundingClientRect().bottom <= v.getBoundingClientRect().bottom + 1;
      v.scrollTop = 0; return top && bottom;
    });
    assert.ok(fit, name + ': 導入の場面 ' + (i + 1) + ' の図が切れずに見られる');
  }
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
  // 終章「雒陽南宮」：高祖は御座の段（高さ0.6）の上に座り、段にめり込まない
  await p.evaluate(() => window.Koumon._go('c9'));
  await p.waitForFunction(() => window.KoumonStage3D.S.stageId === 'nangong' && !window.KoumonStage3D.S.building && window.KoumonStage3D.S.cast.ko, null, { timeout: 120000 });
  const ko = await p.evaluate(() => window.KoumonStage3D.S.cast.ko.position.y);
  assert.ok(ko > 0.75, '3D: 高祖が御座の榻（天面0.76）の上に座っている（y=' + ko + '）');
  assert.deepEqual(errors, [], '3D: ページのエラー');
  await p.close();
  console.log('ok 3D stage');
}

// Issue 35: real story scenes, real GPU assets and saved responsive evidence.
// Optional GU_ZHUI_ONLY=1 runs this regression alone; normal test:browser includes it.
async function guZhui(browser) {
  const out = path.resolve(process.env.GU_ZHUI_SCREENSHOTS || path.join(__dirname, '../model-preview-output/issue35-browser'));
  fs.mkdirSync(out, { recursive: true });
  const evidence = [];
  for (const [name, viewport, quality] of [
    ['pc', { width: 1440, height: 900 }, 'high'],
    ['phone-portrait', { width: 390, height: 844 }, 'low'],
    ['phone-landscape', { width: 932, height: 430 }, 'low']
  ]) {
    const { p, errors } = await open(browser, viewport, '3d', quality);
    if (!(await p.evaluate(() => document.querySelector('#km').classList.contains('km-3d')))) {
      console.log('skip Gu/Zhui: WebGL が使えない環境'); await p.close(); return;
    }
    await p.click('[data-km="new"]');
    await until(p, () => window.Koumon._mode() === 'say', null, 20);
    assert.equal(await p.evaluate(() => KoumonStage3D.quality()), quality, name + ': intended runtime LOD');
    async function scene(stage, castId) {
      await p.evaluate(([stage, castId]) => {
        const match = Object.entries(Koumon._nodes()).find(([, v]) => v.n.t === 'scene' && v.n.stage === stage && (!castId || (v.n.cast || []).includes(castId)));
        if (!match) throw Error('Story scene missing: ' + stage);
        Koumon._go(match[0]);
      }, [stage, castId]);
      await p.waitForFunction(([stage, castId]) => {
        const S = KoumonStage3D.S;
        return S.stageId === stage && !S.building && (!castId || S.cast[castId]) && (stage === 'tent' || S.horse && S.horse.parent === S.scene);
      }, [stage, castId], { timeout: 120000 });
      await p.waitForTimeout(2300);
      const layout = await p.evaluate(() => {
        const S = KoumonStage3D.S, r = S.cv.getBoundingClientRect();
        return { width: r.width, height: r.height, visibleHeight: Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)), horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, triangles: S.renderer.info.render.triangles };
      });
      assert.ok(layout.width > 250 && layout.visibleHeight > 80 && layout.triangles > 1000, name + ': visible rendered ' + stage);
      assert.equal(layout.horizontalOverflow, false, name + ': no horizontal page overflow');
      await p.screenshot({ path: path.join(out, name + '-' + stage + '.png') });
      return layout;
    }
    const tent = await scene('tent', 'gu');
    const female = await p.evaluate(() => {
      const f = KoumonStage3D.S.cast.gu;
      return { asset: !!f.getObjectByName('asset-head-gu'), gender: KM_HEAD_ASSETS.cast.gu.gender, mouth: Array.from(f.userData.rig.mouthContact) };
    });
    assert.equal(female.asset, true, name + ': Gu uses the female head asset');
    assert.equal(female.gender, 'female');
    assert.ok(female.mouth.length === 3 && female.mouth.every(Number.isFinite), 'female mouth anchor is available');
    if (name === 'pc') {
      for (const [view, yaw] of [['front', 0], ['three-quarter', 35], ['side', 90]]) {
        await p.evaluate(yaw => {
          const G = KoumonStage3D, S = G.S, T = THREE, f = S.cast.gu;
          G.stop(); S.reduced = true; S.to = null; S.from = null; f.updateMatrixWorld(true);
          const target = f.userData.rig.headPiv.getWorldPosition(new T.Vector3()); target.y += .065;
          const angle = yaw * Math.PI / 180;
          const offset = new T.Vector3(Math.sin(angle), .07, Math.cos(angle)).applyQuaternion(f.getWorldQuaternion(new T.Quaternion())).multiplyScalar(.9);
          S.cam.pos.copy(target).add(offset); S.cam.tgt.copy(target); G.renderOnce();
        }, yaw);
        await p.screenshot({ path: path.join(out, 'pc-tent-gu-' + view + '.png') });
      }
      await p.evaluate(() => { KoumonStage3D.S.reduced = false; KoumonStage3D.start(); });
    }
    const ukou = await scene('ukou', 'tei');
    assert.deepEqual(await p.evaluate(() => { const h = KoumonStage3D.S.horse; return [h.getObjectByName('horse-draped-reins').visible, h.getObjectByName('horse-ridden-reins').visible]; }), [true, false], name + ': riderless reins drape onto the saddle');
    const hooves = await p.evaluate(() => {
      const h = KoumonStage3D.S.horse; h.updateMatrixWorld(true);
      return h.userData.hooves.map(hoof => new THREE.Box3().setFromObject(hoof).min.y);
    });
    assert.ok(hooves.every(y => Math.abs(y) < .008), name + ': Ukou horse remains grounded');
    const road = await scene('road', 'hai');
    assert.deepEqual(await p.evaluate(() => { const h = KoumonStage3D.S.horse; return [h.getObjectByName('horse-draped-reins').visible, h.getObjectByName('horse-ridden-reins').visible]; }), [false, true], name + ': riding reins meet the hand targets');
    const grips = await p.evaluate(() => {
      const S = KoumonStage3D.S, f = S.cast.hai, h = S.horse, T = THREE;
      f.updateMatrixWorld(true); h.updateMatrixWorld(true);
      return ['L', 'R'].map(side => {
        const hand = f.userData.rig.arms[side].hand.children[0];
        const grip = hand.localToWorld(new T.Vector3().fromArray(hand.userData.gripCenter));
        const target = h.localToWorld(new T.Vector3().fromArray(h.userData.reinGrips[side])); target.y += h.userData.riderBob;
        return grip.distanceTo(target);
      });
    });
    assert.ok(grips.every(d => d < .0005), name + ': riding hands hold the animated reins');
    assert.deepEqual(errors, [], name + ': Gu/Zhui page errors');
    evidence.push({ name, viewport, quality, tent, ukou, road, hoofGroundY: hooves, reinGripError: grips });
    await p.close();
    console.log('ok Gu/Zhui', name, quality);
  }
  fs.writeFileSync(path.join(out, 'validation.json'), JSON.stringify(evidence, null, 2) + '\n');
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  try {
    if (!process.env.GU_ZHUI_ONLY) {
    await story(browser, 'PC 1440×800', { width: 1440, height: 800 });
    await story(browser, 'スマホ 390×844', { width: 390, height: 844 });
    await story(browser, 'タブレット 1024×768', { width: 1024, height: 768 });
    await story(browser, 'スマホ横 932×430', { width: 932, height: 430 });
    if (!process.env.SKIP_3D) await stage3d(browser);
    }
    if (!process.env.SKIP_3D) await guZhui(browser);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
