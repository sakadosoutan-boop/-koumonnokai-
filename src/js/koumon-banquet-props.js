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
    var canvas=global.document.createElement('canvas');canvas.width=1024;canvas.height=512;var c=canvas.getContext('2d');
    c.fillStyle='#17100e';c.fillRect(0,0,1024,512);c.strokeStyle='#8c2c23';c.lineWidth=6;
    [57,74,433,450].forEach(function(y){c.beginPath();c.moveTo(0,y);c.lineTo(1024,y);c.stroke();});
    c.lineWidth=4;c.lineCap='round';
    // Paired curling cloud heads occupy the cylindrical wall, with quiet
    // black lacquer between them. The band dimensions are in wall UV space.
    for(var row=0;row<2;row++)for(var i=-1;i<8;i++){
      var x=i*144+row*72,y=176+row*155;
      c.beginPath();c.moveTo(x-56,y+18);c.bezierCurveTo(x-18,y+19,x-36,y-39,x+6,y-37);c.bezierCurveTo(x+49,y-34,x+48,y+21,x+11,y+15);c.bezierCurveTo(x-8,y+11,x-3,y-13,x+14,y-8);c.stroke();
      c.beginPath();c.moveTo(x-51,y+34);c.bezierCurveTo(x-20,y+38,x-4,y+33,x+16,y+29);c.bezierCurveTo(x+46,y+20,x+53,y+42,x+70,y+35);c.stroke();
    }
    var texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;texture.wrapS=T.RepeatWrapping;texture.anisotropy=4;cache.zhiPattern=texture;return texture;
  }
  function zhi() {
    var group=new T.Group();group.name='Western Han style lacquer zhi, one small ring ear';
    var outer=material('Deep brown lacquer zhi outside',0xffffff,.27),red=material('Vermilion lacquer interior',0x7f231c,.31),edge=material('Dark lacquer thin lip',0x291813,.29);
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
    // A clipped plane, rather than a disc parented to the cup, keeps the wine
    // level under gravity. The dynamic mesh is private to each vessel.
    var count=quality==='high'?64:32,wg=new T.BufferGeometry(),wp=new Float32Array((count+4)*3),wi=[];
    for(var n=1;n<count+3;n++)wi.push(0,n,n+1);
    wg.setAttribute('position',new T.BufferAttribute(wp,3));wg.setAttribute('normal',new T.BufferAttribute(new Float32Array(wp.length),3));wg.setIndex(wi);
    var wine=mesh(wg,material('Quiet amber wine surface',0x5c301a,.21),'Gravity-level amber wine');wine.material.side=T.DoubleSide;group.add(wine);
    group.userData={prop:'zhi',handleGrip:[.093,.005,0],handleAxis:[0,1,0],rim:[0,.073,0],drinkContact:[0,.073,.075],baseSupport:[0,-.075,0],dimensions:[.160,.148,.160],wineMesh:wine,liquidSegments:count,liquidFill:.72,sourceType:'Western Han lacquer zhi; cylinder, flat bottom, single small ring ear'};
    updateLiquid(group,.72);
    return group;
  }

  function updateLiquid(cup,fill,slosh) {
    if(!cup||!cup.userData.wineMesh)return;
    var data=cup.userData,wine=data.wineMesh,r=.0725,bottom=-.058,top=.067,volume=Math.max(0,Math.min(1,fill==null?data.liquidFill:fill));
    data.liquidFill=volume;cup.updateWorldMatrix(true,false);
    var q=cup.getWorldQuaternion(new T.Quaternion()).invert(),normal=new T.Vector3(0,1,0).applyQuaternion(q);
    // Once the mouth faces down, the vessel cannot retain a stationary pool.
    if(volume<.002||normal.y<.035){wine.visible=false;data.effectiveFill=0;return;}
    wine.visible=true;
    var ny=normal.y,nx=normal.x,nz=normal.z,lo=-.21,hi=.21,h=0,columns=[];
    for(var ring=0;ring<5;ring++)for(var j=0;j<20;j++){var rad=r*Math.sqrt((ring+.5)/5),a=(j+.5)*Math.PI/10;columns.push(nx*Math.cos(a)*rad+nz*Math.sin(a)*rad);}
    function retained(level){var sum=0;for(var k=0;k<columns.length;k++)sum+=Math.max(0,Math.min(top-bottom,(level-columns[k])/ny-bottom));return sum/(columns.length*(top-bottom));}
    for(var pass=0;pass<18;pass++){h=(lo+hi)/2;if(retained(h)<volume)lo=h;else hi=h;}
    h=Math.min(h,ny*top-r*Math.sqrt(nx*nx+nz*nz)-.0006);
    data.effectiveFill=retained(h);
    var poly=[],segments=data.liquidSegments;
    for(j=0;j<segments;j++){a=j/segments*Math.PI*2;poly.push([Math.sin(a)*r,Math.cos(a)*r]);}
    // Clip the circular section at the inner floor. This produces a small
    // crescent at the end of a guzzle, without wine outside the cup wall.
    var clipped=[],limit=h-ny*(bottom+.0004);
    for(j=0;j<poly.length;j++){
      var A=poly[j],B=poly[(j+1)%poly.length],da=nx*A[0]+nz*A[1]-limit,db=nx*B[0]+nz*B[1]-limit;
      if(da<=0)clipped.push(A);
      if((da<0)!==(db<0)){var t=da/(da-db);clipped.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]);}
    }
    if(clipped.length<3){wine.visible=false;return;}
    var cx=0,cz=0;clipped.forEach(function(v){cx+=v[0];cz+=v[1];});cx/=clipped.length;cz/=clipped.length;
    var p=wine.geometry.attributes.position,normalAttribute=wine.geometry.attributes.normal,cy=(h-nx*cx-nz*cz)/ny;p.setXYZ(0,cx,cy,cz);
    for(j=0;j<=clipped.length;j++){var point=clipped[j%clipped.length],x=point[0],z=point[1],wave=(slosh||0)*.0007*Math.sin(j*1.7);p.setXYZ(j+1,x,(h-nx*x-nz*z)/ny+wave,z);}
    // Collapse unused fan triangles so offline exporters that omit drawRange
    // preserve exactly the same depleted pool. All normals share the air side.
    for(j=clipped.length+2;j<p.count;j++)p.setXYZ(j,cx,cy,cz);
    for(j=0;j<p.count;j++)normalAttribute.setXYZ(j,nx,ny,nz);
    p.needsUpdate=true;normalAttribute.needsUpdate=true;wine.geometry.setDrawRange(0,clipped.length*3);wine.geometry.computeBoundingSphere();
  }

  function meatMaterial() {
    if(mats.meat)return mats.meat;
    var canvas=global.document.createElement('canvas');canvas.width=256;canvas.height=256;var c=canvas.getContext('2d'),pixels=c.createImageData(256,256);
    for(var y=0;y<256;y++)for(var x=0;x<256;x++){var i=(y*256+x)*4,v=142+12*Math.sin(x*.81+Math.sin(y*.047)*3)+6*Math.sin(x*2.7+y*.21)+4*Math.sin(x*1.37-y*1.83);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}
    c.putImageData(pixels,0,0);var map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;
    mats.meat=new T.MeshStandardMaterial({vertexColors:true,roughness:.57,bumpMap:map,bumpScale:.00045});mats.meat.name='Moist raw muscle, connective tissue and soft fat';return mats.meat;
  }
  function muscleColor(x,y,z,cut,small) {
    var scale=small?3.6:1,xx=x*scale,yy=y*scale,zz=z*scale;
    var c=new T.Color(0x9b3947),fat=new T.Color(0xddd0b6),fascicle=.5+.5*Math.sin(xx*40+yy*17+Math.sin(zz*25)*.8);
    c.lerp(new T.Color(0xc46c76),.18+.31*fascicle);
    var cap=.071+.009*Math.sin(xx*17+zz*14)+.004*Math.sin(zz*35),t=Math.max(0,Math.min(1,(yy-cap+.006)/.012));
    var seam1=yy-(.022+.25*xx+.013*Math.sin(xx*23+zz*9)),seam2=yy-(-.039-.22*xx+.010*Math.sin(xx*31-zz*8));
    var membrane=Math.exp(-seam1*seam1/.000006)+.70*Math.exp(-seam2*seam2/.000003);
    var fiber=Math.pow(.5+.5*Math.sin(xx*580+yy*95+Math.sin(yy*32+zz*17)*7+Math.sin(xx*16)*3),12)*.065;
    c.lerp(fat,Math.max(t*.93,Math.min(.72,membrane*.60+fiber)));
    if(cut){
      // Embedded scapular section is painted into the actual cut plane, with
      // a darker marrow core and an ivory cortical edge, never a floating disc.
      var bx=(xx-.030)/.036,by=(yy+.010+.26*(xx-.03))/.014,bone=bx*bx+by*by;
      if(bone<1)c.copy(bone>.63?new T.Color(0xe2d5bb):new T.Color(0xbfa88c)).lerp(fat,.10*Math.sin(xx*790));
      else c.multiplyScalar(.94+.05*Math.sin(xx*123+yy*61));
    }
    return c.convertSRGBToLinear();
  }
  function cutMeatMaterial() {
    if(mats.meatCut)return mats.meatCut;
    var canvas=global.document.createElement('canvas');canvas.width=512;canvas.height=512;var ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,512);
    for(var y=0;y<512;y++)for(var x=0;x<512;x++){var c=muscleColor((x/511-.5)*.4,(.5-y/511)*.24,.14,true,false).convertLinearToSRGB(),i=(y*512+x)*4;pixels.data[i]=Math.round(c.r*255);pixels.data[i+1]=Math.round(c.g*255);pixels.data[i+2]=Math.round(c.b*255);pixels.data[i+3]=255;}
    ctx.putImageData(pixels,0,0);var tex=new T.CanvasTexture(canvas);tex.encoding=T.sRGBEncoding;tex.anisotropy=4;
    mats.meatCut=new T.MeshStandardMaterial({map:tex,roughness:.62,bumpMap:meatMaterial().bumpMap,bumpScale:.00027});mats.meatCut.name='Freshly cut muscle fascicles and embedded scapular bone';return mats.meatCut;
  }
  function shoulderGeometry(small) {
    // An authored asymmetric shoulder loft: two real cut planes, broad
    // muscle mass, a flattened supporting underside and a continuous fat cap.
    // No sphere deformation or piled primitives define the primary form.
    var stations=[[-.140,0,.002,.132,.082],[-.118,-.012,.006,.160,.099],[-.070,-.007,.004,.178,.108],[0,.003,.006,.184,.110],[.060,.010,.002,.166,.101],[.112,-.001,-.004,.138,.082],[.140,-.005,-.005,.119,.069]];
    var rings=quality==='high'?36:22,segments=quality==='high'?72:40,p=[],uv=[],colors=[],idx=[],s=small?.24:1;
    function sample(u,a){
      var z=-.14+u*.28,i=1;while(i<stations.length-1&&z>stations[i][0])i++;var A=stations[i-1],B=stations[i],t=(z-A[0])/(B[0]-A[0]),v=[];
      // Hermite interpolation preserves the broad shoulder silhouette without
      // the horizontal rings produced by independently eased loft sections.
      for(var k=1;k<5;k++){var P=stations[Math.max(0,i-2)],Q=stations[Math.min(stations.length-1,i+1)],span=B[0]-A[0],m0=(B[k]-P[k])/(B[0]-P[0])*span,m1=(Q[k]-A[k])/(Q[0]-A[0])*span;v[k]=(2*t*t*t-3*t*t+1)*A[k]+(t*t*t-2*t*t+t)*m0+(-2*t*t*t+3*t*t)*B[k]+(t*t*t-t*t)*m1;}
      var sn=Math.sin(a),cs=Math.cos(a),shape=1+.033*Math.sin(a*3+.5)+.020*Math.cos(a*5-z*12),x=v[1]+Math.sign(sn)*Math.pow(Math.abs(sn),.84)*v[3]*shape,y=v[2]+Math.sign(cs)*Math.pow(Math.abs(cs),.91)*v[4]*shape;
      y=Math.max(-.104,y);y+=.0013*Math.sin(a*19+z*45)*Math.sin(Math.PI*u);return [x*s,y*s,z*s];
    }
    function add(point,u,v,cut){var id=p.length/3,col=muscleColor(point[0],point[1],point[2],cut,small);p.push(point[0],point[1],point[2]);uv.push(u,v);colors.push(col.r,col.g,col.b);return id;}
    for(var i=0;i<=rings;i++)for(var j=0;j<=segments;j++)add(sample(i/rings,j/segments*Math.PI*2),j/segments*3,i/rings*2,false);
    for(i=0;i<rings;i++)for(j=0;j<segments;j++){var a=i*(segments+1)+j,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);}
    var sideCount=idx.length;
    [0,1].forEach(function(end){
      var previous=[],radial=quality==='high'?12:7,center=end?[-.005*s,-.005*s,.140*s]:[0,.002*s,-.140*s];
      // Cut faces share the same perimeter positions as the muscle loft, with
      // a UV/normal seam for the sharp plane left by the cut.
      for(var j=0;j<segments;j++){var point=sample(end,j/segments*Math.PI*2);previous.push(add(point,.5+point[0]/(.4*s),.5+point[1]/(.24*s),true));}
      for(var layer=radial-1;layer>=1;layer--){var current=[],t=layer/radial;
        for(j=0;j<segments;j++){var edge=sample(end,j/segments*Math.PI*2),pt=[center[0]+(edge[0]-center[0])*t,center[1]+(edge[1]-center[1])*t,center[2]],id=add(pt,.5+pt[0]/(.4*s),.5+pt[1]/(.24*s),true);current.push(id);}
        for(j=0;j<segments;j++){var next=(j+1)%segments;if(end)idx.push(previous[j],current[j],previous[next],previous[next],current[j],current[next]);else idx.push(previous[j],previous[next],current[j],previous[next],current[next],current[j]);}previous=current;
      }
      var mid=add(center,.5,.5,true);for(j=0;j<segments;j++){var next=(j+1)%segments;if(end)idx.push(previous[j],mid,previous[next]);else idx.push(previous[j],previous[next],mid);}
    });
    var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.addGroup(0,sideCount,0);g.addGroup(sideCount,idx.length-sideCount,1);g.computeVertexNormals();return g;
  }
  function porkShoulder() {
    var group=new T.Group();group.name='Raw pork shoulder with fat cap and exposed cut face';
    group.add(mesh(geometry('pork-shoulder',function(){return shoulderGeometry(false);}),[meatMaterial(),cutMeatMaterial()],'Continuous whole raw pork shoulder with integral cut ends'));
    group.userData={prop:'raw-pork-shoulder',cutContact:[-.015,.077,.012],pierceContact:[-.100,.012,.005],biteContact:[0,.100,-.126],supportContact:[.065,-.099,0],placementBaseY:-.104,dimensions:[.376,.220,.280]};return group;
  }
  function morsel() {
    var o=mesh(geometry('raw-pork-morsel',function(){return shoulderGeometry(true);}),[meatMaterial(),cutMeatMaterial()],'Small cut morsel pierced by the blade');o.userData={prop:'raw-pork-morsel',piercedByBlade:true};return o;
  }
  global.KM_BANQUET={setQuality:function(q){quality=q==='high'?'high':'low';},sword:sword,zhi:zhi,updateLiquid:updateLiquid,porkShoulder:porkShoulder,morsel:morsel,cycles:{dance:7.8,eat:12,drink:6.4,enter:3.6}};
})(typeof window!=='undefined'?window:this);
