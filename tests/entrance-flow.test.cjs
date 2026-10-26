const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
function canvas(){
  const c={width:1,height:1},noop=()=>{},gradient={addColorStop:noop};
  c.getContext=()=>new Proxy({canvas:c,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:t=>({width:t.length*8})},{get:(o,k)=>k in o?o[k]:noop});return c;
}
function stageHarness(){
  const callbacks=new Map();let serial=0;
  const C={console,document:{createElement:canvas},navigator:{},setTimeout:fn=>{queueMicrotask(fn);return ++serial;},clearTimeout(){},setInterval:()=>++serial,clearInterval(){},requestAnimationFrame:fn=>{callbacks.set(++serial,fn);return serial;},cancelAnimationFrame:id=>callbacks.delete(id)};C.window=C;vm.createContext(C);
  vm.runInContext(fs.readFileSync(path.join(root,'src/vendor/three.min.js'),'utf8'),C);
  C.KM_BANQUET={cycles:{enter:3.6}};
  C.KM_CAST3D={lacquerCloudTex:()=>null,CAST:Object.fromEntries(['u','haku','hai','ryo','kai','ei','zo','sou','chin'].map(id=>[id,{h:1.72}])),makeFigure(id){
    const f=new C.THREE.Group(),body=new C.THREE.Group(),head=new C.THREE.Group(),state={pose:'stand'},updates=[];head.position.y=1.5;f.add(body);body.add(head);
    f.userData={id,state,rig:{s:1,body,headPiv:head,props:{}},updates,
      setPose(pose){state.pose=pose;state.actionStart=null;delete state.actionProgress;body.position.y=pose==='down'?.12:0;body.rotation.z=pose==='down'?-1.42:0;},
      update(dt,t){updates.push({t,progress:state.actionProgress,gateProgress:state.gateProgress,position:f.position.clone()});},lookAt(){},talk(){}};return f;
  }};
  vm.runInContext(fs.readFileSync(path.join(root,'src/js/koumon-3d.js'),'utf8'),C);
  const stage=C.KoumonStage3D,S=stage.S;S.camera=new C.THREE.PerspectiveCamera(45,1,.1,100);S.faceFill={intensity:0};S.renderer={render(){}};S.fx={material:{color:new C.THREE.Color(),opacity:0}};
  async function scene(poses={kai:'enter'},stageId='feast',cast=['u','haku','hai','ryo','kai']){await stage.setScene(stageId,'day',cast,poses);return S.cast.kai;}
  function at(time){S.t=time-.016;stage.renderOnce();}
  function raf(now){const [id,fn]=callbacks.entries().next().value||[];assert.ok(fn,'the stage requested an animation frame');callbacks.delete(id);fn(now);}
  return {C,stage,S,scene,at,raf,callbacks};
}

