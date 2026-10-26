const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require(process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas'));
const root=path.resolve(__dirname,'..');
const C={console,performance:require('node:perf_hooks').performance,document:{createElement:()=>createCanvas(1,1)},atob:s=>Buffer.from(s,'base64').toString('binary')};C.window=C;vm.createContext(C);
for(const f of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-head-assets.js','src/js/koumon-heads.js','src/js/koumon-hand-assets.js','src/js/koumon-hands.js','src/js/koumon-costume.js','src/js/koumon-banquet-props.js','src/js/koumon-cast3d.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});
const rows=[],V=C.THREE.Vector3,Q=C.THREE.Quaternion,maxima={},minima={};let denseCases=0,determinismCases=0;
function max(name,value){if(!Number.isFinite(value))throw Error('Nonfinite '+name);maxima[name]=Math.max(maxima[name]||0,value);return value;}
function min(name,value){if(!Number.isFinite(value))throw Error('Nonfinite '+name);minima[name]=Math.min(minima[name]===undefined?Infinity:minima[name],value);return value;}
function check(condition,label){if(!condition)throw Error(label);}
function frame(f,u){f.userData.state.actionProgress=u;f.userData.update(0,0);f.updateMatrixWorld(true);}
function nodes(r){
 const out={body:r.body,pelvis:r.pelvis,spine:r.spine,neck:r.neck,head:r.headPiv};
 for(const side of ['L','R'])for(const name of ['sh','el','wr','hand'])out[side+'/'+name]=r.arms[side][name];
 for(const name of ['sword','cup','meat'])out[name]=r.props[name];return out;
}
function snapshot(r){return Object.fromEntries(Object.entries(nodes(r)).map(([name,o])=>{const worldQ=o.getWorldQuaternion(new Q());return [name,{matrix:Array.from(o.matrixWorld.elements),localQ:o.quaternion.clone(),worldQ}];}));}
function angle(a,b){return 2*Math.acos(Math.min(1,Math.abs(a.dot(b))));}
function inspect(f,q,id,pose,u,kind){
 const r=f.userData.rig,state=f.userData.state,label=q+'/'+id+'/'+pose+'@'+u.toFixed(6),prop=r.props[pose==='drink'?'cup':'sword'];
 const grip=r.arms.R.wr.localToWorld(new V().fromArray(r.arms.R.hand.children[0].userData.gripCenter).multiplyScalar(r.s).applyQuaternion(r.arms.R.hand.quaternion));
 const anchor=prop.localToWorld(new V().fromArray(prop.userData[pose==='drink'?'handleGrip':'gripCenter']));
 const row={kind,q,id,pose,phase:u,gripGap:max('gripGap',grip.distanceTo(anchor))};
 check(row.gripGap<.0005,label+' detached handle');
 if(pose!=='drink'){
  const thumb=new V(-1,0,0).transformDirection(r.arms.R.hand.matrixWorld);
  row.bladeToThumb=min('bladeToThumb',new V().fromArray(prop.userData.bladeDirection).transformDirection(prop.matrixWorld).dot(thumb));
  check(row.bladeToThumb>.999,label+' blade exits the little-finger side');
 }
 for(const error of Object.values(state.contactErrors||{}))check(max('solverContact',error)<.0005,label+' detached action contact');
 row.joints={};
 for(const [side,joint] of Object.entries(state.ikDetails||{})){
  const arm=r.arms[side],wristBend=max('wristBend',2*Math.acos(Math.min(1,Math.abs(arm.wr.quaternion.w))));
  check(wristBend<1.24,label+'/'+side+' wrist exceeds 71 degrees');
  check(max('forearmTwist',Math.abs(joint.forearmTwist))<1.50,label+'/'+side+' forearm reversal');
  check(max('elbowFlex',joint.flex)<2.68&&joint.flex>.07,label+'/'+side+' elbow limit');
  check(Math.abs(arm.el.rotation.x+joint.flex)<1e-9,label+'/'+side+' elbow diagnostic mismatch');
  const drop=min('shoulderElbowDrop',arm.sh.getWorldPosition(new V()).y-arm.el.getWorldPosition(new V()).y);
  check(drop>.02*r.s,label+'/'+side+' elbow above shoulder');
  row.joints[side]={flex:joint.flex,forearmTwist:joint.forearmTwist,wristBend,shoulderElbowDrop:drop};
 }
 if(pose==='dance'){
  check(r.arms.R.wr.quaternion.angleTo(new Q())<1e-9,label+' dance wrist flipped');
 }else{
  check(Object.keys(state.ikDetails).length===2&&Object.keys(state.contactErrors).length===2,label+' must solve both hands');
  row.ik=JSON.parse(JSON.stringify(state.contactErrors));
  const mouth=r.head.localToWorld(new V(0,-.038,.073)),palm=r.arms.L.wr.localToWorld(new V(-.012*r.s,-.075*r.s,0));
  if(pose==='eat'){
   const meat=r.props.meat,contact=meat.userData.contactState;
   check(contact.wholeShoulder&&meat.visible&&meat.parent===f,label+' must carry the full existing shoulder');
   check(!r.props.morsel||!r.props.morsel.visible,label+' must not substitute a morsel');
   check(meat.scale.distanceTo(new V(r.s,r.s,r.s))<1e-10,label+' must not shrink the shoulder');
   row.lift=contact.lift;row.brace=contact.brace;
   if(u>=.34&&u<=.94){
    const blade=prop.localToWorld(new V().fromArray(contact.bladePoint)),pierce=meat.localToWorld(new V().fromArray(meat.userData.pierceContact));
    row.bladePierceGap=max('bladePierceGap',blade.distanceTo(pierce));check(row.bladePierceGap<.0005,label+' blade detached from the full shoulder');
    check(new C.THREE.Box3().setFromObject(meat).containsPoint(blade),label+' blade contact outside meat bounds');
   }
   if(u>=.67&&u<=.77){
    row.shoulderBiteGap=max('shoulderBiteGap',meat.localToWorld(new V().fromArray(meat.userData.biteContact)).distanceTo(mouth));
    check(row.shoulderBiteGap<.015*r.s,label+' full shoulder misses the lips');
    const line=new C.THREE.Line3(prop.localToWorld(new V().fromArray(prop.userData.bladeRoot)),prop.localToWorld(new V().fromArray(prop.userData.bladeTip)));
    row.bladeLipClearance=min('bladeLipClearance',line.closestPointToPoint(mouth,true,new V()).distanceTo(mouth));check(row.bladeLipClearance>.14*r.s,label+' blade reaches the face');
   }
   if(u>=.57&&u<=.86){
    row.shoulderSupportGap=max('shoulderSupportGap',palm.distanceTo(meat.localToWorld(new V().fromArray(meat.userData.supportContact))));
    check(row.shoulderSupportGap<.0005,label+' left palm misses the full shoulder');
   }
   if(u===0||u===1){
    const box=new C.THREE.Box3().setFromObject(meat),size=box.getSize(new V());
    const center=meat.getWorldPosition(new V()),hits=new C.THREE.Raycaster(new V(center.x,box.max.y+.1,center.z),new V(0,-1,0)).intersectObject(r.props.shield,true);
    check(hits.length>0,label+' shoulder is not over the shield');
    row.shieldGap=max('shoulderShieldGap',Math.abs(box.min.y-hits[0].point.y));
    check(row.shieldGap<.003*r.s,label+' shoulder does not rest on the shield');
    check(size.x>.30*r.s&&size.z>.25*r.s,label+' shoulder no longer has its full silhouette');
   }
  }else{
   const cup=r.props.cup;
   row.cupSupportGap=max('cupSupportGap',palm.distanceTo(cup.localToWorld(new V().fromArray(cup.userData.baseSupport))));check(row.cupSupportGap<.0005,label+' left palm misses the cup base');
   const up=new V(0,1,0).applyQuaternion(cup.getWorldQuaternion(new Q())).applyQuaternion(f.getWorldQuaternion(new Q()).invert());
   row.cupPitch=Math.atan2(up.z,up.y);max('cupTilt',Math.abs(row.cupPitch));check(row.cupPitch<=1e-8&&row.cupPitch>-.9,label+' cup tilts away from the drinker');
   if(u>=.28&&u<=.82){
    const rim=cup.localToWorld(new V().fromArray(cup.userData.drinkContact)),center=cup.getWorldPosition(new V()),forward=new V(0,0,1).applyQuaternion(r.head.getWorldQuaternion(new Q()));
    row.cupRimGap=max('cupRimGap',rim.distanceTo(mouth));check(row.cupRimGap<.015*r.s,label+' rim misses the lips');
    row.cupForward=min('cupForward',center.clone().sub(mouth).dot(forward));check(row.cupForward>.05*r.s,label+' cup center is behind the mouth');
    row.nearRimForward=rim.clone().sub(center).dot(forward);check(row.nearRimForward<-.04*r.s,label+' the wrong rim faces the lips');
   }
   if(u>=.56&&u<=.69)check(row.cupPitch<-.78,label+' cup base is not raised for the drink');
  }
 }
 rows.push(row);return row;
}
for(const q of ['low','high']){
 C.KM_CAST3D.setQuality(q);
 // Keep the original 192 representative cases, including the sword dancers.
 for(const id of ['sou','haku','kai','u']){
  const f=C.KM_CAST3D.makeFigure(id);
  for(const pose of id==='kai'?['dance','eat','drink']:['dance']){
   f.userData.setPose(pose);
   for(let i=0;i<16;i++){frame(f,i/16);inspect(f,q,id,pose,i/16,'representative');}
  }
 }
 const f=C.KM_CAST3D.makeFigure('kai'),r=f.userData.rig,meat=r.props.meat,geometry=meat.children[0].geometry;
 f.position.set(.37,.08,-.21);f.rotation.y=.43;
 for(const pose of ['eat','drink']){
  f.userData.setPose(pose);const frames=[];let previous,firstMeatCenter;
  for(let i=0;i<=720;i++){
   const u=i/720,label=q+'/kai/'+pose+'@'+u.toFixed(6);frame(f,u);const row=inspect(f,q,'kai',pose,u,'dense'),current=snapshot(r);denseCases++;
   if(pose==='eat'){
    check(r.props.meat===meat&&meat.children[0].geometry===geometry,label+' replaced the whole shoulder');
    const center=f.worldToLocal(meat.getWorldPosition(new V()));
    if(i===0)firstMeatCenter=center.clone();
    if(u>=.67&&u<=.77)check(center.y>firstMeatCenter.y+.4*r.s,label+' full shoulder never leaves the shield');
    if(i===720)check(max('shoulderReturnGap',center.distanceTo(firstMeatCenter))<1e-9,label+' shoulder does not return to its original place');
   }
   for(const [name,node] of Object.entries(current)){
    check(node.matrix.every(Number.isFinite),label+'/'+name+' nonfinite world matrix');
    if(previous){
     const local=max('localQuaternionStep',angle(previous[name].localQ,node.localQ)),world=max('worldQuaternionStep',angle(previous[name].worldQ,node.worldQ));
     check(local<.10&&world<.10,label+'/'+name+' quaternion discontinuity');
     row.maxLocalStep=Math.max(row.maxLocalStep||0,local);row.maxWorldStep=Math.max(row.maxWorldStep||0,world);
    }
   }
   frames.push(current);previous=current;
  }
  for(const name of Object.keys(frames[0]))check(max('cycleQuaternionGap',angle(frames[0][name].worldQ,frames[720][name].worldQ))<1e-6,q+'/'+pose+'/'+name+' open animation cycle');
  for(let i=0;i<=720;i++){
   const index=i*193%721;frame(f,index/720);const actual=snapshot(r),expected=frames[index];determinismCases++;
   for(const name of Object.keys(actual))for(let k=0;k<16;k++)check(max('outOfOrderMatrixDelta',Math.abs(actual[name].matrix[k]-expected[name].matrix[k]))<1e-8,q+'/'+pose+'/'+name+' depends on frame order');
  }
 }
 f.userData.setPose('stand');for(const side of ['L','R'])check(r.arms[side].wr.quaternion.angleTo(new Q())<1e-9,q+' action wrist did not reset');
}
const out=path.join(root,'model-preview-output/banquet-motion-audit.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({maxima,minima,rows},null,2));
console.log(JSON.stringify({cases:rows.length,denseCases,determinismCases,maxima,minima,details:path.relative(root,out).replaceAll('\\','/')}));
