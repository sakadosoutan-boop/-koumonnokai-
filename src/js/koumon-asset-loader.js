/* 3D 人物の大きなデータ（頭部・手のメッシュ）を、表紙を出したあとに裏で読み込む。
 * 頭部データは約16MBあり、ページの読み込みを止めると教室の回線で表紙が長く出ないため。
 * 人物を作る前に koumon-3d.js が KoumonAssets.ready() を待つ。影絵（2D）では読み込まない。
 * 配布用の一枚HTML（dist）ではデータを先に埋め込むので、loaded() がはじめから true になる。 */
(function () {
  'use strict';
  var FILES = ['src/js/koumon-head-assets.js?v=20261026f', 'src/js/koumon-hand-assets.js?v=20261026f'];
  var pending = null;
  function loaded() { return !!(window.KM_HEAD_ASSETS && window.KM_HAND_ASSETS); }
  function ready() {
    if (pending) return pending;
    if (loaded()) return (pending = Promise.resolve(true));
    pending = Promise.all(FILES.map(function (src) {
      return new Promise(function (res) {
        var s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = function () { res(true); };
        s.onerror = function () { res(false); }; // 読めなくても補助の造形で続ける
        document.head.appendChild(s);
      });
    })).then(loaded);
    return pending;
  }
  function wants2d() {
    try { var m = JSON.parse(localStorage.getItem('kanbun-dojo:koumon:v1') || '{}'); return m && m.view === '2d'; } catch (e) { return false; }
  }
  window.KoumonAssets = { ready: ready, loaded: loaded };
  function preload() { if (!wants2d()) setTimeout(ready, 200); }
  if (document.readyState === 'complete') preload(); else window.addEventListener('load', preload);
})();