test('Fan Kuai enters from the doorway with continuous, collision-free, deterministic root travel',async()=>{
  const h=stageHarness(),f=await h.scene(),home=f.userData.home;
  assert.ok(f.position.x>3.8,'the actor begins outside the east curtain');
  assert.ok(Math.abs(f.position.z-1.1)<1e-9,'the entry starts in the doorway lane');
  const samples=[];let previous,minSeatClearance=Infinity,maxStep=0;
  for(let i=0;i<=240;i++){
    f.userData.state.actionProgress=i/240;h.stage.renderOnce();const p=f.position.clone();samples.push(p);
    if(previous){assert.ok(p.x<=previous.x+1e-10,'the actor advances toward the banquet');maxStep=Math.max(maxStep,p.distanceTo(previous));}
    for(const [id,other] of Object.entries(h.S.cast))if(id!=='kai')minSeatClearance=Math.min(minSeatClearance,Math.hypot(p.x-other.position.x,p.z-other.position.z));
    if(p.x>=3.3)assert.ok(p.z>.25&&p.z<1.95,'the path remains inside the actual east doorway opening');
    if(Math.abs(p.x-3.8)<.1){
      assert.ok(h.S.entry.curtainOpen>.6,'the curtain opens before the actor passes through it');
      const door=h.S.entranceCurtain;door.updateMatrixWorld(true);
      const inner=door.children.map((leaf,index)=>{
        const cloth=leaf.children[0],position=cloth.geometry.attributes.position,x=[];
        for(let vertex=0;vertex<position.count;vertex++){
          const point=door.worldToLocal(cloth.localToWorld(new h.C.THREE.Vector3().fromBufferAttribute(position,vertex)));
          if(point.y> -1.7&&point.y<-.5)x.push(point.x);
        }
        return index===0?Math.max(...x):Math.min(...x);
      });
      assert.ok(inner[1]-inner[0]>.65,'the actual deformed cloth leaves a body-width opening');
    }
    const update=f.userData.updates.at(-1);assert.ok(update.position.distanceTo(p)<1e-10,'root travel is applied before the rig update');
    assert.ok(Math.abs(update.progress-i/240)<1e-10,'the stage and rig use the same clamped entry phase');previous=p;
  }
  assert.ok(maxStep<.05,'entry has no per-frame teleport');assert.ok(minSeatClearance>.75,'the actor body envelope clears every seated actor');
  assert.ok(Math.hypot(f.position.x-home.x,f.position.z-home.z)<1e-9,'entry ends exactly at the banquet position');
  for(let i=0;i<=240;i++){
    const index=i*97%241;f.userData.state.actionProgress=index/240;h.stage.renderOnce();assert.ok(f.position.distanceTo(samples[index])<1e-9,'scrubbing entry is independent of frame order');
  }
  for(const [phase,index] of [[-1,0],[2,240]]){f.userData.state.actionProgress=phase;h.stage.renderOnce();assert.ok(f.position.distanceTo(samples[index])<1e-9,'entry clamps at the doorway and destination');}
});

test('entry restarts and reduced motion or pose interruption settle to a consistent destination',async()=>{
  const h=stageHarness();let f=await h.scene();const start=f.position.clone();
  f.userData.state.actionProgress=.5;h.stage.renderOnce();assert.ok(f.position.distanceTo(start)>.5,'the first entry actually advances');
  f=await h.scene();assert.ok(f.position.distanceTo(start)<1e-9,'repeating the scene starts at the same doorway');
  f.userData.state.actionProgress=.4;h.stage.renderOnce();h.stage.setPose('kai','drink');
  assert.ok(Math.abs(f.position.x-f.userData.home.x)<1e-9&&Math.abs(f.position.z-f.userData.home.z)<1e-9,'interrupting entry settles to the banquet position');
  assert.equal(f.userData.state.pose,'drink');assert.ok(!h.S.entry||!h.S.entry.active,'interrupted entry no longer owns root movement');
  h.stage.setPose('kai','enter');assert.ok(f.position.distanceTo(start)<1e-9,'an explicit replay starts consistently');
  h.S.reduced=true;f=await h.scene();assert.ok(Math.abs(f.position.x-f.userData.home.x)<1e-9,'reduced motion arrives immediately');
  h.S.reduced=false;await h.scene();await h.scene({},'gate',['kai','ryo','ei']);
  assert.ok(!h.S.entry||!h.S.entry.active,'a scene transition cancels entry');
  const gate=h.stage.STAGES.gate.pos.kai;assert.ok(Math.hypot(h.S.cast.kai.position.x-gate[0],h.S.cast.kai.position.z-gate[1])<1e-9,'a new scene owns actor placement');
});

test('paused entry resumes without consuming time spent hidden',async()=>{
  const h=stageHarness(),f=await h.scene();h.stage.start();h.raf(1000);h.raf(1016);
  const before=h.S.t,position=f.position.clone();h.stage.stop();assert.equal(h.callbacks.size,0,'pause cancels the scheduled frame');
  assert.equal(h.S.t,before);h.stage.start();h.raf(61016);
  assert.ok(Math.abs(h.S.t-before-.016)<1e-10,'the first resumed frame resets the wall clock');
  assert.ok(f.position.distanceTo(position)<.05,'resuming does not jump to the end of entry');h.stage.stop();
});

