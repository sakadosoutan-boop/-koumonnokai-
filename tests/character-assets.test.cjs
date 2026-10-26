const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..');
function canvas(){
  const c={width:1,height:1};
  const noop=()=>{},gradient={addColorStop:noop};
  const ctx=new Proxy({canvas:c,createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:t=>({width:t.length*8})},{get:(o,k)=>k in o?o[k]:noop});
  c.getContext=()=>ctx;return c;
}
const C={console,performance,document:{createElement:canvas},atob:s=>Buffer.from(s,'base64').toString('binary'),setTimeout,clearTimeout};C.window=C;vm.createContext(C);
for(const file of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-head-assets.js','src/js/koumon-heads.js','src/js/koumon-hand-assets.js','src/js/koumon-hands.js','src/js/koumon-costume.js','src/js/koumon-banquet-props.js','src/js/koumon-cast3d.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),C,{filename:file});
const ids=['hai','u','ryo','zo','haku','kai','sou','chin'];
function healthy(object,label='asset'){
  let count=0;object.updateMatrixWorld(true);
  object.traverse(o=>{if(!o.isMesh)return;count++;
    const g=o.geometry,p=g.attributes.position,n=g.attributes.normal;
    assert.ok(p&&n&&p.count>0,'mesh has positions and normals');
    for(const value of p.array)assert.ok(Number.isFinite(value),'finite positions');
    let usable=0,sampled=0;
    for(let i=0;i<n.count;i+=Math.max(1,Math.floor(n.count/90))){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert.ok(Number.isFinite(length)&&length<1.6,'finite normal: '+label);sampled++;if(length>.4)usable++;}
    // Flattened shoe bottoms and closed surface poles contain degenerate faces.
    assert.ok(usable>sampled*.75,'most surface normals are usable: '+label+' '+g.type);
    if(g.index)for(const value of g.index.array)assert.ok(value<p.count,'index references a vertex');
    assert.ok(o.matrixWorld.elements.every(Number.isFinite),'finite placement');
  });assert.ok(count>0);
}
test('every principal character uses an anatomical head in both quality levels',()=>{
  for(const quality of ['low','high'])for(const id of ids){
    const built=C.KM_HEADS.build(id,C.KM_CAST3D.CAST[id].head,quality);
    assert.ok(built&&built.asset&&built.surface&&built.eyes,id+' has an asset head');healthy(built.group);
    const box=new C.THREE.Box3().setFromObject(built.surface),size=box.getSize(new C.THREE.Vector3());
    assert.ok(size.x>.10&&size.x<.26&&size.y>.20&&size.y<.45,id+' has a plausible head and neck scale');
  }
});
test('character rig preserves imported facial geometry and survives representative poses',()=>{
  C.KM_CAST3D.setQuality('low');
  for(const id of ids){
    const reference=C.KM_HEADS.build(id,C.KM_CAST3D.CAST[id].head,'low').surface.geometry.attributes.position.array;
    const figure=C.KM_CAST3D.makeFigure(id);let surface;
    figure.userData.rig.headPiv.traverse(o=>{if(o.userData.part==='skin')surface=o;});
    assert.ok(surface,'anatomical surface is attached to the animated head');
    const actual=surface.geometry.attributes.position.array;
    assert.equal(actual.length,reference.length);
    for(let i=0;i<actual.length;i+=97)assert.equal(actual[i],reference[i],'face is not warped a second time');
    for(const pose of ['stand','sit','kneel','drink','dance','run']){
      figure.userData.setPose(pose);figure.userData.update(.016,.5);healthy(figure,id+'/'+pose);
      if(pose==='drink'){
        const rig=figure.userData.rig,A=rig.arms.R,hand=A.hand.children[0];
        const grip=new C.THREE.Vector3().fromArray(hand.userData.gripCenter).multiplyScalar(rig.s).applyQuaternion(A.hand.quaternion);
        A.wr.localToWorld(grip);
        const handle=rig.props.cup.localToWorld(new C.THREE.Vector3().fromArray(rig.props.cup.userData.handleGrip));
        assert.ok(grip.distanceTo(handle)<.001,'cup handle stays in the anatomical grip');
      }
      const box=new C.THREE.Box3().setFromObject(figure);
      assert.ok(box.min.y>-1&&box.max.y<4,'pose remains at human scale');
    }
  }
});
test('anatomical hand poses stay finite and export a usable handle grip',()=>{
  for(const quality of ['low','high'])for(const side of ['L','R'])for(const pose of ['relax','lap','grasp','hold','point']){
    const hand=C.KM_HANDS.build(pose,side,C.KM_CAST3D.CAST.hai.head,quality);healthy(hand);
    assert.ok(hand.userData.gripCenter.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...hand.userData.gripAxis)-1)<.01,'unit grip axis');
    assert.ok(hand.userData.gripRadius>.005&&hand.userData.gripRadius<.04,'hand-sized handle');
  }
});

