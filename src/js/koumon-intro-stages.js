/* 導入「鴻門への道」の紙芝居で使う舞台。
 * 本編の舞台の作り（3D の build・影絵の layers）と人物の素材はそのまま使い、立ち位置だけを足す。
 * 3D の pos は [x, z, 向き(rad, 0=+Z), 姿勢]、影絵の pos は { x, y, h, face, pose }。 */
(function () {
  'use strict';
  var PI = Math.PI;
  var DEFS = {
    // 楚の懐王の前に、劉邦と項羽が並んで膝をつく（玉座は空けておく）
    'intro-court': { base: 'nangong', extra: { officials: null },
      d3: { hai: [-.95, -.1, PI - .45, 'kneel'], u: [.95, -.1, PI + .45, 'kneel'] },
      d2: { hai: { x: 600, y: 830, h: 320, face: 1, pose: 'kneel' }, u: { x: 1000, y: 830, h: 340, face: -1, pose: 'kneel' } } },
    // 咸陽の宮殿。劉邦を樊噲と張良がいさめる
    'intro-palace': { base: 'nangong', extra: { officials: null },
      d3: { hai: [0, -1.0, 0], kai: [-1.45, .5, .55], ryo: [1.45, .5, -.55] },
      d2: { hai: { x: 800, y: 830, h: 320, face: 1 }, kai: { x: 540, y: 836, h: 330, face: 1 }, ryo: { x: 1070, y: 830, h: 300, face: -1 } } },
    // 陣の門の前に立つ項羽（会稽・鉅鹿・函谷関で使い回す）
    'intro-field': { base: 'gate', extra: {},
      d3: { u: [-.3, .9, .3], zo: [1.05, .7, -.5] },
      d2: { u: { x: 720, y: 830, h: 360, face: 1 }, zo: { x: 980, y: 830, h: 300, face: -1 } } }
  };
  function register(api, key) {
    if (!api || !api.STAGES) return;
    Object.keys(DEFS).forEach(function (id) {
      var d = DEFS[id], base = api.STAGES[d.base];
      if (!base) return;
      var v = {};
      Object.keys(base).forEach(function (k) { v[k] = base[k]; });
      Object.keys(d.extra).forEach(function (k) { v[k] = d.extra[k]; });
      v.pos = d[key];
      api.STAGES[id] = v;
    });
  }
  register(window.KoumonStage3D, 'd3');
  register(window.KoumonStage, 'd2');
})();