test('an abandoned scene preparation cannot restore an obsolete entrance',async()=>{
  const h=stageHarness(),old=h.stage.setScene('feast','day',['kai'],{kai:'enter'}),latest=h.stage.setScene('gate','day',['ryo'],{});
  await Promise.all([old,latest]);assert.equal(h.S.stageId,'gate');assert.ok(h.S.cast.ryo&&!h.S.cast.kai,'only the latest prepared cast is installed');
  assert.ok(!h.S.entry||!h.S.entry.active,'the obsolete entry cannot become active after preparation');
});

test('early gate advance queues one shield impact and a continuous guard fall after arrival',async()=>{
  const h=stageHarness(),f=await h.scene({},'gate',['kai','ryo','ei']);h.stage.setPose('kai','charge');
  const b=h.S.breach,start=f.position.clone(),guard=h.S.cast.ei2,stand=guard.userData.rig.body.quaternion.clone();let impacts=0;
  h.stage.setPose('ei','down');assert.equal(h.stage.whenBreachImpact(()=>impacts++),true);
  let previous=start,maxStep=0;
  for(let i=0;i<120;i++){
    h.at(b.started+b.duration*i/120);maxStep=Math.max(maxStep,f.position.distanceTo(previous));previous=f.position.clone();
    assert.equal(impacts,0,'early advance does not deliver impact before arrival');assert.equal(guard.userData.state.pose,'stand','the guard remains upright during the approach');
    assert.ok(Math.abs(f.userData.updates.at(-1).gateProgress-b.progress)<1e-9,'the rig receives the actual stage approach phase');
  }
  assert.ok(maxStep<.05,'gate approach has no root teleport');assert.ok(f.position.distanceTo(start)>2,'the actor actually crosses the gate approach');
  h.at(b.started+b.duration);assert.equal(impacts,1,'contact delivers the queued impact once');assert.ok(f.position.distanceTo(b.to)<1e-9,'contact occurs at the destination');
  assert.ok(guard.userData.rig.body.quaternion.angleTo(stand)<1e-8,'the guard begins falling from its standing pose');
  let last=guard.userData.rig.body.quaternion.clone(),maxTurn=0;
  for(let i=1;i<=65;i++){h.at(b.impactStart+i*.65/65);const q=guard.userData.rig.body.quaternion;maxTurn=Math.max(maxTurn,q.angleTo(last));last=q.clone();}
  assert.ok(maxTurn<.10&&guard.userData.rig.body.quaternion.angleTo(stand)>1,'the actual guard rig falls continuously');
  h.at(b.impactStart+.651);assert.equal(impacts,1);assert.equal(b.finished,true);
});

test('leaving or reducing the gate action cancels queued impact and restores scene ownership',async()=>{
  const h=stageHarness();await h.scene({},'gate',['kai','ryo','ei']);h.stage.setPose('kai','charge');h.stage.setPose('ei','down');let abandoned=0;h.stage.whenBreachImpact(()=>abandoned++);
  await h.scene();h.at(10);assert.equal(abandoned,0,'scene exit drops the abandoned impact callback');assert.equal(h.S.breach,null,'scene exit removes approach and fall state');
  h.S.reduced=true;await h.scene({},'gate',['kai','ryo','ei']);h.stage.setPose('kai','charge');h.stage.setPose('ei','down');h.stage.renderOnce();
  assert.ok(h.S.cast.kai.position.distanceTo(h.S.breach.to)<1e-9,'reduced motion completes the approach');assert.equal(h.S.breach.fallProgress,1,'reduced motion completes the guard fall');
});