test('a sword leaves the thumb side of the fist throughout the sword dance',()=>{
  const V=C.THREE.Vector3;C.KM_CAST3D.setQuality('low');
  for(const id of ['sou','haku','u','kai']){
    const f=C.KM_CAST3D.makeFigure(id),r=f.userData.rig;f.userData.setPose('dance');
    for(let i=0;i<16;i++){
      f.userData.state.actionProgress=i/16;f.userData.update(0,0);f.updateMatrixWorld(true);
      const a=r.arms.R,p=r.props.sword,thumb=new V(-1,0,0).applyQuaternion(a.hand.quaternion);
      const blade=new V().fromArray(p.userData.bladeDirection).applyQuaternion(p.quaternion);
      assert.ok(blade.dot(thumb)>.999,'guard is at the index finger, pommel at the little finger');
      assert.ok(a.el.rotation.x<0&&a.el.rotation.x>-2.7,'elbow bends in its anatomical direction');
      assert.equal(a.wr.rotation.x,0);assert.equal(a.wr.rotation.y,0);assert.equal(a.wr.rotation.z,0);
      assert.equal(f.position.length(),0,'stage motion does not slide the figure');
    }
  }
});

function actionNodes(r){
  const nodes={body:r.body,pelvis:r.pelvis,spine:r.spine,neck:r.neck,head:r.headPiv};
  for(const side of ['L','R'])for(const name of ['sh','el','wr','hand'])nodes[side+'/'+name]=r.arms[side][name];
  for(const name of ['sword','cup','meat'])nodes[name]=r.props[name];
  return nodes;
}
function actionSnapshot(r){
  return Object.fromEntries(Object.entries(actionNodes(r)).map(([name,node])=>{
    // Detached, hidden props can retain the previous parent's cached matrix.
    const worldQ=node.getWorldQuaternion(new C.THREE.Quaternion());
    return [name,{matrix:Array.from(node.matrixWorld.elements),localQ:node.quaternion.clone(),worldQ}];
  }));
}
function quaternionStep(a,b){return 2*Math.acos(Math.min(1,Math.abs(a.dot(b))));}
function actionFrame(f,u){f.userData.state.actionProgress=u;f.userData.update(0,0);f.updateMatrixWorld(true);}

