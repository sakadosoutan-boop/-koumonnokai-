/* Anatomical cast heads. Geometry is authored in tools/build-head-assets.py
 * from Blender Studio's CC0 Human Base Meshes; attribution in docs/assets/manifest.csv.
 * Metres, +Y up, +Z front. No SDF sculpt or atlas projection is applied.
 */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;
  var T = THREE, CACHE = {}, MOUTH_CACHE = {}, TEXTURES = {}, PI = Math.PI;
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
  function decodePackedIndices(encoded, count, encoding, vertexCount) {
    if (!Number.isInteger(count) || count < 0 || !Number.isInteger(vertexCount) || vertexCount < 0 || vertexCount > 65535) throw new Error('Invalid packed head dimensions');
    if (typeof encoded !== 'string' || encoded.length % 4 || /[^A-Za-z0-9+/=]/.test(encoded) || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid packed head base64');
    var raw = bytes(encoded), result = new Uint16Array(count), previous = 0, written = 0;
    if (!encoding || encoding === 'uint16') {
      if (raw.length !== count * 2) throw new Error('Incomplete packed head indices');
      var view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      for (var j = 0; j < count; j++) {
        var value = view.getUint16(j * 2, true);
        if (value >= vertexCount) throw new Error('Packed head index out of bounds');
        result[j] = value;
      }
      return result;
    }
    if (encoding !== 'delta-zigzag-varint') throw new Error('Unsupported packed head index encoding');
    for (var offset = 0; offset < raw.length;) {
      if (written >= count) throw new Error('Excess packed head index bytes');
      var value = 0, shift = 0, byte;
      do {
        if (offset >= raw.length) throw new Error('Incomplete packed head varint');
        byte = raw[offset++]; value |= (byte & 127) << shift; shift += 7;
        if (shift > 21) throw new Error('Packed head varint overflow');
      } while (byte & 128);
      if (shift > 7 && !(byte & 127)) throw new Error('Noncanonical packed head varint');
      if (value > 131070) throw new Error('Packed head delta overflow');
      previous += (value >>> 1) ^ -(value & 1);
      if (previous < 0 || previous >= vertexCount) throw new Error('Packed head index out of bounds');
      result[written++] = previous;
    }
    if (written !== count) throw new Error('Incomplete packed head indices');
    return result;
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
    var idx = decodePackedIndices(source.indices[data.i],data.t * 3,source.indexEncoding,data.v);
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
      roughness: skin ? (asset.age > .5 ? .63 : .53) : kind === 'hair' ? .70 : .76,
      metalness: 0, bumpMap: detail(!skin), bumpScale: skin ? .00016 : kind === 'hair' ? .00018 : .00006});
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
  function headwearMat(hex,roughness,metalness) {
    return new T.MeshStandardMaterial({color:new T.Color(hex).convertSRGBToLinear(),roughness:roughness,metalness:metalness || 0,side:T.DoubleSide});
  }
  function headwearMesh(vertices,faces,mat) {
    var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(faces);g.computeVertexNormals();
    return new T.Mesh(g,mat);
  }
  function finishHeadwear(group) {
    group.userData.part='headwear';
    group.traverse(function(o){if(o.isMesh){o.userData.part='headwear';o.castShadow=true;o.receiveShadow=true;}});
    return group;
  }
  function seam(points,mat,radius) {
    return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(12,points.length*5),radius || .0008,5,false),mat);
  }
  function foldedCap(id) {
    // A closed, hollow cloth shell with an oval contact rim. Its curved crown,
    // offset peak and surface folds give each courtier a distinct silhouette.
    var fit={
      hai:{h:.067,rx:.029,rz:.026,leanX:.004,leanZ:-.005,front:.006,phase:.4,top:.98,color:0x231d19,trim:0x84673f,pin:.117},
      zo:{h:.051,rx:.033,rz:.028,leanX:-.004,leanZ:-.011,front:.004,phase:1.6,top:.87,color:0x25211f,trim:0x665946,pin:.106},
      haku:{h:.056,rx:.037,rz:.030,leanX:.006,leanZ:-.004,front:.004,phase:2.4,top:.96,color:0x211c1d,trim:0x806744,pin:.118},
      chin:{h:.065,rx:.027,rz:.025,leanX:-.006,leanZ:-.006,front:.006,phase:1.0,top:.86,color:0x1d1b1e,trim:0x69553d,pin:.113},
      ryo:{h:.035,rx:.044,rz:.032,leanX:-.010,leanZ:-.012,front:.004,phase:2.1,top:.91,base:-.006,color:0x171619,trim:0x403c39,pin:.095}
    }[id];
    if(!fit)return null;
    var group=new T.Group();group.name=id+'-curved-folded-cloth-crown';group.position.set(0,.137,-.027);
    var cloth=headwearMat(fit.color,.88,0),trim=headwearMat(fit.trim,.66,.14);
    var levels=[0,.15,.34,.56,.77,.93,1],radii=[1,1.015,1.035,1.045,1.04,1.01,fit.top],N=32,verts=[],faces=[],thick=.0026;
    function point(a,k,inner) {
      var t=levels[k],rad=radii[k],sin=Math.sin(a),cos=Math.cos(a);
      var ripple=.0015*Math.sin(3*a+fit.phase)*Math.sin(Math.PI*t)+.0006*Math.sin(7*a-fit.phase)*t*(1-t);
      var x=(fit.rx*rad+ripple-(inner?thick:0))*sin+fit.leanX*t*t;
      var z=(fit.rz*rad+ripple-(inner?thick:0))*cos+fit.leanZ*t;
      var y=fit.h*t+(fit.base||0)*(1-t)+fit.front*cos*t*t+.003*Math.sin(a+fit.phase)*t*t
        +(id==='ryo'?-.006*Math.sin(a)*t*t:0)-(inner?thick:0);
      return new T.Vector3(x,y,z);
    }
    for(var layer=0;layer<2;layer++)for(var k=0;k<levels.length;k++)for(var i=0;i<N;i++){
      var v=point(2*PI*i/N,k,layer===1);verts.push(v.x,v.y,v.z);
    }
    var stride=N*levels.length;
    for(var layer=0;layer<2;layer++)for(var k=0;k<levels.length-1;k++)for(var i=0;i<N;i++){
      var ni=(i+1)%N,a=layer*stride+k*N+i,b=layer*stride+k*N+ni,c=a+N,d=b+N;
      if(layer===0)faces.push(a,b,c,b,d,c);else faces.push(a,c,b,b,c,d);
    }
    for(var i=0;i<N;i++){
      var ni=(i+1)%N,top=(levels.length-1)*N;
      faces.push(top+i,top+ni,stride+top+i,top+ni,stride+top+ni,stride+top+i);
      faces.push(i,stride+i,ni,ni,stride+i,stride+ni);
    }
    var topOuter=verts.length/3,topInner=topOuter+1;
    verts.push(fit.leanX,fit.h*.87,fit.leanZ,fit.leanX,fit.h*.87-thick,fit.leanZ);
    for(var i=0;i<N;i++){
      var ni=(i+1)%N,top=(levels.length-1)*N;
      faces.push(top+i,top+ni,topOuter,stride+top+i,topInner,stride+top+ni);
    }
    group.add(headwearMesh(verts,faces,cloth));
    // The cloth edge rests inside the knot; the narrow welt reads as an actual
    // sewn base rather than a flat board perched on the scalp.
    var welt=new T.Mesh(new T.TorusGeometry(fit.rx-.0015,.0016,6,48),cloth);
    welt.rotation.x=PI/2;welt.scale.y=(fit.rz-.0015)/(fit.rx-.0015);welt.position.y=(fit.base||0)+.0004;group.add(welt);
    [-.90,.83].forEach(function(a){var curve=[];for(var j=0;j<=6;j++)curve.push(point(a+j*.025,j,false).multiplyScalar(1.007));group.add(seam(curve,trim,.00085));});
    // A restrained embroidery line follows the curved front instead of using
    // a rectangular gold plate. Zhang Liang's soft cap keeps it almost black.
    var border=[];for(var j=0;j<=12;j++){
      var a=-.95+j*1.9/12,v=point(a,1,false);v.x+=Math.sin(a)*.0007;v.z+=Math.cos(a)*.0007;border.push(v);
    }group.add(seam(border,trim,id==='ryo'?.00065:.00085));
    var crownFold=[point(0,levels.length-1,false),new T.Vector3(fit.leanX,fit.h*.87+.0008,fit.leanZ),point(PI,levels.length-1,false)];
    group.add(seam(crownFold,headwearMat(id==='ryo'?0x322c2b:0x4c4033,.82,0),.00065));
    if(id==='ryo'){
      // One broad, slanted soft fold wraps the front of the scholar's cap.
      // Its lower lip cuts into the knot, while the raised edge rolls back.
      var flapV=[],flapF=[],cols=11,rows=[2,3,4,5];
      for(var row=0;row<rows.length;row++)for(var col=0;col<cols;col++){
        var a=-1.02+2.04*col/(cols-1),q=point(a,rows[row],false);
        q.y+=.0035*(col/(cols-1)-.5)*(row+1)/rows.length;
        q.z+=.0026*Math.cos(a);flapV.push(q.x,q.y,q.z);
      }
      for(var row=0;row<rows.length-1;row++)for(var col=0;col<cols-1;col++){
        var a=row*cols+col,b=a+1,c=a+cols,d=c+1;flapF.push(a,b,c,b,d,c);
      }
      group.add(headwearMesh(flapV,flapF,headwearMat(0x242026,.91,0)));
      var foldEdge=[];for(var col=0;col<cols;col++){
        var a=-1.02+2.04*col/(cols-1),q=point(a,5,false);
        q.y+=.0035*(col/(cols-1)-.5);q.z+=.0032*Math.cos(a);foldEdge.push(q);
      }group.add(seam(foldEdge,headwearMat(0x514a4a,.83,0),.00075));
    }
    var pinMat=headwearMat(id==='ryo'?0x554a3d:0x967448,.52,.48);
    var pin=new T.Mesh(new T.CylinderGeometry(.0013,.0013,fit.pin,10),pinMat);
    pin.rotation.z=PI/2;pin.position.set(0,id==='ryo'?.012:.017,-.002);group.add(pin);
    return finishHeadwear(group);
  }
  function roundedBand(id,knot) {
    var group=new T.Group();group.name=id+'-fitted-knot-binding';group.position.set(0,.123,-.027);
    var color=id==='kai'?0x283b3b:0x6b382e,mat=headwearMat(color,.84,0),edge=headwearMat(id==='kai'?0x475551:0x995844,.74,0);
    for(var i=0;i<3;i++){
      var b=new T.Mesh(new T.TorusGeometry(knot*(.92-i*.045),.0025,7,44),i===1?edge:mat);
      b.rotation.x=PI/2;b.scale.y=.82;b.position.y=.007+i*.006;group.add(b);
    }
    // Two narrow cloth tails grow from the rear tie and settle against hair.
    for(var side of [-1,1]){
      var x=side*(id==='kai'?.010:.008),length=id==='kai'?.068:.045,w=id==='kai'?.008:.006;
      var p=[x-w/2,.015,-knot*.72,x+w/2,.015,-knot*.72,
             x-w*.56,-length*.42,-knot*.85-.009,x+w*.56,-length*.42,-knot*.85-.009,
             x-w*.32,-length,-knot*.77-.012,x+w*.32,-length,-knot*.77-.012];
      var ribbon=headwearMesh(p,[0,1,2,1,3,2,2,3,4,3,5,4],mat);group.add(ribbon);
      group.add(seam([new T.Vector3(x,.015,-knot*.72),new T.Vector3(x,-length*.42,-knot*.85-.008),new T.Vector3(x,-length,-knot*.77-.011)],edge,.0007));
    }
    return finishHeadwear(group);
  }
  function compactWarCrown() {
    var group=new T.Group();group.name='u-curved-engraved-war-crown';group.position.set(0,.137,-.027);
    var base=headwearMat(0x6e572f,.46,.58),gold=headwearMat(0xb29353,.39,.70),shadow=headwearMat(0x3b2d1d,.57,.45);
    var N=48,verts=[],faces=[],rx=.036,rz=.030;
    for(var ring=0;ring<4;ring++)for(var i=0;i<N;i++){
      var a=2*PI*i/N,cs=Math.cos(a),sn=Math.sin(a),inner=ring>=2,upper=ring===1||ring===2;
      var r=inner?- .0024:0,y=upper?.010+.005*Math.max(0,cs):-.008;
      verts.push((rx+r)*sn,y,(rz+r)*cs);
    }
    for(var ring=0;ring<4;ring++)for(var i=0;i<N;i++){
      var ni=(i+1)%N,a=ring*N+i,b=ring*N+ni,c=((ring+1)%4)*N+i,d=((ring+1)%4)*N+ni;
      if(ring===2)faces.push(a,c,b,b,c,d);else faces.push(a,b,c,b,d,c);
    }
    group.add(headwearMesh(verts,faces,base));
    for(var j=0;j<2;j++){
      var curve=[];for(var i=0;i<=32;i++){
        var a=-PI+2*PI*i/32,cs=Math.cos(a),sn=Math.sin(a);
        curve.push(new T.Vector3((rx+.0008)*sn,(j? .010+.005*Math.max(0,cs):-.007), (rz+.0008)*cs));
      }group.add(seam(curve,gold,.0012));
    }
    // Front openwork: the gaps between three shallow arches stay genuinely
    // empty, while curved engraved lines follow the compact band surface.
    [-.43,0,.43].forEach(function(mid){var arch=[];for(var j=0;j<=8;j++){
      var a=mid-.16+j*.04,cs=Math.cos(a),sn=Math.sin(a);
      arch.push(new T.Vector3((rx+.0017)*sn,.001+.007*Math.sin(j/8*PI),(rz+.0017)*cs));
    }group.add(seam(arch,gold,.0009));});
    var crest=[];for(var j=0;j<=10;j++){
      var a=-.68+j*.136,cs=Math.cos(a),sn=Math.sin(a);
      crest.push(new T.Vector3((rx+.0018)*sn,.003+.002*Math.cos(a*3),(rz+.0018)*cs));
    }group.add(seam(crest,shadow,.00075));
    var pin=new T.Mesh(new T.CylinderGeometry(.0015,.0015,.108,8),gold);
    pin.rotation.z=PI/2;pin.position.set(0,.012,-.002);group.add(pin);
    return finishHeadwear(group);
  }
  function fittedHeadwear(id, asset) {
    if(['hai','zo','haku','chin','ryo'].indexOf(id)>=0)return foldedCap(id);
    if(id==='u')return compactWarCrown();
    if(id==='kai'||id==='sou')return roundedBand(id,id==='kai'?.038:.033);
    return null;
  }
  function outerLipAnchor(surface, cacheKey) {
    if (!MOUTH_CACHE[cacheKey]) {
      // Probe the indexed skin in head-local space once. This contact follows
      // the actual outer lip rather than a point behind the imported face.
      var probe = new T.Mesh(surface.geometry, surface.material);
      probe.updateMatrixWorld(true);
      var ray = new T.Raycaster(new T.Vector3(0,-.038,.3), new T.Vector3(0,0,-1));
      var hit = ray.intersectObject(probe, false)[0];
      if (!hit) throw new Error('No outer lip surface for ' + cacheKey);
      MOUTH_CACHE[cacheKey] = hit.point.toArray();
    }
    return MOUTH_CACHE[cacheKey].slice();
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
    var anchors = JSON.parse(JSON.stringify(asset.anchors));
    anchors.mouth = outerLipAnchor(surface,id + '|' + q);
    if (id !== key) {
      // Secondary cast retains the continuous source topology while introducing
      // a small stable anatomical variation, away from the eye contact region.
      var seed = params.seed || 0, sx = 1 + ((seed % 5) - 2) * .015;
      group.scale.x = sx;
    }
    return {group: group, surface: surface, eyes: eyes, anchors: anchors, asset: true, source: key, headwear:!!headwear};
  }
  window.KM_HEADS = {build:build,decodePackedIndices:decodePackedIndices};
})();
