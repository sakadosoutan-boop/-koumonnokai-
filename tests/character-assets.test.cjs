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

test('raw pork and wine contacts follow bounded human joints and reset between poses',()=>{
  const V=C.THREE.Vector3;C.KM_CAST3D.setQuality('low');
  const f=C.KM_CAST3D.makeFigure('kai'),r=f.userData.rig;
  for(const pose of ['eat','drink']){
    f.userData.setPose(pose);
    for(let i=0;i<16;i++){
      f.userData.state.actionProgress=i/16;f.userData.update(0,0);f.updateMatrixWorld(true);
      for(const gap of Object.values(f.userData.state.contactErrors))assert.ok(gap<.0005,'contact stays within half a millimetre');
      for(const joint of Object.values(f.userData.state.ikDetails)){
        assert.ok(Math.abs(joint.forearmTwist)<1.51,'forearm does not reverse');
        assert.ok(joint.flex>.07&&joint.flex<2.68,'elbow remains within the authored range');
      }
    }
    f.userData.state.actionProgress=pose==='eat'?.24:.5;f.userData.update(0,0);f.updateMatrixWorld(true);
    if(pose==='eat'){
      const point=r.props.sword.localToWorld(new V().fromArray(r.props.sword.userData.spearPoint));
      assert.ok(new C.THREE.Box3().setFromObject(r.props.meat).containsPoint(point),'cut contacts the actual raw shoulder');
      f.userData.state.actionProgress=.7;f.userData.update(0,0);f.updateMatrixWorld(true);
      const bite=r.props.morsel.getWorldPosition(new V()),mouth=r.head.localToWorld(new V(0,-.038,.073));
      assert.ok(bite.distanceTo(mouth)<.075,'pierced piece reaches the mouth');
      assert.equal(r.props.morsel.parent,r.props.sword);
    }else{
      const rim=r.props.cup.localToWorld(new V().fromArray(r.props.cup.userData.drinkContact));
      const mouth=r.head.localToWorld(new V(0,-.038,.073));
      assert.ok(rim.distanceTo(mouth)<.035,'drinking edge reaches the lips');
      const palm=r.arms.L.wr.localToWorld(new V(-.012*r.s,-.075*r.s,0));
      const bottom=r.props.cup.localToWorld(new V().fromArray(r.props.cup.userData.baseSupport));
      assert.ok(palm.distanceTo(bottom)<.010,'left palm supports the base');
    }
  }
  f.userData.setPose('stand');assert.equal(r.arms.R.wr.rotation.x,0,'eating wrist flexion is cleared');
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
      }
    }
  }
  stage.setPose('haku','sit');assert.equal(actors.haku.position.x,actors.haku.userData.home.x);
});