for(const quality of ['low','high'])test('Fan Kuai carries the whole shoulder and drinks with continuous, deterministic joints ('+quality+')',()=>{
  const V=C.THREE.Vector3,Q=C.THREE.Quaternion;C.KM_CAST3D.setQuality(quality);
  const f=C.KM_CAST3D.makeFigure('kai'),r=f.userData.rig,meat=r.props.meat,geometry=meat.children[0].geometry;
  // A stage translation and yaw exercise the world-space contacts as well as the isolated rig.
  f.position.set(.37,.08,-.21);f.rotation.y=.43;
  for(const pose of ['eat','drink']){
    f.userData.setPose(pose);
    const frames=[],endpoints=[];let previous;
    for(let i=0;i<=720;i++){
      const u=i/720,label=quality+'/'+pose+'@'+u.toFixed(5);actionFrame(f,u);
      const state=f.userData.state,prop=r.props[pose==='drink'?'cup':'sword'];
      const grip=r.arms.R.wr.localToWorld(new V().fromArray(r.arms.R.hand.children[0].userData.gripCenter).multiplyScalar(r.s).applyQuaternion(r.arms.R.hand.quaternion));
      const handle=prop.localToWorld(new V().fromArray(prop.userData[pose==='drink'?'handleGrip':'gripCenter']));
      assert.ok(grip.distanceTo(handle)<.0005,label+' handle stays inside the closed hand');
      assert.equal(Object.keys(state.contactErrors).length,2,label+' solves both hands');
      for(const gap of Object.values(state.contactErrors))assert.ok(Number.isFinite(gap)&&gap<.0005,label+' solver contact stays within half a millimetre');
      for(const [side,joint] of Object.entries(state.ikDetails)){
        const arm=r.arms[side],bend=2*Math.acos(Math.min(1,Math.abs(arm.wr.quaternion.w)));
        assert.ok(joint.analytic,label+' uses the deterministic analytic solution');
        assert.ok(Math.abs(joint.forearmTwist)<1.50,label+' forearm does not reverse');
        assert.ok(joint.flex>.07&&joint.flex<2.68,label+' elbow stays in range');
        assert.ok(bend<1.24,label+' wrist bend stays below 71 degrees');
        assert.ok(Math.abs(arm.el.rotation.x+joint.flex)<1e-9,label+' elbow diagnostic matches the actual joint');
        assert.ok(arm.sh.getWorldPosition(new V()).y-arm.el.getWorldPosition(new V()).y>.02*r.s,label+' elbow remains below the shoulder');
      }
      const mouth=r.head.localToWorld(new V(0,-.038,.073));
      const palm=r.arms.L.wr.localToWorld(new V(-.012*r.s,-.075*r.s,0));
      if(pose==='eat'){
        const contact=meat.userData.contactState;
        assert.equal(r.props.meat,meat,label+' retains the original full shoulder');
        assert.equal(meat.children[0].geometry,geometry,label+' keeps the complete mesh');
        assert.equal(meat.parent,f,label+' shoulder stays in the rig coordinate frame');
        assert.ok(meat.visible&&(!r.props.morsel||!r.props.morsel.visible),label+' displays the whole shoulder without a substitute morsel');
        assert.ok(meat.scale.distanceTo(new V(r.s,r.s,r.s))<1e-10,label+' does not shrink the meat');
        assert.ok(contact.wholeShoulder,label+' marks the carried load as a whole shoulder');
        const center=f.worldToLocal(meat.getWorldPosition(new V()));
        if(i===0||i===720){
          endpoints.push(center.clone());
          const box=new C.THREE.Box3().setFromObject(meat),size=box.getSize(new V());
          const meatCenter=meat.getWorldPosition(new V());
          const hits=new C.THREE.Raycaster(new V(meatCenter.x,box.max.y+.1,meatCenter.z),new V(0,-1,0)).intersectObject(r.props.shield,true);
          assert.ok(hits.length>0,label+' shoulder rests over the shield');
          assert.ok(Math.abs(box.min.y-hits[0].point.y)<.003*r.s,label+' rests the shoulder on the actual shield surface');
          assert.ok(size.x>.30*r.s&&size.z>.25*r.s,label+' retains the large shoulder silhouette');
        }
        if(u>=.34&&u<=.94){
          const blade=prop.localToWorld(new V().fromArray(contact.bladePoint)),pierce=meat.localToWorld(new V().fromArray(meat.userData.pierceContact));
          assert.ok(blade.distanceTo(pierce)<.0005,label+' blade remains embedded in the same full shoulder');
          assert.ok(new C.THREE.Box3().setFromObject(meat).containsPoint(blade),label+' blade contact is inside the actual meat bounds');
        }
        if(u>=.67&&u<=.77){
          const bite=meat.localToWorld(new V().fromArray(meat.userData.biteContact));
          assert.ok(bite.distanceTo(mouth)<.015*r.s,label+' the whole shoulder cut face reaches the lips');
          assert.ok(center.y>endpoints[0].y+.4*r.s,label+' lifts the full shoulder from the shield');
          const line=new C.THREE.Line3(prop.localToWorld(new V().fromArray(prop.userData.bladeRoot)),prop.localToWorld(new V().fromArray(prop.userData.bladeTip)));
          assert.ok(line.closestPointToPoint(mouth,true,new V()).distanceTo(mouth)>.14*r.s,label+' the blade clears the face during the bite');
        }
        if(u>=.57&&u<=.86){
          const support=meat.localToWorld(new V().fromArray(meat.userData.supportContact));
          assert.ok(palm.distanceTo(support)<.0005,label+' left palm supports the actual shoulder');
        }
      }else{
        const cup=r.props.cup,bottom=cup.localToWorld(new V().fromArray(cup.userData.baseSupport));
        assert.ok(palm.distanceTo(bottom)<.0005,label+' left palm supports the actual cup base');
        const up=new V(0,1,0).applyQuaternion(cup.getWorldQuaternion(new Q())).applyQuaternion(f.getWorldQuaternion(new Q()).invert());
        const pitch=Math.atan2(up.z,up.y);
        assert.ok(pitch<=1e-8&&pitch>-.9,label+' cup tilts toward the drinker');
        if(u>=.28&&u<=.82){
          const rim=cup.localToWorld(new V().fromArray(cup.userData.drinkContact));
          const center=cup.getWorldPosition(new V()),forward=new V(0,0,1).applyQuaternion(r.head.getWorldQuaternion(new Q()));
          assert.ok(rim.distanceTo(mouth)<.015*r.s,label+' drinking edge reaches the lips');
          assert.ok(center.clone().sub(mouth).dot(forward)>.05*r.s,label+' cup stays in front of the mouth');
          assert.ok(rim.clone().sub(center).dot(forward)<-.04*r.s,label+' the near rim faces the lips');
        }
        if(u>=.56&&u<=.69)assert.ok(pitch<-.78,label+' raises the cup base for the sustained drink');
      }
      const current=actionSnapshot(r);frames.push(current);
      for(const [name,node] of Object.entries(current)){
        assert.ok(node.matrix.every(Number.isFinite),label+' '+name+' has a finite world transform');
        if(previous){
          assert.ok(quaternionStep(node.localQ,previous[name].localQ)<.10,label+' '+name+' local quaternion has no snap');
          assert.ok(quaternionStep(node.worldQ,previous[name].worldQ)<.10,label+' '+name+' world quaternion has no snap');
        }
      }
      previous=current;
    }
    if(pose==='eat')assert.ok(endpoints[0].distanceTo(endpoints[1])<1e-9,'the whole shoulder returns to its original place');
    for(const name of Object.keys(frames[0]))assert.ok(quaternionStep(frames[0][name].worldQ,frames[720][name].worldQ)<1e-6,quality+'/'+pose+' '+name+' closes the animation cycle');
    // The permutation jumps repeatedly across the cycle instead of warming up an incremental solver.
    for(let i=0;i<=720;i++){
      const index=i*193%721;actionFrame(f,index/720);const actual=actionSnapshot(r),expected=frames[index];
      for(const name of Object.keys(actual))for(let k=0;k<16;k++)assert.ok(Math.abs(actual[name].matrix[k]-expected[name].matrix[k])<1e-8,quality+'/'+pose+' '+name+' is independent of frame order');
    }
  }
  f.userData.setPose('stand');
  for(const side of ['L','R'])assert.ok(r.arms[side].wr.quaternion.angleTo(new Q())<1e-9,'action wrist flexion is cleared');
  assert.ok(!r.props.meat.parent&&!r.props.cup.parent,'action props are removed on return to standing');
});