test('the lightweight stage preserves gate causality and continuous entrance placement',()=>{
  const C={console,document:{createElement:canvas},requestAnimationFrame:()=>1,cancelAnimationFrame(){}};C.window=C;vm.createContext(C);vm.runInContext(fs.readFileSync(path.join(root,'src/js/koumon-stage.js'),'utf8'),C);
  const stage=C.KoumonStage,S=stage.S;S.cv=canvas();S.g=S.cv.getContext('2d');S.cw=1280;S.ch=720;
  const at=t=>{S.t=t-.016;stage.renderOnce();};stage.setScene('gate','day',['kai','ei','ryo'],{});stage.setPose('kai','charge');stage.setPose('ei','down');let impacts=0;assert.equal(stage.whenBreachImpact(()=>impacts++),true);
  const b=S.breach;at(b.started+.5);assert.equal(impacts,0);assert.notEqual(S.cast.ei.pose,'down','the lightweight guard waits for physical arrival');
  at(b.started+b.duration);assert.equal(impacts,1);assert.ok(Math.abs(S.cast.kai.x-b.to)<1e-8);assert.equal(S.cast.ei.fallProgress,0);
  at(b.impactStart+.325);assert.ok(S.cast.ei.fallProgress>.45&&S.cast.ei.fallProgress<.55,'the guard is midway through a timed fall');at(b.impactStart+.651);assert.equal(impacts,1);assert.equal(b.finished,true);
  stage.setScene('feast','day',['kai','u','hai'],{kai:'enter'});const f=S.cast.kai,start=f.x;let previous=start,maxStep=0;
  for(let i=0;i<=120;i++){f.actionProgress=i/120;stage.renderOnce();assert.ok(f.x<=previous+1e-8,'the lightweight entry advances continuously');maxStep=Math.max(maxStep,Math.abs(f.x-previous));previous=f.x;}
  assert.ok(start-f.x>300&&maxStep<15,'the lightweight actor crosses the entrance without teleporting');assert.ok(Math.abs(f.x-f.x0)<1e-8,'the lightweight entry arrives at its home position');
  S.reduced=true;stage.setScene('feast','day',['kai'],{kai:'enter'});assert.ok(Math.abs(S.cast.kai.x-S.cast.kai.x0)<1e-8,'reduced lightweight entry arrives immediately');
});

