/* Original game-ready banquet props. Metres, +Y up. The zhi is a reconstruction
 * after Western Han lacquer examples, not a modern mug. See the source notes.
 * No external meshes/textures are fetched at runtime. */
(function (global) {
  'use strict';
  var T = global.THREE;
  if (!T) return;
  var quality = 'high', cache = {}, mats = {};
  function material(name, color, roughness, metalness) {
    if (!mats[name]) { mats[name] = new T.MeshStandardMaterial({ color: new T.Color(color).convertSRGBToLinear(), roughness: roughness, metalness: metalness || 0 }); mats[name].name = name; }
    return mats[name];
  }
  function mesh(g, m, name) { var o = new T.Mesh(g, m); o.name = name || ''; o.castShadow = o.receiveShadow = true; return o; }
  function geometry(name, build) { var key = name + quality; return cache[key] || (cache[key] = build()); }
  function cylinder(rt, rb, h, seg) { return new T.CylinderGeometry(rt, rb, h, seg || (quality === 'high' ? 32 : 16)); }
  function lathe(profile, seg) { var g = new T.LatheGeometry(profile.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg || (quality === 'high' ? 48 : 24)); g.computeVertexNormals(); return g; }
  function band(r, y, height, mat, name) { var o = mesh(cylinder(r, r, height), mat, name); o.position.y = y; return o; }

  function bladeGeometry() {
    // Continuous diamond section: bevelled cutting edges and a central ridge,
    // tapering to one point. A closed indexed mesh, without a square rod spine.
    var levels = [[-.074,.023,.005],[-.13,.023,.005],[-.58,.018,.004],[-.735,.009,.0025],[-.79,0,0]];
    var p = [], idx = [];
    levels.forEach(function (r) { p.push(-r[1],r[0],0, 0,r[0],r[2], r[1],r[0],0, 0,r[0],-r[2]); });
    for (var j=0;j<levels.length-1;j++) for(var k=0;k<4;k++){var a=j*4+k,b=j*4+(k+1)%4,c=(j+1)*4+k,d=(j+1)*4+(k+1)%4;idx.push(a,c,b,b,c,d);}
    idx.push(0,1,2,0,2,3);
    var g = new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  function sword(drawn) {
    var group = new T.Group(); group.name = drawn ? 'Drawn double-edged jian' : 'Lacquer scabbard and jian';
    var iron=material('Polished iron blade',0x9cabb1,.26,.88), bronze=material('Aged bronze jian furniture',0x8c784a,.4,.62), wood=material('Dark bound sword grip',0x211812,.76), binding=material('Woven dark grip binding',0x62412a,.91);
    if(drawn)group.add(mesh(geometry('jian-blade',bladeGeometry),iron,'Tapered diamond-section blade'));
    else {
      var scabbard = lathe([[0,-.80],[.016,-.80],[.024,-.76],[.027,-.12],[.026,-.075],[0,-.075]],quality==='high'?16:10);scabbard.scale(1,1,.42);
      group.add(mesh(scabbard,material('Black lacquer scabbard',0x1c1512,.43),'Closed lacquer scabbard'));
      var end=band(.024,-.76,.036,bronze,'Scabbard chape');end.scale.z=.48;group.add(end);
    }
    var guardShape=new T.Shape();guardShape.moveTo(-.047,-.008);guardShape.quadraticCurveTo(-.040,.014,-.018,.014);guardShape.lineTo(.018,.014);guardShape.quadraticCurveTo(.040,.014,.047,-.008);guardShape.lineTo(.026,-.014);guardShape.lineTo(-.026,-.014);guardShape.closePath();
    var guard=mesh(new T.ExtrudeGeometry(guardShape,{depth:.020,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:2,curveSegments:6}),bronze,'Short recessed jian guard');guard.position.set(0,-.075,-.010);group.add(guard);
    group.add(mesh(cylinder(.0145,.015,.137,16),wood,'Cylindrical hilt inside fist'));
    var curve=[];for(var i=0;i<=120;i++){var a=i/120*Math.PI*18;curve.push(new T.Vector3(.0153*Math.cos(a),-.058+i/120*.116,.0153*Math.sin(a)));}
    group.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(curve),quality==='high'?120:60,.0015,4,false),binding,'Helical grip wrap'));
    var pommel=mesh(cylinder(.023,.021,.014,24),bronze,'Flat disk pommel');pommel.position.y=.078;group.add(pommel);
    group.userData={prop:'jian',gripCenter:[0,0,0],gripAxis:[0,1,0],bladeDirection:[0,-1,0],bladeRoot:[0,-.092,0],bladeTip:[0,-.79,0],spearPoint:[0,-.73,0],bladeFlatNormal:[0,0,1],thumbSide:[0,-1,0]};
    return group;
  }

  function lacquerPattern() {
    if(cache.zhiPattern)return cache.zhiPattern;
    var canvas=global.document.createElement('canvas');canvas.width=512;canvas.height=256;var c=canvas.getContext('2d');
    c.fillStyle='#211510';c.fillRect(0,0,512,256);c.strokeStyle='#8f251e';c.lineWidth=6;
    [34,55,201,222].forEach(function(y){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();});
    c.lineWidth=4;
    for(var i=0;i<8;i++){var x=i*64+32;c.beginPath();c.moveTo(x-28,128);c.bezierCurveTo(x-24,92,x+18,98,x+16,126);c.bezierCurveTo(x+14,151,x-14,144,x-7,126);c.bezierCurveTo(x-3,116,x+10,121,x+4,130);c.stroke();c.beginPath();c.moveTo(x-30,166);c.lineTo(x+31,166);c.lineTo(x+31,176);c.stroke();}
    var texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;cache.zhiPattern=texture;return texture;
  }
  function zhi() {
    var group=new T.Group();group.name='Western Han style lacquer zhi, one small ring ear';
    var outer=material('Deep brown lacquer zhi outside',0xffffff,.32),red=material('Vermilion lacquer interior',0x8b2920,.38),edge=material('Dark lacquer thin lip',0x321c15,.33);
    outer.map=lacquerPattern();
    // The path closes along the axis: solid flat base, walls and thin rolled lip.
    var profile=[[0,-.075],[.067,-.075],[.073,-.071],[.077,-.062],[.078,.061],[.080,.069],[.079,.073],[.0755,.073],[.074,.069],[.0735,-.059],[.068,-.064],[0,-.064]];
    var g=geometry('zhi-body',function(){return lathe(profile);});g.clearGroups();
    var uv=g.attributes.uv,positions=g.attributes.position;
    for(var v=0;v<uv.count;v++)uv.setY(v,Math.max(0,Math.min(1,(positions.getY(v)+.075)/.148)));
    uv.needsUpdate=true;
    var segments=quality==='high'?48:24;
    // Lathe faces are interleaved by radial segment; assign outer/inner by face.
    for(var j=0;j<segments;j++)for(var k=0;k<profile.length-1;k++)g.addGroup((j*(profile.length-1)+k)*6,6,k>=7?1:k>=5?2:0);
    group.add(mesh(g,[outer,red,edge],'Solid thin-walled lacquer drinking vessel'));
    var earPoints=[];for(var i=0;i<=40;i++){var a=i/40*Math.PI*2;earPoints.push(new T.Vector3(.082+.013*Math.sin(a),.005+.027*Math.cos(a),0));}
    var ear=mesh(new T.TubeGeometry(new T.CatmullRomCurve3(earPoints),quality==='high'?40:20,.0055,8,true),edge,'Small close-set single ring ear');group.add(ear);
    var wine=mesh(new T.CircleGeometry(.072,quality==='high'?48:24),material('Quiet amber wine surface',0x6c3d22,.16),'Inset wine');wine.rotation.x=-Math.PI/2;wine.position.y=.036;group.add(wine);
    group.userData={prop:'zhi',handleGrip:[.093,.005,0],handleAxis:[0,1,0],rim:[0,.073,0],drinkContact:[-.075,.073,0],baseSupport:[0,-.075,0],dimensions:[.160,.148,.160],sourceType:'Western Han lacquer zhi; cylinder, flat bottom, single small ring ear'};
    return group;
  }

  function meatColor(g, small) {
    var p=g.attributes.position,colors=[];
    for(var i=0;i<p.count;i++){var x=p.getX(i),y=p.getY(i),z=p.getZ(i),fat=Math.max(0,Math.min(1,(y-(small?.012:.046))/(small?.007:.017)));var sine=Math.sin(x*340+Math.sin(z*72)*2.4)*Math.sin(z*290+y*45);var marble=Math.pow(Math.max(0,sine),8)*.38;var col=new T.Color().setHex(0x943943);col.lerp(new T.Color(0xc25e68),.24+.17*Math.sin(x*65+z*23));col.lerp(new T.Color(0xdcc4aa),Math.max(fat*.92,marble));col.convertSRGBToLinear();colors.push(col.r,col.g,col.b);}
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
  }
  function shoulderGeometry(small) {
    var w=small?.039:.137,h=small?.012:.071,d=small?.022:.109;
    // Rounded, asymmetric shoulder cut with a gently flattened cut end. The
    // original closed mesh remains connected beneath the pale fat cap.
    var g=new T.SphereGeometry(1,quality==='high'?36:20,quality==='high'?22:12),p=g.attributes.position;
    for(var i=0;i<p.count;i++){var x=p.getX(i),y=p.getY(i),z=p.getZ(i),l=1+.06*Math.sin(x*8+z*5)+.035*Math.sin(y*11-z*4);p.setXYZ(i,x*w*l*(1-.12*z),y*h*l,small?z*d*(.9+.12*x):Math.min(z*(.9+.12*x),.60)*d);}
    return meatColor(g,small);
  }
  function porkShoulder() {
    var group=new T.Group();group.name='Raw pork shoulder with fat cap and exposed cut face';
    if(!mats.meat){mats.meat=new T.MeshStandardMaterial({vertexColors:true,roughness:.47});mats.meat.name='Raw pink-red muscle and pale fat';}
    group.add(mesh(geometry('pork-shoulder',function(){return shoulderGeometry(false);}),mats.meat,'Connected raw shoulder cut'));
    // The scapula is a flat section embedded in the cut, never a roast drumstick.
    var bone=mesh(new T.CircleGeometry(.014,16),material('Pale embedded shoulder bone section',0xd6bc9c,.68),'Small embedded bone section');bone.scale.set(1.4,.5,1);bone.rotation.z=-.3;bone.position.set(.031,.003,.0657);group.add(bone);
    group.userData={prop:'raw-pork-shoulder',cutContact:[-.015,.041,.012],placementBaseY:-.071,dimensions:[.274,.142,.218]};return group;
  }
  function morsel() {
    if(!mats.meat){mats.meat=new T.MeshStandardMaterial({vertexColors:true,roughness:.47});mats.meat.name='Raw pink-red muscle and pale fat';}
    var o=mesh(geometry('raw-pork-morsel',function(){return shoulderGeometry(true);}),mats.meat,'Small cut morsel pierced by the blade');o.userData={prop:'raw-pork-morsel',piercedByBlade:true};return o;
  }
  global.KM_BANQUET={setQuality:function(q){quality=q==='high'?'high':'low';},sword:sword,zhi:zhi,porkShoulder:porkShoulder,morsel:morsel,cycles:{dance:8,eat:10,drink:6}};
})(typeof window!=='undefined'?window:this);