test('Xiang Bo interposes between the dancer and Liu Bang, with blades clear of heads',()=>{
  vm.runInContext(fs.readFileSync(path.join(root,'src/js/koumon-3d.js'),'utf8'),C);
  const stage=C.KoumonStage3D,V=C.THREE.Vector3,actors={};stage.S.stageId='feast';stage.S.cast=actors;
  C.KM_CAST3D.setQuality('low');
  for(const id of ['sou','haku','hai','u','ryo']){
    const p=stage.STAGES.feast.pos[id],f=C.KM_CAST3D.makeFigure(id);actors[id]=f;
    f.position.set(p[0],0,p[1]);f.rotation.y=p[2];f.userData.home={x:p[0],z:p[1],yaw:p[2]};f.userData.setPose('sit');
  }
  stage.setPose('sou','dance');stage.setPose('haku','dance');
  const start=actors.sou.position,end=actors.hai.position,guard=actors.haku.position;
  assert.ok(guard.z>start.z&&guard.z<end.z&&Math.abs(guard.x)<.5,'guard stands in the line to the guest');
  for(let i=0;i<16;i++){
    for(const id of ['sou','haku']){const f=actors[id];f.userData.state.actionProgress=i/16;f.userData.update(0,0);}
    Object.values(actors).forEach(f=>f.updateMatrixWorld(true));
    for(const id of ['sou','haku']){
      const p=actors[id].userData.rig.props.sword,a=p.localToWorld(new V().fromArray(p.userData.bladeRoot)),b=p.localToWorld(new V().fromArray(p.userData.bladeTip));
      const line=new C.THREE.Line3(a,b);
      for(const [other,f] of Object.entries(actors))if(other!==id){
        const head=f.userData.rig.head.localToWorld(new V(0,.015,.01));
        assert.ok(line.closestPointToPoint(head,true,new V()).distanceTo(head)>.14,id+' blade clears '+other+' head');
        if(other==='sou'||other==='haku'){
          const otherRig=f.userData.rig,palm=otherRig.arms.L.wr.localToWorld(new V(0,-.07*otherRig.s,0));
          assert.ok(line.closestPointToPoint(palm,true,new V()).distanceTo(palm)>.07,id+' blade clears '+other+' free hand');
        }
      }
    }
  }
  stage.setPose('haku','sit');assert.equal(actors.haku.position.x,actors.haku.userData.home.x);
});