async function storyHarness(resumeAt){
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,timeouts=new Map(),events=[],errors=[];let serial=0;
  w.matchMedia=()=>({matches:true});w.Element.prototype.scrollIntoView=function(){};w.Date.now=()=>0;
  w.setTimeout=(fn,ms)=>{timeouts.set(++serial,{fn,ms});return serial;};w.clearTimeout=id=>timeouts.delete(id);w.setInterval=()=>++serial;w.clearInterval=()=>{};
  w.addEventListener('error',e=>{errors.push(e.message);e.preventDefault();});
  w.KoumonStage=new Proxy({is3D:false,S:{stageId:'gate'},setScene(stage,light,cast,poses){this.S.stageId=stage;events.push({kind:'scene',stage,poses:{...poses}});return Promise.resolve();},setPose(id,pose){events.push({kind:'pose',id,pose});}},{get:(o,k)=>k in o?o[k]:()=>{}});
  w.localStorage.setItem('kanbun-dojo:koumon:v1',JSON.stringify({v:2,save:{node:'c5',ch:'c5',life:3,maxLife:3,ikari:40,satsu:40,saku:3,flags:{kyodai:true},items:[],streak:0,q:0,ok:0,hints:0,picks:[],log:[],cp:null,hinted:{},phase:null},endings:{},gen:{},cleared:{},sound:false,plays:0,best:null,view:'2d',classroom:true,instant:true}));
  for(const file of ['src/data/kuho.js','src/js/learning.js','src/data/koumon.js','src/js/koumon-classroom.js','src/js/koumon.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  if(resumeAt){
    const index=w.KOUMON.script.c5.findIndex(n=>n.pose&&n.pose.kai===resumeAt);assert.ok(index>=0,'the resumed action exists');
    const saved=JSON.parse(w.localStorage.getItem('kanbun-dojo:koumon:v1'));saved.save.node=w.KOUMON.script.c5[index].id||'c5-'+index;w.localStorage.setItem('kanbun-dojo:koumon:v1',JSON.stringify(saved));
  }
  async function flush(){for(let i=0;i<10;i++)await Promise.resolve();}
  async function click(selector){const button=w.document.querySelector(selector);assert.ok(button,'missing '+selector);button.click();await flush();}
  w.Koumon.open({standalone:true});await flush();await click('[data-km="continue"]');
  return {w,app:w.Koumon,timeouts,events,errors,flush,click,close:()=>w.close()};
}
test('gameplay knocks down the gate guard before starting one uninterrupted banquet entrance',async()=>{
  const h=await storyHarness();
  try{
    for(let i=0;i<40&&!h.events.some(e=>e.kind==='pose'&&e.id==='kai'&&e.pose==='drink');i++){
      const mode=h.app._mode(),n=h.app._nodes()[h.app._state().node].n;
      if(mode==='scene'){for(const [id,t] of [...h.timeouts])if(t.ms===10){h.timeouts.delete(id);t.fn();}await h.flush();}
      else if(mode==='card')await h.click('#km-card');
      else if(mode==='say'||mode==='react')await h.click('[data-km="next"]');
      else if(mode==='gen')await h.click('[data-km="gennext"]');
      else if(mode==='ask')await h.click('[data-km="pick"][data-i="'+n.o.findIndex(o=>o.ok)+'"]');
      else if(mode==='feedback')await h.click('[data-km="fbnext"]');
      else assert.fail('unexpected mode '+mode);
    }
    const down=h.events.findIndex(e=>e.kind==='pose'&&e.id==='ei'&&e.pose==='down'),entry=h.events.findIndex(e=>e.kind==='scene'&&e.stage==='feast'&&e.poses.kai==='enter'),drink=h.events.findIndex(e=>e.kind==='pose'&&e.id==='kai'&&e.pose==='drink');
    assert.ok(down>=0&&entry>down&&drink>entry,'the guard falls, entry begins, and the wine is awarded in that order');
    assert.equal(h.events.filter(e=>e.kind==='scene'&&e.stage==='feast'&&e.poses.kai==='enter').length,1,'the entry starts once for the scene');
    assert.ok(!h.events.slice(entry+1,drink).some(e=>e.kind==='pose'&&e.id==='kai'&&['glare','enter'].includes(e.pose)),'arrival narration does not restart or cut off entry');
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});

test('resuming an arrived story node restores the banquet position without replaying entry',async()=>{
  const h=await storyHarness('drink');
  try{
    const scene=h.events.find(e=>e.kind==='scene'&&e.stage==='feast');assert.ok(scene,'the resumed scene is restored');
    assert.equal(scene.poses.kai,'glare','quiet scene restoration starts from the arrived pose');
    assert.ok(!h.events.some(e=>e.kind==='scene'&&e.poses.kai==='enter'),'a saved mid-scene node does not replay the doorway entrance');
    assert.ok(h.events.some(e=>e.kind==='pose'&&e.id==='kai'&&e.pose==='drink'),'the saved wine action resumes after stage restoration');
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});


test('fallen guards keep visible weapons that settle above the floor and restore on replay',async()=>{
  const h=stageHarness();await h.scene({},'gate',['kai','ryo','ei']);const weapons=[];
  for(const id of ['ei','ei2']){
    const guard=h.S.cast[id],weapon=new h.C.THREE.Group();weapon.add(new h.C.THREE.Mesh(new h.C.THREE.BoxGeometry(.04,2.8,.04),new h.C.THREE.MeshBasicMaterial()));weapon.position.y=1.2;guard.add(weapon);guard.userData.rig.props.halberd=weapon;
    const original=guard.userData.setPose;guard.userData.setPose=pose=>{if(pose==='down'&&weapon.parent)weapon.parent.remove(weapon);original(pose);if(pose==='stand'&&weapon.parent!==guard){guard.add(weapon);weapon.position.set(0,1.2,0);weapon.quaternion.identity();}};weapons.push(weapon);
  }
  h.stage.setPose('kai','charge');h.stage.setPose('ei','down');const b=h.S.breach;
  for(let i=0;i<=65;i++){
    h.at(b.started+b.duration+i*.651/65);
    for(const weapon of weapons){weapon.updateMatrixWorld(true);assert.ok(weapon.visible&&weapon.parent===h.S.scene,'the weapon never disappears during the fall');assert.ok(weapon.matrixWorld.elements.every(Number.isFinite));assert.ok(new h.C.THREE.Box3().setFromObject(weapon).min.y>=.0059,'a dropped weapon remains above the ground');}
  }
  for(const weapon of weapons)assert.ok(new h.C.THREE.Box3().setFromObject(weapon).max.y<.09,'the complete shaft comes to rest on the floor');
  h.stage.setPose('kai','glare');for(const weapon of weapons)assert.ok(weapon.parent===h.S.scene,'settling an interrupted action preserves its dropped props');
  await h.scene({},'gate',['kai','ryo','ei']);for(const id of ['ei','ei2'])assert.ok(h.S.cast[id].userData.rig.props.halberd.parent===h.S.cast[id],'replaying restores held weapons');
  h.stage.setPose('kai','charge');h.stage.setPose('ei','down');h.at(h.S.breach.started+h.S.breach.duration+.651);
  await h.scene();for(const weapon of weapons)assert.ok(!weapon.parent,'cached dropped props do not retain an abandoned room');
});

test('the entrance camera fits the actor above the actual story panel',async()=>{
  const h=stageHarness(),f=await h.scene();h.S.cw=1280;h.S.ch=720;h.S.visibleFraction=.68;
  const camera=h.S.camera;camera.fov=38;camera.aspect=1280/720;camera.setViewOffset(1280,720,0,720*.16,1280,720);
  for(const u of [0,.15,.5,1]){
    f.userData.state.actionProgress=u;h.stage.renderOnce();camera.updateMatrixWorld(true);
    for(const y of [0,2.03]){const p=new h.C.THREE.Vector3(f.position.x,y,f.position.z).project(camera),screenY=(1-p.y)*360;assert.ok(screenY>8&&screenY<720*.68-8,'head and feet fit above the panel at phase '+u+': '+screenY);}
  }
});

test('deferred shield impact audio is cancelled on close and a new story',async()=>{
  const h=await storyHarness(),starts=[];let queued;
  try{
    const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}),node=()=>({frequency:param(),gain:param(),Q:param(),connect(){},disconnect(){},start(){starts.push(1);},stop(){}});
    h.w.AudioContext=function(){this.currentTime=0;this.sampleRate=100;this.state='running';this.destination={};this.createOscillator=node;this.createGain=node;this.createBufferSource=node;this.createBiquadFilter=node;this.createBuffer=(channels,length)=>({getChannelData:()=>new Float32Array(length)});};
    h.app._meta().sound=true;h.w.KoumonStage.whenBreachImpact=callback=>{queued=callback;return true;};
    const id=Object.keys(h.app._nodes()).find(key=>{const n=h.app._nodes()[key].n;return n.pose&&n.pose.ei==='down';});h.app._go(id);assert.equal(typeof queued,'function');
    queued();assert.ok(starts.length>0,'the live impact produces its sound');
    h.app.close();let count=starts.length;queued();assert.equal(starts.length,count,'closed game cannot emit an abandoned sound');
    h.app.open({standalone:true});await h.flush();await h.click('[data-km="menu"]');await h.click('[data-km="chap"][data-c="c0"]');count=starts.length;queued();assert.equal(starts.length,count,'old impact cannot play during the new chapter fade');
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});
