/* 楚漢の衣装アトリエ。
 * Authored continuous garment surfaces: cut panels, folded edges and layered
 * lames. tools/author-costume-assets.cjs saves the same meshes as a .blend.
 * +Y up, +Z front. All garment dimensions are in metres at 1.72 m stature.
 */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;
  var T = THREE, V = T.Vector3, PI = Math.PI, QUALITY = 'high';
  function setQuality(value) { QUALITY = value === 'low' ? 'low' : 'high'; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function sat(x) { return Math.max(0, Math.min(1, x)); }
  function ease(a, b, x) { var u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  function bell(x, w) { return Math.exp(-x * x / (w * w)); }
  function cpow(x, p) { return Math.sign(x) * Math.pow(Math.abs(x), p); }
  function C(c) { return new T.Color(c).convertSRGBToLinear(); }
  function material(c, rough, metal, more) { return new T.MeshStandardMaterial(Object.assign({ color: C(c), roughness: rough == null ? .82 : rough, metalness: metal || 0 }, more || {})); }
  function object(g, m, name) { var o = new T.Mesh(g, m); o.name = name || ''; o.castShadow = true; o.receiveShadow = true; return o; }
  var SURFACES={};
  function grain(kind) {
    if(SURFACES[kind])return SURFACES[kind];
    var canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;var ctx=canvas.getContext('2d'),im=ctx.createImageData(256,256);
    for(var y=0;y<256;y++)for(var x=0;x<256;x++){
      var i=(y*256+x)*4,noise=Math.sin(x*19.17+y*73.11)*Math.sin(x*5.37-y*31.41),warp=Math.cos(x*Math.PI/2),weft=Math.cos(y*Math.PI/2),twill=Math.cos((x+y)*Math.PI/4);
      var v=kind==='cloth-color'?246+3*noise+3*warp+2*weft:kind==='cloth-height'?143+20*warp+16*weft+9*twill:kind==='cloth-rough'?228+10*warp+7*noise:kind==='iron'?143+18*noise+5*Math.sin(x*.13+y*.31):kind==='lacquer'?173+5*noise+3*Math.sin(x*.21):151+17*noise+8*Math.sin(x*.6+Math.sin(y*.37)*2);
      im.data[i]=im.data[i+1]=im.data[i+2]=Math.max(0,Math.min(255,v));im.data[i+3]=255;
    }
    ctx.putImageData(im,0,0);var tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(kind.indexOf('cloth')===0?7:3,kind.indexOf('cloth')===0?9:4);tex.anisotropy=4;if(kind==='cloth-color')tex.encoding=T.sRGBEncoding;SURFACES[kind]=tex;return tex;
  }
  function brocade(family) {
    var key='brocade-'+family;if(SURFACES[key])return SURFACES[key];
    var canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;var ctx=canvas.getContext('2d');
    ctx.fillStyle='#ededeb';ctx.fillRect(0,0,512,512);ctx.lineCap='round';ctx.lineJoin='round';
    var dense=family==='ochre'||family==='teal',light=family==='slate'||family==='blue',violet=family==='violet';
    function scroll(x,y,flip){
      ctx.save();ctx.translate(x,y);ctx.scale(flip,1);ctx.strokeStyle=dense?'#dedbd3':light?'#e0e2e3':violet?'#ded8df':'#e3e0db';ctx.lineWidth=3.1;
      // Interlaced shoots are drawn as a repeated woven design. Adjacent
      // leaves share a stem, so the pattern follows one authored flow.
      ctx.beginPath();ctx.moveTo(-54,94);ctx.bezierCurveTo(34,63,-52,-9,16,-51);ctx.bezierCurveTo(62,-77,92,-12,51,4);ctx.bezierCurveTo(12,13,21,-30,43,-25);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-25,47);ctx.bezierCurveTo(-65,30,-74,-6,-43,-21);ctx.bezierCurveTo(-29,8,-42,27,-25,47);ctx.moveTo(-16,14);ctx.bezierCurveTo(24,18,52,45,21,63);ctx.bezierCurveTo(-4,55,5,27,-16,14);ctx.stroke();
      ctx.strokeStyle='#f9f7ef';ctx.globalAlpha=.45;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-53,97);ctx.bezierCurveTo(38,64,-48,-8,18,-48);ctx.stroke();ctx.restore();
    }
    for(var row=-1;row<4;row++)for(var col=-1;col<4;col++)scroll(col*170+(row%2)*85,row*170,(col+row)%2?1:-1);
    // Fine, low-contrast crossed thread is separate from the larger brocade.
    ctx.globalAlpha=.12;ctx.lineWidth=.6;ctx.strokeStyle='#8a8d8c';
    for(var j=0;j<512;j+=4){ctx.beginPath();ctx.moveTo(j,0);ctx.lineTo(j,512);ctx.moveTo(0,j);ctx.lineTo(512,j);ctx.stroke();}
    var texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(7.2,4.5);texture.anisotropy=8;SURFACES[key]=texture;return texture;
  }
  function clothFamily(color) {
    for(var id in STYLES)if(STYLES[id].robe===color)return STYLES[id].fabric||'linen';return 'linen';
  }
  function fabric(mat,family) {
    family=family||'linen';if(mat.userData.sewnFabric===family)return mat;mat.userData.sewnFabric=family;
    mat.name='Woven '+family+' garment';mat.map=family==='linen'||family==='rugged'?grain('cloth-color'):brocade(family);mat.bumpMap=grain('cloth-height');mat.bumpScale=family==='rugged'?.00035:.00019;mat.roughnessMap=grain('cloth-rough');mat.roughness=family==='linen'||family==='rugged'?.96:.84;mat.metalness=0;mat.needsUpdate=true;return mat;
  }
  function leatherMaterial(c) {return material(c,.78,0,{side:T.DoubleSide,bumpMap:grain('leather'),bumpScale:.00034});}
  function paint(g, fn) {
    var p = g.attributes.position, out = [], c = new T.Color();
    for (var i = 0; i < p.count; i++) { fn(i, p.getX(i), p.getY(i), p.getZ(i), c); c.convertSRGBToLinear(); out.push(c.r, c.g, c.b); }
    g.setAttribute('color', new T.Float32BufferAttribute(out, 3)); return g;
  }

  /* A sewn sheet has an outer skin, its lining, and closed cut edges. The
     thickness follows the actual surface normal, including the crease valleys. */
  function sheet(nu, nv, sample, thickness, loop, flip) {
    if (QUALITY === 'low') { nu = Math.max(4,Math.round(nu*.68)); nv = Math.max(4,Math.round(nv*.68)); }
    var p = [], uv = [], idx = [], N = (nu + 1) * (nv + 1), i, j;
    for (i = 0; i <= nu; i++) for (j = 0; j <= nv; j++) {
      var a = sample(i / nu, j / nv); p.push(a[0], a[1], a[2]); uv.push(j / nv, i / nu);
    }
    for (i = 0; i < nu; i++) for (j = 0; j < nv; j++) {
      var a0 = i * (nv + 1) + j, b0 = a0 + nv + 1;
      idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0);
    }
    if (flip) for (i = 0; i < idx.length; i += 3) { var tmp = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tmp; }
    var outer = new T.BufferGeometry(); outer.setAttribute('position', new T.Float32BufferAttribute(p, 3)); outer.setIndex(idx); outer.computeVertexNormals();
    var n = outer.attributes.normal;
    // Normal convention of the sheet is arbitrary; the lining is consistently
    // offset toward its back. Material is double sided to retain both hem faces.
    for (i = 0; i < N; i++) { p.push(p[i * 3] - n.getX(i) * thickness, p[i * 3 + 1] - n.getY(i) * thickness, p[i * 3 + 2] - n.getZ(i) * thickness); uv.push(uv[i * 2], uv[i * 2 + 1]); }
    var L = idx.length;
    for (i = 0; i < L; i += 3) idx.push(idx[i] + N, idx[i + 2] + N, idx[i + 1] + N);
    function stitch(a, b) { idx.push(a, a + N, b, b, a + N, b + N); }
    for (j = 0; j < nv; j++) { stitch(j + 1, j); stitch(nu * (nv + 1) + j, nu * (nv + 1) + j + 1); }
    if (!loop) for (i = 0; i < nu; i++) { stitch(i * (nv + 1), (i + 1) * (nv + 1)); stitch((i + 1) * (nv + 1) + nv, i * (nv + 1) + nv); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData.outerCount = N; g.userData.nu = nu; g.userData.nv = nv; return g;
  }
  var BODY = [[-.34,.159,.112],[-.27,.155,.108],[-.16,.164,.117],[-.04,.178,.127],[.065,.187,.128],[.13,.193,.116],[.17,.184,.099],[.195,.150,.078],[.214,.097,.061],[.235,.052,.048]];
  function bodySize(y, b) {
    var v = BODY[0];
    // Continuous tangents through the tailoring stations avoid a horizontal
    // highlight/ridge at every shoulder and chest sample of a smoothstep loft.
    for (var i = 1; i < BODY.length; i++) { var q = BODY[i]; if (y <= q[0]) {
      var u=sat((y-v[0])/(q[0]-v[0])),previous=BODY[Math.max(0,i-2)],next=BODY[Math.min(BODY.length-1,i+1)],span=q[0]-v[0];
      var shape=[];for(var k=1;k<=2;k++){
        var m0=(q[k]-previous[k])/(q[0]-previous[0])*span,m1=(next[k]-v[k])/(next[0]-v[0])*span;
        shape.push((2*u*u*u-3*u*u+1)*v[k]+(u*u*u-2*u*u+u)*m0+(-2*u*u*u+3*u*u)*q[k]+(u*u*u-u*u)*m1);
      }
      return [shape[0]*(1+(b-1)*.72),shape[1]*(1+(b-1)*.45)];
    } v = q; }
    return [v[1],v[2]];
  }
  function chestFront(x, y, b) {
    var d = bodySize(y,b), a = sat(Math.abs(x) / d[0]);
    return d[1] * Math.pow(Math.max(0,1 - Math.pow(a,2.6)), 1 / 2.4);
  }
  function thorax(s, b, color) {
    var g = sheet(42,72,function (u,v) {
      var y = mix(-.34,.235,u), originalY=y, a = v * PI * 2, d = bodySize(y,b), sn = Math.sin(a), cs = Math.cos(a);
      var x = cpow(sn,2/2.6) * d[0], z = cpow(cs,2/2.4) * d[1], front = Math.pow(Math.max(0,cs),2), back = Math.pow(Math.max(0,-cs),2);
      // The robe is cut open at the throat. The top front edge dips into the
      // crossed neckline; it must never rise behind it as a closed turtleneck.
      y -= .102 * Math.max(0,cs) * ease(.125,.235,y);
      z = mix(z,chestFront(x,y,b),ease(.125,.235,originalY)*ease(0,.20,cs));
      var belt = ease(-.31,-.19,y) * (1-ease(.07,.17,y));
      // Cloth is caught under the belt; broad folds run toward the armholes.
      var crease = 0;
      [-1,1].forEach(function (sd) {
        var t = sat((y+.26)/.43), line = sd * (.034 + .116 * Math.pow(t,.72));
        crease += -.011*bell(x-line,.012) + .008*bell(x-line-sd*.018,.020);
        var line2 = sd * (.095 + .055*t);
        crease += -.006*bell(x-line2,.012) + .006*bell(x-line2+sd*.015,.023);
      });
      var ax=Math.abs(x),shoulderGather=.005*bell(y-(.12-.32*ax),.013)-.003*bell(y-(.10-.32*ax),.010);
      var neckFold=.0045*bell(y-(.235-.50*ax),.006)-.0035*bell(y-(.228-.50*ax),.005)+.003*bell(y-(.211-.38*ax),.005)-.0023*bell(y-(.204-.38*ax),.005);
      shoulderGather+=neckFold*ease(.038,.085,ax)*(1-ease(.17,.205,ax));
      z += front * (crease*belt + .007*bell(y+.09,.13)*bell(x,.15)+shoulderGather*ease(.03,.10,Math.abs(x)));
      z -= back * ease(-.34,-.18,y) * (1-ease(.10,.18,y)) * (.010*Math.sin(a*5+.6) + .005*Math.sin(a*9-.8));
      var side = Math.pow(Math.abs(sn),8); z += cs * side * .007 * Math.sin((y+.32)*21 + a*2) * (1-ease(.09,.18,y));
      return [x*s,y*s,z*s];
    }, .003*s, true);
    var base = new T.Color(color), N = g.userData.outerCount;
    return paint(g,function(i,x,y,z,c){ c.copy(base).multiplyScalar(i>=N?.70:1); });
  }

  var STYLES = {
    hai:{robe:0x25464c,trim:0x22383d,thread:0x9c8b65,inner:0xc8c2ae,belt:0x26211c,fabric:'teal'},
    ko:{robe:0x1d1719,trim:0x68372a,inner:0xd5cbb5,belt:0x9a783a},
    ryo:{robe:0x344856,trim:0x263740,thread:0x758692,inner:0xccc7b8,belt:0x25282d,fabric:'blue'},
    zo:{robe:0x8b7755,trim:0x493c2b,thread:0xa68e60,inner:0xc9bd9d,belt:0x3d3024,fabric:'ochre'},
    haku:{robe:0x5c495d,trim:0x403441,thread:0x9a8493,inner:0xc5bdaf,belt:0x302427,fabric:'violet'},
    chin:{robe:0x354854,trim:0x293944,thread:0x7e8e9b,inner:0xc9c8be,belt:0x24282b,fabric:'slate'},
    u:{robe:0x602b25,trim:0x3c2924,thread:0x9b7950,inner:0x99816b,belt:0x392b21,lace:0x472b28,cape:0x68231d,metal:0x252123,edge:0x98784b,legs:0x302624,fabric:'crimson',scarf:0x722c26},
    kai:{robe:0x252f32,trim:0x172224,thread:0x5b6b6c,inner:0x7f8176,belt:0x2d241c,lace:0x233033,metal:0x323638,edge:0x635d4b,legs:0x283033,fabric:'rugged',scarf:0x263337},
    sou:{robe:0x684c3d,trim:0x382b26,thread:0x8e7458,inner:0xb8a78e,belt:0x38251b,lace:0x4b372e,metal:0x423a31,edge:0x8a7050,legs:0x4c3a30,fabric:'linen',scarf:0x76513d}
  };
  function resolveStyle(id, c) { return Object.assign({},c,STYLES[id] || {}); }
  var FABRICS = {};
  function trimMaterial(color,thread,plain) {
    var key=color+'-'+thread+'-'+plain;if(FABRICS[key])return FABRICS[key];
    var canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;var ctx=canvas.getContext('2d'),base=new T.Color(color),embroidery=new T.Color(thread||0x8d8269);
    embroidery.lerp(base,.34);ctx.fillStyle='#'+base.getHexString();ctx.fillRect(0,0,256,512);ctx.lineCap='round';ctx.strokeStyle='#'+embroidery.getHexString();ctx.globalAlpha=.68;ctx.lineWidth=1.4;
    [21,28,228,235].forEach(function(x){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();});
    if(!plain)for(var y=-64;y<550;y+=64){
      // Fine interlaced leaf brocade, smaller than the band width. The border
      // reads as woven edging at portrait distance instead of isolated logos.
      ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(113,y);ctx.bezierCurveTo(165,y+18,91,y+45,143,y+64);ctx.moveTo(143,y);ctx.bezierCurveTo(91,y+18,165,y+45,113,y+64);ctx.stroke();
      [-1,1].forEach(function(sd){ctx.beginPath();ctx.moveTo(128+sd*8,y+16);ctx.bezierCurveTo(128+sd*35,y+4,128+sd*44,y+25,128+sd*18,y+31);ctx.bezierCurveTo(128+sd*25,y+19,128+sd*18,y+18,128+sd*8,y+16);ctx.moveTo(128+sd*8,y+48);ctx.bezierCurveTo(128+sd*35,y+36,128+sd*44,y+57,128+sd*18,y+63);ctx.stroke();});
    }
    ctx.globalAlpha=.35;ctx.lineWidth=1;ctx.setLineDash([3,4]);[11,245].forEach(function(x){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();});
    var tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(1,2.1);tex.encoding=T.sRGBEncoding;tex.anisotropy=8;
    var mat=material(0xffffff,.78,0,{map:tex,side:T.DoubleSide,bumpMap:grain('cloth-height'),bumpScale:.00019});mat.name='Sewn embroidered collar border';return FABRICS[key]=mat;
  }
  /* A folded lapel is a volume with a rolled inner edge. Its cross section
     lifts at the neck and relaxes onto the chest, instead of being a stripe. */
  function ribbon(points, width, depth, mat, name, cross, scale) {
    var curve = new T.CatmullRomCurve3(points.map(function(p){return new V(p[0],p[1],p[2]);})), s=scale||1;
    var g=sheet(52,8,function(u,v){
      var p=curve.getPoint(u),d=curve.getTangent(u),q=new V(-d.y,d.x,0).normalize();
      var w=(typeof width==='function'?width(u):width)*(v-.5), roll=cross?cross(u,v):Math.sin(v*PI)*depth;
      return [(p.x+q.x*w)*s,(p.y+q.y*w)*s,(p.z+roll)*s];
    },depth*.45*s,false,true);
    return object(g,mat,name);
  }
  function collar(c,s,b,armored) {
    var group=new T.Group();group.name='sewn-layered-collar';
    var cut = armored ? -.115 : -.255;
    function pts(side,under){
      var xy=under?[[-.048,.232],[-.052,.203],[-.047,.169],[-.008,.114],[.010,.086]]:[[.048,.232],[.052,.202],[.046,.156],[-.012,.064],[-.082,-.071],[-.144,cut]];
      return xy.map(function(p,i){var z=i===0?-.015:i===1?.045:chestFront(p[0],p[1],b)+.007+(under?0:.007);if(armored&&i>1)z-=.022*ease(.17,.05,p[1]);return [p[0],p[1],z];});
    }
    var broad=trimMaterial(c.trim,c.thread,armored),lining=fabric(material(c.inner||0xd2c6b2,.94,0,{side:T.DoubleSide}));
    var backingMat=fabric(material(c.scarf||c.robe,.88,0,{side:T.DoubleSide}),armored?'rugged':c.fabric);
    var under=pts(-1,true),over=pts(1,false);
    // The facing continues up behind the neck-side lapels. A lower top edge
    // exposed the hollow interior between the shirt and the anatomical neck.
    var facing=sheet(16,12,function(u,v){var y=mix(.095,.190,u)-.009*ease(.65,1,u)*Math.pow(v*2-1,2),half=mix(.009,.029,u),x=(v*2-1)*half,z=mix(chestFront(x,y,b)-.008,.049,ease(.35,1,u));return [x*s,y*s,z*s];},.0016*s,false,true);
    group.add(object(facing,backingMat,'underrobe-throat-facing'));
    if(armored){
      // A single draped collar skirt is gathered at the nape and lies on the
      // shoulder cloth. The red/teal/brown wrap remains under the cuirass lip.
      var wrap=sheet(26,68,function(u,v){var a=mix(-PI*.91,PI*.91,v),sn=Math.sin(a),cs=Math.cos(a),y=.212-.082*u-.022*u*Math.pow(Math.abs(sn),1.3),d=bodySize(y,b);
        var x=mix(sn*.058,cpow(sn,2/2.6)*(d[0]+.004),u),z=mix(cs*.046,cpow(cs,2/2.4)*(d[1]+.006),u)+cs*.025*Math.sin(u*PI);
        y+=.005*Math.sin(u*PI*5+a*2)*Math.sin(u*PI);z+=.004*Math.sin(u*PI*5+a*2)*Math.sin(u*PI);return [x*s,y*s,z*s];},.0038*s,false,true);
      group.add(object(wrap,backingMat,'gathered-neck-and-shoulder-wrap'));
    }
    group.add(ribbon(under,function(u){return mix(.039,armored?.050:.058,u);},.005,armored?backingMat:broad,'under-collar',function(u,v){return .004*Math.sin(v*PI)*(1-.35*u);},s));
    group.add(ribbon(over,function(u){return mix(.040,armored?.064:.067,u);},.005,armored?backingMat:broad,'rolled-over-lapel',function(u,v){return .0055*Math.sin(v*PI);},s));
    // Narrow sewn piping follows the rolled outer collar, sharing its curve.
    // Its motif is mapped to the cloth itself, rather than floating jewelry.
    if(armored){var outerEdge=over.map(function(p,i,all){var A=all[Math.max(0,i-1)],B=all[Math.min(all.length-1,i+1)],d=new V(B[0]-A[0],B[1]-A[1],0).normalize(),q=new V(-d.y,d.x,0).multiplyScalar(-.022);return [p[0]+q.x,p[1]+q.y,p[2]+.002];});group.add(ribbon(outerEdge,.011,.002,broad,'bound-armored-wrap-edge',function(u,v){return .0014*Math.sin(v*PI);},s));}
    // The pale underrobe is a separate sewn layer, visible only inside the V.
    [under.slice(0,4),over.slice(0,4)].forEach(function(path,k){
      path=path.map(function(p,i,all){var q0=all[Math.max(0,i-1)],q1=all[Math.min(all.length-1,i+1)],d=new V(q1[0]-q0[0],q1[1]-q0[1],0).normalize(),q=new V(-d.y,d.x,0).multiplyScalar(k?-.023:.021);return [p[0]+q.x,p[1]+q.y,p[2]-.003];});
      // A broad flat facing sits under the outer lapel. Recomputing its Z from
      // the chest would pull the neck end forward into a floating white loop.
      group.add(ribbon(path,armored?.007:.012,.002,lining,'overlapped-linen-inner-collar',function(u,v){return .0007*Math.sin(v*PI);},s));
    });
    // Back collar has a stand, with a folded top. It bridges both lapels at the nape.
    var back=sheet(32,6,function(u,v){var a=mix(PI*.47,PI*1.53,u),r=.054+(v-.5)*.010;return [Math.sin(a)*r*s,(.217+(v-.5)*.031)*s,Math.cos(a)*r*.86*s];},.004*s,false,true);
    group.add(object(back,armored?backingMat:broad,'standing-nape-collar'));return group;
  }
  function waist(c,s,b,armored) {
    var g=new T.Group();g.name=armored?'leather-girdle':'folded-silk-girdle';var color=c.belt||0x29221c;
    var band=sheet(6,80,function(u,v){var a=v*2*PI,d=bodySize(-.275,b),r=.010+.002*Math.sin(u*PI),y=-.267+(u-.5)*(armored?.048:.068)-.008*Math.pow(Math.max(0,Math.cos(a)),4);return [cpow(Math.sin(a),2/2.6)*(d[0]+r)*s,y*s,cpow(Math.cos(a),2/2.4)*(d[1]+r)*s];},.005*s,true);
    var mat=armored?leatherMaterial(color):fabric(material(color,.93,0,{side:T.DoubleSide}));g.add(object(band,mat,'belt-captured-waist'));
    if(!armored){
      var z=chestFront(0,-.27,b)+.021;
      g.add(ribbon([[-.040,-.26,z],[0,-.279,z+.012],[.039,-.26,z+.002]],.047,.008,mat,'compressed-belt-knot',function(u,v){return .008*Math.sin(v*PI)*Math.sin(u*PI);},s));
      [0,1].forEach(function(k){var x=k?-.032:.023,len=k?.33:.40;
        g.add(ribbon([[x,-.278,z+.008],[x+(k?-.006:.007),-.37,z+.027],[x+(k?-.018:.020),-.49,z+.038],[x+(k?-.010:.030),-.278-len,z+.025]],function(u){return mix(.040,.036,u);},.004,mat,'falling-belt-tail',function(u,v){return .007*Math.sin(v*PI)*ease(0,.2,u)+.004*Math.sin(u*PI*1.3);},s));
      });
    }else{
      var shape=new T.Shape();shape.moveTo(-.023,-.016);shape.lineTo(.023,-.016);shape.lineTo(.023,.016);shape.lineTo(-.023,.016);shape.closePath();
      var hole=new T.Path();hole.moveTo(-.015,-.009);hole.lineTo(-.015,.009);hole.lineTo(.015,.009);hole.lineTo(.015,-.009);hole.closePath();shape.holes.push(hole);
      var buckle=object(new T.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:1,steps:1}),material(c.edge||0x8a7049,.48,.65),'cast-belt-buckle');buckle.scale.setScalar(s);buckle.position.set(.006*s,-.275*s,.134*s);g.add(buckle);
    }return g;
  }

  /* Deep folds are irregularly spaced and continue from the belt capture to
     the weighted hem. The wrapped front is a second cut piece of cloth. */
  function skirt(o,mat) {
    fabric(mat,clothFamily(o.color));
    var group=new T.Group();group.name=o.seat?'seated-wrapped-robe':'standing-wrapped-robe';
    var folds=[[-2.82,.018],[-2.21,-.014],[-1.70,.020],[-1.10,-.017],[-.62,.018],[-.13,-.022],[.35,.020],[.83,-.018],[1.31,.020],[1.94,-.014],[2.44,.017],[2.92,-.016]];
    function surf(u,a,off){
      var flare=ease(0,1,u),rad=mix(o.r0,o.r1,Math.pow(flare,.74))+(o.hip||0)*Math.sin(PI*Math.min(1,u*1.4));
      var f=0;folds.forEach(function(p,i){var da=Math.atan2(Math.sin(a-p[0]-.12*u*Math.sin(i*2)),Math.cos(a-p[0]-.12*u*Math.sin(i*2)));f+=p[1]*bell(da,.115+u*.055);});
      var weight=.22+.78*Math.pow(u,.65),rr=rad+f*weight*(o.fold/.014)+off;
      // Secondary tension folds emerge below the belt and relax toward the
      // hem; they follow the cut grain instead of forming concentric rings.
      rr+=(.0024*Math.sin(a*17+u*1.9)+.0016*Math.sin(a*29-u*3.1))*Math.sin(u*PI)*(.40+.60*u);
      var x=Math.sin(a)*rr,z=Math.cos(a)*rr*o.depth,y=-o.len*u;
      y+=(o.frontLift||0)*u*u*Math.max(0,Math.cos(a));
      y+=.006*Math.sin(a*5+.7)*Math.pow(u,6);
      if(o.seat){
        var front=Math.pow(Math.max(0,Math.cos(a)),1.6),bend=ease(.16,.85,u);
        z+=o.seat*bend*front*(1-.30*ease(.65,1,u));x*=1+.15*u;
        y=mix(y,-o.len*(.26*u+.74*u*u),front*.88);
        // A broad fold breaks over each knee, then drops to the floor.
        y+=.022*bell(Math.abs(a)-.43,.19)*bell(u-.55,.22);z+=.025*bell(Math.abs(a)-.43,.17)*bell(u-.55,.21);
        if(u>.92){var pool=ease(.92,1,u);y=mix(y,Math.max(-o.len+.002,y),pool);x*=1+.025*pool;z*=1+.02*pool;}
      }
      return [x,y,z];
    }
    function colored(geo,isWrap){var N=geo.userData.outerCount,base=new T.Color(o.color),trim=new T.Color(o.trim);return paint(geo,function(i,x,y,z,c){var j=i%N,u=Math.floor(j/(geo.userData.nv+1))/geo.userData.nu,v=(j%(geo.userData.nv+1))/geo.userData.nv;c.copy(u>.958||isWrap&&v<.035?trim:base);c.multiplyScalar(i>=N?.62:isWrap?1:.94);});}
    var full=colored(sheet(42,112,function(u,v){return surf(u,v*PI*2,0);},.0035*(o.len>.7?1:.8),true,true),false);
    var fullUV=full.attributes.uv;for(var q=0;q<fullUV.count;q++){fullUV.setXY(q,fullUV.getX(q)*(o.r0+o.r1)*PI/.95,fullUV.getY(q)*o.len/.575);}fullUV.needsUpdate=true;
    group.add(object(full,mat,'under-robe-with-weighted-hem'));
    if(o.wrap){
      var over=colored(sheet(46,68,function(u,v){var edge=-1.45+2.60*Math.pow(u,.91),a=edge+v*3.95;return surf(u,a,.007+.004*Math.sin(v*PI));},.004,false,true),true);
      var overUV=over.attributes.uv;for(var q=0;q<overUV.count;q++){overUV.setXY(q,overUV.getX(q)*(o.r0+o.r1)*1.975/.95,overUV.getY(q)*o.len/.575);}overUV.needsUpdate=true;
      group.add(object(over,mat,'overlapping-curved-front-panel'));
    }
    group.userData.surface=surf;return group;
  }

  function sleeve(o,mat) {
    if(!mat.userData.sewnFabric)fabric(mat,clothFamily(o.color));
    var nu=o.upper?(QUALITY==='low'?14:22):(QUALITY==='low'?18:28),nv=QUALITY==='low'?24:40,N=(nu+1)*(nv+1),baseU=[],baseA=[],pos=[],uv=[],idx=[],s=o.scale||1,side=o.side||1;
    for(var layer=0;layer<2;layer++)for(var i=0;i<=nu;i++)for(var j=0;j<=nv;j++){var u=i/nu,a=j/nv*PI*2;baseU.push(u);baseA.push(a);pos.push(0,0,0);uv.push(j/nv*.42,u*.54);}
    for(i=0;i<nu;i++)for(j=0;j<nv;j++){var a0=i*(nv+1)+j,b0=a0+nv+1;idx.push(a0,b0,a0+1,a0+1,b0,b0+1,a0+N,a0+1+N,b0+N,a0+1+N,b0+1+N,b0+N);}
    for(j=0;j<nv;j++){var e=nu*(nv+1)+j;idx.push(j,j+N,j+1,j+1,j+N,j+1+N,e,e+1,e+N,e+1,e+1+N,e+N);}
    // The padded shoulder root continues beneath the armhole when raised.
    // Closing this root avoids an exposed hollow cylinder at the armpit.
    if(o.upper)for(j=1;j<nv-1;j++)idx.push(0,j,j+1);
    var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
    var m=object(g,mat,o.upper?'sewn-shoulder-and-upper-sleeve':'gravity-draped-bag-sleeve'),def=(o.def||new V(-side*.5,0,-.86)).clone().normalize();
    var base=new T.Color(o.color),trim=new T.Color(o.trim==null?o.color:o.trim);
    paint(g,function(k,x,y,z,c){c.copy(baseU[k]>.90?trim:base).multiplyScalar(k>=N?.75:1);});
    m.userData.bag=function(down){
      var along=-down.y,L=Math.sqrt(down.x*down.x+down.z*down.z),t=ease(.05,.40,L),bx=mix(def.x,L>1e-5?down.x/L:def.x,t),bz=mix(def.z,L>1e-5?down.z/L:def.z,t),bl=Math.sqrt(bx*bx+bz*bz)||1;bx/=bl;bz/=bl;
      var raised=o.slide?Math.max(0,-along):0,hang=.70+.30*ease(.1,.65,L),p=g.attributes.position;
      var elbow=m.userData.elbowJoint ? sat(Math.abs(m.userData.elbowJoint.rotation.x)/1.25) : .25;
      for(var k=0;k<baseU.length;k++){
        var u=baseU[k],a=baseA[k],sn=Math.sin(a),cs=Math.cos(a),dot=sn*bx+cs*bz,gravity=Math.pow(Math.max(0,dot),.72);
        var rad=o.r(u)*(o.upper?mix(.64,1,ease(0,.18,u)):1),thick=k>=N?.0032*s:0;
        // Large, coherent seam-to-cuff folds; no regular corrugated cylinder.
        var fold=(.0065*Math.sin(a*4+u*2.5)+.0038*Math.sin(a*7-u*4+.4))*s*Math.sin(u*PI);
        var creaseAngle=Math.atan2(Math.sin(a-(.3+u*1.4)),Math.cos(a-(.3+u*1.4)));
        fold+=(-.006*bell(creaseAngle,.18)+.005*bell(creaseAngle-.24,.25))*s*Math.sin(u*PI);
        fold+=.0017*s*(Math.sin(a*13-u*6)+.50*Math.sin(a*21+u*9))*Math.sin(u*PI)*(.45+.55*elbow);
        var cap=o.upper?(o.fitted?.008:.014)*s*Math.sin(u*PI)*(.5+.5*Math.abs(sn)):0;
        var bendFold=o.upper?(.010*bell(u-.80,.045)-.006*bell(u-.88,.030)+.007*bell(u-.95,.025)):(.008*bell(u-.075,.040)-.005*bell(u-.16,.035));
        rad+=fold+cap+bendFold*s*elbow*Math.pow(Math.max(0,cs),2)-thick;
        var h=(o.H?o.H(u):0)*hang*(1-.63*raised);
        var y=(o.y0||0)-o.len*u*(1-.28*raised*ease(.15,1,u));
        y-=(o.sag||0)*ease(.2,.88,u)*gravity*Math.max(0,along);
        var socket=o.upper?-side*.039*s*(1-ease(0,.24,u)):0;
        var rootRise=o.upper?.012*s*(1-ease(0,.25,u))*(.5+.5*sn*side):0;
        var x=sn*rad+bx*h*gravity+socket,z=cs*rad+bz*h*gravity;
        // The bottom of the bag has its own weighted fold, not a sharp cone.
        x+=bx*.005*s*gravity*Math.sin(u*PI);z+=bz*.005*s*gravity*Math.sin(u*PI);
        p.setXYZ(k,x,y+rootRise,z);
      }p.needsUpdate=true;g.computeVertexNormals();
    };m.userData.bag(new V(0,-1,0));return m;
  }

  var METALS={};
  function lacquerPlateMap() {
    if(SURFACES.lamellaLacquer)return SURFACES.lamellaLacquer;
    var canvas=document.createElement('canvas');canvas.width=192;canvas.height=256;var ctx=canvas.getContext('2d');ctx.fillStyle='#252121';ctx.fillRect(0,0,192,256);
    ctx.strokeStyle='#796548';ctx.lineWidth=2;ctx.strokeRect(10,8,172,240);ctx.strokeStyle='#4e4336';ctx.lineWidth=1;ctx.strokeRect(15,13,162,230);
    // Inlaid edge bands belong to each lacquer lamella; no floating gold
    // overlays or extra studs are needed to distinguish the commander's suit.
    ctx.strokeStyle='#8b6e48';ctx.beginPath();ctx.moveTo(66,19);ctx.bezierCurveTo(73,29,84,31,96,21);ctx.bezierCurveTo(108,31,119,29,126,19);ctx.stroke();
    var tex=new T.CanvasTexture(canvas);tex.encoding=T.sRGBEncoding;tex.anisotropy=8;SURFACES.lamellaLacquer=tex;return tex;
  }
  function metalMaterial(c) {
    var lacquer=c.armor==='lacq',key=(lacquer?'lacquer':'iron')+(c.metal||0x303033);
    if(!METALS[key]){METALS[key]=material(lacquer?0xffffff:c.metal||0x303033,lacquer?.34:.63,lacquer?.18:.72,{side:T.DoubleSide,bumpMap:grain(lacquer?'lacquer':'iron'),bumpScale:lacquer?.000055:.00018});if(lacquer)METALS[key].map=lacquerPlateMap();METALS[key].name=lacquer?'Black lacquer lamellae with narrow brass inlay':'Worked dark forged iron';}return METALS[key];
  }
  function shoulderChasing(c) {
    var key='shoulder-chasing';if(METALS[key])return METALS[key];
    var canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;var ctx=canvas.getContext('2d');ctx.fillStyle='#272322';ctx.fillRect(0,0,512,256);
    ctx.strokeStyle='#997647';ctx.lineWidth=7;ctx.lineJoin='round';ctx.strokeRect(20,17,472,222);ctx.lineWidth=2;ctx.strokeRect(32,28,448,200);
    for(var side=-1;side<=1;side+=2){ctx.save();ctx.translate(256,125);ctx.scale(side,1);ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,72);ctx.bezierCurveTo(37,60,49,31,33,4);ctx.bezierCurveTo(7,-35,45,-76,83,-50);ctx.bezierCurveTo(121,-25,95,28,68,9);ctx.bezierCurveTo(51,-3,73,-25,84,-9);ctx.stroke();ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(37,35);ctx.bezierCurveTo(97,54,156,37,141,-15);ctx.bezierCurveTo(180,-7,195,30,169,47);ctx.moveTo(43,-23);ctx.bezierCurveTo(31,-73,6,-86,0,-65);ctx.stroke();ctx.restore();}
    var tex=new T.CanvasTexture(canvas);tex.encoding=T.sRGBEncoding;tex.anisotropy=8;METALS[key]=material(0xffffff,.42,.64,{map:tex,side:T.DoubleSide,bumpMap:grain('lacquer'),bumpScale:.000065});METALS[key].name='Chased brass inlay on black shoulder plate';return METALS[key];
  }
  function cord(points,r,color,name){return object(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(function(p){return new V(p[0],p[1],p[2]);})),Math.max(12,points.length*3),r,5,false),color&&color.isMaterial?color:material(color,.84),name);}
  function plate(w,h) {
    var sh=new T.Shape(),r=.004;sh.moveTo(-w/2+r,-h/2);sh.lineTo(w/2-r,-h/2);sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);sh.lineTo(w/2,h/2-.002);sh.quadraticCurveTo(w/2,h/2,w/2-.002,h/2);sh.lineTo(-w/2+.002,h/2);sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-.002);sh.lineTo(-w/2,-h/2+r);sh.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    var g=new T.ExtrudeGeometry(sh,{depth:.004,bevelEnabled:QUALITY!=='low',bevelSize:.0012,bevelThickness:.0012,bevelSegments:1,curveSegments:QUALITY==='low'?1:2,steps:1}),p=g.attributes.position;
    var uv=g.attributes.uv;for(var i=0;i<p.count;i++){p.setZ(i,p.getZ(i)+.003*(1-Math.pow(p.getX(i)/(w/2),2)));uv.setXY(i,.5+p.getX(i)/w,.5+p.getY(i)/h);}uv.needsUpdate=true;g.computeVertexNormals();return g;
  }
  function ringSample(a,y,b,offset){var d=bodySize(y,b),x=cpow(Math.sin(a),2/2.6)*(d[0]+offset),z=cpow(Math.cos(a),2/2.4)*(d[1]+offset);return [x,y,z];}
  function stud(group,point,normal,s,c){var m=object(new T.SphereGeometry(.0025*s,7,5),material(c,.45,.65),'peened-rivet');m.position.copy(point);m.scale.z=.55;m.quaternion.setFromUnitVectors(new V(0,0,1),normal);group.add(m);}
  function armor(c,s,b,part,side) {
    var group=new T.Group();group.name='mounted-lamellar-'+part;
    var steel=metalMaterial(c),leather=leatherMaterial(c.belt||0x30251d),edge=c.edge||0x8b7450,edgeMat=material(edge,c.gold?.39:.61,c.gold?.78:.55),lace=c.lace||0x53251c;
    var base=material(c.armor==='lacq'?0x24201e:0x302c25,.9,0,{side:T.DoubleSide});
    function rim(points,name){group.add(cord(points,(c.gold?.0018:.00135)*s,edgeMat,name));}
    if(part==='shoulder'){
      var sd=side||1;
      for(var layer=0;layer<3;layer++){
        (function(l){
          function p(u,v){
            var a=mix(-1.42,1.42,v),t=(l+u*.95)/3,yy=.025-l*.041-u*.059;
            // Shoulder lames follow the actual sleeve envelope. Their top
            // root tucks into the shoulder seam; the lower plates overlap
            // down the upper arm instead of spreading into a floating hoop.
            var reach=.052+.010*ease(0,.40,t)-.007*ease(.45,1,t),socket=-.025*(1-ease(0,.26,t)),depth=.066-.009*t;
            return [sd*(Math.cos(a)*reach+socket-.006*(1-Math.cos(a)))*s,(yy-.006*Math.abs(Math.sin(a)))*s,Math.sin(a)*depth*s];
          }
          group.add(object(sheet(8,28,p,.0045*s,false,sd<0),c.gold&&l===0?shoulderChasing(c):steel,'sloping-overlapped-shoulder-lame-'+l));
          var low=[];for(var j=0;j<=28;j++)low.push(p(1,j/28));rim(low,'bound-shoulder-lower-edge');
          if(QUALITY!=='low')[-.75,.0,.75].forEach(function(a){var q=p(.27,(a+1.42)/2.84);stud(group,new V(q[0],q[1]+.002*s,q[2]),new V(sd*Math.cos(a),.3,Math.sin(a)).normalize(),s,edge);});
          [-1,1].forEach(function(k){var points=[];for(var z=0;z<4;z++){var q=p(z/3,(k*.96+1.42)/2.84);q[0]+=sd*.002*s;points.push(q);}group.add(cord(points,.0018*s,lace,'shoulder-lacing'));});
        })(layer);
      }
      // Strap runs under all lames and into the sleeve seam, visible in side views.
      [-1,1].forEach(function(k){group.add(ribbon([[-sd*.018,.012,k*.039],[sd*.031,-.060,k*.050],[sd*.033,-.156,k*.041]],.012,.003,leather,'buried-pauldron-suspension-strap',function(u,v){return .001*Math.sin(v*PI);},s));});
      return group;
    }
    if(part==='skirt'){
      var plateGeo=plate(.036*s,.059*s),positions=[],normals=[];
      for(var sector=0;sector<4;sector++){
        (function(sec){var mid=PI/4+sec*PI/2;
          var bg=sheet(12,20,function(u,v){var a=mid+(v-.5)*1.43,r=(.184+.060*u)*s*b;return [Math.sin(a)*r,(-.012-.232*u+.010*Math.cos((v-.5)*PI))*s,Math.cos(a)*r*.77];},.006*s,false,true);group.add(object(bg,base,'leather-tasset-backing'));
          for(var r=0;r<5;r++)for(var k=0;k<8;k++){var a=mid+(k/7-.5)*1.33,rad=(.188+r*.012)*s*b,y=(-.026-r*.045)*s;positions.push(new V(Math.sin(a)*rad,y,Math.cos(a)*rad*.78));normals.push(new V(Math.sin(a),.14,Math.cos(a)/.78).normalize());}
          var rr=[];for(var j=0;j<=22;j++){var a=mid+(j/22-.5)*1.43,rad=.249*s*b;rr.push([Math.sin(a)*rad,-.238*s,Math.cos(a)*rad*.78]);}rim(rr,'tasset-bound-edge');
        })(sector);
      }
      addPlateInstances(group,plateGeo,steel,positions,normals,c,s);
      return group;
    }
    // The cuirass is tailored over the upper chest instead of ending as a
    // horizontal barrel below the clavicles. Its raised sides meet the straps
    // while the central dip leaves the crossed neck wrap visible.
    function neckline(a){return .169+.021*Math.pow(Math.abs(Math.sin(a)),2)-.022*Math.pow(Math.max(0,Math.cos(a)),4);}
    var backing=sheet(32,88,function(u,v){var a=v*2*PI,top=neckline(a),y=mix(-.320,top,u),p=ringSample(a,y,b,.0045);return [p[0]*s,p[1]*s,p[2]*s];},.006*s,true);group.add(object(backing,base,'padded-cuirass-foundation'));
    var topRim=[],bottomRim=[];for(var k=0;k<=96;k++){var a=k/96*PI*2,y=neckline(a)+.004,p=ringSample(a,y,b,.010);topRim.push(p.map(function(v){return v*s;}));p=ringSample(a,-.324,b,.010);bottomRim.push(p.map(function(v){return v*s;}));}rim(topRim,'cuirass-bound-neckline');rim(bottomRim,'cuirass-bound-waist');
    var positions=[],normals=[];
    for(var row=0;row<11;row++){
      var y=.141-row*.043,per=2*PI*Math.sqrt((.18*.18+.128*.128)/2),count=Math.round(per/(c.armor==='iron'?.033:.035));
      for(k=0;k<count;k++){
        var a=(k+(row%2)*.5)/count*PI*2,yy=y+(neckline(a)-.169)*(1-row/11),p=ringSample(a,yy,b,.0075+(.00035*(10-row))),n=new V(Math.sin(a),.035,Math.cos(a)*1.15).normalize();positions.push(new V(p[0]*s,p[1]*s,p[2]*s));normals.push(n);
      }
      // Continuous through-laces tie each row into the padded foundation.
      if(QUALITY!=='low'||row%2===0){var l=[];for(k=0;k<=96;k++){a=k/96*PI*2;var yy=y+(neckline(a)-.169)*(1-row/11);p=ringSample(a,yy+.018,b,.014);p[1]+=.0018*Math.sin(a*count);l.push(p.map(function(v){return v*s;}));}group.add(cord(l,.0015*s,lace,'row-through-lacing'));}
    }
    addPlateInstances(group,plate(.040*s,.059*s),steel,positions,normals,c,s);
    [-1,1].forEach(function(sd){
      var strap=[[sd*.115,.050,chestFront(.115,.050,b)+.004],[sd*.119,.148,chestFront(.119,.148,b)+.004],[sd*.104,.202,0],[sd*.117,.142,-chestFront(.117,.142,b)-.001],[sd*.115,.045,-chestFront(.115,.045,b)-.001]];
      var path=new T.CatmullRomCurve3(strap.map(function(p){return new V(p[0],p[1],p[2]);}));
      var fittedStrap=sheet(60,8,function(u,v){var p=path.getPoint(u),d=path.getTangent(u),n=new V(0,-d.z,d.y).normalize();return [(p.x+(v-.5)*.032)*s,(p.y+n.y*.002*Math.sin(v*PI))*s,(p.z+n.z*.002*Math.sin(v*PI))*s];},.004*s,false);
      group.add(object(fittedStrap,leather,'surface-fitted-shoulder-strap'));
      var pp=new V(sd*.112*s,.087*s,.151*s);stud(group,pp,new V(0,0,1),1.4*s,edge);
      // A short crossed leather tie visibly captures the front shoulder strap.
      group.add(cord([[sd*.099*s,.099*s,.152*s],[sd*.122*s,.071*s,.156*s],[sd*.100*s,.062*s,.152*s]],.0022*s,lace,'shoulder-strap-tie'));
    });
    return group;
  }
  function addPlateInstances(group,geo,mat,positions,normals,c,s) {
    var im=new T.InstancedMesh(geo,mat,positions.length),M=new T.Matrix4(),Q=new T.Quaternion(),scale=new V(1,1,1),up=new V(0,1,0),color=new T.Color();
    positions.forEach(function(p,i){var n=normals[i],x=new V().crossVectors(up,n).normalize(),y=new V().crossVectors(n,x).normalize();Q.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,n));M.compose(p,Q,scale);im.setMatrixAt(i,M);var f=.90+.10*Math.sin(i*7.13);color.setRGB(f,f,f);im.setColorAt(i,color);});im.castShadow=true;im.receiveShadow=true;im.name='curved-beveled-lamellae';group.add(im);
    // Rivets use one shared instanced mesh, set on the plate upper corners.
    if(QUALITY==='low')return;
    var rivets=new T.InstancedMesh(new T.SphereGeometry(.0019*s,6,4),material(c.edge||0x8a7049,.46,.65),positions.length*2),q=new T.Quaternion();
    positions.forEach(function(p,i){var n=normals[i],x=new V().crossVectors(up,n).normalize();[-1,1].forEach(function(sd,j){var v=p.clone().addScaledVector(n,.006*s).addScaledVector(up,.015*s).addScaledVector(x,sd*.011*s);q.setFromUnitVectors(new V(0,0,1),n);M.compose(v,q,new V(1,1,.5));rivets.setMatrixAt(i*2+j,M);});});rivets.name='small-lamella-rivets';rivets.castShadow=true;group.add(rivets);
  }
  function bracer(c,s) {
    var group=new T.Group();group.name='fitted-leather-vambrace';
    var shell=sheet(16,48,function(u,v){var a=v*PI*2,r=mix(.060,.051,u)+.0017*Math.sin(a*5-u*7)*Math.sin(u*PI);return [Math.sin(a)*r*s,(-.085-.145*u)*s,Math.cos(a)*r*s];},.004*s,true,true);group.add(object(shell,leatherMaterial(c.belt||0x33281e),'creased-vambrace'));
    [.11,.205].forEach(function(y){var path=[];for(var j=0;j<=40;j++){var a=j/40*PI*2;path.push([Math.sin(a)*.059*s,-y*s,Math.cos(a)*.059*s]);}group.add(cord(path,.0035*s,0x201914,'vambrace-strapping'));});return group;
  }
  function cape(c,s,b) {
    var nu=64,nv=84,baseU=[],g=sheet(nu,nv,function(u,v){
      var t=v*2-1,w=mix(.198,.412,Math.pow(u,.65))*b,x=t*w,topY=.19-.045*Math.pow(Math.abs(t),1.6);
      var y=-1.22*u-.045*Math.pow(Math.abs(t),1.6)*(1-u)+.017*Math.cos(t*PI*2.5)*Math.pow(u,8);
      // The upper edge is cut to the nape/shoulder surface. It is not a broad
      // planar board hovering behind the neck. Below that sewn capture, the
      // cloth falls clear of the back in long gathered channels.
      var rootZ=.16*b-chestFront(t*.198*b,topY,b)-.012;
      var hangingZ=.16*b-.185-.040*u;
      var z=mix(rootZ,hangingZ,ease(0,.22,u));
      z-=(.023*Math.cos(t*PI*5+.4)+.011*Math.cos(t*PI*9+u*.8)+.010*Math.cos(t*PI*2))*ease(0,.10,u)*(.38+.62*u);
      return [x*s,y*s,z*s];
    },.004*s,false),N=g.userData.outerCount;
    for(var layer=0;layer<2;layer++)for(var i=0;i<=g.userData.nu;i++)for(var j=0;j<=g.userData.nv;j++)baseU.push(i/g.userData.nu);
    var base=new T.Color(c.cape);paint(g,function(i,x,y,z,t){t.copy(base).multiplyScalar(i>=N?.63:1);if(baseU[i]>.967)t.multiplyScalar(.57);});
    var m=object(g,fabric(material(0xffffff,.96,0,{vertexColors:true,side:T.DoubleSide})),'gathered-wool-cloak');m.position.set(0,.19*s,-.16*s*b);g.userData.base=g.attributes.position.array.slice();g.userData.hemU=baseU;
    [-1,1].forEach(function(sd){
      var claspX=sd*.162*b,claspZ=.16*b-chestFront(claspX,.158,b)-.009;
      var mount=object(new T.SphereGeometry(.023*s,16,10),material(c.trim,.86),'cloak-gather');mount.scale.set(1,.55,.40);mount.position.set(claspX*s,-.032*s,claspZ*s);m.add(mount);
      var clasp=object(new T.CylinderGeometry(.016*s,.018*s,.006*s,16),material(c.edge||0x917343,.40,.7),'cloak-brooch');clasp.rotation.x=PI/2;clasp.position.set(claspX*s,-.028*s,(claspZ+.006)*s);m.add(clasp);
      var ring=object(new T.TorusGeometry(.012*s,.0018*s,5,18),material(0x33251b,.55,.4),'brooch-inset');ring.position.copy(clasp.position);ring.position.z+=.004*s;m.add(ring);
    });return m;
  }
  window.KM_COSTUME={setQuality:setQuality,resolveStyle:resolveStyle,thorax:thorax,collar:collar,waist:waist,skirt:skirt,sleeve:sleeve,armor:armor,bracer:bracer,cape:cape,bodySize:bodySize,chestFront:chestFront};
})();
