/* Anatomical cast heads. Geometry is authored in tools/build-head-assets.py
 * from Blender Studio's CC0 Human Base Meshes; attribution in docs/assets/manifest.csv.
 * Metres, +Y up, +Z front. No SDF sculpt or atlas projection is applied.
 */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;
  var T = THREE, CACHE = {}, TEXTURES = {}, PI = Math.PI;
  function bytes(s) {
    if (typeof atob === 'function') {
      var raw = atob(s), out = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    }
    // The offline CPU renderer has no browser globals.
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', arr = [];
    var acc = 0, bits = 0;
    for (var j = 0; j < s.length; j++) {
      var value = alphabet.indexOf(s[j]); if (value < 0) continue;
      acc = (acc << 6) | value; bits += 6;
      if (bits >= 8) { bits -= 8; arr.push((acc >> bits) & 255); }
    }
    return new Uint8Array(arr);
  }
  function geometry(data, key) {
    if (CACHE[key]) return CACHE[key].clone();
    var source = window.KM_HEAD_ASSETS, packed = bytes(data.p), view = new DataView(packed.buffer);
    var pos = new Float32Array(data.v * 3), nor = new Float32Array(data.v * 3), normal = bytes(data.n);
    var uv = new Float32Array(data.v * 2), col = data.c ? bytes(data.c) : null;
    for (var i = 0; i < pos.length; i++) {
      pos[i] = view.getInt16(i * 2, true) * source.quantization;
      nor[i] = (normal[i] > 127 ? normal[i] - 256 : normal[i]) / 127;
    }
    var hair = key.indexOf('|hair') >= 0 || key.indexOf('|beard') >= 0 || key.indexOf('|brow') >= 0;
    for (var v = 0; v < data.v; v++) {
      uv[v * 2] = hair ? Math.atan2(pos[v * 3], pos[v * 3 + 2] + .02) / (PI * 2) + .5 : pos[v * 3] / .22 + .5;
      uv[v * 2 + 1] = hair ? (pos[v * 3 + 1] + .30) / .48 : (pos[v * 3 + 1] + .165) / .31;
    }
    var ib = bytes(source.indices[data.i]), idx = new Uint16Array(ib.buffer);
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (col) g.setAttribute('color', new T.BufferAttribute(col, 3, true));
    g.setIndex(new T.BufferAttribute(idx, 1)); g.computeBoundingBox(); g.computeBoundingSphere();
    CACHE[key] = g; return g.clone();
  }
  function canvas(w, h, draw) {
    if (typeof document === 'undefined') return null;
    var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function detail(hair) {
    var key = hair ? 'hair' : 'skin'; if (TEXTURES[key]) return TEXTURES[key];
    var texture = canvas(512, 512, function (c, w, h) {
      var im = c.createImageData(w, h), d = im.data, seed = 12347;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        var noise = ((seed >>> 24) / 255 - .5), v = hair ? 128 + 30 * Math.sin(x * .93 + Math.sin(y * .012) * 5) + noise * 20 : 128 + noise * 40;
        var i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      c.putImageData(im, 0, 0);
    });
    if (texture) { texture.wrapS = texture.wrapT = T.RepeatWrapping; if (!hair) texture.repeat.set(3, 4); }
    TEXTURES[key] = texture; return texture;
  }
  function material(kind, asset) {
    var skin = kind === 'skin';
    return new T.MeshStandardMaterial({color: 0xffffff, vertexColors: true,
      roughness: skin ? (asset.age > .5 ? .63 : .53) : kind === 'hair' ? .48 : .72,
      metalness: 0, bumpMap: detail(!skin), bumpScale: skin ? .00016 : .00030});
  }
  function irisTexture(doublePupil) {
    var key = 'iris' + !!doublePupil; if (TEXTURES[key]) return TEXTURES[key];
    var tx = canvas(256, 256, function (c, w, h) {
      var im = c.createImageData(w, h), d = im.data;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2), r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
        var strand = .5 + .5 * Math.sin(a * 113 + Math.sin(a * 29) * 3 + r * 22);
        var edge = Math.max(0, Math.min(1, (1 - r) * 9));
        var pupil = doublePupil ? Math.min(Math.hypot(dx - .11, dy), Math.hypot(dx + .11, dy)) < .29 : r < .37;
        var i = (y * w + x) * 4;
        d[i] = pupil ? 5 : (22 + 31 * strand) * edge; d[i + 1] = pupil ? 4 : (14 + 18 * strand) * edge; d[i + 2] = pupil ? 3 : (9 + 11 * strand) * edge; d[i + 3] = 255;
      }
      c.putImageData(im, 0, 0);
    });
    if (tx) tx.encoding = T.sRGBEncoding; TEXTURES[key] = tx; return tx;
  }
  function irisGeometry(radius, irisR, quality) {
    var seg = quality === 'low' ? 24 : 40, rings = 7, p = [], n = [], uv = [], idx = [];
    for (var j = 0; j <= rings; j++) for (var i = 0; i <= seg; i++) {
      var r = irisR * j / rings, a = i / seg * PI * 2, x = r * Math.cos(a), y = r * Math.sin(a), z = Math.sqrt(radius * radius - r * r) + .00006;
      p.push(x, y, z); var v = new T.Vector3(x, y, z).normalize(); n.push(v.x, v.y, v.z); uv.push(.5 + x / (irisR * 2), .5 + y / (irisR * 2));
      if (j && i) { var q = j * (seg + 1) + i; idx.push(q - seg - 2, q, q - seg - 1, q - seg - 2, q - 1, q); }
    }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  function makeEyes(asset, params, quality) {
    var group = new T.Group(); group.name = 'anatomical-eyes'; group.userData.part = 'eyes';
    var white = new T.MeshStandardMaterial({color: new T.Color(0xc3b7a6).convertSRGBToLinear(),roughness: .25,metalness: 0});
    var iris = new T.MeshStandardMaterial({map: irisTexture(params.doublePupil),roughness: .19,metalness: 0});
    asset.anchors.eyes.forEach(function (e) {
      var eg = new T.Group(); eg.position.fromArray(e.center); eg.rotation.set(params.gazePitch || 0,params.gazeYaw || 0,0);
      if(e.scale)eg.scale.fromArray(e.scale);
      var globe = new T.Mesh(new T.SphereGeometry(e.radius,quality === 'low' ? 24 : 40,quality === 'low' ? 16 : 24),white);
      globe.userData.part = 'eyes'; eg.add(globe);
      var im = new T.Mesh(irisGeometry(e.radius,e.radius * .48,quality),iris); im.userData.part = 'eyes'; eg.add(im); group.add(eg);
    });
    return group;
  }
  var ALIAS = {ko:'hai',ou:'hai',tei:'zo',rba:'u',msg:'sou',ei:'sou'};
  function fittedHeadwear(id, asset) {
    if (['ryo','u','kai','sou'].indexOf(id) < 0) return null;
    var knot = {ryo:.025,u:.037,kai:.034,sou:.033}[id], crown = id === 'u';
    var group = new T.Group(); group.name = id + '-fitted-headwear'; group.userData.part = 'headwear';
    var color = crown ? 0x8a6c36 : id === 'sou' ? 0x71432d : id === 'kai' ? 0x243a3c : 0x1b1a18;
    var mat = new T.MeshStandardMaterial({color:new T.Color(color).convertSRGBToLinear(),roughness:crown?.4:.86,metalness:crown?.62:0});
    var band = new T.Mesh(new T.CylinderGeometry(knot*.91,knot*.98,knot*.30,36,2,true),mat);
    band.position.set(0,.123+knot*.28,-.027);band.scale.z=.82;group.add(band);
    if (crown) {
      var bronze = new T.MeshStandardMaterial({color:new T.Color(0xb39750).convertSRGBToLinear(),roughness:.35,metalness:.75});
      [-1,1].forEach(function (s) {var rim = new T.Mesh(new T.TorusGeometry(knot*.95,.0013,6,36),bronze);rim.rotation.x=PI/2;rim.scale.y=.82;rim.position.set(0,.123+knot*.28+s*knot*.15,-.027);group.add(rim);});
      var pin = new T.Mesh(new T.CylinderGeometry(.0018,.0018,.11,8),bronze);pin.rotation.z=PI/2;pin.position.set(0,.123+knot*.42,-.027);group.add(pin);
      var front = new T.Mesh(new T.BoxGeometry(.025,.020,.0022),bronze);front.position.set(0,.123+knot*.42,-.027+knot*.82);group.add(front);
    }
    group.traverse(function(o){if(o.isMesh){o.userData.part='headwear';o.castShadow=false;o.receiveShadow=true;}});
    return group;
  }
  function build(id, params, quality) {
    params = params || {}; var source = window.KM_HEAD_ASSETS; if (!source) return null;
    var key = source.cast[id] ? id : ALIAS[id];
    // Keep the established female portrait until an appropriate female source
    // has been authored; a male face is not used as a silent fallback.
    if (!key || !source.cast[key]) return null;
    var asset = source.cast[key], q = quality === 'low' ? 'low' : 'high', data = Object.assign({}, asset.lod.high, asset.lod[q]);
    var group = new T.Group(); group.name = 'asset-head-' + id; group.userData.asset = true;
    var surface = null;
    Object.keys(data).forEach(function (kind) {
      var g = geometry(data[kind],key + '|' + q + '|' + kind), m = new T.Mesh(g,material(kind,asset));
      m.name = id + '-' + kind; m.userData.part = kind; m.userData.asset = true; m.castShadow = m.receiveShadow = true;
      group.add(m); if (kind === 'skin') surface = m;
    });
    var eyes = makeEyes(asset,params,q); group.add(eyes);
    var headwear = fittedHeadwear(id,asset); if(headwear)group.add(headwear);
    if (id !== key) {
      // Secondary cast retains the continuous source topology while introducing
      // a small stable anatomical variation, away from the eye contact region.
      var seed = params.seed || 0, sx = 1 + ((seed % 5) - 2) * .015;
      group.scale.x = sx;
    }
    return {group: group, surface: surface, eyes: eyes, anchors: JSON.parse(JSON.stringify(asset.anchors)), asset: true, source: key, headwear:!!headwear};
  }
  window.KM_HEADS = {build:build};
})();
