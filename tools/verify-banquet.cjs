const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require(process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas'));
const root=path.resolve(__dirname,'..');
const castSha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'src/js/koumon-cast3d.js'))).digest('hex');
const C={console,performance:require('node:perf_hooks').performance,document:{createElement:()=>createCanvas(1,1)},atob:s=>Buffer.from(s,'base64').toString('binary')};C.window=C;vm.createContext(C);
for(const f of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-head-assets.js','src/js/koumon-heads.js','src/js/koumon-hand-assets.js','src/js/koumon-hands.js','src/js/koumon-costume.js','src/js/koumon-banquet-props.js','src/js/koumon-cast3d.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});
const rows=[],dance=[],guzzling=[],V=C.THREE.Vector3,Q=C.THREE.Quaternion,maxima={},minima={};let denseCases=0,determinismCases=0,denseDanceCases=0;
function max(name,value){if(!Number.isFinite(value))throw Error('Nonfinite '+name);maxima[name]=Math.max(maxima[name]||0,value);return value;}
function min(name,value){if(!Number.isFinite(value))throw Error('Nonfinite '+name);minima[name]=Math.min(minima[name]===undefined?Infinity:minima[name],value);return value;}
function check(condition,label){if(!condition)throw Error(label);}
function frame(f,u){f.userData.state.actionProgress=u;f.userData.update(0,0);f.updateMatrixWorld(true);}
function nodes(r){
 const out={body:r.body,pelvis:r.pelvis,spine:r.spine,neck:r.neck,head:r.headPiv};
 for(const side of ['L','R'])for(const name of ['sh','el','wr','hand'])out[side+'/'+name]=r.arms[side][name];
 for(const side of ['L','R'])for(const name of ['hip','knee','shoe'])if(r.legs[side][name])out[side+'/'+name]=r.legs[side][name];
 for(const name of ['sword','cup','meat'])out[name]=r.props[name];return out;
}
function snapshot(r){return Object.fromEntries(Object.entries(nodes(r)).map(([name,o])=>{const worldQ=o.getWorldQuaternion(new Q()).normalize();return [name,{matrix:Array.from(o.matrixWorld.elements),localQ:o.quaternion.clone(),worldQ}];}));}
function angle(a,b){return 2*Math.acos(Math.min(1,Math.abs(a.dot(b))));}
function pelvisYaw(f,r){const q=f.getWorldQuaternion(new Q()).invert().multiply(r.pelvis.getWorldQuaternion(new Q())),forward=new V(0,0,1).applyQuaternion(q);return Math.atan2(forward.x,forward.z);}
function originalMotifScore(r,key){
 const a=r.arms.R,p=r.props.sword,shoulder=new Q().setFromEuler(new C.THREE.Euler(-key[0],key[3],-key[1])),elbow=new Q().setFromEuler(new C.THREE.Euler(-key[2],a.el.rotation.y,0));
 const expected=new V().fromArray(p.userData.bladeDirection).applyQuaternion(p.quaternion).applyQuaternion(elbow).applyQuaternion(shoulder),actual=new V().fromArray(p.userData.bladeDirection).transformDirection(p.matrixWorld).applyQuaternion(r.chest.getWorldQuaternion(new Q()).invert());
 return Math.max(angle(a.sh.quaternion,shoulder)/.22,Math.abs(a.el.rotation.x+key[2])/.18,actual.distanceTo(expected)/.30);
}
vm.runInContext(fs.readFileSync(path.join(root,'src/js/koumon-3d.js'),'utf8'),C);
function inspectDance(q){
 const steps=720,stage=C.KoumonStage3D,actors={},stats={},saved={},safety={sou:[],haku:[]},safetyFrames=new Set(Array.from({length:64},(_,i)=>Math.round(i*steps/64)));stage.S.stageId='feast';stage.S.cast=actors;
 for(const id of ['sou','haku','hai','u','ryo']){
  const p=stage.STAGES.feast.pos[id],f=C.KM_CAST3D.makeFigure(id);actors[id]=f;f.position.set(p[0],0,p[1]);f.rotation.y=p[2];f.userData.home={x:p[0],z:p[1],yaw:p[2]};f.userData.setPose('sit');
 }
 stage.setPose('sou','dance');stage.setPose('haku','dance');
 const cycle=C.KM_BANQUET.cycles.dance;check(cycle>=4&&cycle<=8,q+' dance phrase must fit a short stage sequence');
 const roots=Object.fromEntries(['sou','haku'].map(id=>[id,{position:actors[id].position.clone(),yaw:actors[id].rotation.y}]));
 for(const id of ['sou','haku']){stats[id]={q,id,cycle,bladePath:0,peakBladeSpeed:0,fastCutSpeed:0,maxLocalStep:0,maxWorldStep:0,minHeadClearance:Infinity,minFreeHandClearance:Infinity,originalMotifScores:[Infinity,Infinity],ranges:{}};saved[id]=[];}
 function range(s,key,value){const span=s.ranges[key]||(s.ranges[key]=[Infinity,-Infinity]);span[0]=Math.min(span[0],value);span[1]=Math.max(span[1],value);}
 const tips={},feetPrevious={},yawPrevious={},yawUnwrapped={sou:0,haku:0};
 for(let i=0;i<=steps;i++){
  for(const id of ['sou','haku'])frame(actors[id],i/steps);
  Object.values(actors).forEach(f=>f.updateMatrixWorld(true));
  for(const id of ['sou','haku']){
   const f=actors[id],r=f.userData.rig,s=stats[id],row=inspect(f,q,id,'dance',i/steps,'dense-dance'),p=r.props.sword;
   check(max('danceRootShift',f.position.distanceTo(roots[id].position))<1e-10&&Math.abs(f.rotation.y-roots[id].yaw)<1e-10,q+'/'+id+' stage root moves during body rotation');
   const yaw=pelvisYaw(f,r);if(yawPrevious[id]!==undefined)yawUnwrapped[id]+=Math.atan2(Math.sin(yaw-yawPrevious[id]),Math.cos(yaw-yawPrevious[id]));yawPrevious[id]=yaw;range(s,'bodyTurn',yawUnwrapped[id]);
   if(i/steps<=.35){s.originalMotifScores[0]=Math.min(s.originalMotifScores[0],originalMotifScore(r,[.88,.42,.62,-.42]));s.originalMotifScores[1]=Math.min(s.originalMotifScores[1],originalMotifScore(r,[.52,.86,.27,-.46]));}
   const a=p.localToWorld(new V().fromArray(p.userData.bladeRoot)),b=p.localToWorld(new V().fromArray(p.userData.bladeTip)),line=new C.THREE.Line3(a,b);
   if(safetyFrames.has(i))safety[id].push({a:a.clone(),b:b.clone(),head:r.head.localToWorld(new V(0,.015,.01)),palm:r.arms.L.wr.localToWorld(new V(0,-.07*r.s,0))});
   for(const [other,actor] of Object.entries(actors)){
    const otherRig=actor.userData.rig,head=otherRig.head.localToWorld(new V(0,.015,.01)),palm=otherRig.arms.L.wr.localToWorld(new V(0,-.07*otherRig.s,0));
    const headGap=min('danceHeadClearance',line.closestPointToPoint(head,true,new V()).distanceTo(head)),palmGap=min('danceFreeHandClearance',line.closestPointToPoint(palm,true,new V()).distanceTo(palm));
    check(headGap>.14,q+'/'+id+' blade clears '+other+' head');check(palmGap>.07,q+'/'+id+' blade clears '+other+' free hand');
    s.minHeadClearance=Math.min(s.minHeadClearance,headGap);s.minFreeHandClearance=Math.min(s.minFreeHandClearance,palmGap);
   }
   if(tips[id]){const distance=b.distanceTo(tips[id]),speed=distance/(cycle/steps);s.bladePath+=distance;s.peakBladeSpeed=Math.max(s.peakBladeSpeed,speed);if(i/steps<.5||i/steps>.9)s.fastCutSpeed=Math.max(s.fastCutSpeed,speed);}tips[id]=b.clone();
   range(s,'torsoYaw',r.spine.rotation.y);range(s,'bodyHeight',r.body.position.y+r.pelvis.position.y);range(s,'bodySway',r.body.position.x);
   for(const side of ['L','R']){
    range(s,side+'Hip',r.legs[side].hip.rotation.x);range(s,side+'Knee',r.legs[side].knee.rotation.x);
    const foot=f.userData.state.footContacts[side],target=f.localToWorld(new V().fromArray(foot.target)),shoe=r.legs[side].shoe;
    check(max('danceFootContactGap',shoe.getWorldPosition(new V()).distanceTo(target))<.0005,q+'/'+id+'/'+side+' shoe detached from foot contact');
    check(max('danceFootReachError',foot.reachError)<.0005&&foot.kneeFlex>.05&&foot.kneeFlex<2.5,q+'/'+id+'/'+side+' leg reach or flex limit');
    check(min('danceSoleHeight',new C.THREE.Box3().setFromObject(shoe).min.y)>-.003*r.s,q+'/'+id+'/'+side+' shoe below floor');
    const last=feetPrevious[id+'/'+side];if(last&&Math.hypot(foot.target[0]-last[0],foot.target[2]-last[2])>.0005*r.s)check(Math.max(foot.target[1],last[1])>.00001*r.s,q+'/'+id+'/'+side+' moving foot slides on the floor');feetPrevious[id+'/'+side]=Array.from(foot.target);
   }
   check(Math.min(...Object.values(f.userData.state.footContacts).map(foot=>foot.target[1]))<1e-8,q+'/'+id+' lacks a supporting foot');
   const current=snapshot(r),previous=saved[id].at(-1);
   if(previous)for(const [name,node] of Object.entries(current)){
    const local=max('danceLocalQuaternionStep',angle(node.localQ,previous[name].localQ)),world=max('danceWorldQuaternionStep',angle(node.worldQ,previous[name].worldQ));
    check(local<.10&&world<.10,q+'/'+id+'/'+name+' dance quaternion discontinuity');s.maxLocalStep=Math.max(s.maxLocalStep,local);s.maxWorldStep=Math.max(s.maxWorldStep,world);
   }
   saved[id].push(current);row.maxLocalStep=s.maxLocalStep;row.maxWorldStep=s.maxWorldStep;denseCases++;denseDanceCases++;
  }
 }
 for(const id of ['sou','haku'])for(const blade of safety[id])for(const other of safety[id==='sou'?'haku':'sou']){
  const line=new C.THREE.Line3(blade.a,blade.b),head=min('independentDanceHeadClearance',line.closestPointToPoint(other.head,true,new V()).distanceTo(other.head)),palm=min('independentDanceFreeHandClearance',line.closestPointToPoint(other.palm,true,new V()).distanceTo(other.palm));
  check(head>.14&&palm>.07,q+'/'+id+' independent dance phase collision');
 }
 for(const id of ['sou','haku']){
  const f=actors[id],r=f.userData.rig,s=stats[id];s.ranges=Object.fromEntries(Object.entries(s.ranges).map(([key,span])=>[key,span[1]-span[0]]));
  check(s.ranges.torsoYaw>.4&&s.ranges.bodyHeight>.025*r.s,q+'/'+id+' must turn the torso and shift body weight');
  check(s.ranges.bodyTurn>(id==='sou'?Math.PI*2-.08:.35),q+'/'+id+' full-body turn or shielding pivot is missing');
  check(s.originalMotifScores.every(score=>score<1),q+'/'+id+' original slant-up or outer-sweep motif is missing');
  for(const side of ['L','R'])check(s.ranges[side+'Hip']>.1&&s.ranges[side+'Knee']>.12,q+'/'+id+' must move both hips and knees');
  check(s.bladePath>2.5&&s.peakBladeSpeed>1,q+'/'+id+' blade must travel quickly through a substantial path');
  check(s.fastCutSpeed>2.5,q+'/'+id+' actual fast cuts outside the spin are missing');
  for(const name of Object.keys(saved[id][0])){
   check(max('danceCycleQuaternionGap',angle(saved[id][0][name].worldQ,saved[id][steps][name].worldQ))<1e-6,q+'/'+id+'/'+name+' full-turn loop quaternion does not close');
   for(let k=0;k<16;k++)check(max('danceCycleMatrixGap',Math.abs(saved[id][0][name].matrix[k]-saved[id][steps][name].matrix[k]))<1e-7,q+'/'+id+'/'+name+' full-turn loop transform does not close');
  }
  for(let i=0;i<=128;i++){
   const index=i===128?steps:i*193%721;frame(f,index/steps);const actual=snapshot(r),expected=saved[id][index];determinismCases++;
   for(const name of Object.keys(actual))for(let k=0;k<16;k++)check(max('danceOutOfOrderMatrixDelta',Math.abs(actual[name].matrix[k]-expected[name].matrix[k]))<1e-8,q+'/'+id+'/'+name+' dance depends on frame order');
  }
  f.userData.setPose('dance');f.userData.update(0,10);f.updateMatrixWorld(true);const p=r.props.sword,first=p.localToWorld(new V().fromArray(p.userData.bladeTip));
  f.userData.update(0,10+cycle/2);f.updateMatrixWorld(true);check(Math.abs(f.userData.state.motionProgress-.5)<1e-8,q+'/'+id+' elapsed-time dance phase');
  check(p.localToWorld(new V().fromArray(p.userData.bladeTip)).distanceTo(first)>.2,q+'/'+id+' clock does not move blade');
  f.userData.update(0,10+cycle);f.updateMatrixWorld(true);s.clockCycleGap=p.localToWorld(new V().fromArray(p.userData.bladeTip)).distanceTo(first);check(s.clockCycleGap<.02*r.s,q+'/'+id+' real-time cycle does not close');
  dance.push(s);
 }
}
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
  max('elbowRise',Math.max(0,-drop));
  check(drop>(pose==='drink'?-.20:.02)*r.s,label+'/'+side+' elbow elevation outside the action range');
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
   row.cupPitch=Math.atan2(up.z,up.y);max('cupTilt',Math.abs(row.cupPitch));check(row.cupPitch<=1e-8&&row.cupPitch>-1.51,label+' cup tilts away or inverts');
   if(cup.userData.contactState.raised>.999999){
    const rim=cup.localToWorld(new V().fromArray(cup.userData.drinkContact)),center=cup.getWorldPosition(new V()),forward=new V(0,0,1).applyQuaternion(r.head.getWorldQuaternion(new Q()));
    row.cupRimGap=max('cupRimGap',rim.distanceTo(mouth));check(row.cupRimGap<.015*r.s,label+' rim misses the lips');
    row.cupForward=min('cupForward',center.clone().sub(mouth).dot(forward));check(row.cupForward>.05*r.s,label+' cup center is behind the mouth');
    row.nearRimForward=rim.clone().sub(center).dot(forward);check(row.nearRimForward<-.04*r.s,label+' the wrong rim faces the lips');
   }
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
 inspectDance(q);
 const f=C.KM_CAST3D.makeFigure('kai'),r=f.userData.rig,meat=r.props.meat,geometry=meat.children[0].geometry;
 f.position.set(.37,.08,-.21);f.rotation.y=.43;
 for(const pose of ['eat','drink']){
  f.userData.setPose(pose);const frames=[],drink={q,cycle:C.KM_BANQUET.cycles.drink,lipContactFrames:0,guzzleFrames:0,peakCupTilt:0};let previous,firstMeatCenter;
  for(let i=0;i<=720;i++){
   const u=i/720,label=q+'/kai/'+pose+'@'+u.toFixed(6);frame(f,u);const row=inspect(f,q,'kai',pose,u,'dense'),current=snapshot(r);denseCases++;
   if(pose==='drink'){
    const neckAnchor=r.chest.worldToLocal(r.head.localToWorld(new V(0,-.165,0)));if(!drink.neckAnchor)drink.neckAnchor=neckAnchor.clone();
    check(max('neckAnchorDrift',neckAnchor.distanceTo(drink.neckAnchor))<.0005,q+' raised head detaches at the neck');
    drink.peakCupTilt=Math.max(drink.peakCupTilt,-row.cupPitch);if(row.cupRimGap!==undefined){drink.lipContactFrames++;if(row.cupPitch<=-1.35)drink.guzzleFrames++;}
   }
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
  if(pose==='drink'){check(drink.peakCupTilt>1.39&&drink.peakCupTilt<1.50&&drink.lipContactFrames>720*.4&&drink.guzzleFrames>720*.15,q+' must sustain an 80–85-degree drink with actual lip contact');delete drink.neckAnchor;guzzling.push(drink);}
  for(const name of Object.keys(frames[0]))check(max('cycleQuaternionGap',angle(frames[0][name].worldQ,frames[720][name].worldQ))<1e-6,q+'/'+pose+'/'+name+' open animation cycle');
  for(let i=0;i<=720;i++){
   const index=i*193%721;frame(f,index/720);const actual=snapshot(r),expected=frames[index];determinismCases++;
   for(const name of Object.keys(actual))for(let k=0;k<16;k++)check(max('outOfOrderMatrixDelta',Math.abs(actual[name].matrix[k]-expected[name].matrix[k]))<1e-8,q+'/'+pose+'/'+name+' depends on frame order');
  }
 }
 f.userData.setPose('stand');for(const side of ['L','R'])check(r.arms[side].wr.quaternion.angleTo(new Q())<1e-9,q+' action wrist did not reset');
}
const out=path.join(root,'model-preview-output/banquet-motion-audit.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({castSha256,maxima,minima,dance,guzzling,rows},null,2));
console.log(JSON.stringify({castSha256,cases:rows.length,denseCases,denseDanceCases,determinismCases,maxima,minima,dance,guzzling,details:path.relative(root,out).replaceAll('\\','/')}));
