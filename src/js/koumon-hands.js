/* Anatomical hands from Blender Studio Human Base Meshes (CC0).
 * Factory frame: wrist origin, +Y fingers, +Z dorsal, thumb toward -X.
 * Meshes and materials are shared; a pose change only creates a Mesh instance.
 */
(function (global) {
  'use strict';
  var THREE = global.THREE;
  if (!THREE) return;
  var baseCache = new Map(), colorCache = new Map(), materialCache = new Map();
  var aliases = { hidden: 'relax', open: 'reach', grip: 'grasp', relaxed: 'relax' };

  function bytes(encoded) {
    if (typeof global.atob === 'function') {
      var raw = global.atob(encoded), out = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    }
    // Also usable by the offline preview VM, without browser globals.
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', result = [];
    var acc = 0, bits = 0;
    for (var j = 0; j < encoded.length && encoded[j] !== '='; j++) {
      var n = chars.indexOf(encoded[j]);
      if (n < 0) continue;
      acc = (acc << 6) | n; bits += 6;
      if (bits >= 8) { bits -= 8; result.push((acc >> bits) & 255); }
    }
    return new Uint8Array(result);
  }
  function values16(encoded, signed) {
    var raw = bytes(encoded), view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    var out = signed ? new Int16Array(raw.length / 2) : new Uint16Array(raw.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = signed ? view.getInt16(i * 2, true) : view.getUint16(i * 2, true);
    return out;
  }
  function linear(hex) {
    var r = (hex >> 16 & 255) / 255, g = (hex >> 8 & 255) / 255, b = (hex & 255) / 255;
    function f(c) { return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }
    return [f(r), f(g), f(b)];
  }
  function blend(a, b, t) { return a.map(function (v, i) { return v + (b[i] - v) * t; }); }
  function baseGeometry(pose, side, quality) {
    var key = pose + '|' + side + '|' + quality;
    if (baseCache.has(key)) return baseCache.get(key);
    var asset = global.KM_HAND_ASSETS, data = asset.lod[quality], src = values16(data.poses[pose], true);
    var positions = new Float32Array(src.length), indices = values16(data.indices, false);
    for (var i = 0; i < src.length; i++) positions[i] = src[i] / asset.scale * (side === 'L' && i % 3 === 0 ? -1 : 1);
    // Mirroring positions requires mirroring winding as well. Negative object
    // scale would invert the lighting and break contact normals in the preview.
    if (side === 'L') {
      for (var t = 0; t < indices.length; t += 3) { var swap = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = swap; }
    }
    var geometry = new THREE.BufferGeometry();
    geometry.name = 'CC0 connected anatomical hand ' + key;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.addGroup(0, data.skinCount, 0);
    geometry.addGroup(data.skinCount, indices.length - data.skinCount, 1);
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData = { asset: 'Blender Studio Human Base Meshes v1.2.0', license: 'CC0', pose: pose, side: side, quality: quality };
    baseCache.set(key, geometry);
    return geometry;
  }
  function palette(P) {
    return [P.skin || 0xc49a78, P.skinRed || 0xbd7b64, P.skinLight || 0xd8b498];
  }
  function materials(key) {
    if (materialCache.has(key)) return materialCache.get(key);
    var pair = [
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .57, metalness: 0 }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .34, metalness: 0 })
    ];
    pair[0].name = 'Hand skin'; pair[1].name = 'Natural nail bed';
    materialCache.set(key, pair); return pair;
  }
  function coloredGeometry(pose, side, P, quality) {
    var colors = palette(P), skinKey = colors.join('|'), key = [pose, side, quality, skinKey].join('|');
    if (colorCache.has(key)) return colorCache.get(key);
    var base = baseGeometry(pose, side, quality), marks = bytes(global.KM_HAND_ASSETS.lod[quality].marks);
    var skin = linear(colors[0]), red = linear(colors[1]), light = linear(colors[2]);
    // Nail colors follow each character's complexion. A small warm increase in
    // value gives a natural nail plate without white/claw-like fingertips.
    var nail = blend(blend(skin, light, .20), linear(0xc49385), .12);
    var attribute = new Float32Array(marks.length);
    for (var i = 0; i < marks.length; i += 3) {
      var color = marks[i + 2] ? nail : blend(blend(skin, light, marks[i] / 255), red, marks[i + 1] / 255);
      attribute[i] = color[0]; attribute[i + 1] = color[1]; attribute[i + 2] = color[2];
    }
    // Share the immutable position/index/normal buffers across complexions.
    var g = new THREE.BufferGeometry(); g.name = base.name;
    g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal); g.setIndex(base.index);
    g.setAttribute('color', new THREE.BufferAttribute(attribute, 3));
    base.groups.forEach(function (v) { g.addGroup(v.start, v.count, v.materialIndex); });
    g.boundingBox = base.boundingBox; g.boundingSphere = base.boundingSphere; g.userData = base.userData;
    var result = { geometry: g, materials: materials(skinKey) };
    colorCache.set(key, result); return result;
  }
  function build(pose, side, headParams, quality) {
    var asset = global.KM_HAND_ASSETS;
    if (!asset) return null;
    pose = aliases[pose] || pose || 'relax';
    if (!asset.lod.high.poses[pose]) pose = 'relax';
    side = side === 'L' ? 'L' : 'R';
    quality = quality === 'high' || quality === 'medium' ? 'high' : 'low';
    var cached = coloredGeometry(pose, side, headParams || {}, quality);
    var mesh = new THREE.Mesh(cached.geometry, cached.materials);
    mesh.name = 'Anatomical ' + side + ' hand (' + pose + ')';
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = {
      anatomicalHand: true, source: 'Blender Studio Human Base Meshes v1.2.0', license: 'CC0',
      pose: pose, side: side, quality: quality,
      // Local grasp transform for aligning a cylindrical weapon handle.
      gripCenter: [0, .102, -.024], gripAxis: [side === 'L' ? -1 : 1, 0, 0], gripRadius: .016,
      wristAnchor: [0, 0, 0], wristPlugEnd: [0, -.035, 0]
    };
    return mesh;
  }
  global.KM_HANDS = { build: build };
})(typeof window !== 'undefined' ? window : this);
