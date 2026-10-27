/* 楚漢の章 —— 物語の進行・画面・保存・小さな遊び・音
 *
 * 画面の作りは寝殿造り3D探訪の再現モード「徒然草」にならう。
 *   全画面の舞台の絵／上下の黒帯／上端の札（作品・題・段・目次・絵を見る・音・✕）／
 *   下端の漆に金縁の本文パネル（和紙に縦組みの本文＋現代語訳＋注）／場面転換の暗転・白転。
 * そこに RPG の要素を足す。
 *   命（読み違えで減る）・項王の怒気・范増の殺気・策（張良に問うヒント）・持ち物・結末帳・原文帳。
 *
 * 記録は漢文道場の本体（kanbun-dojo:v1）とは別のキーに置く。
 * 本体へは「読んだ字数」と「解答数」、物語の完走（finishSession）だけを渡す。
 */
(function () {
  'use strict';

  var KEY = 'kanbun-dojo:koumon:v1';
  var K = null, ST = null;
  var NODES = {}, ORDER = [];
  var meta = null, st = null;
  var $root = null, el = {};
  var mode = '', typing = null, cur = null, onExit = null, timerId = null, cardTimer = null, standalone = false;
  var clockState = null, modalFocus = null, modalStack = [], sceneEpoch = 0;
  var aiSources = ['g02', 'g08', 'g09', 'g10'];

  /* ============================ 記録 ============================ */
  function blankMeta() {
    return { v: 2, save: null, endings: {}, gen: {}, cleared: {}, sound: false, plays: 0, best: null, view: '',
      classroom: true, projection: false, instant: true, meters: true, reflection: {}, missed: {}, introStep: 0 };
  }
  function loadMeta() {
    meta = blankMeta();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') Object.keys(meta).forEach(function (k) {
          if (k === 'save' || k === 'best') { if (p[k] && typeof p[k] === 'object') meta[k] = p[k]; }
          else if (p[k] !== undefined && typeof p[k] === typeof meta[k]) meta[k] = p[k];
        });
      }
    } catch (e) { /* 壊れた記録は使わない */ }
    if (meta.save && (!meta.save.node || !NODES[meta.save.node])) meta.save = null;
    ['endings', 'gen', 'cleared', 'missed'].forEach(function (k) { if (!meta[k] || typeof meta[k] !== 'object' || Array.isArray(meta[k])) meta[k] = {}; });
    Object.keys(meta.missed).forEach(function (id) { if (!NODES[id] || NODES[id].n.k !== 'read') delete meta.missed[id]; });
    meta.v = 2;
    if (!meta.reflection || typeof meta.reflection !== 'object' || Array.isArray(meta.reflection)) meta.reflection = {};
    if (meta.save) meta.save = hydrateState(meta.save);
  }
  function saveMeta() {
    try { localStorage.setItem(KEY, JSON.stringify(meta)); return true; }
    catch (e) { if (window.dispatchEvent && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('save-error')); return false; }
  }

  function freshState(chapterId) {
    var s = { node: '', ch: chapterId || 'c0', life: 3, maxLife: 3, ikari: 40, satsu: 40, saku: 3, flags: {}, items: [],
      streak: 0, q: 0, ok: 0, hints: 0, picks: [], log: [], cp: null, rewinds: [], hinted: {}, phase: null };
    var idx = chapIndex(s.ch);
    // 途中の章から始めるときは、それまでの場面を史記どおりに選んだものとする
    if (idx >= 2) { s.flags.kyodai = true; s.flags.honest = true; }
    if (idx >= 3) { s.flags.mushou = true; s.flags.meters = true; s.ikari = 10; s.satsu = 45; }
    if (idx >= 6) { s.ikari = 0; }
    return s;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hydrateState(saved) {
    var at = saved && NODES[saved.node];
    if (!at) return null;
    var state = freshState(at.ch);
    Object.keys(state).forEach(function (key) {
      if (saved[key] !== undefined && saved[key] !== null && typeof saved[key] === typeof state[key]) state[key] = saved[key];
    });
    state.node = saved.node; state.ch = at.ch;
    ['flags', 'hinted'].forEach(function (key) { if (!state[key] || Array.isArray(state[key])) state[key] = {}; });
    ['items', 'picks', 'log'].forEach(function (key) { if (!Array.isArray(state[key])) state[key] = []; });
    state.items = state.items.filter(function (id) { return !!K.items[id]; });
    state.log = state.log.filter(function (line) { return Array.isArray(line); });
    state.picks = state.picks.filter(function (pick) { return pick && typeof pick === 'object'; });
    ['life', 'maxLife', 'ikari', 'satsu', 'saku', 'streak', 'q', 'ok', 'hints'].forEach(function (key) {
      if (!Number.isFinite(state[key]) || state[key] < 0) state[key] = freshState(at.ch)[key];
    });
    state.maxLife = Math.min(3, Math.max(1, state.maxLife)); state.life = Math.min(state.life, state.maxLife);
    state.remainingMs = Number.isFinite(saved.remainingMs) ? Math.max(0, saved.remainingMs) : null;
    state.genView = saved.genView === 'haku' ? 'haku' : 'yomi';
    var phase = saved.phase;
    if (phase && phase.node === state.node &&
      ((phase.kind === 'feedback' && at.n.k === 'read' && at.n.o[phase.choice]) ||
       (phase.kind === 'retry' && at.n.k === 'read' && Array.isArray(phase.wrong) && phase.wrong.length && phase.wrong.every(function (i) { return at.n.o[i] && !at.n.o[i].ok; })) ||
       (phase.kind === 'react' && NODES[phase.after] && typeof phase.text === 'string'))) state.phase = phase;
    else state.phase = null;
    state.game = saved.game && saved.game.node === state.node ? saved.game : null;
    state.rewinds = Array.isArray(saved.rewinds) ? saved.rewinds.filter(function (point) {
      return point && NODES[point.node] && point.snap && point.snap.node === point.node;
    }).slice(-64) : [];
    if (state.cp && (!NODES[state.cp.node] || !state.cp.snap)) state.cp = null;
    return state;
  }

  /* ============================ 台本の索引 ============================ */
  function chapIndex(id) { for (var i = 0; i < K.chapters.length; i++) if (K.chapters[i].id === id) return i; return 0; }
  function chap(id) { return K.chapters[chapIndex(id)]; }
  function buildIndex() {
    NODES = {}; ORDER = [];
    K.chapters.forEach(function (c) {
      var arr = K.script[c.id] || [];
      arr.forEach(function (n, i) {
        if (!n.t) n.t = n.go && !n.x ? 'go' : 'say';
        if (!n.id) n.id = c.id + '-' + i;
        NODES[n.id] = { n: n, ch: c.id, i: i };
        ORDER.push(n.id);
      });
    });
    K.chapters.forEach(function (c) {
      var arr = K.script[c.id] || [];
      arr.forEach(function (n, i) {
        if (n.next || n.t === 'end' || n.t === 'go' || n.t === 'if') return;
        if (i + 1 < arr.length) n._next = arr[i + 1].id;
        else if (c.next) n._next = chap(c.next).start;
      });
    });
  }
  function nextOf(n) { return n.next || n._next || null; }

  /* ============================ 表示の小道具 ============================ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function kanbunHTML(s) {
    var toks = window.Learning ? window.Learning.tokens(String(s || '')) : String(s || '').split('').map(function (c) { return { c: c }; });
    return toks.map(function (t) {
      return t.mark ? '<span class="kc">' + esc(t.c) + '<i class="mark">' + esc(t.mark) + '</i></span>' + esc(t.okuri || '') : esc(t.c) + esc(t.okuri || '');
    }).join('');
  }
  function kanjiCount(s) {
    var m = String(s || '').replace(/\^(一レ|上レ|甲レ|レ|一|二|三|四|上|中|下|甲|乙|丙)/g, '').match(/[㐀-䶿一-鿿]/g);
    return m ? m.length : 0;
  }
  function who(id) {
    if (!id) return null;
    if (id === 'you') {
      var nm = st && st.ch === 'c8' ? '項王' : st && st.ch === 'c9' ? '高祖' : '沛公';
      return { name: nm + '（心の声）', seal: '心', side: st && st.ch === 'c8' ? 'so' : 'han' };
    }
    return K.chars[id] || null;
  }
  function speakerHTML(id) {
    var c = who(id);
    if (!c) return '<div class="km-speaker narr">　</div>';
    var identity = id === 'you' ? (st && st.ch === 'c8' ? 'u' : 'hai') : id === 'ko' ? 'hai' : id;
    var classroom = window.KoumonClassroom;
    var p = classroom && classroom.people[identity];
    var portrait = classroom && classroom.portraitHTML ? classroom.portraitHTML(identity) : '';
    return '<div class="km-speaker' + (portrait ? ' km-speaker-portrait' : '') + '">' + portrait +
      '<span class="km-speaker-identity"><span class="km-speaker-name"><span class="km-seal km-' + c.side + '">' + esc(c.seal) + '</span><b>' + esc(c.name) + '</b></span>' +
      (p ? '<small>' + esc(p[0] + ' · ' + p[3]) + '</small>' : '') + '</span></div>';
  }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ============================ 音（合成） ============================ */
  var AC = null, amb = null;
  function ac() {
    if (!meta.sound) return null;
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { AC = new C(); } catch (e) { return null; }
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function noiseBuf(a, sec) {
    var b = a.createBuffer(1, Math.floor(a.sampleRate * sec), a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function env(a, node, t0, peak, att, dec) {
    var g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + dec);
    node.connect(g); g.connect(a.destination);
    return g;
  }
  function tone(a, type, f, t0, peak, att, dec, f2) {
    var o = a.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + att + dec);
    env(a, o, t0, peak, att, dec);
    o.start(t0); o.stop(t0 + att + dec + .05);
  }
  function noise(a, t0, peak, att, dec, ftype, freq, q) {
    var s = a.createBufferSource(); s.buffer = noiseBuf(a, att + dec + .05);
    var f = a.createBiquadFilter(); f.type = ftype || 'lowpass'; f.frequency.value = freq || 800; if (q) f.Q.value = q;
    s.connect(f); env(a, f, t0, peak, att, dec);
    s.start(t0);
  }
  function pluck(a, freq, t0, vol) {
    var sr = a.sampleRate, n = Math.round(sr / freq), len = Math.floor(sr * 2.2);
    var b = a.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(n);
    for (var i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
    for (i = 0; i < len; i++) { var j = i % n; var v = ring[j]; ring[j] = (v + ring[(j + 1) % n]) * .498; d[i] = v; }
    var s = a.createBufferSource(); s.buffer = b;
    var g = a.createGain(); g.gain.value = vol || .25;
    s.connect(g); g.connect(a.destination); s.start(t0);
  }
  var SFX = {
    drum: function (a, t) { tone(a, 'sine', 120, t, .7, .005, .7, 42); noise(a, t, .25, .003, .18, 'lowpass', 300); },
    clang: function (a, t) { [1240, 1870, 2960, 4100].forEach(function (f, i) { tone(a, i % 2 ? 'square' : 'triangle', f, t, .07, .002, .7 - i * .1); }); noise(a, t, .2, .001, .06, 'highpass', 3000); },
    hoof: function (a, t) { for (var i = 0; i < 6; i++) noise(a, t + i * .17 + (i % 2) * .04, .35, .002, .07, 'lowpass', 260); },
    thud: function (a, t) { tone(a, 'sine', 80, t, .7, .003, .35, 40); noise(a, t, .4, .002, .15, 'lowpass', 500); },
    chime: function (a, t) { tone(a, 'sine', 1568, t, .2, .002, 1.6); tone(a, 'sine', 2350, t, .08, .002, 1.1); },
    shatter: function (a, t) { for (var i = 0; i < 9; i++) { noise(a, t + i * .025, .25, .001, .05 + Math.random() * .1, 'highpass', 2500 + Math.random() * 3000); } tone(a, 'sine', 2960, t, .12, .001, .9); },
    pluck: function (a, t) { [293.7, 349.2, 392, 440, 523.3].forEach(function (f, i) { pluck(a, f, t + i * .32, .22); }); },
    song: function (a, t) {
      // 遠くから聞こえる楚の歌（五音音階の旋律を、こもった声のように）
      var mel = [392, 440, 523.3, 440, 392, 349.2, 392, 293.7, 349.2, 392];
      mel.forEach(function (f, i) {
        var o = a.createOscillator(), o2 = a.createOscillator(); o.type = 'sawtooth'; o2.type = 'sine';
        o.frequency.value = f; o2.frequency.value = f * 1.003;
        var lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
        o.connect(lp); o2.connect(lp);
        var g = env(a, lp, t + i * .55, .05, .18, .5);
        void g;
        o.start(t + i * .55); o2.start(t + i * .55); o.stop(t + i * .55 + .8); o2.stop(t + i * .55 + .8);
      });
    }
  };
  function sfx(name) {
    var a = ac(); if (!a || !SFX[name]) return;
    try { SFX[name](a, a.currentTime + .02); } catch (e) { /* 鳴らせなくても進行は止めない */ }
  }
  function ambience(kind) {
    stopAmbience();
    var a = ac(); if (!a || !kind) return;
    try {
      var s = a.createBufferSource(); s.buffer = noiseBuf(a, 4); s.loop = true;
      var f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'in' ? 300 : 500; f.Q.value = .6;
      var g = a.createGain(); g.gain.value = kind === 'in' ? .015 : .035;
      var lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = .08; lg.gain.value = kind === 'in' ? 60 : 260;
      lfo.connect(lg); lg.connect(f.frequency);
      s.connect(f); f.connect(g); g.connect(a.destination);
      s.start(); lfo.start();
      amb = { s: s, lfo: lfo, g: g };
    } catch (e) { amb = null; }
  }
  function stopAmbience() {
    if (!amb) return;
    try { amb.g.gain.setTargetAtTime(0, AC.currentTime, .3); amb.s.stop(AC.currentTime + 1); amb.lfo.stop(AC.currentTime + 1); } catch (e) { /* 既に止まっている */ }
    amb = null;
  }

  /* ============================ 画面の骨組み ============================ */
  function build() {
    $root = document.createElement('div');
    $root.id = 'km';
    $root.className = 'km';
    $root.setAttribute('role', 'dialog');
    $root.setAttribute('aria-label', K.title + '　' + K.subtitle);
    $root.innerHTML =
      '<canvas class="km-cv" aria-hidden="true"></canvas>' +
      '<div class="km-ov" aria-hidden="true"></div>' +
      '<div class="km-bar km-bar-t"></div><div class="km-bar km-bar-b"></div>' +
      '<div class="km-fade"></div>' +
      '<div class="km-caption" aria-live="polite"></div>' +
      '<div class="km-top">' +
        '<div class="km-chip"><span class="km-k">作</span>史記</div>' +
        '<div class="km-chip km-title-chip" id="km-title">楚漢の章</div>' +
        '<button class="km-chip km-btn-chip" data-km="menu">目次</button>' +
        '<button class="km-chip km-btn-chip" data-km="book">原文帳</button>' +
        '<button class="km-chip km-btn-chip" data-km="characters">人物</button>' +
        '<button class="km-chip km-btn-chip" data-km="settings">授業設定</button>' +
        '<button class="km-chip km-btn-chip" data-km="log">履歴</button>' +
        '<button class="km-chip km-btn-chip" data-km="view" title="本文を隠して場面の絵だけを見る（H キー）">絵を見る</button>' +
        '<button class="km-chip km-btn-chip" data-km="sound" id="km-sound" aria-pressed="false">音 切</button>' +
      '</div>' +
      '<button class="km-quit" data-km="quit" title="楚漢の章を閉じる" aria-label="閉じる">✕</button>' +
      '<div class="km-status" id="km-status"></div>' +
      '<div class="km-cap"><div class="km-panel" id="km-panel"></div></div>' +
      '<div class="km-card" id="km-card"></div>' +
      '<div class="km-modal" id="km-modal" hidden></div>';
    document.body.appendChild($root);
    el.cv = $root.querySelector('.km-cv');
    el.ov = $root.querySelector('.km-ov');
    el.fade = $root.querySelector('.km-fade');
    el.caption = $root.querySelector('.km-caption');
    el.panel = $root.querySelector('#km-panel');
    el.status = $root.querySelector('#km-status');
    el.card = $root.querySelector('#km-card');
    el.modal = $root.querySelector('#km-modal');
    el.title = $root.querySelector('#km-title');
    el.sound = $root.querySelector('#km-sound');
    mountStage();
    $root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseTimer(); else resumeTimer(); });
    window.addEventListener('pagehide', function () { if (st && mode !== 'end') persist(); });
    window.addEventListener('save-error', function () {
      var warning = $root.querySelector('.km-save-warning');
      if (!warning) { warning = document.createElement('div'); warning.className = 'km-save-warning'; warning.setAttribute('role', 'status'); $root.appendChild(warning); }
      warning.textContent = 'この端末では記録を保存できません。ページを閉じると進み具合は失われます。';
    });
  }
  function onResize() { if ($root && ST) ST.resize(); }

  /** 舞台の描き方を選ぶ。3D が使えて、影絵（軽量）を選んでいなければ 3D */
  function mountStage() {
    var want3d = meta.view !== '2d' && window.KoumonStage3D && window.KoumonStage3D.supported();
    if (ST && ST.stop) { ST.stop(); if (ST.clearLabels) ST.clearLabels(); if (ST.hideBubble) ST.hideBubble(); }
    // 一枚の canvas は 2D と WebGL を兼ねられないので、描き方を変えるたびに作り直す
    var fresh = document.createElement('canvas');
    fresh.className = 'km-cv'; fresh.setAttribute('aria-hidden', 'true');
    el.cv.parentNode.replaceChild(fresh, el.cv);
    el.cv = fresh;
    if (want3d && window.KoumonStage3D.mount(el.cv, el.ov)) { ST = window.KoumonStage3D; }
    else {
      if (want3d) { fresh = document.createElement('canvas'); fresh.className = 'km-cv'; el.cv.parentNode.replaceChild(fresh, el.cv); el.cv = fresh; }
      ST = window.KoumonStage; ST.mount(el.cv, el.ov);
    }
    $root.classList.toggle('km-3d', !!ST.is3D);
  }

  function open(opts) {
    K = window.KOUMON;
    if (!K || !window.KoumonStage) return;
    onExit = opts && opts.onExit;
    standalone = !!(opts && opts.standalone);
    buildIndex();
    loadMeta();
    if (!$root) build();
    $root.hidden = false;
    $root.classList.toggle('km-standalone', standalone);
    ST.resize();
    document.documentElement.classList.add('km-open');
    updateSoundChip();
    ST.start();
    titleScreen();
    startFromHash();
  }
  function close() {
    if (st && mode !== 'end') persist();
    cancelScene();
    stopAmbience();
    closeModal(false);
    if (window.KoumonClassroom) window.KoumonClassroom.hide();
    if (ST) ST.stop();
    if ($root) $root.hidden = true;
    document.documentElement.classList.remove('km-open');
    if (onExit) onExit();
  }

  function persist() {
    if (st && clockState) st.remainingMs = timerRemaining();
    if (st && st.node) meta.save = clone(st);
    saveMeta();
  }

  /* ============================ 表紙 ============================ */
  function titleScreen() {
    cancelScene(); closeModal(false); stopAmbience();
    if (window.KoumonClassroom) window.KoumonClassroom.hide();
    st = null; cur = null; mode = 'title';
    applyPreferences();
    ST.stop();
    $root.classList.add('km-at-title');
    $root.classList.remove('km-view');
    el.status.innerHTML = '';
    el.caption.textContent = '';
    el.title.textContent = K.title;
    var endN = Object.keys(meta.endings).length, endAll = Object.keys(K.endings).length;
    var genN = Object.keys(meta.gen).length, genAll = Object.keys(K.genbun).length;
    var save = meta.save;
    el.panel.innerHTML =
      '<div class="km-titlecard">' +
        '<div class="km-t-src">' + esc(K.src) + '</div>' +
        '<h2 class="km-t-h">' + esc(K.title) + '</h2>' +
        '<div class="km-t-sub">' + esc(K.subtitle) + '</div>' +
        '<p class="km-t-lead">あなたは沛公・劉邦。四十万の楚軍が待つ鴻門の宴へ、百余騎で向かう。言葉を一つ読み違えれば、命はない。</p>' +
        '<div class="km-t-btns">' +
          (save ? '<button class="km-btn gold" data-km="continue">続きから<small>' + esc(chap(save.ch).no + '　' + chap(save.ch).title) + '</small></button>' : '') +
          '<button class="km-btn' + (save ? '' : ' gold') + '" data-km="new">はじめから</button>' +
          '<button class="km-btn" data-km="menu">章を選ぶ</button>' +
          '<button class="km-btn" data-km="book">原文帳<small>' + genN + ' / ' + genAll + ' 段</small></button>' +
          '<button class="km-btn" data-km="endings">結末帳<small>' + endN + ' / ' + endAll + '</small></button>' +
          '<button class="km-btn" data-km="howto">遊び方</button>' +
        '</div>' +
        '<div class="km-viewsel" role="group" aria-label="表示">' +
          '<span>表示</span>' +
          '<button class="km-tab' + (ST.is3D ? ' on' : '') + '" data-km="view3d" aria-pressed="' + !!ST.is3D + '"' + (window.KoumonStage3D && window.KoumonStage3D.supported() ? '' : ' disabled') + '>3D</button>' +
          '<button class="km-tab' + (ST.is3D ? '' : ' on') + '" data-km="view2d" aria-pressed="' + !ST.is3D + '">影絵（軽量）</button>' +
        '</div>' +
      '</div>';
    if (window.KoumonClassroom) el.panel.innerHTML = window.KoumonClassroom.homeHTML(meta, !!ST.is3D);
    mode = 'title';
  }

  function cancelScene() {
    sceneEpoch++; stopTimer(); clearTimeout(cardTimer); showCard.fin = null;
    if (ST && ST.cancelPendingScene) ST.cancelPendingScene();
    if (typing) { clearInterval(typing.id); typing = null; }
    if (el.card) el.card.classList.remove('on');
    if (el.fade) el.fade.classList.remove('show');
  }
  function applyPreferences() {
    $root.classList.toggle('km-classroom', meta.classroom);
    $root.classList.toggle('km-projection', meta.projection);
  }
  function intro() {
    if (st && mode !== 'end') persist();
    cancelScene(); closeModal(false); mode = 'intro'; ST.stop();
    window.KoumonClassroom.open($root, meta.introStep, {
      step: function (i) { meta.introStep = i; saveMeta(); },
      done: function () { window.KoumonClassroom.hide(); ST.start(); startNew('c0'); },
      exit: function () { ST.start(); titleScreen(); }
    });
  }

  function startNew(chId) {
    cancelScene(); closeModal(false);
    ST.start();
    $root.classList.remove('km-at-title');
    st = freshState(chId || 'c0');
    meta.plays++;
    if (window.Store) window.Store.mark();
    go(chap(st.ch).start);
  }
  function continueSave() {
    if (!meta.save) return startNew('c0');
    $root.classList.remove('km-at-title');
    st = clone(meta.save);
    ST.start();
    var n = NODES[st.node];
    // 途中の場面へ戻るときは、その章の舞台を描き直してから続ける
    var sc = lastScene(st.node);
    cancelScene(); var epoch = sceneEpoch;
    if (sc && sc.n !== n.n) applyScene(sc.n, true).then(function () { if (epoch === sceneEpoch && st) go(st.node, true); });
    else go(st.node, true);
  }
  function lastScene(id) {
    var at = NODES[id]; if (!at) return null;
    var arr = K.script[at.ch];
    for (var i = at.i; i >= 0; i--) if (arr[i].t === 'scene') return NODES[arr[i].id];
    return null;
  }

  /* ============================ 進行 ============================ */
  function go(id, resuming) {
    cancelScene();
    if (!id || !NODES[id]) { titleScreen(); return; }
    var at = NODES[id], n = at.n;
    if (st.ch !== at.ch) {
      // 章が変わった：前の章を読み終えたことにする
      meta.cleared[st.ch] = true;
      st.ch = at.ch;
    }
    st.node = id;
    if (!resuming) { st.phase = null; st.remainingMs = null; st.game = null; }
    if (n.cp && !resuming) { st.node = id; st.cp = { node: id, snap: snapshot() }; }
    if ((n.t === 'ask' || n.t === 'game') && !st.phase && !st.game) {
      var previous = st.rewinds[st.rewinds.length - 1];
      if (!previous || previous.node !== id) {
        st.rewinds.push({ node: id, snap: snapshot() });
        if (st.rewinds.length > 64) st.rewinds.shift();
      }
    }
    cur = n;
    if (n.t !== 'end') persist();
    el.title.textContent = chap(st.ch).no + '　' + chap(st.ch).title;
    renderStatus();
    if (resuming && st.phase && st.phase.node === id) {
      if (st.phase.kind === 'feedback') { doAsk(n, true); return judgeRead(n, n.o[st.phase.choice], true); }
      if (st.phase.kind === 'retry') { doAsk(n, true); return markRetry(n); }
      if (st.phase.kind === 'react') return renderReaction(st.phase);
    }
    switch (n.t) {
      case 'scene': return doScene(n);
      case 'say': return doSay(n);
      case 'gen': return doGen(n);
      case 'ask': return doAsk(n);
      case 'if': return go(test(n) ? n.go : n.el);
      case 'set': apply(n); return go(nextOf(n));
      case 'go': return go(n.go);
      case 'game': return doGame(n);
      case 'end': return doEnd(n.e);
    }
  }
  function snapshot() {
    // 復帰点の中へ履歴や復帰点を入れ子にしない。
    var s = {};
    // 台詞の履歴は復帰点ごとに複製せず、選び直したあとも続けて残す。
    Object.keys(st).forEach(function (key) { if (key !== 'cp' && key !== 'rewinds' && key !== 'log') s[key] = st[key]; });
    s.cp = null; s.rewinds = []; s.log = [];
    return clone(s);
  }
  function retryPoint(eid) {
    var points = st.rewinds, wanted = null, fallback = null;
    function gameNode(kind) { return ORDER.filter(function (id) { return NODES[id].n.t === 'game' && NODES[id].n.g === kind; })[0]; }
    if (eid === 'B7') { fallback = gameNode('gift'); wanted = function (p) { return p.node === fallback; }; }
    else if (eid === 'B2' && !st.flags.kyodai) { fallback = 'c1-haku'; wanted = function (p) { return p.node === fallback; }; }
    else if (eid === 'B2' && st.satsu >= 100) { fallback = 'c2-7'; wanted = function (p) { return p.snap.satsu < 100; }; }
    else if (eid === 'B3') { fallback = 'c2-7'; wanted = function (p) { return p.snap.ikari < 100; }; }
    else if (eid === 'B8') { fallback = st.node; wanted = function (p) { return p.node === st.node; }; }
    for (var i = points.length - 1; i >= 0; i--) {
      if (!wanted || wanted(points[i])) {
        var point = clone(points[i]); point.snap.rewinds = clone(points.slice(0, i));
        return cleanRetryPoint(point);
      }
    }
    // 履歴を持たない旧版の記録でも、原因となった選択をやり直せる位置へ戻す。
    if (fallback) {
      var state = freshState(NODES[fallback].ch); state.node = fallback;
      if (eid === 'B7') state.items = ['heki', 'to'];
      return cleanRetryPoint({ node: fallback, snap: state });
    }
    return cleanRetryPoint(st.cp || { node: st.node, snap: snapshot() });
  }
  function cleanRetryPoint(point) {
    point = clone(point);
    point.snap.node = point.node;
    point.snap.phase = null; point.snap.game = null; point.snap.remainingMs = null;
    if (point.snap.life <= 0) point.snap.life = 1;
    return point;
  }
  function test(n) {
    if (n.f) return !!st.flags[n.f];
    if (n.ikari !== undefined) return st.ikari >= n.ikari;
    if (n.satsu !== undefined) return st.satsu >= n.satsu;
    return false;
  }
  function apply(o) {
    if (!o) return;
    var fx = o.fx && typeof o.fx === 'object' ? o.fx : null;
    if (fx) {
      if (fx.ikari) st.ikari = Math.max(0, Math.min(120, st.ikari + fx.ikari));
      if (fx.satsu) st.satsu = Math.max(0, Math.min(120, st.satsu + fx.satsu));
      if (fx.saku) st.saku = Math.max(0, Math.min(5, st.saku + fx.saku));
      if (fx.life) st.life = Math.max(0, Math.min(st.maxLife, st.life + fx.life));
    }
    if (o.set) Object.keys(o.set).forEach(function (k) { st.flags[k] = o.set[k]; });
    if (o.give) o.give.forEach(function (it) { if (st.items.indexOf(it) === -1) st.items.push(it); });
    if (o.take) st.items = st.items.filter(function (it) { return o.take.indexOf(it) === -1; });
    renderStatus();
  }
  function logLine(w, x) {
    st.log.push([w || '', x]);
    if (st.log.length > 120) st.log.shift();
  }

  /* ---------- 舞台 ---------- */
  function applyScene(n, quiet) {
    var epoch = sceneEpoch;
    var indoor = /tent|feast|nangong/.test(n.stage);
    if (meta.sound) ambience(indoor ? 'in' : 'out');
    var poses = n.pose || {};
    // 途中の台詞へ復帰するとき、すでに終えた入場をもう一度始めない。
    if (quiet && poses.kai === 'enter') { poses = Object.assign({}, poses, { kai: 'glare' }); }
    return Promise.resolve(ST.setScene(n.stage, n.light, n.cast || [], poses)).then(function () {
      if (epoch !== sceneEpoch) return;
      ST.focus('wide');
      if (n.stage === 'gate' && ST.prewarm) ST.prewarm(['u', 'haku', 'hai']);
      if (!quiet && n.sfx) sfx(n.sfx);
    });
  }
  function fadeOver(kind, fn) {
    var epoch = sceneEpoch;
    var f = el.fade;
    f.className = 'km-fade ' + (kind === 'white' ? 'white' : '') + ' show';
    void f.offsetWidth;
    setTimeout(function () {
      if (epoch !== sceneEpoch) return;
      fn();
      f.classList.remove('show');
    }, reduced() ? 10 : 360);
  }
  function doScene(n) {
    var epoch = sceneEpoch;
    if (n.set) apply(n);
    var after = function () {
      applyScene(n).then(function () {
        if (cur !== n || epoch !== sceneEpoch || !st) return;
        if (n.caption) showCaption(n.caption);
        if (n.card) showCard(chap(st.ch), function () { go(nextOf(n)); });
        else go(nextOf(n));
      });
    };
    el.panel.innerHTML = '';
    mode = 'scene';
    if (n.fade) fadeOver(n.fade, after); else after();
  }
  function showCaption(text) {
    el.caption.textContent = text;
    el.caption.classList.add('on');
    clearTimeout(showCaption.t);
    showCaption.t = setTimeout(function () { el.caption.classList.remove('on'); }, 4200);
  }
  function showCard(c, done) {
    mode = 'card';
    el.card.innerHTML = '<div class="km-card-in"><div class="km-card-no">' + esc(c.no) + '</div><div class="km-card-t">' + esc(c.title) + '</div><div class="km-card-sub">' + esc(c.sub) + '</div><div class="km-card-tap">画面をタップして始める</div></div>';
    el.card.classList.add('on');
    var finished = false;
    function fin() {
      if (finished) return; finished = true;
      clearTimeout(cardTimer);
      el.card.classList.remove('on');
      done();
    }
    showCard.fin = fin;
    if (!meta.classroom) cardTimer = setTimeout(fin, reduced() ? 1600 : 3600);
  }

  /* ---------- 台詞 ---------- */
  function doSay(n) {
    mode = 'say';
    if (n.pose) Object.keys(n.pose).forEach(function (k) { ST.setPose(k, n.pose[k]); });
    if (n.at) ST.focus(n.at);
    if (ST.speaker) ST.speaker(n.w && n.w !== 'you' ? n.w : null);
    if (typeof n.fx === 'string') ST.effect(n.fx);
    var impactSession = st;
    if (n.sfx && !(n.pose && n.pose.ei === 'down' && ST.whenBreachImpact && ST.whenBreachImpact(function () {
      if (st === impactSession && !$root.hidden && mode !== 'title' && ST.S.stageId === 'gate') sfx(n.sfx);
    }))) sfx(n.sfx);
    if (n.b && n.w && n.w !== 'you') ST.showBubble(n.w, { anger: '！！', hush: '……', think: '（……）' }[n.b] || '……', n.b);
    else if (n.b === 'think' && n.at && n.at !== 'wide') ST.showBubble(n.at, '（……）', 'think');
    else ST.hideBubble();
    logLine(n.w, n.x);
    el.panel.innerHTML = speakerHTML(n.w) + '<span class="km-evidence-label">本文をもとにした再構成 · 創作の台詞を含む</span>' +
      '<div class="km-text' + (n.w ? '' : ' narr') + (n.w === 'you' ? ' inner' : '') + '" id="km-text"></div>' +
      '<div class="km-nav"><span class="km-hint-key">タップ／Enter で次へ</span><button class="km-btn gold km-next" data-km="next">次へ ▶</button></div>';
    typeText(document.getElementById('km-text'), n.x);
  }
  function typeText(node, text) {
    if (typing) { clearInterval(typing.id); typing = null; }
    if (reduced() || meta.instant) { node.textContent = text; return; }
    var i = 0;
    node.textContent = '';
    typing = { node: node, text: text, id: setInterval(function () {
      i += 2;
      node.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typing.id); typing = null; }
    }, 28) };
  }
  function advance() {
    if (mode === 'card') { if (showCard.fin) showCard.fin(); return; }
    if (mode === 'say') {
      if (typing) { clearInterval(typing.id); typing.node.textContent = typing.text; typing = null; return; }
      ST.hideBubble();
      go(nextOf(cur));
    } else if (mode === 'react') {
      go(cur._after);
    } else if (mode === 'gen') {
      go(nextOf(cur));
    }
  }

  /* ---------- 原文の段 ---------- */
  function doGen(n) {
    mode = 'gen';
    ST.hideBubble();
    if (ST.speaker) ST.speaker(null);
    var g = K.genbun[n.g];
    var first = !meta.gen[n.g];
    if (first) {
      meta.gen[n.g] = true;
      saveMeta();
      if (window.Store && window.Store.addChars) window.Store.addChars(kanjiCount(g.hakubun));
    }
    renderGen(n.g, st.genView || 'yomi', first);
  }
  function genPaperHTML(g, view) {
    var body = view === 'haku' ? g.hakubun : g.yomi;
    if (g.poem) {
      // 詩の部分だけ句ごとの列にする
      return '<div class="km-vt km-paper-text">' + esc(body).replace(/／/g, '<br>') + '</div>';
    }
    return '<div class="km-vt km-paper-text">' + esc(body) + '</div>';
  }
  /** 教科書（古典探究）の本文か、物語のために補った段か */
  function tbTag(g) {
    if (g.tb === true) return '<span class="km-tb">教科書</span>';
    if (g.tb === 'part') return '<span class="km-tb part">一部 教科書</span>';
    return '<span class="km-tb extra">補</span>';
  }
  function renderGen(gid, view, first) {
    var g = K.genbun[gid];
    st.genView = view;
    el.panel.innerHTML =
      '<div class="km-gen-h"><span class="km-gen-tag">原文の段</span><b>' + esc(g.title) + '</b><span class="km-gen-src">' + esc(g.src) + '</span>' + tbTag(g) +
        (first ? '<span class="km-new">原文帳に綴じた</span>' : '') + '</div>' +
      '<div class="km-tabs" role="tablist">' +
        '<button role="tab" aria-selected="' + (view === 'yomi') + '" class="km-tab' + (view === 'yomi' ? ' on' : '') + '" data-km="genview" data-v="yomi" data-g="' + gid + '">書き下し文</button>' +
        '<button role="tab" aria-selected="' + (view === 'haku') + '" class="km-tab' + (view === 'haku' ? ' on' : '') + '" data-km="genview" data-v="haku" data-g="' + gid + '">白文</button>' +
      '</div>' +
      '<div class="km-paper" tabindex="0" aria-label="本文（縦書き。横にスクロールできます）">' + genPaperHTML(g, view) + '</div>' +
      '<div class="km-yaku-label">現代語訳</div>' +
      '<div class="km-yaku">' + esc(g.yaku) + '</div>' +
      '<div class="km-note">' + esc(g.note) + '</div>' +
      '<div class="km-nav km-nav-sticky"><span class="km-hint-key">本文は横にスクロールできます</span><button class="km-btn gold km-next" data-km="gennext">次へ ▶</button></div>';
  }

  /* ---------- 選択 ---------- */
  function doAsk(n, restoring) {
    mode = 'ask';
    ST.hideBubble();
    if (n.at) ST.focus(n.at); else if (n.w && n.w !== 'you') ST.focus(n.w);
    var opts = n.o.map(function (o, i) { return { o: o, i: i }; });
    if (n.k === 'read') opts = shuffle(opts, n.id);
    n._order = opts.map(function (x) { return x.i; });
    var canHint = n.k === 'read' && n.hint;
    el.panel.innerHTML =
      '<div class="km-ask-h">' + (n.k === 'read' ? '<span class="km-ask-tag read">読み解け</span>' : '<span class="km-ask-tag judge">決断</span>') +
        '<span class="km-ask-q">' + esc(n.q) + '</span></div>' +
      (n.stem ? '<div class="km-stem-wrap"><div class="km-vt km-stem">' + kanbunHTML(n.stem) + '</div></div>' : '') +
      (n.timer && !meta.classroom ? '<div class="km-timer" aria-label="決断の残り時間"><i id="km-timer-bar"></i></div>' : '') +
      '<div class="km-opts">' + opts.map(function (x, k) {
        return '<button class="km-opt" data-km="pick" data-i="' + x.i + '"><span class="km-opt-n">' + '一二三四'.charAt(k) + '</span><span>' + esc(x.o.x) + '</span></button>';
      }).join('') + '</div>' +
        '<div class="km-nav">' + (canHint ? '<button class="km-btn km-hint-btn" data-km="hint"' + (meta.classroom || st.saku > 0 || st.hinted[n.id] ? '' : ' disabled') + '>' + esc(hintWho()) + 'に問う<small>' + (meta.classroom ? '何度でも確認できます' : '策 残り ' + st.saku) + '</small></button>' : '<span></span>') +
        '<span class="km-hint-key km-key-hint">1〜' + opts.length + ' キーでも選べます</span></div>' +
      (canHint ? '<div class="km-hint" id="km-hint" hidden></div>' : '');
    if (st.hinted[n.id]) showHint(n);
    if (n.timer && !reduced() && !meta.classroom && !restoring) startTimer(n);
  }
  function hintWho() { return st.ch === 'c8' ? '虞' : st.ch === 'c9' ? '蕭何' : '子房（張良）'; }
  function shuffle(arr, seedStr) {
    var a = arr.slice(), seed = 0;
    String(seedStr + (st ? st.q : 0)).split('').forEach(function (c) { seed = (seed * 31 + c.charCodeAt(0)) >>> 0; });
    for (var i = a.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) >>> 0; var j = seed % (i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function startTimer(n) {
    clockState = { n: n, remaining: st.remainingMs == null ? n.timer * 1000 : st.remainingMs, started: null };
    resumeTimer();
  }
  function timerRemaining() { return clockState ? Math.max(0, clockState.remaining - (clockState.started == null ? 0 : Date.now() - clockState.started)) : null; }
  function pauseTimer() {
    if (!clockState) return;
    clockState.remaining = timerRemaining(); clockState.started = null;
    if (timerId) clearInterval(timerId); timerId = null;
    if (st) { st.remainingMs = clockState.remaining; persist(); }
  }
  function resumeTimer() {
    if (!clockState || timerId || meta.classroom || document.hidden || !el.modal.hidden || mode !== 'ask' || !st) return;
    var n = clockState.n, bar = document.getElementById('km-timer-bar');
    clockState.started = Date.now();
    timerId = setInterval(function () {
      if (!st || cur !== n || mode !== 'ask') { stopTimer(); return; }
      var remaining = timerRemaining();
      if (bar) bar.style.transform = 'scaleX(' + remaining / (n.timer * 1000) + ')';
      if (remaining <= 0) {
        stopTimer();
        if (n.timeout) { logLine('', '（動けなかった）'); go(n.timeout); }
      }
    }, 100);
  }
  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; clockState = null; }

  function useHint() {
    var n = cur;
    if (!n || n.t !== 'ask' || !n.hint || mode !== 'ask') return;
    if (!st.hinted[n.id]) {
      if (!meta.classroom && st.saku <= 0) return;
      if (!meta.classroom) st.saku--;
      st.hints++; st.hinted[n.id] = true;
    }
    renderStatus();
    showHint(n); persist();
  }
  function showHint(n) {
    var h = document.getElementById('km-hint');
    if (h) { h.hidden = false; h.innerHTML = speakerHTML(st.ch === 'c8' ? 'gu' : st.ch === 'c9' ? null : 'ryo') + '<p>' + esc(n.hint) + '</p>'; }
    var b = $root.querySelector('[data-km="hint"]'); if (b) b.textContent = 'ヒントをもう一度見る';
  }

  function pick(i) {
    var n = cur; if (!n || n.t !== 'ask' || mode !== 'ask') return;
    stopTimer();
    var o = n.o[i]; if (!o) return;
    if (n.k === 'read') return judgeRead(n, o);
    recordPick(n.q, o.x, n.o, o);
    logLine('you', o.x);
    apply(o);
    var to = o.go || nextOf(n);
    if (o.r) {
      st.phase = { node: n.id, kind: 'react', after: to, text: o.r, speaker: o.rw || null };
      logLine(o.rw || '', o.r);
      persist();
      return renderReaction(st.phase);
    }
    go(to);
  }

  /** 決断の記録。史記の道が一つに定まる問いだけ、史記の選択を添える。 */
  function recordPick(q, a, options, chosen) {
    var hist = options ? options.filter(function (x) { return x.ok; }) : [];
    var pick = { q: q, a: a, ch: st.ch };
    if (hist.length === 1 && hist.length < options.length) { pick.hist = hist[0].x; pick.same = chosen === hist[0]; }
    else if (options) pick.interp = true;
    st.picks.push(pick);
    if (st.picks.length > 40) st.picks.shift();
  }
  function noteMissed(n) {
    meta.missed[n.id] = (meta.missed[n.id] || 0) + 1;
    saveMeta();
  }

  function renderReaction(phase) {
    mode = 'react'; cur = { _after: phase.after };
    el.panel.innerHTML = speakerHTML(phase.speaker) + '<span class="km-evidence-label">ゲーム上の創作</span><div class="km-text">' + esc(phase.text) + '</div>' +
      '<div class="km-nav"><span></span><button class="km-btn gold km-next" data-km="next">次へ →</button></div>';
    el.panel.querySelector('.km-next').focus({ preventScroll: true });
  }
  /** 授業モードでは、最初の読み違いで答えを見せず、ヒントを添えてもう一度考えさせる。 */
  function retryRead(n, i) {
    st.phase = { node: n.id, kind: 'retry', wrong: [i] };
    noteMissed(n);
    markRetry(n);
    persist();
  }
  function markRetry(n) {
    mode = 'ask';
    st.phase.wrong.forEach(function (i) {
      var b = $root.querySelector('.km-opt[data-i="' + i + '"]');
      if (b) { b.disabled = true; b.classList.add('ng'); }
    });
    if (n.hint) showHint(n);
    var fb = document.createElement('div');
    fb.className = 'km-fb km-fb-retry';
    fb.setAttribute('role', 'status');
    fb.innerHTML = '<div class="km-fb-h">もう一度、読み直そう</div><p>' + (n.hint ? '下のヒントを手がかりに、' : '') + '残りの選択肢から選び直してください。</p>';
    var opts = $root.querySelector('.km-opts');
    if (opts) opts.parentNode.insertBefore(fb, opts.nextSibling);
    fb.scrollIntoView({ block: 'nearest' });
    var first = $root.querySelector('.km-opt:not([disabled])'); if (first) first.focus({ preventScroll: true });
  }
  function judgeRead(n, o, restoring) {
    var retried = !!(st.phase && st.phase.node === n.id && (st.phase.kind === 'retry' || st.phase.retried));
    if (!restoring && !o.ok && meta.classroom && !retried) return retryRead(n, n.o.indexOf(o));
    mode = 'feedback';
    var ok = !!o.ok, safe = meta.classroom || !!chap(st.ch).safe;
    var lifeNote = '';
    if (!restoring) {
    st.q++;
    // 読解率は一度目の読みで数える。読み直して正解したときは連続正解にも数えない。
    if (ok && !retried) { st.ok++; st.streak++; } else st.streak = 0;
    if (!ok && !retried) noteMissed(n);
    apply(o);
    if (!ok && !safe) {
      st.life = Math.max(0, st.life - 1);
      lifeNote = '<div class="km-life-note">読み違えた。命が一つ削られた。</div>';
    }
    if (ok && st.streak > 0 && st.streak % 3 === 0 && st.life < st.maxLife && !safe) {
      st.life++;
      lifeNote = '<div class="km-life-note up">三つ続けて読み解いた。命が一つ戻った。</div>';
    }
    if (window.Store && window.Store.record) window.Store.record(null, ok, kanjiCount(n.stem || ''));
    st.phase = { node: n.id, kind: 'feedback', choice: n.o.indexOf(o), lifeNote: lifeNote, retried: retried };
    } else { lifeNote = st.phase.lifeNote || ''; retried = !!st.phase.retried; }
    var oldRetry = $root.querySelector('.km-fb-retry'); if (oldRetry) oldRetry.parentNode.removeChild(oldRetry);
    renderStatus();
    var right = n.o.filter(function (x) { return x.ok; })[0];
    var kuho = n.kuho && window.KUHO ? window.KUHO.filter(function (k) { return k.id === n.kuho; })[0] : null;
    // 選んだ選択肢・正解に印をつける
    $root.querySelectorAll('.km-opt').forEach(function (b) {
      var bi = Number(b.getAttribute('data-i'));
      b.disabled = true;
      if (n.o[bi].ok) b.classList.add('ok');
      else if (n.o[bi] === o) b.classList.add('ng');
    });
    var fb = document.createElement('div');
    fb.className = 'km-fb ' + (ok ? 'ok' : 'ng');
    fb.innerHTML = '<div class="km-fb-h">' + (ok ? (retried ? '◯ 読み直して、読み解いた' : '◯ 読み解いた') : '✕ 読み違えた') + '</div>' +
      (ok ? '' : '<div class="km-fb-right">正しくは：' + esc(right ? right.x : '') + '</div>') +
      '<span class="km-evidence-label">読解の解説 · 本文の理解と解釈</span><p>' + esc(n.exp || '') + '</p>' +
      (kuho ? '<div class="km-kuho"><span class="km-kuho-tag">句法</span><b>' + esc(kuho.form) + '</b>　' + esc(kuho.read || '') + '<br><small>' + esc(kuho.mean || '') + '</small></div>' : '') +
      lifeNote +
      '<div class="km-nav km-nav-sticky"><span></span><button class="km-btn gold km-next" data-km="fbnext">次へ ▶</button></div>';
    var old = $root.querySelector('.km-hint-btn'); if (old) old.parentNode.parentNode.removeChild(old.parentNode);
    el.panel.appendChild(fb);
    fb.scrollIntoView({ block: 'nearest' });
    var nb = fb.querySelector('.km-next'); if (nb) nb.focus({ preventScroll: true });
    persist();
  }
  function afterFeedback() {
    if (!meta.classroom && st.life <= 0) return doEnd('B8');
    go(nextOf(cur));
  }

  /* ---------- 状態表示 ---------- */
  function renderStatus() {
    if (!st) { el.status.innerHTML = ''; return; }
    var safe = meta.classroom || chap(st.ch).safe;
    var hearts = '';
    for (var i = 0; i < st.maxLife; i++) hearts += '<i class="' + (i < st.life ? 'on' : '') + '"></i>';
    // 授業モードでは命に響かないが、言葉づかいの因果が見えるよう怒気・殺気は参考として示す。
    var meters = st.flags.meters && chapIndex(st.ch) <= 7 && (!safe || (meta.classroom && meta.meters));
    function meter(label, v, cls) {
      var p = Math.max(0, Math.min(100, v));
      return '<div class="km-meter ' + cls + (p >= 75 ? ' hot' : '') + '" title="' + label + ' ' + p + '"><span>' + label + '</span><b><i style="width:' + p + '%"></i></b></div>';
    }
    el.status.innerHTML =
      (safe ? '' : '<div class="km-life" aria-label="命 ' + st.life + '">' + '<span>命</span>' + hearts + '</div>') +
      (meters ? meter('項王の怒気', st.ikari, 'ikari') + meter('范増の殺気', st.satsu, 'satsu') : '') +
      (meta.classroom ? '<div class="km-study-badge">授業モード</div>' : '<div class="km-saku" title="策（ヒント）"><span>策</span>' + st.saku + '</div>') +
      (st.items.length ? '<div class="km-items">' + st.items.map(function (it) { var x = K.items[it]; return '<span title="' + esc(x.name) + '">' + esc(x.glyph) + '</span>'; }).join('') + '</div>' : '');
  }

  /* ============================ 小さな遊び ============================ */
  function doGame(n) {
    mode = 'game';
    ST.hideBubble();
    if (n.g === 'seat') return gameSeat(n);
    if (n.g === 'gift') return gameGift(n);
    if (n.g === 'route') return gameRoute(n);
    go(nextOf(n));
  }
  function modal(html, cls) {
    if (el.modal.hidden) modalFocus = document.activeElement;
    var className = 'km-modal ' + (cls || '');
    if (!el.modal.hidden && el.modal.className !== className) {
      var previous = modalStack.findIndex(function (frame) { return frame.className === className; });
      if (previous >= 0) modalStack = modalStack.slice(0, previous);
      else modalStack.push({ className: el.modal.className, content: el.modal.firstChild, focus: document.activeElement, scroll: el.modal.scrollTop });
    }
    pauseTimer();
    el.modal.className = className;
    el.modal.innerHTML = '<div class="km-mcard">' + html + '</div>';
    el.modal.hidden = false;
    el.modal.setAttribute('role', 'dialog'); el.modal.setAttribute('aria-modal', 'true');
    el.panel.inert = true; $root.querySelector('.km-top').inert = true;
    var f = el.modal.querySelector('button:not([disabled]),input,textarea,summary'); if (f) f.focus({ preventScroll: true });
  }
  function closeModal(resume) {
    el.modal.hidden = true; el.modal.innerHTML = ''; modalStack = [];
    el.panel.inert = false; $root.querySelector('.km-top').inert = false;
    if (resume !== false) { resumeTimer(); if (modalFocus && modalFocus.isConnected) modalFocus.focus({ preventScroll: true }); }
  }
  function dismissModal() {
    if (modalStack.length) {
      var frame = modalStack.pop();
      el.modal.className = frame.className; el.modal.replaceChildren(frame.content); el.modal.scrollTop = frame.scroll;
      var focus = frame.focus && frame.focus.isConnected ? frame.focus : el.modal.querySelector('button:not([disabled]),input,textarea,summary');
      if (focus) focus.focus({ preventScroll: true });
      return;
    }
    closeModal();
  }

  /* 座次図：人物の札を選んでから席を押す */
  var seatS = null;
  function gameSeat(n) {
    var G = K.games.seat;
    var saved = st.game && st.game.kind === 'seat' ? st.game : {};
    seatS = { place: saved.place || {}, sel: null, tries: saved.tries || 0, done: !!saved.done, message: saved.message || '', n: n };
    renderSeat(seatS.message, seatS.done);
  }
  function renderSeat(msg, done) {
    var G = K.games.seat;
    seatS.done = !!done; seatS.message = msg || '';
    st.game = { node: seatS.n.id, kind: 'seat', place: seatS.place, tries: seatS.tries, done: seatS.done, message: seatS.message }; persist();
    function seatHTML(s) {
      var here = Object.keys(seatS.place).filter(function (p) { return seatS.place[p] === s.id; });
      return '<button class="km-seat km-seat-' + s.id + '" data-km="seat" data-s="' + s.id + '"' + (done ? ' disabled' : '') + ' aria-label="' + esc(s.label) + '">' +
        '<span class="km-seat-l">' + esc(s.label) + '<small>' + esc(s.dir) + '・' + esc(s.rank) + '</small></span>' +
        '<span class="km-seat-p">' + here.map(function (p) { return '<span class="km-seal km-' + K.chars[p].side + '">' + esc(K.chars[p].seal) + '</span>'; }).join('') + '</span></button>';
    }
    var people = G.people.filter(function (p) { return !seatS.place[p]; });
    modal('<h3>' + esc(G.title) + '</h3><p class="km-m-lead">' + esc(G.lead) + '</p>' +
      '<div class="km-seatmap">' +
        '<div class="km-compass n">北</div><div class="km-compass s">南（入口）</div><div class="km-compass w">西</div><div class="km-compass e">東</div>' +
        G.seats.map(seatHTML).join('') +
        '<div class="km-seat-center">帳の中</div>' +
      '</div>' +
      '<div class="km-people">' + (people.length ? people.map(function (p) {
        return '<button class="km-person' + (seatS.sel === p ? ' on' : '') + '" data-km="person" data-p="' + p + '"><span class="km-seal km-' + K.chars[p].side + '">' + esc(K.chars[p].seal) + '</span>' + esc(K.chars[p].full) + '</button>';
      }).join('') : '<span class="km-m-lead">全員を席に着けた。</span>') + '</div>' +
      (msg ? '<div class="km-m-msg">' + msg + '</div>' : '') +
      '<div class="km-nav">' +
        (done ? '<span></span>' : '<button class="km-btn" data-km="seatreset">置き直す</button>') +
        (done ? '<button class="km-btn gold" data-km="seatdone">宴へ ▶</button>' : '<button class="km-btn gold" data-km="seatcheck"' + (people.length ? ' disabled' : '') + '>史記と照らす</button>') +
      '</div>', 'km-m-seat');
  }
  function seatCheck() {
    if (!seatS || seatS.done) return;
    var G = K.games.seat, wrong = [];
    seatS.tries++;
    G.seats.forEach(function (s) {
      s.ans.forEach(function (p) { if (seatS.place[p] !== s.id) wrong.push(p); });
    });
    if (window.Store && window.Store.record) window.Store.record(null, !wrong.length, 0);
    if (!wrong.length) {
      renderSeat('<b>史記のとおり。</b>' + esc(G.after), true);
      return;
    }
    var hint = '項王・項伯は「東嚮」、亜父は「南嚮」、沛公は「北嚮」、張良は「西嚮」。東を向いて座る席は、西側にある。';
    wrong.forEach(function (p) { delete seatS.place[p]; });
    renderSeat('<b>' + wrong.map(function (p) { return esc(K.chars[p].name); }).join('・') + '</b>の席が違う。' + esc(hint));
  }

  /* 献上品：品を選んでから相手を押す */
  var giftS = null;
  function gameGift(n) {
    giftS = { to: st.game && st.game.kind === 'gift' ? st.game.to || {} : {}, sel: null, n: n };
    renderGift();
  }
  function renderGift() {
    var G = K.games.gift;
    st.game = { node: giftS.n.id, kind: 'gift', to: giftS.to }; persist();
    var all = G.items.every(function (it) { return giftS.to[it.id]; });
    modal('<h3>' + esc(G.title) + '</h3><p class="km-m-lead">' + esc(G.lead) + '</p>' +
      '<div class="km-gifts">' + G.items.map(function (it) {
        return '<button class="km-gift' + (giftS.sel === it.id ? ' on' : '') + '" data-km="giftitem" data-it="' + it.id + '"><b>' + esc(it.name) + '</b><small>' + esc(it.desc) + '</small>' +
          (giftS.to[it.id] ? '<span class="km-gift-to">→ ' + esc(G.targets.filter(function (t) { return t.id === giftS.to[it.id]; })[0].name) + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="km-targets">' + G.targets.map(function (t) {
        return '<button class="km-target" data-km="gifttarget" data-t="' + t.id + '"' + (giftS.sel ? '' : ' disabled') + '><span class="km-seal km-so">' + esc(K.chars[t.id].seal) + '</span>' + esc(t.name) + 'に献じる</button>';
      }).join('') + '</div>' +
      '<div class="km-nav"><button class="km-btn" data-km="giftreset">選び直す</button><button class="km-btn gold" data-km="giftdone"' + (all ? '' : ' disabled') + '>張良に託す ▶</button></div>', 'km-m-gift');
  }
  function giftDone() {
    if (mode !== 'game' || !giftS) return;
    var G = K.games.gift;
    var ok = Object.keys(G.ans).every(function (k) { return giftS.to[k] === G.ans[k]; });
    st.flags.giftWrong = !ok;
    var giftText = function (to) { return G.items.map(function (it) { return it.name + '→' + (to[it.id] === 'u' ? '項王' : '亜父'); }).join('、'); };
    st.picks.push({ q: '献上の品', a: giftText(giftS.to), ch: st.ch, hist: giftText(G.ans), same: ok });
    if (st.picks.length > 40) st.picks.shift();
    apply({ take: ['heki', 'to'] });
    closeModal();
    var n = giftS.n;
    st.phase = { node: n.id, kind: 'react', after: nextOf(n), speaker: 'ryo', text: '謹んで諾す。――白璧一双と玉斗一双、確かにお預かりしました。' };
    renderReaction(st.phase);
    persist();
  }

  /* 逃げ道：三つの問いに順に答える。地図に道筋を描く */
  var routeS = null;
  function gameRoute(n) {
    var saved = st.game && st.game.kind === 'route' ? st.game : {};
    routeS = { step: saved.step || 0, bad: !!saved.bad, n: n, message: saved.message || '' };
    renderRoute(routeS.message);
  }
  function routeMap() {
    var s = routeS.step, ok = !routeS.bad;
    return '<svg class="km-map" viewBox="0 0 320 170" role="img" aria-label="鴻門から霸上への地図">' +
      '<path d="M40 120 Q120 60 200 90 T290 70" class="km-map-road' + (s >= 1 && !ok ? ' on' : '') + '"/>' +
      '<path d="M40 120 Q90 150 150 140 Q220 128 290 70" class="km-map-path' + (s >= 1 && ok ? ' on' : '') + '"/>' +
      '<path d="M110 160 L150 112 L176 128 L210 96 L250 160 Z" class="km-map-mt"/>' +
      '<circle cx="40" cy="120" r="6" class="km-map-pt so"/><text x="40" y="104">鴻門</text>' +
      '<circle cx="290" cy="70" r="6" class="km-map-pt han"/><text x="290" y="54">霸上</text>' +
      '<text x="182" y="158" class="km-map-s">驪山</text><text x="132" y="150" class="km-map-s">芷陽</text>' +
      '<text x="160" y="64" class="km-map-s">大道 四十里</text><text x="214" y="132" class="km-map-s">間道 二十里</text>' +
      '</svg>';
  }
  function renderRoute(msg) {
    var G = K.games.route, s = G.steps[routeS.step];
    st.game = { node: routeS.n.id, kind: 'route', step: routeS.step, bad: routeS.bad, message: msg || '' }; persist();
    modal('<h3>' + esc(G.title) + '</h3><p class="km-m-lead">' + esc(G.lead) + '</p>' + routeMap() +
      (msg ? '<div class="km-m-msg">' + msg + '</div>' : '') +
      (s ? '<div class="km-route-q"><b>' + (routeS.step + 1) + '／' + G.steps.length + '　' + esc(s.q) + '</b></div><div class="km-opts">' +
        s.o.map(function (o, i) { return '<button class="km-opt" data-km="routepick" data-i="' + i + '"><span class="km-opt-n">' + '一二'.charAt(i) + '</span><span>' + esc(o.x) + '</span></button>'; }).join('') + '</div>'
        : '<div class="km-nav"><span></span><button class="km-btn gold" data-km="routedone">駆ける ▶</button></div>'), 'km-m-route');
  }
  function routePick(i) {
    var G = K.games.route, s = routeS && G.steps[routeS.step], o = s && s.o[i];
    if (mode !== 'game' || !o) return;
    if (!o.ok) routeS.bad = true;
    recordPick(s.q, o.x, s.o, o);
    routeS.step++;
    renderRoute(esc(o.r));
  }
  function routeDone() {
    closeModal();
    var n = routeS.n;
    if (routeS.bad && n.el) return go(n.el);
    go(nextOf(n));
  }

  /* ============================ 結末 ============================ */
  function doEnd(eid) {
    stopTimer();
    mode = 'end';
    var E = K.endings[eid];
    if (E.kind === 'bad') st.cp = retryPoint(eid);
    var firstTime = !meta.endings[eid];
    meta.endings[eid] = true;
    if (eid === 'T1') { meta.cleared.c7 = true; for (var i = 0; i <= 7; i++) meta.cleared['c' + i] = true; }
    if (eid === 'T2') { meta.cleared.c8 = true; meta.cleared.c9 = true; }
    var rate = st.q ? Math.round(st.ok / st.q * 100) : 0;
    if (E.kind === 'true') {
      if (!meta.best || rate > meta.best.rate) meta.best = { rate: rate, q: st.q };
      if (window.Store && window.Store.finishSession) {
        var got = window.Store.finishSession(eid === 'T1' ? 'koumon' : 'koumon2', { xp: eid === 'T1' ? 80 + st.ok * 4 : 40 + st.ok * 4, score: rate });
        void got;
      }
    }
    var grade = rate >= 95 ? '子房の智' : rate >= 80 ? '樊噲の胆' : rate >= 60 ? '項伯の情' : '鯫生の言';
    var btns = [];
    if (E.kind === 'bad' && st.cp) {
      var retryNode = NODES[st.cp.node].n;
      var retryLabel = retryNode.q || (retryNode.t === 'game' && K.games[retryNode.g].title) || chap(NODES[st.cp.node].ch).title;
      btns.push('<button class="km-btn gold" data-km="retry">選び直す：' + esc(retryLabel) + '</button>');
    }
    if (E.unlock) btns.push('<button class="km-btn gold" data-km="part2">第二部「垓下」へ進む</button>');
    if (E.ai || eid === 'T1') btns.push('<button class="km-btn gold" data-km="ai">范増として考える（AI活動）</button>');
    if (missedIds().length) btns.push('<button class="km-btn" data-km="review">読み直し帳<small>' + missedIds().length + ' 問</small></button>');
    btns.push('<button class="km-btn" data-km="record">学習記録を書き出す</button>');
    btns.push('<button class="km-btn" data-km="endings">結末帳</button>');
    btns.push('<button class="km-btn" data-km="totitle">表紙へ</button>');
    if (E.kind === 'bad') sfx('drum'); else sfx('pluck');
    // 異聞の結末では、原因となった選択の前を続きとして保存する。
    if (E.kind === 'true') meta.save = null;
    else if (st.cp) { meta.save = clone(st.cp.snap); meta.save.cp = clone(st.cp); meta.save.node = st.cp.node; meta.save.log = clone(st.log); }
    saveMeta();
    modal('<div class="km-end ' + E.kind + '">' +
      '<div class="km-end-kind">' + (E.kind === 'true' ? '正史' : '異聞') + '　結末' + (firstTime ? '<span class="km-new">初めて見た</span>' : '') + '</div>' +
      '<h3 class="km-end-t">' + esc(E.title) + '</h3><div class="km-end-sub">' + esc(E.sub) + '</div>' +
      '<p class="km-end-text">' + esc(E.text) + '</p>' +
      '<div class="km-end-fact"><b>史記の記述と、このゲームの解釈</b>' + esc(E.fact) + '</div>' +
      (E.kind === 'true' ? '<div class="km-end-stats"><div><b>' + st.ok + ' / ' + st.q + '</b><span>読み解いた句</span></div><div><b>' + rate + '%</b><span>読解率</span></div><div><b>' + esc(grade) + '</b><span>評</span></div><div><b>' + st.hints + '</b><span>策を用いた</span></div></div>' : '') +
      routeHTML(st.picks, E.kind === 'true') +
      '<div class="km-end-btns">' + btns.join('') + '</div></div>', 'km-m-end');
  }
  /** あなたの道と史記の道を並べる。史記の道が一つに定まらない問いは「あなたの読み」として分ける。 */
  function routeHTML(picks, open) {
    var compared = picks.filter(function (p) { return p.hist; }), interp = picks.filter(function (p) { return p.interp; });
    var plain = picks.filter(function (p) { return !p.hist && !p.interp; });
    if (!compared.length && !interp.length && !plain.length) return '';
    var differ = compared.filter(function (p) { return !p.same; }).length;
    return '<details class="km-end-picks"' + (open ? ' open' : '') + '><summary>あなたの道と史記の道' +
      (compared.length ? '<small>' + (differ ? '史記と違う選択 ' + differ + ' / ' + compared.length : compared.length + ' の決断すべてが史記どおり') + '</small>' : '') + '</summary>' +
      (compared.length ? '<ol class="km-route-list">' + compared.map(function (p) {
        return '<li class="' + (p.same ? 'same' : 'differ') + '"><span>' + esc(p.q) + '</span>' +
          '<div><b>あなた</b>' + esc(p.a) + '</div>' +
          (p.same ? '<div class="km-route-mark">史記と同じ</div>' : '<div><b>史記</b>' + esc(p.hist) + '</div>') + '</li>';
      }).join('') + '</ol>' : '') +
      (interp.length ? '<p class="km-route-h">あなたの読み（本文からいくつも説明できる問い）</p><ol class="km-route-list">' + interp.map(function (p) {
        return '<li class="interp"><span>' + esc(p.q) + '</span><div><b>あなた</b>' + esc(p.a) + '</div></li>';
      }).join('') + '</ol>' : '') +
      (plain.length ? '<ol class="km-route-list">' + plain.map(function (p) { return '<li><span>' + esc(p.q) + '</span><div>' + esc(p.a) + '</div></li>'; }).join('') + '</ol>' : '') +
      '</details>';
  }
  function retry() {
    if (!st || !st.cp) return titleScreen();
    var cp = st.cp;
    var keep = { q: st.q, ok: st.ok, hints: st.hints, log: st.log };
    st = hydrateState(cp.snap);
    if (!st) return titleScreen();
    st.cp = cp;
    st.q = keep.q; st.ok = keep.ok; st.hints = keep.hints; st.log = keep.log;
    if (st.life <= 0) st.life = 1;
    closeModal();
    cancelScene(); var epoch = sceneEpoch;
    var sc = lastScene(cp.node);
    if (sc && sc.n !== NODES[cp.node].n) applyScene(sc.n, true).then(function () { if (epoch === sceneEpoch && st) go(cp.node, true); });
    else go(cp.node, true);
  }

  /* ============================ 目次・原文帳・結末帳・履歴 ============================ */
  function chapterMenu() {
    var html = '<h3>目次</h3><p class="km-m-lead">読み終えた章から、もう一度始められます。途中の章から始めるときは、それまでを史記どおりに選んだものとします。</p><div class="km-chaps">';
    K.chapters.forEach(function (c, i) {
      var open = chapterOpen(i);
      html += '<button class="km-chap" data-km="chap" data-c="' + c.id + '"' + (open ? '' : ' disabled') + '>' +
        '<span class="km-chap-no">' + esc(c.no) + '</span><b>' + (open ? esc(c.title) : '？？？') + '</b><small>' + (open ? esc(c.sub) : 'まだ開いていない') + '</small>' +
        (meta.cleared[c.id] ? '<span class="km-chap-done">読了</span>' : '') + '</button>';
    });
    html += '</div>';
    if (meta.classroom) html += '<div class="km-chaplink"><b>授業で場面を指定する</b><p class="km-m-small">ページのURLの末尾に「#c3」のように付けて開くと、その場面から始まります。生徒と同じ場所（学校のWebページや共有フォルダ）に置いたファイルで使ってください。</p>' +
      '<label>はじめる場面 <select data-chaplink>' + [['intro', '鴻門前夜（七場面の導入）']].concat(K.chapters.map(function (c) { return [c.id, c.no + '　' + c.title]; }), [['ai', '范増として考える（AI活動）'], ['review', '読み直し帳']]).map(function (o) {
        return '<option value="' + o[0] + '">' + esc(o[1]) + '　#' + o[0] + '</option>';
      }).join('') + '</select></label><button class="km-btn" data-km="copychaplink">リンクをコピー</button><span class="km-m-small" role="status" id="km-chaplink-status"></span></div>';
    html += '<div class="km-nav"><span></span><button class="km-btn" data-km="closemodal">閉じる</button></div>';
    modal(html, 'km-m-menu');
  }
  function chapterOpen(i) {
    var c = K.chapters[i];
    if (c.part2 && !meta.classroom) return !!meta.endings.T1 && (c.id === 'c8' || !!meta.cleared.c8);
    return !!(meta.classroom || i === 0 || meta.cleared[K.chapters[i - 1].id] || meta.cleared[c.id]);
  }
  function chapterLink(id) { return location.href.split('#')[0] + '#' + id; }
  /** URLの #c3・#intro などから、その場面を開く。挑戦モードでまだ開いていない章は表紙のまま。 */
  function startFromHash() {
    var id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (!id) return;
    if (id === 'intro' && window.KoumonClassroom) return intro();
    if (id === 'ai') return aiScreen();
    if (id === 'review') return review();
    if (id === 'book') return bookMenu();
    var i = K.chapters.map(function (c) { return c.id; }).indexOf(id);
    if (i >= 0 && chapterOpen(i)) startNew(id);
  }
  function bookMenu(openId, back) {
    var ids = Object.keys(K.genbun);
    var html = '<h3>原文帳</h3><p class="km-m-lead">物語の中で読んだ『史記』の原文が、ここに綴じられます（' + Object.keys(meta.gen).length + ' / ' + ids.length + ' 段）。「教科書」は古典探究の教材の範囲、「補」は物語のつながりのために補った段です。</p><div class="km-book">';
    ids.forEach(function (gid, i) {
      var g = K.genbun[gid], have = meta.classroom || !!meta.gen[gid] || !!back;
      html += '<details class="km-book-it"' + (openId === gid ? ' open' : '') + (have ? '' : ' aria-disabled="true"') + '>' +
        '<summary><span class="km-book-no">' + (i + 1) + '</span><b>' + (have ? esc(g.title) : '――　まだ読んでいない段') + '</b>' + tbTag(g) + '<small>' + esc(chap(g.ch).no) + '</small></summary>' +
        (have ? '<div class="km-paper km-paper-sm">' + genPaperHTML(g, 'haku') + '</div><div class="km-book-yomi">' + esc(g.yomi) + '</div><div class="km-yaku">' + esc(g.yaku) + '</div><div class="km-note">' + esc(g.note) + '</div>' : '') +
        '</details>';
    });
    html += '</div><div class="km-nav"><span></span><button class="km-btn" data-km="closemodal">' + (back ? 'AI活動へ戻る' : '閉じる') + '</button></div>';
    modal(html, 'km-m-book');
  }
  function endingsMenu() {
    var html = '<h3>結末帳</h3><p class="km-m-lead">たどり着いた結末が記録されます。異聞の結末には、史記の本文との違いが添えられています。</p><div class="km-ends">';
    Object.keys(K.endings).forEach(function (id) {
      var E = K.endings[id], have = !!meta.endings[id];
      html += '<div class="km-ends-it ' + E.kind + (have ? '' : ' locked') + '"><span class="km-ends-k">' + (E.kind === 'true' ? '正史' : '異聞') + '</span><b>' + (have ? esc(E.title) : '？？？') + '</b><small>' + (have ? esc(E.sub) : 'まだ見ていない') + '</small>' +
        (have ? '<p>' + esc(E.fact) + '</p>' : '') + '</div>';
    });
    html += '</div><div class="km-nav"><span></span><button class="km-btn" data-km="closemodal">閉じる</button></div>';
    modal(html, 'km-m-ends');
  }
  function logMenu() {
    if (!st) return;
    var html = '<h3>履歴</h3><div class="km-log">' + st.log.slice(-60).map(function (l) {
      var c = who(l[0]);
      return '<p>' + (c ? '<b>' + esc(c.name) + '</b>' : '') + esc(l[1]) + '</p>';
    }).join('') + '</div><div class="km-nav"><span></span><button class="km-btn" data-km="closemodal">閉じる</button></div>';
    modal(html, 'km-m-log');
    var lg = el.modal.querySelector('.km-log'); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  function howto() {
    modal('<h3>遊び方</h3><div class="km-howto">' +
      '<p><b>進める</b>　画面か「次へ」をタップ。Enter・スペースキーでも進みます。</p>' +
      '<p><b>読み解け</b>　台詞の漢文の意味を選びます。読み違えると<b>命</b>が一つ減り、三つ続けて正しく読むと一つ戻ります。命が尽きると結末を迎えます。</p>' +
      '<p><b>決断</b>　沛公としての判断です。史記と違う道を選ぶと、<b>異聞の結末</b>にたどり着くことがあります。結末からは、原因になった選択へ戻って選び直せます。戻り先はボタンに表示されます。</p>' +
      '<p><b>項王の怒気・范増の殺気</b>　言葉づかい一つで上下します。どちらも満ちれば命はありません。</p>' +
      '<p><b>策</b>　「子房に問う」でヒントがもらえます。数には限りがあります。</p>' +
      '<p><b>授業モード</b>　読み違えても命は減らず、一度目はヒントを添えて選び直せます。怒気・殺気は参考として表示されます（授業設定で切り替え）。</p>' +
      '<p><b>読み直し帳</b>　読み違えた問いが集まり、表紙や結末からあとで解き直せます。読み解くと帳から外れます。</p>' +
      '<p><b>あなたの道と史記の道</b>　結末で、あなたの決断と史記の記述を並べて振り返れます。「学習記録」でテキストに書き出せます。</p>' +
      '<p><b>原文帳</b>　物語で読んだ史記の原文（白文・書き下し・現代語訳・注）が綴じられます。読んだ字数は「学びの記録」にも加算されます。</p>' +
      '<p><b>絵を見る</b>　本文を隠して場面の絵だけを眺められます（H キー）。</p>' +
      '</div><div class="km-nav"><span></span><button class="km-btn" data-km="closemodal">閉じる</button></div>', 'km-m-howto');
  }
  function aiScreen() {
    modal('<div class="km-eyebrow">READ → THINK → DIALOGUE</div><h3>范増として、言葉を届ける。</h3>' +
      '<p class="km-m-lead">玉玦の合図に、項王は応じない。その沈黙を、あなたはどう読む？</p>' +
      '<div class="km-ai-brief"><b>創作上の目標</b><p>項王が范増の懸念を聞き、対応策を再検討する。対話は人物解釈を試す活動です。結果は史実でも成績でもありません。</p></div>' +
      '<ol class="km-ai-steps"><li>根拠にする段を選ぶ。原文帳で前後の文脈も確かめる。</li><li>原文付きの指示文をコピーし、授業で使うAIへ貼り付ける。</li><li>范増として5回まで話し、AIの講評を本文と照合する。</li></ol>' +
      '<fieldset class="km-evidence-picker"><legend>AIに渡す原文を選ぶ <small>この時点までの10段</small></legend>' +
      Object.keys(K.genbun).slice(0,10).map(function(id) { return '<label><input type="checkbox" data-km-source="' + id + '"' + (aiSources.indexOf(id)>=0?' checked':'') + '><span><small>' + id + '</small>' + esc(K.genbun[id].title) + '</span></label>'; }).join('') + '</fieldset>' +
      '<p class="km-m-small">本文の発言と事実を区別します。曹無傷の報告内容を、そのまま真実と断定しません。</p>' +
      '<details class="km-prompt-preview"><summary>原文付き指示文を確認する</summary><textarea class="km-ai-prompt" readonly rows="10" aria-label="AIへの指示文">' + esc(window.KoumonClassroom.buildPrompt(aiSources)) + '</textarea></details>' +
      '<div class="km-nav"><button class="km-btn" data-km="aibook">原文帳を開く</button><button class="km-btn gold" data-km="copyai"' + (aiSources.length?'':' disabled') + '>原文と指示文をコピー</button></div>' +
      '<p class="km-m-small" role="status" id="km-ai-copy-status">個人情報を含めず、学校で利用するAIを使ってください。</p>' +
      '<div class="km-nav"><button class="km-btn" data-km="closeai">戻る</button><button class="km-btn" data-km="reflection">対話を振り返る →</button></div>', 'km-m-ai');
    el.modal.querySelectorAll('[data-km-source]').forEach(function(input) { input.addEventListener('change', function() {
      aiSources = Array.prototype.filter.call(el.modal.querySelectorAll('[data-km-source]'), function(x){return x.checked;}).map(function(x){return x.getAttribute('data-km-source');});
      el.modal.querySelector('.km-ai-prompt').value = window.KoumonClassroom.buildPrompt(aiSources);
      el.modal.querySelector('[data-km="copyai"]').disabled = !aiSources.length;
    }); });
  }
  function copyAI() {
    var ta = el.modal.querySelector('.km-ai-prompt');
    function done(ok) {
      var b = el.modal.querySelector('[data-km="copyai"]');
      if (b) b.textContent = ok ? 'コピーしました' : '選択して手動でコピーしてください';
      var status = document.getElementById('km-ai-copy-status');
      if (status) status.textContent = ok ? '次は ① 授業で使うAIの入力欄に貼り付けて送信 → ② 范増として5回まで話す → ③ このページに戻り「対話を振り返る」へ。' : '指示文の欄を開いて全体を選び、コピーしてください。';
      if (!ok && ta) { var d = ta.closest('details'); if (d) d.open = true; ta.focus(); ta.select(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(window.KoumonClassroom.buildPrompt(aiSources)).then(function () { done(true); }, function () { done(false); });
    else done(false);
  }

  function settings() {
    modal('<h3>授業に合わせる</h3><p class="km-m-lead">設定はこのブラウザーに保存されます。</p><div class="km-settings">' +
      '<label><input type="checkbox" data-pref="classroom"' + (meta.classroom?' checked':'') + '><span><b>授業モード</b><small>命を減らさず、時間制限なし。全章・全原文へ移動できます。</small></span></label>' +
      '<label><input type="checkbox" data-pref="meters"' + (meta.meters?' checked':'') + '><span><b>怒気・殺気を示す</b><small>授業モードでも、言葉づかいで項王の怒気・范増の殺気がどう動くかを表示します。</small></span></label>' +
      '<label><input type="checkbox" data-pref="projection"' + (meta.projection?' checked':'') + '><span><b>投影して、みんなで読む</b><small>本文・選択肢を大きく表示。個人学習ではオフに。</small></span></label>' +
      '<label><input type="checkbox" data-pref="instant"' + (meta.instant?' checked':'') + '><span><b>文字を一度に表示</b><small>オフにすると、台詞を少しずつ表示します。</small></span></label></div>' +
      '<div class="km-viewsel"><span>舞台</span><button class="km-btn" data-km="view3d"' + (window.KoumonStage3D && window.KoumonStage3D.supported()?'':' disabled') + '>3D</button><button class="km-btn" data-km="view2d">影絵（軽量）</button></div>' +
      '<p class="km-m-small">舞台の切替は現在の進行を保存して表紙に戻ります。</p><div class="km-nav"><button class="km-btn" data-km="fullscreen">全画面表示</button><button class="km-btn gold" data-km="closemodal">設定を閉じる</button></div>', 'km-m-settings');
    el.modal.querySelectorAll('[data-pref]').forEach(function(input){ input.addEventListener('change', function(){
      meta[input.dataset.pref] = input.checked; saveMeta(); applyPreferences();
      if (st) { renderStatus(); if (mode === 'ask') { pauseTimer(); doAsk(cur); pauseTimer(); } }
    }); });
  }
  function reflection() {
    var fields = [['quote','根拠にした本文','段番号と引用を書こう。'],['reason','どう考え、何と伝えたか','引用から、どのように考えた？'],['difference','AIと本文の違い','AIの発言を本文と照合しよう。'],['next','読み直して気づいたこと','解釈を修正した点、次に確かめたい点は？']];
    modal('<h3>言葉の根拠を、残しておこう。</h3><p class="km-m-lead">この端末に自動保存。氏名などの個人情報は不要です。</p><div class="km-reflection">' + fields.map(function(f){return '<label>' + f[1] + '<textarea data-reflection="' + f[0] + '" rows="3" placeholder="' + f[2] + '">' + esc(meta.reflection[f[0]] || '') + '</textarea></label>';}).join('') + '</div><div class="km-nav"><button class="km-btn" data-km="ai">AI活動へ</button><button class="km-btn gold" data-km="exportreflection">記録を保存する</button><button class="km-btn" data-km="closemodal">閉じる</button></div>', 'km-m-reflection');
    el.modal.querySelectorAll('[data-reflection]').forEach(function(t){t.addEventListener('input',function(){meta.reflection[t.dataset.reflection]=t.value;saveMeta();});});
  }
  function exportReflection() {
    var labels = {quote:'根拠にした本文',reason:'考えと伝えた言葉',difference:'AIと本文の違い',next:'読み直して気づいたこと'};
    var content = '鴻門の会 — 振り返り\n\n' + Object.keys(labels).map(function(k){return labels[k]+'\n'+(meta.reflection[k]||'（未記入）');}).join('\n\n');
    downloadText('鴻門の会_振り返り.txt', content);
  }

  /* ============================ 読み直し帳 ============================ */
  function missedIds() { return ORDER.filter(function (id) { return meta.missed[id]; }); }
  var reviewS = null;
  function review() { reviewS = { ids: missedIds(), i: 0, cleared: 0, answered: null }; renderReview(); }
  function kuhoHTML(n) {
    var k = n.kuho && window.KUHO ? window.KUHO.filter(function (x) { return x.id === n.kuho; })[0] : null;
    return k ? '<div class="km-kuho"><span class="km-kuho-tag">句法</span><b>' + esc(k.form) + '</b>　' + esc(k.read || '') + '<br><small>' + esc(k.mean || '') + '</small></div>' : '';
  }
  function renderReview() {
    var ids = reviewS.ids, close = '<button class="km-btn" data-km="closemodal">閉じる</button>';
    if (!ids.length) return modal('<h3>読み直し帳</h3><p class="km-m-lead">読み違えた「読み解け」の問いが、ここに集まります。いまは読み直す問いがありません。</p><div class="km-nav"><span></span>' + close + '</div>', 'km-m-review');
    if (reviewS.i >= ids.length) {
      var left = missedIds().length;
      return modal('<h3>読み直し帳</h3><p class="km-m-lead">' + ids.length + ' 問を読み直し、' + reviewS.cleared + ' 問を読み解いた。' + (left ? 'まだ ' + left + ' 問が残っています。' : '読み直す問いは、すべて読み解きました。') + '</p>' +
        '<div class="km-nav">' + (left ? '<button class="km-btn gold" data-km="review">残りをもう一度</button>' : '<span></span>') + close + '</div>', 'km-m-review');
    }
    var id = ids[reviewS.i], n = NODES[id].n, answered = reviewS.answered;
    var order = shuffle(n.o.map(function (o, i) { return i; }), 'review' + id);
    var html = '<h3>読み直し帳 <small>' + (reviewS.i + 1) + ' / ' + ids.length + '</small></h3>' +
      '<p class="km-m-lead">' + esc(chap(NODES[id].ch).no + '　' + chap(NODES[id].ch).title) + '　·　読み違えた回数 ' + (meta.missed[id] || 0) + '</p>' +
      '<div class="km-ask-h"><span class="km-ask-tag read">読み解け</span><span class="km-ask-q">' + esc(n.q) + '</span></div>' +
      (n.stem ? '<div class="km-stem-wrap"><div class="km-vt km-stem">' + kanbunHTML(n.stem) + '</div></div>' : '') +
      '<div class="km-opts">' + order.map(function (i, k) {
        var o = n.o[i], cls = answered === null ? '' : o.ok ? ' ok' : i === answered ? ' ng' : '';
        return '<button class="km-opt' + cls + '" data-km="revpick" data-i="' + i + '"' + (answered === null ? '' : ' disabled') + '><span class="km-opt-n">' + '一二三四'.charAt(k) + '</span><span>' + esc(o.x) + '</span></button>';
      }).join('') + '</div>';
    if (answered !== null) {
      var ok = !!n.o[answered].ok;
      html += '<div class="km-fb ' + (ok ? 'ok' : 'ng') + '"><div class="km-fb-h">' + (ok ? '◯ 読み解いた。読み直し帳から外します' : '✕ まだ読み違えている') + '</div>' +
        '<span class="km-evidence-label">読解の解説 · 本文の理解と解釈</span><p>' + esc(n.exp || '') + '</p>' + kuhoHTML(n) + '</div>';
    } else if (n.hint) html += '<details class="km-review-hint"><summary>ヒントを見る</summary><p>' + esc(n.hint) + '</p></details>';
    html += '<div class="km-nav">' + close + (answered !== null ? '<button class="km-btn gold" data-km="revnext">' + (reviewS.i + 1 < ids.length ? '次の問いへ ▶' : '結果を見る ▶') + '</button>' : '<span></span>') + '</div>';
    modal(html, 'km-m-review');
  }
  function reviewPick(i) {
    if (!reviewS || reviewS.answered !== null) return;
    var id = reviewS.ids[reviewS.i], o = NODES[id].n.o[i];
    if (!o) return;
    reviewS.answered = i;
    if (o.ok) { delete meta.missed[id]; reviewS.cleared++; } else meta.missed[id] = (meta.missed[id] || 0) + 1;
    saveMeta();
    renderReview();
  }

  /* ============================ 学習記録 ============================ */
  function recordText() {
    var L = ['鴻門の会 — 学習記録', '書き出した日時：' + new Date().toLocaleString('ja-JP'), '（提出するときは、先生の指示に従って名前や番号を書き加えてください）', ''];
    L.push('■ 進み具合', 'モード：' + (meta.classroom ? '授業モード' : '挑戦モード'));
    var read = K.chapters.filter(function (c) { return meta.cleared[c.id]; });
    L.push('読み終えた章：' + (read.length ? read.map(function (c) { return c.no; }).join('・') : 'まだない') + '（' + read.length + ' / ' + K.chapters.length + '）');
    L.push('原文帳：' + Object.keys(meta.gen).filter(function (g) { return K.genbun[g]; }).length + ' / ' + Object.keys(K.genbun).length + ' 段', '');
    L.push('■ 結末（' + Object.keys(meta.endings).filter(function (e) { return K.endings[e]; }).length + ' / ' + Object.keys(K.endings).length + '）');
    Object.keys(K.endings).forEach(function (e) { var E = K.endings[e]; L.push((meta.endings[e] ? '◯ ' : '－ ') + (E.kind === 'true' ? '正史' : '異聞') + '「' + (meta.endings[e] ? E.title : '？？？') + '」'); });
    L.push('', '■ 読解');
    if (meta.best) L.push('結末までの最高の読解率：' + meta.best.rate + '%（' + meta.best.q + ' 問）');
    if (st && st.q) L.push('今回の記録：' + st.ok + ' / ' + st.q + ' 問を一度で読み解いた（策を用いた回数 ' + st.hints + '）');
    if (!meta.best && !(st && st.q)) L.push('まだ記録がない');
    var differ = st ? st.picks.filter(function (p) { return p.hist && !p.same; }) : [];
    if (differ.length) {
      L.push('', '■ 今回、史記と違う道を選んだ決断');
      differ.forEach(function (p) { L.push('・' + p.q, '　あなた：' + p.a, '　史記：' + p.hist); });
    }
    var interp = st ? st.picks.filter(function (p) { return p.interp; }) : [];
    if (interp.length) { L.push('', '■ あなたの読み'); interp.forEach(function (p) { L.push('・' + p.q, '　' + p.a); }); }
    var miss = missedIds();
    L.push('', '■ 読み直し帳（まだ読み解けていない問い ' + miss.length + ' 問）');
    if (miss.length) miss.forEach(function (id) { L.push('・' + NODES[id].n.q + '（' + chap(NODES[id].ch).no + '、読み違え ' + meta.missed[id] + ' 回）'); });
    else L.push('なし');
    var labels = { quote: '根拠にした本文', reason: '考えと伝えた言葉', difference: 'AIと本文の違い', next: '読み直して気づいたこと' };
    if (Object.keys(labels).some(function (k) { return meta.reflection[k]; })) {
      L.push('', '■ 振り返り');
      Object.keys(labels).forEach(function (k) { L.push(labels[k] + '：' + (meta.reflection[k] || '（未記入）')); });
    }
    return L.join('\n');
  }
  function recordScreen() {
    modal('<h3>学習記録を書き出す</h3><p class="km-m-lead">結末・原文帳・読解・史記と違う決断・読み直し帳・振り返りを、テキストにまとめます。コピーして提出フォームに貼るか、ファイルで保存してください。</p>' +
      '<textarea class="km-record" readonly rows="12" aria-label="学習記録">' + esc(recordText()) + '</textarea>' +
      '<p class="km-m-small" role="status" id="km-record-status">記録はこの端末のブラウザーにだけ保存されています。</p>' +
      '<div class="km-nav"><button class="km-btn" data-km="closemodal">閉じる</button><button class="km-btn" data-km="saverecord">ファイルで保存</button><button class="km-btn gold" data-km="copyrecord">コピー</button></div>', 'km-m-record');
  }
  function downloadText(name, content) {
    var url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function copyText(text, statusId, okMsg) {
    var status = document.getElementById(statusId);
    function done(ok) { if (status) status.textContent = ok ? okMsg : 'コピーできませんでした。文字を選んでコピーしてください。'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    else done(false);
  }

  function updateSoundChip() {
    if (!el.sound) return;
    el.sound.textContent = meta.sound ? '音 入' : '音 切';
    el.sound.setAttribute('aria-pressed', meta.sound ? 'true' : 'false');
  }

  /* ============================ 入力 ============================ */
  function onClick(e) {
    var t = e.target.closest('[data-km]');
    if (!t) {
      // 舞台やパネルの空いたところを押したら進む
      if (e.target.closest('.km-modal') || e.target.closest('.km-top')) return;
      if ($root.classList.contains('km-view')) { $root.classList.remove('km-view'); return; }
      advance();
      return;
    }
    e.stopPropagation();
    var a = t.getAttribute('data-km');
    switch (a) {
      case 'intro': intro(); break;
      case 'settings': settings(); break;
      case 'characters': modal(window.KoumonClassroom.charactersHTML() + '<div class="km-nav"><span></span><button class="km-btn gold" data-km="closemodal">物語へ戻る</button></div>', 'km-m-characters'); break;
      case 'reflection': reflection(); break;
      case 'exportreflection': exportReflection(); break;
      case 'aibook': bookMenu(null, aiScreen); break;
      case 'closeai': dismissModal(); break;
      case 'fullscreen': if (!document.fullscreenElement && $root.requestFullscreen) $root.requestFullscreen().catch(function(){}); else if (document.exitFullscreen) document.exitFullscreen(); break;
      case 'next': advance(); break;
      case 'gennext': go(nextOf(cur)); break;
      case 'genview': renderGen(t.getAttribute('data-g'), t.getAttribute('data-v'), false); break;
      case 'pick': pick(Number(t.getAttribute('data-i'))); break;
      case 'hint': useHint(); break;
      case 'fbnext': afterFeedback(); break;
      case 'new':
        if (meta.save) {
          confirmBox('最初から始めますか？　いまの続き（' + chap(meta.save.ch).no + '）は上書きされます。', '最初から', function () { closeModal(); meta.save = null; startNew('c0'); });
        } else startNew('c0');
        break;
      case 'continue': continueSave(); break;
      case 'menu': chapterMenu(); break;
      case 'chap': closeModal(); if (st) persist(); startNew(t.getAttribute('data-c')); break;
      case 'book': bookMenu(); break;
      case 'endings': endingsMenu(); break;
      case 'log': logMenu(); break;
      case 'howto': howto(); break;
      case 'closemodal':
        dismissModal();
        break;
      case 'view': $root.classList.toggle('km-view'); break;
      case 'view3d': case 'view2d':
        if (st && mode !== 'end') persist(); cancelScene(); closeModal(false);
        meta.view = a === 'view3d' ? '3d' : '2d'; saveMeta();
        mountStage(); ST.start(); titleScreen();
        break;
      case 'sound':
        meta.sound = !meta.sound; saveMeta(); updateSoundChip();
        if (meta.sound) { ac(); if (st && ST.S.stageId) ambience(/tent|feast|nangong/.test(ST.S.stageId) ? 'in' : 'out'); sfx('chime'); }
        else stopAmbience();
        break;
      case 'quit':
        if (standalone) { if (st && mode !== 'end') persist(); titleScreen(); }
        else close();
        break;
      case 'retry': retry(); break;
      case 'review': review(); break;
      case 'revpick': reviewPick(Number(t.getAttribute('data-i'))); break;
      case 'revnext': reviewS.i++; reviewS.answered = null; renderReview(); break;
      case 'record': recordScreen(); break;
      case 'copyrecord': copyText(recordText(), 'km-record-status', 'コピーしました。提出フォームなどに貼り付けてください。'); break;
      case 'saverecord': downloadText('鴻門の会_学習記録.txt', recordText()); break;
      case 'copychaplink':
        var sel = el.modal.querySelector('[data-chaplink]');
        if (sel) copyText(chapterLink(sel.value), 'km-chaplink-status', 'コピーしました：' + chapterLink(sel.value));
        break;
      case 'part2': closeModal(); startNew('c8'); break;
      case 'ai': aiScreen(); break;
      case 'copyai': copyAI(); break;
      case 'totitle': closeModal(); titleScreen(); break;
      case 'person': seatS.sel = t.getAttribute('data-p'); renderSeat(); break;
      case 'seat':
        if (seatS.sel) { seatS.place[seatS.sel] = t.getAttribute('data-s'); seatS.sel = null; renderSeat(); }
        else {
          var s = t.getAttribute('data-s');
          Object.keys(seatS.place).forEach(function (p) { if (seatS.place[p] === s) delete seatS.place[p]; });
          renderSeat();
        }
        break;
      case 'seatreset': seatS.place = {}; seatS.sel = null; renderSeat(); break;
      case 'seatcheck': seatCheck(); break;
      case 'seatdone': closeModal(); go(nextOf(seatS.n)); break;
      case 'giftitem': giftS.sel = t.getAttribute('data-it'); renderGift(); break;
      case 'gifttarget':
        if (giftS.sel) {
          var tg = t.getAttribute('data-t');
          Object.keys(giftS.to).forEach(function (k) { if (giftS.to[k] === tg) delete giftS.to[k]; });
          giftS.to[giftS.sel] = tg; giftS.sel = null; renderGift();
        }
        break;
      case 'giftreset': giftS.to = {}; giftS.sel = null; renderGift(); break;
      case 'giftdone': giftDone(); break;
      case 'routepick': routePick(Number(t.getAttribute('data-i'))); break;
      case 'routedone': routeDone(); break;
      case 'cfm-ok': if (confirmBox.ok) confirmBox.ok(); break;
      case 'cfm-no': dismissModal(); break;
    }
  }
  function confirmBox(msg, okLabel, ok) {
    confirmBox.ok = ok;
    modal('<p class="km-cfm">' + esc(msg) + '</p><div class="km-nav"><button class="km-btn" data-km="cfm-no">やめる</button><button class="km-btn gold" data-km="cfm-ok">' + esc(okLabel) + '</button></div>', 'km-m-cfm');
  }
  function onKey(e) {
    if (!$root || $root.hidden) return;
    if (mode === 'intro') return;
    if (!el.modal.hidden && e.key === 'Tab') {
      var focusable = Array.prototype.filter.call(el.modal.querySelectorAll('button:not([disabled]),input,textarea,summary,a[href]'), function(x){return !x.closest('details') || x.closest('details').open || x.tagName==='SUMMARY';});
      var first=focusable[0], last=focusable[focusable.length-1];
      if (e.shiftKey && document.activeElement===first) {e.preventDefault();last.focus();}
      else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus();}
    }
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var modalOpen = !el.modal.hidden;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (modalOpen && (modalStack.length || (mode !== 'end' && mode !== 'game'))) dismissModal();
      else if (!modalOpen) chapterMenu();
      return;
    }
    if (modalOpen) return;
    if (e.key === 'h' || e.key === 'H') { $root.classList.toggle('km-view'); e.preventDefault(); return; }
    if (mode === 'ask') {
      // 番号は画面に並んだ順。読み直しで無効になった選択肢があっても番号はずらさない。
      var k = '1234'.indexOf(e.key);
      var btns = $root.querySelectorAll('.km-opts .km-opt');
      if (k >= 0 && btns[k] && !btns[k].disabled) { e.preventDefault(); btns[k].click(); }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest && e.target.closest('button') && e.target.closest('#km')) return; // ボタン自身の動作に任せる
      if (mode === 'say' || mode === 'react' || mode === 'card') { e.preventDefault(); advance(); }
      else if (mode === 'gen') { e.preventDefault(); go(nextOf(cur)); }
      else if (mode === 'feedback') { e.preventDefault(); afterFeedback(); }
    }
  }

  /** ホームのカードに出す進み具合（物語を開かずに読む） */
  function summary() {
    K = window.KOUMON;
    if (!K) return null;
    if (!ORDER.length) buildIndex();
    loadMeta();
    var sv = meta.save && K.chapters.filter(function (c) { return c.id === meta.save.ch; })[0];
    return {
      endings: Object.keys(meta.endings).filter(function (k) { return K.endings[k]; }).length, endAll: Object.keys(K.endings).length,
      gen: Object.keys(meta.gen).filter(function (k) { return K.genbun[k]; }).length, genAll: Object.keys(K.genbun).length,
      saveAt: sv ? sv.no + '　' + sv.title : '', cleared: !!meta.endings.T1, done: !!meta.endings.T2
    };
  }

  window.Koumon = {
    open: open, close: close, summary: summary,
    // テスト用の入口
    _state: function () { return st; }, _meta: function () { return meta; }, _mode: function () { return mode; },
    _go: function (id) { go(id); }, _nodes: function () { return NODES; }
  };
})();
