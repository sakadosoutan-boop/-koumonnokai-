const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require(process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas'));
const C={console,performance:require('node:perf_hooks').performance,document:{createElement:()=>createCanvas(1,1)},atob:s=>Buffer.from(s,'base64').toString('binary')};C.window=C;vm.createContext(C);
for(const f of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-head-assets.js','src/js/koumon-heads.js','src/js/koumon-hand-assets.js','src/js/koumon-hands.js','src/js/koumon-costume.js','src/js/koumon-banquet-props.js','src/js/koumon-cast3d.js'])vm.runInContext(fs.readFileSync(f,'utf8'),C,{filename:f});
const rows=[],V=C.THREE.Vector3;
for(const q of ['low','high']){
 C.KM_CAST3D.setQuality(q);
 for(const id of ['sou','haku','kai','u']){
  const f=C.KM_CAST3D.makeFigure(id),r=f.userData.rig;
  for(const pose of id==='kai'?['dance','eat','drink']:['dance']){
   f.userData.setPose(pose);
   for(let i=0;i<16;i++){
    f.userData.state.actionProgress=i/16;f.userData.update(0,0);f.updateMatrixWorld(true);
    const hand=r.arms.R.hand,thumb=new V(-1,0,0).applyQuaternion(hand.quaternion);
    const prop=r.props[pose==='drink'?'cup':'sword'];
    const grip=new V().fromArray(hand.children[0].userData.gripCenter).multiplyScalar(r.s).applyQuaternion(hand.quaternion);r.arms.R.wr.localToWorld(grip);
    const anchor=new V().fromArray(pose==='drink'?prop.userData.handleGrip:prop.userData.gripCenter);prop.localToWorld(anchor);
    const gripGap=grip.distanceTo(anchor);
    if(gripGap>.0005)throw Error(id+'/'+pose+': detached handle '+gripGap);
    const blade=pose==='drink'?null:new V(0,-1,0).applyQuaternion(prop.quaternion).dot(thumb);
    if(blade!==null&&blade<.999)throw Error('Blade exits little-finger side');
    if(r.arms.R.wr.rotation.toArray().slice(0,3).some(x=>Math.abs(x)>(pose==='eat'?.86:.001)))throw Error('Flipped wrist');
    for(const error of Object.values(f.userData.state.contactErrors||{}))if(error>.0005)throw Error('Detached action contact '+error);
    for(const joint of Object.values(f.userData.state.ikDetails||{}))if(Math.abs(joint.forearmTwist)>1.50||joint.flex>2.67)throw Error('Anatomical motion limit');
    rows.push({q,id,pose,phase:i/16,gripGap,bladeToThumb:blade,ik:f.userData.state.contactErrors?JSON.parse(JSON.stringify(f.userData.state.contactErrors)):null,joints:f.userData.state.ikDetails?JSON.parse(JSON.stringify(f.userData.state.ikDetails)):null});
   }
  }
 }
}
const out='model-preview-output/banquet-motion-audit.json';fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(rows,null,2));
const errors=rows.flatMap(r=>r.ik?Object.values(r.ik):[]);
console.log(JSON.stringify({cases:rows.length,maxGripGap:Math.max(...rows.map(r=>r.gripGap)),minBladeThumbAlignment:Math.min(...rows.filter(r=>r.bladeToThumb!==null).map(r=>r.bladeToThumb)),maxIkError:Math.max(...errors),eating:rows.filter(r=>r.q==='high'&&r.pose==='eat').map(r=>({u:r.phase,ik:r.ik})),drinking:rows.filter(r=>r.q==='high'&&r.pose==='drink').map(r=>({u:r.phase,ik:r.ik}))}));
