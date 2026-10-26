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
      z += front * (crease*belt + .007*bell(y+.09,.13)*bell(x,.15));
      z -= back * ease(-.34,-.18,y) * (1-ease(.10,.18,y)) * (.010*Math.sin(a*5+.6) + .005*Math.sin(a*9-.8));
      var side = Math.pow(Math.abs(sn),8); z += cs * side * .007 * Math.sin((y+.32)*21 + a*2) * (1-ease(.09,.18,y));
      return [x*s,y*s,z*s];
    }, .003*s, true);
    var base = new T.Color(color), N = g.userData.outerCount;
    return paint(g,function(i,x,y,z,c){ c.copy(base).multiplyScalar(i>=N?.70:1); });
  }

  var STYLES = {
    hai:{robe:0x28484b,trim:0x182e30,inner:0xcfc7b4,belt:0x26211c},
    ko:{robe:0x1d1719,trim:0x68372a,inner:0xd5cbb5,belt:0x9a783a},
    ryo:{robe:0x495865,trim:0x2a3540,inner:0xd8d3c7,belt:0x25282d},
    zo:{robe:0x817054,trim:0x393023,inner:0xc9bd9d,belt:0x3d3024},
    haku:{robe:0x554653,trim:0x30262e,inner:0xc5bdaf,belt:0x302427},
    chin:{robe:0x495560,trim:0x2a3239,inner:0xd2d0c5,belt:0x24282b},
    u:{robe:0x602821,trim:0x2c2523,inner:0xc7b69b,belt:0x392b21,lace:0x57241c,cape:0x68231d,metal:0x27262a,edge:0x947247},
    kai:{robe:0x28353a,trim:0x18272c,inner:0xb4afa0,belt:0x2d241c,lace:0x202c2c,metal:0x323333,edge:0x70634e},
    sou:{robe:0x704733,trim:0x39271f,inner:0xb8a78e,belt:0x38251b,lace:0x573727,metal:0x4b3a2d,edge:0x8a7050}
  };
  function resolveStyle(id, c) { return Object.assign({},c,STYLES[id] || {}); }
  var FABRICS = {};
  function trimMaterial(color) {
    var key = color.toString(); if(FABRICS[key]) return FABRICS[key];
    var canvas = document.createElement('canvas'); canvas.width=128;canvas.height=256;var c=canvas.getContext('2d');
    c.fillStyle='#c4c0b7';c.fillRect(0,0,128,256);
    c.strokeStyle='rgba(48,42,32,.23)';c.lineWidth=2.1;
    // Quiet woven meanders, following the long grain of the lapel.
    for(var y=-32;y<280;y+=64) for(var x=-16;x<150;x+=48){ c.beginPath();c.moveTo(x,y+30);c.bezierCurveTo(x+35,y-4,x+48,y+36,x+19,y+43);c.bezierCurveTo(x+4,y+44,x+8,y+21,x+24,y+28);c.stroke(); }
    c.strokeStyle='rgba(230,219,181,.25)';c.lineWidth=1;c.beginPath();c.moveTo(9,0);c.lineTo(9,256);c.moveTo(119,0);c.lineTo(119,256);c.stroke();
    var tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(1,4);
    return FABRICS[key]=material(color,.82,0,{map:tex,side:T.DoubleSide});
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
      return xy.map(function(p,i){var z=i===0?-.015:i===1?.045:chestFront(p[0],p[1],b)+.007+(under?0:.007);return [p[0],p[1],z];});
    }
    var broad=trimMaterial(c.trim),lining=material(c.inner||0xd2c6b2,.88,0,{side:T.DoubleSide});
    var under=pts(-1,true),over=pts(1,false);
    // The facing continues up behind the neck-side lapels. A lower top edge
    // exposed the hollow interior between the shirt and the anatomical neck.
    var facing=sheet(16,12,function(u,v){var y=mix(.095,.190,u)-.009*ease(.65,1,u)*Math.pow(v*2-1,2),half=mix(.009,.029,u),x=(v*2-1)*half,z=mix(chestFront(x,y,b)-.008,.026,ease(.35,1,u));return [x*s,y*s,z*s];},.0016*s,false,true);
    group.add(object(facing,lining,'underrobe-throat-facing'));
    group.add(ribbon(under,function(u){return mix(.033,.046,u);},.004,broad,'under-collar',function(u,v){return .003*Math.sin(v*PI)*(1-.5*u);},s));
    group.add(ribbon(over,function(u){return mix(.035,armored?.048:.052,u);},.004,broad,'rolled-over-lapel',function(u,v){return .004*Math.sin(v*PI);},s));
    // The pale underrobe is a separate sewn layer, visible only inside the V.
    [under.slice(0,4),over.slice(0,4)].forEach(function(path,k){
      path=path.map(function(p,i,all){var q0=all[Math.max(0,i-1)],q1=all[Math.min(all.length-1,i+1)],d=new V(q1[0]-q0[0],q1[1]-q0[1],0).normalize(),q=new V(-d.y,d.x,0).multiplyScalar(k?-.020:.018);return [p[0]+q.x,p[1]+q.y,p[2]-.003];});
      // A broad flat facing sits under the outer lapel. Recomputing its Z from
      // the chest would pull the neck end forward into a floating white loop.
      group.add(ribbon(path,.014,.002,lining,'overlapped-linen-inner-collar',function(u,v){return .0007*Math.sin(v*PI);},s));
    });
    // Back collar has a stand, with a folded top. It bridges both lapels at the nape.
    var back=sheet(32,6,function(u,v){var a=mix(PI*.47,PI*1.53,u),r=.054+(v-.5)*.010;return [Math.sin(a)*r*s,(.217+(v-.5)*.031)*s,Math.cos(a)*r*.86*s];},.004*s,false,true);
    group.add(object(back,broad,'standing-nape-collar'));return group;
  }
  function waist(c,s,b,armored) {
    var g=new T.Group();g.name=armored?'leather-girdle':'folded-silk-girdle';var color=c.belt||0x29221c;
    var band=sheet(6,80,function(u,v){var a=v*2*PI,d=bodySize(-.275,b),r=.010+.002*Math.sin(u*PI),y=-.267+(u-.5)*(armored?.048:.068)-.008*Math.pow(Math.max(0,Math.cos(a)),4);return [cpow(Math.sin(a),2/2.6)*(d[0]+r)*s,y*s,cpow(Math.cos(a),2/2.4)*(d[1]+r)*s];},.005*s,true);
    var mat=material(color,armored?.66:.88,0,{side:T.DoubleSide});g.add(object(band,mat,'belt-captured-waist'));
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
    var group=new T.Group();group.name=o.seat?'seated-wrapped-robe':'standing-wrapped-robe';
    var folds=[[-2.82,.018],[-2.21,-.014],[-1.70,.020],[-1.10,-.017],[-.62,.018],[-.13,-.022],[.35,.020],[.83,-.018],[1.31,.020],[1.94,-.014],[2.44,.017],[2.92,-.016]];
    function surf(u,a,off){
      var flare=ease(0,1,u),rad=mix(o.r0,o.r1,Math.pow(flare,.74))+(o.hip||0)*Math.sin(PI*Math.min(1,u*1.4));
      var f=0;folds.forEach(function(p,i){var da=Math.atan2(Math.sin(a-p[0]-.12*u*Math.sin(i*2)),Math.cos(a-p[0]-.12*u*Math.sin(i*2)));f+=p[1]*bell(da,.115+u*.055);});
      var weight=.22+.78*Math.pow(u,.65),rr=rad+f*weight*(o.fold/.014)+off;
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
    group.add(object(full,mat,'under-robe-with-weighted-hem'));
    if(o.wrap){
      var over=colored(sheet(46,68,function(u,v){var edge=-1.45+2.60*Math.pow(u,.91),a=edge+v*3.95;return surf(u,a,.007+.004*Math.sin(v*PI));},.004,false,true),true);
      group.add(object(over,mat,'overlapping-curved-front-panel'));
    }
    group.userData.surface=surf;return group;
  }

  function sleeve(o,mat) {
    var nu=o.upper?(QUALITY==='low'?14:22):(QUALITY==='low'?18:28),nv=QUALITY==='low'?24:40,N=(nu+1)*(nv+1),baseU=[],baseA=[],pos=[],uv=[],idx=[],s=o.scale||1,side=o.side||1;
    for(var layer=0;layer<2;layer++)for(var i=0;i<=nu;i++)for(var j=0;j<=nv;j++){var u=i/nu,a=j/nv*PI*2;baseU.push(u);baseA.push(a);pos.push(0,0,0);uv.push(j/nv*2,u*2);}
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
  function metalMaterial(c) {var key=c.metal||0x303033;if(!METALS[key])METALS[key]=material(key,.43,.62,{side:T.DoubleSide});return METALS[key];}
  function cord(points,r,color,name){return object(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(function(p){return new V(p[0],p[1],p[2]);})),Math.max(12,points.length*3),r,5,false),material(color,.84),name);}
  function plate(w,h) {
    var sh=new T.Shape(),r=.004;sh.moveTo(-w/2+r,-h/2);sh.lineTo(w/2-r,-h/2);sh.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);sh.lineTo(w/2,h/2-.002);sh.quadraticCurveTo(w/2,h/2,w/2-.002,h/2);sh.lineTo(-w/2+.002,h/2);sh.quadraticCurveTo(-w/2,h/2,-w/2,h/2-.002);sh.lineTo(-w/2,-h/2+r);sh.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    var g=new T.ExtrudeGeometry(sh,{depth:.004,bevelEnabled:QUALITY!=='low',bevelSize:.0012,bevelThickness:.0012,bevelSegments:1,curveSegments:QUALITY==='low'?1:2,steps:1}),p=g.attributes.position;
    for(var i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+.003*(1-Math.pow(p.getX(i)/(w/2),2)));g.computeVertexNormals();return g;
  }
  function ringSample(a,y,b,offset){var d=bodySize(y,b),x=cpow(Math.sin(a),2/2.6)*(d[0]+offset),z=cpow(Math.cos(a),2/2.4)*(d[1]+offset);return [x,y,z];}
  function stud(group,point,normal,s,c){var m=object(new T.SphereGeometry(.0025*s,7,5),material(c,.45,.65),'peened-rivet');m.position.copy(point);m.scale.z=.55;m.quaternion.setFromUnitVectors(new V(0,0,1),normal);group.add(m);}
  function armor(c,s,b,part,side) {
    var group=new T.Group();group.name='mounted-lamellar-'+part;
    var steel=metalMaterial(c),leather=material(c.belt||0x30251d,.83,0,{side:T.DoubleSide}),edge=c.edge||0x8b7450,edgeMat=material(edge,.52,.55),lace=c.lace||0x53251c;
    var base=material(c.armor==='lacq'?0x24201e:0x302c25,.9,0,{side:T.DoubleSide});
    function rim(points,name){group.add(cord(points,.0027*s,edge,name));}
    if(part==='shoulder'){
      var sd=side||1;
      for(var layer=0;layer<3;layer++){
        (function(l){
          function p(u,v){var a=mix(-1.42,1.42,v),yy=.040-l*.044-u*.060,reach=.025+l*.018+u*.025,depth=.073+l*.007+u*.012;return [sd*(Math.cos(a)*reach-.014*(1-Math.cos(a)))*s,(yy-.012*Math.abs(Math.sin(a)))*s,Math.sin(a)*depth*1.12*s];}
          group.add(object(sheet(8,28,p,.0045*s,false,sd<0),steel,'sloping-overlapped-shoulder-lame-'+l));
          var low=[];for(var j=0;j<=28;j++)low.push(p(1,j/28));rim(low,'bound-shoulder-lower-edge');
          if(QUALITY!=='low')[-.75,.0,.75].forEach(function(a){var q=p(.27,(a+1.42)/2.84);stud(group,new V(q[0],q[1]+.002*s,q[2]),new V(sd*Math.cos(a),.3,Math.sin(a)).normalize(),s,edge);});
          [-1,1].forEach(function(k){var points=[];for(var z=0;z<4;z++){var q=p(z/3,(k*.96+1.42)/2.84);q[0]+=sd*.002*s;points.push(q);}group.add(cord(points,.0018*s,lace,'shoulder-lacing'));});
        })(layer);
      }
      // Strap runs under all lames and into the sleeve seam, visible in side views.
      [-1,1].forEach(function(k){group.add(ribbon([[sd*.008,.012,k*.043],[sd*.036,-.070,k*.063],[sd*.030,-.173,k*.044]],.016,.003,leather,'buried-pauldron-suspension-strap',function(u,v){return .001*Math.sin(v*PI);},s));});
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
    // Cuirass lining and the shaped upper edge remain visible between plates.
    var backing=sheet(26,80,function(u,v){var a=v*2*PI,top=.120+.016*Math.pow(Math.abs(Math.sin(a)),2),y=mix(-.320,top,u),p=ringSample(a,y,b,.010);return [p[0]*s,p[1]*s,p[2]*s];},.006*s,true);group.add(object(backing,base,'padded-cuirass-foundation'));
    var topRim=[],bottomRim=[];for(var k=0;k<=96;k++){var a=k/96*PI*2,y=.125+.016*Math.pow(Math.abs(Math.sin(a)),2),p=ringSample(a,y,b,.014);topRim.push(p.map(function(v){return v*s;}));p=ringSample(a,-.324,b,.014);bottomRim.push(p.map(function(v){return v*s;}));}rim(topRim,'cuirass-bound-neckline');rim(bottomRim,'cuirass-bound-waist');
    var positions=[],normals=[];
    for(var row=0;row<10;row++){
      var y=.094-row*.043,per=2*PI*Math.sqrt((.18*.18+.128*.128)/2),count=Math.round(per/.035);
      for(k=0;k<count;k++){
        var a=(k+(row%2)*.5)/count*PI*2,p=ringSample(a,y,b,.015+(.001*(9-row))),n=new V(Math.sin(a),.035,Math.cos(a)*1.15).normalize();positions.push(new V(p[0]*s,p[1]*s,p[2]*s));normals.push(n);
      }
      // Continuous through-laces tie each row into the padded foundation.
      if(QUALITY!=='low'||row%2===0){var l=[];for(k=0;k<=96;k++){a=k/96*PI*2;p=ringSample(a,y+.018,b,.022);p[1]+=.0018*Math.sin(a*count);l.push(p.map(function(v){return v*s;}));}group.add(cord(l,.0015*s,lace,'row-through-lacing'));}
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
    var shell=sheet(12,44,function(u,v){var a=v*PI*2,r=mix(.060,.051,u);return [Math.sin(a)*r*s,(-.085-.145*u)*s,Math.cos(a)*r*s];},.004*s,true,true);group.add(object(shell,material(c.belt||0x33281e,.69,0,{side:T.DoubleSide}),'creased-vambrace'));
    [.11,.205].forEach(function(y){var path=[];for(var j=0;j<=40;j++){var a=j/40*PI*2;path.push([Math.sin(a)*.059*s,-y*s,Math.cos(a)*.059*s]);}group.add(cord(path,.0035*s,0x201914,'vambrace-strapping'));});return group;
  }
  function cape(c,s,b) {
    var nu=48,nv=64,baseU=[],g=sheet(nu,nv,function(u,v){
      var t=v*2-1,w=mix(.225,.425,Math.pow(u,.65))*b,x=t*w;
      var y=-1.22*u-.029*Math.pow(Math.abs(t),1.6)*(1-u)+.018*Math.cos(t*PI*2.5)*Math.pow(u,8);
      var z=.185*t*t*Math.pow(1-u,2)-.035*u-.018*Math.cos(t*PI*5+.4)*(.25+.75*u)-.012*Math.cos(t*PI*2)*u;
      return [x*s,y*s,z*s];
    },.004*s,false),N=g.userData.outerCount;
    for(var layer=0;layer<2;layer++)for(var i=0;i<=g.userData.nu;i++)for(var j=0;j<=g.userData.nv;j++)baseU.push(i/g.userData.nu);
    var base=new T.Color(c.cape);paint(g,function(i,x,y,z,t){t.copy(base).multiplyScalar(i>=N?.63:1);if(baseU[i]>.967)t.multiplyScalar(.57);});
    var m=object(g,material(0xffffff,.86,0,{vertexColors:true,side:T.DoubleSide}),'gathered-wool-cloak');m.position.set(0,.19*s,-.16*s*b);g.userData.base=g.attributes.position.array.slice();g.userData.hemU=baseU;
    [-1,1].forEach(function(sd){
      var mount=object(new T.SphereGeometry(.023*s,16,10),material(c.trim,.86),'cloak-gather');mount.scale.set(1,.55,.40);mount.position.set(sd*.185*s*b,-.025*s,.154*s*b);m.add(mount);
      var clasp=object(new T.CylinderGeometry(.016*s,.018*s,.006*s,16),material(c.edge||0x917343,.40,.7),'cloak-brooch');clasp.rotation.x=PI/2;clasp.position.set(sd*.185*s*b,-.021*s,.163*s*b);m.add(clasp);
      var ring=object(new T.TorusGeometry(.012*s,.0018*s,5,18),material(0x33251b,.55,.4),'brooch-inset');ring.position.copy(clasp.position);ring.position.z+=.004*s;m.add(ring);
    });return m;
  }
  window.KM_COSTUME={setQuality:setQuality,resolveStyle:resolveStyle,thorax:thorax,collar:collar,waist:waist,skirt:skirt,sleeve:sleeve,armor:armor,bracer:bracer,cape:cape,bodySize:bodySize,chestFront:chestFront};
})();
