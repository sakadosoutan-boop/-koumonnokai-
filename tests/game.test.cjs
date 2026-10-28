const fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),KEY='kanbun-dojo:koumon:v1';
async function setup(id='c0-1',options={}){
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:options.url||'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,intervals=new Map(),timeouts=new Map(),errors=[];
  let clock=0,serial=0,maxSaveLength=0;
  const setItem=w.Storage.prototype.setItem;
  w.Storage.prototype.setItem=function(key,value){if(key===KEY)maxSaveLength=Math.max(maxSaveLength,String(value).length);return setItem.call(this,key,value);};
  w.addEventListener('error',e=>{errors.push(e.message);e.preventDefault();});
  w.matchMedia=()=>({matches:options.reduced!==false});
  w.Element.prototype.scrollIntoView=function(){};
  w.Date.now=()=>clock;
  w.setInterval=(fn,ms)=>{intervals.set(++serial,{fn,ms});return serial;};
  w.clearInterval=id=>intervals.delete(id);
  w.setTimeout=(fn,ms)=>{timeouts.set(++serial,{fn,ms});return serial;};
  w.clearTimeout=id=>timeouts.delete(id);
  w.KoumonStage=new Proxy({S:{stageId:'feast'},is3D:false,setScene:()=>Promise.resolve()},{get:(o,k)=>k in o?o[k]:()=>{}});
  const st={node:id,ch:id.split('-')[0],life:3,maxLife:3,ikari:40,satsu:40,saku:3,flags:{kyodai:true},items:[],streak:0,q:0,ok:0,hints:0,picks:[],log:[],cp:null,hinted:{},phase:null,...options.state};
  if(!options.fresh)w.localStorage.setItem(KEY,JSON.stringify(options.saved||{v:2,save:st,endings:{},gen:{},cleared:{},sound:false,plays:0,best:null,view:'2d',classroom:!!options.classroom,instant:true}));
  for(const f of ['src/data/kuho.js','src/js/learning.js','src/data/koumon.js','src/js/koumon-classroom.js','src/js/koumon.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));
  const app=w.Koumon,doc=w.document;
  async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
  async function click(selector){const b=doc.querySelector(selector);assert.ok(b,'missing '+selector);assert.notEqual(b.disabled,true,'disabled '+selector);b.focus();b.click();await flush();}
  app.open({standalone:options.standalone!==false});await flush();
  if(options.start!==false)await click('[data-km="continue"]');
  return {w,doc,app,click,flush,errors,timeouts,intervals,close:()=>w.close(),saved:()=>JSON.parse(w.localStorage.getItem(KEY)),maxSavedLength:()=>maxSaveLength,
    async advance(ms){clock+=ms;for(const j of [...intervals.values()].filter(x=>x.ms===100))j.fn();await flush();}};
}
test('read feedback survives reload without charging life or score twice',async()=>{
  let h=await setup('c0-11');await h.click('[data-km="pick"][data-i="1"]');
  assert.equal(h.app._state().life,2);const saved=h.saved();h.close();
  h=await setup('c0-11',{saved});assert.equal(h.app._mode(),'feedback');assert.equal(h.app._state().q,1);assert.equal(h.app._state().life,2);
  assert.ok(h.doc.querySelector('.km-fb'));assert.ok([...h.doc.querySelectorAll('.km-opt')].every(x=>x.disabled));
  await h.click('[data-km="fbnext"]');assert.notEqual(h.app._state().node,'c0-11');assert.equal(h.app._state().q,1);h.close();
});
test('judgment reaction survives same-session resume and reload',async()=>{
  let h=await setup('c2-7');await h.click('[data-km="pick"][data-i="1"]');assert.equal(h.app._state().ikari,65);
  await h.click('[data-km="quit"]');await h.click('[data-km="continue"]');assert.equal(h.app._mode(),'react');assert.equal(h.app._state().ikari,65);
  const saved=h.saved();h.close();h=await setup('c2-7',{saved});assert.equal(h.app._mode(),'react');await h.click('[data-km="next"]');assert.equal(h.app._state().ikari,65);assert.notEqual(h.app._state().node,'c2-7');h.close();
});
test('reference modal pauses timer and closing resumes remaining time',async()=>{
  const h=await setup('c4-dance',{reduced:false});await h.advance(5000);await h.click('.km-top [data-km="book"]');await h.advance(20000);
  assert.equal(h.app._state().node,'c4-dance');await h.click('[data-km="closemodal"]');await h.advance(9000);assert.equal(h.app._state().node,'c4-dance');await h.advance(1001);assert.notEqual(h.app._state().node,'c4-dance');assert.deepEqual(h.errors,[]);h.close();
});
test('quit cancels pending timer while preserving its remaining time',async()=>{
  const h=await setup('c4-dance',{reduced:false});await h.advance(4000);await h.click('[data-km="quit"]');assert.equal(h.intervals.size,0);await h.advance(20000);assert.equal(h.app._mode(),'title');assert.equal(h.saved().save.remainingMs,11000);assert.deepEqual(h.errors,[]);h.close();
});
test('hint can be reopened without charging another strategy point',async()=>{
  const h=await setup('c0-11');await h.click('[data-km="hint"]');await h.click('[data-km="quit"]');await h.click('[data-km="continue"]');
  assert.equal(h.doc.querySelector('#km-hint').hidden,false);await h.click('[data-km="hint"]');assert.equal(h.app._state().saku,2);assert.equal(h.app._state().hints,1);h.close();
});
test('AI activity returns from its reference book and selected sources are attached',async()=>{
  const h=await setup('c9-16');h.app._go('c9-17');await h.click('[data-km="ai"]');
  const before=h.doc.querySelector('.km-ai-prompt').value;assert.match(before,/\[g02\].*史記/);assert.match(before,/原文：/);assert.doesNotMatch(before,/説得度が80/);
  await h.click('[data-km="aibook"]');assert.match(h.doc.querySelector('[data-km="closemodal"]').textContent,/AI活動へ戻る/);await h.click('[data-km="closemodal"]');assert.equal(h.doc.querySelector('.km-ai-prompt').value,before);h.close();
});
test('classroom mode unlocks all chapters, books and removes time/life penalties',async()=>{
  const h=await setup('c0-11',{classroom:true});await h.click('[data-km="pick"][data-i="1"]');assert.equal(h.app._state().life,3);
  await h.click('.km-top [data-km="menu"]');assert.equal(h.doc.querySelectorAll('.km-chap:disabled').length,0);await h.click('[data-km="closemodal"]');
  await h.click('.km-top [data-km="book"]');assert.equal(h.doc.querySelectorAll('.km-book-yomi').length,24);await h.click('[data-km="closemodal"]');h.app._go('c4-dance');assert.equal(h.intervals.size,0);h.close();
});
test('intro has seven navigable scenes, stops for quiz and exits to game',async()=>{
  const h=await setup('c0-1',{start:false,classroom:true});await h.click('[data-km="intro"]');assert.equal(h.app._mode(),'intro');assert.equal(h.doc.querySelectorAll('[data-intro="step"]').length,7);
  await h.click('[data-intro="step"][data-step="5"]');await h.click('[data-intro="auto"]');assert.ok(![...h.timeouts.values()].some(x=>x.ms===45000));
  await h.click('[data-intro="quiz"][data-question="promise"][data-answer="hai"]');
  await h.click('[data-intro="quiz"][data-question="force"][data-answer="u"]');assert.match(h.doc.querySelector('.km-intro-quiz').textContent,/兵力は項羽/);assert.ok(h.doc.querySelector('.km-quiz-takeaway'));
  await h.click('[data-intro="step"][data-step="6"]');await h.click('[data-intro="done"]');assert.equal(h.doc.querySelector('#km-intro').hidden,true);assert.equal(h.app._state().ch,'c0');h.close();
});
test('reflection saves on input and is restored when reopened',async()=>{
  const h=await setup('c0-1',{start:false});await h.click('[data-km="reflection"]');const t=h.doc.querySelector('[data-reflection="quote"]');t.value='[g10] 項王黙然不応';t.dispatchEvent(new h.w.Event('input',{bubbles:true}));await h.click('[data-km="closemodal"]');await h.click('[data-km="reflection"]');assert.equal(h.doc.querySelector('[data-reflection="quote"]').value,'[g10] 項王黙然不応');h.close();
});
for(const classroom of [false,true])test('both parts and all three mini-games complete: '+(classroom?'classroom':'challenge'),async(t)=>{
  const h=await setup('c0-1',{classroom}),K=h.w.KOUMON;
  for(let guard=0;guard<500;guard++){
    const mode=h.app._mode(),n=h.app._nodes()[h.app._state().node].n;
    if(mode==='scene'){for(const [id,j] of [...h.timeouts])if(j.ms===10){h.timeouts.delete(id);j.fn();}await h.flush();}
    else if(mode==='card')await h.click('#km-card');
    else if(mode==='say'||mode==='react')await h.click('[data-km="next"]');
    else if(mode==='gen')await h.click('[data-km="gennext"]');
    else if(mode==='ask')await h.click('[data-km="pick"][data-i="'+n.o.findIndex(o=>o.ok)+'"]');
    else if(mode==='feedback')await h.click('[data-km="fbnext"]');
    else if(mode==='game'){
      if(n.g==='seat'){for(const s of K.games.seat.seats)for(const p of s.ans){await h.click('[data-km="person"][data-p="'+p+'"]');await h.click('[data-km="seat"][data-s="'+s.id+'"]');}await h.click('[data-km="seatcheck"]');await h.click('[data-km="seatdone"]');}
      if(n.g==='gift'){for(const [it,to]of Object.entries(K.games.gift.ans)){await h.click('[data-km="giftitem"][data-it="'+it+'"]');await h.click('[data-km="gifttarget"][data-t="'+to+'"]');}await h.click('[data-km="giftdone"]');}
      if(n.g==='route'){for(const s of K.games.route.steps)await h.click('[data-km="routepick"][data-i="'+s.o.findIndex(o=>o.ok)+'"]');await h.click('[data-km="routedone"]');}
    }else if(mode==='end'){if(n.e==='T1'){assert.ok(h.doc.querySelector('[data-km="ai"]'));await h.click('[data-km="part2"]');}else{assert.equal(n.e,'T2');break;}}
    else throw new Error(mode);
  }
  assert.ok(h.app._meta().endings.T1&&h.app._meta().endings.T2);assert.equal(Object.keys(h.app._meta().gen).length,24);assert.deepEqual(h.errors,[]);
  assert.ok(h.maxSavedLength()<1000000);t.diagnostic('largest saved JSON across both parts: '+h.maxSavedLength()+' characters');h.close();
});

test('nested activity dialogs return to their caller without awarding completion again',async()=>{
  const h=await setup('c9-16');let completions=0;
  h.w.Store={finishSession(){completions++;}};
  h.app._go('c9-17');assert.equal(completions,1);
  await h.click('[data-km="ai"]');
  const source=h.doc.querySelector('[data-km-source="g02"]');source.checked=false;source.dispatchEvent(new h.w.Event('change'));
  await h.click('[data-km="aibook"]');
  h.doc.querySelector('[data-km="closemodal"]').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(h.doc.querySelector('[data-km-source="g02"]').checked,false);
  assert.equal(h.doc.activeElement.dataset.km,'aibook');
  await h.click('[data-km="reflection"]');await h.click('[data-km="closemodal"]');
  assert.ok(h.doc.querySelector('.km-m-ai'));
  await h.click('[data-km="closeai"]');assert.ok(h.doc.querySelector('.km-m-end'));
  await h.click('[data-km="endings"]');await h.click('[data-km="closemodal"]');
  assert.ok(h.doc.querySelector('.km-m-end'));assert.equal(completions,1);assert.equal(h.saved().save,null);
  h.app.close();assert.equal(h.saved().save,null);assert.deepEqual(h.errors,[]);h.close();
});

test('closing an embedded game saves the clock before cancelling it',async()=>{
  let h=await setup('c4-dance',{reduced:false,standalone:false});await h.advance(6000);h.app.close();
  const saved=h.saved();assert.equal(saved.save.remainingMs,9000);assert.equal(h.intervals.size,0);h.close();
  h=await setup('c4-dance',{reduced:false,saved});await h.advance(8999);assert.equal(h.app._state().node,'c4-dance');
  await h.advance(1);assert.notEqual(h.app._state().node,'c4-dance');assert.deepEqual(h.errors,[]);h.close();
});

test('settings keep timed decisions paused and preserve the challenge clock',async()=>{
  const h=await setup('c4-dance',{reduced:false});await h.advance(3000);await h.click('[data-km="settings"]');
  const preference=h.doc.querySelector('[data-pref="classroom"]');preference.checked=true;preference.dispatchEvent(new h.w.Event('change'));
  await h.advance(30000);assert.equal(h.app._state().node,'c4-dance');
  preference.checked=false;preference.dispatchEvent(new h.w.Event('change'));await h.advance(30000);
  assert.equal(h.app._state().node,'c4-dance');await h.click('[data-km="closemodal"]');
  await h.advance(11999);assert.equal(h.app._state().node,'c4-dance');await h.advance(1);assert.notEqual(h.app._state().node,'c4-dance');h.close();
});

test('fresh and partial legacy saves hydrate defaults and reject invalid phases',async()=>{
  let h=await setup('c0-1',{fresh:true,start:false});assert.equal(h.app._meta().classroom,true);assert.equal(h.app._meta().save,null);
  await h.click('[data-km="new"]');assert.equal(h.app._state().ch,'c0');h.close();
  h=await setup('c0-11',{saved:{v:1,save:{node:'c0-11',hinted:null,items:['missing'],flags:null,phase:{node:'c0-11',kind:'feedback',choice:99}},reflection:null}});
  assert.equal(h.app._mode(),'ask');assert.equal(h.app._state().life,3);assert.equal(h.app._state().items.length,0);
  await h.click('[data-km="hint"]');assert.ok(h.app._state().hinted['c0-11']);assert.deepEqual(h.errors,[]);h.close();
});

for(const game of ['seat','gift','route'])test(game+' result resumes after reload without replaying completed actions',async()=>{
  let h=await setup();const K=h.w.KOUMON,n=Object.values(h.app._nodes()).find(x=>x.n.t==='game'&&x.n.g===game).n;
  h.app._go(n.id);await h.flush();let records=0;h.w.Store={record(){records++;}};
  if(game==='seat'){
    for(const seat of K.games.seat.seats)for(const person of seat.ans){await h.click('[data-km="person"][data-p="'+person+'"]');await h.click('[data-km="seat"][data-s="'+seat.id+'"]');}
    await h.click('[data-km="seatcheck"]');assert.equal(records,1);
  }else if(game==='gift'){
    for(const [item,to]of Object.entries(K.games.gift.ans)){await h.click('[data-km="giftitem"][data-it="'+item+'"]');await h.click('[data-km="gifttarget"][data-t="'+to+'"]');}
    await h.click('[data-km="giftdone"]');
  }else for(const step of K.games.route.steps)await h.click('[data-km="routepick"][data-i="'+step.o.findIndex(o=>o.ok)+'"]');
  const saved=h.saved(),count=h.app._state().picks.length;h.close();h=await setup(n.id,{saved});
  assert.equal(h.app._state().picks.length,count);assert.equal(h.app._state().node,n.id);
  if(game==='seat'){assert.ok(h.doc.querySelector('[data-km="seatdone"]'));assert.equal(h.doc.querySelector('[data-km="seatcheck"]'),null);await h.click('[data-km="seatdone"]');}
  if(game==='gift'){assert.equal(h.app._mode(),'react');await h.click('[data-km="next"]');}
  if(game==='route'){assert.ok(h.doc.querySelector('[data-km="routedone"]'));assert.equal(h.doc.querySelector('[data-km="routepick"]'),null);await h.click('[data-km="routedone"]');}
  assert.notEqual(h.app._state().node,n.id);assert.equal(h.app._state().picks.length,count);assert.deepEqual(h.errors,[]);h.close();
});

test('script references, identifiers and reading answers are internally consistent',async()=>{
  const h=await setup('c0-1',{start:false}),K=h.w.KOUMON,nodes=Object.values(K.script).flat(),ids=new Set();
  for(const node of nodes){assert.ok(!ids.has(node.id),'duplicate '+node.id);ids.add(node.id);}
  for(const node of nodes){
    for(const target of [node.next,node.go,node.el,node.timeout,...(node.o||[]).map(o=>o.go)].filter(Boolean))assert.ok(ids.has(target),node.id+' → '+target);
    if(node.t==='gen')assert.ok(K.genbun[node.g],node.id+' original text');
    if(node.t==='end')assert.ok(K.endings[node.e],node.id+' ending');
    if(node.k==='read')assert.equal(node.o.filter(o=>o.ok).length,1,node.id+' correct answers');
    if(node.kuho)assert.ok(h.w.KUHO.some(k=>k.id===node.kuho),node.id+' grammar');
  }
  for(const chapter of K.chapters)assert.ok(ids.has(chapter.start),chapter.id+' start');h.close();
});

async function chooseCanonical(h,stopAtEnd=true){
  for(let guard=0;guard<400;guard++){
    const mode=h.app._mode(),n=h.app._nodes()[h.app._state().node].n,K=h.w.KOUMON;
    if(mode==='end'&&stopAtEnd)return;
    if(mode==='scene'){for(const [id,j]of [...h.timeouts])if(j.ms===10){h.timeouts.delete(id);j.fn();}await h.flush();}
    else if(mode==='card')await h.click('#km-card');
    else if(mode==='say'||mode==='react')await h.click('[data-km="next"]');
    else if(mode==='gen')await h.click('[data-km="gennext"]');
    else if(mode==='ask')await h.click('[data-km="pick"][data-i="'+n.o.findIndex(o=>o.ok)+'"]');
    else if(mode==='feedback')await h.click('[data-km="fbnext"]');
    else if(mode==='game'){
      if(n.g==='seat'){for(const seat of K.games.seat.seats)for(const p of seat.ans){await h.click('[data-km="person"][data-p="'+p+'"]');await h.click('[data-km="seat"][data-s="'+seat.id+'"]');}await h.click('[data-km="seatcheck"]');await h.click('[data-km="seatdone"]');}
      if(n.g==='gift'){for(const [it,to]of Object.entries(K.games.gift.ans)){await h.click('[data-km="giftitem"][data-it="'+it+'"]');await h.click('[data-km="gifttarget"][data-t="'+to+'"]');}await h.click('[data-km="giftdone"]');}
      if(n.g==='route'){while(h.doc.querySelector('[data-km="routepick"]')){const s=K.games.route.steps[h.app._state().game.step];await h.click('[data-km="routepick"][data-i="'+s.o.findIndex(o=>o.ok)+'"]');}await h.click('[data-km="routedone"]');}
    }else throw new Error('Unexpected mode '+mode);
  }
  assert.fail('story did not reach an ending');
}

const retryCases=[
  {name:'B1 refusal',id:'c1-sha',choice:1,ending:'B1'},
  {name:'B2 delayed bond',id:'c1-haku',choice:1,ending:'B2',state:{flags:{}}},
  {name:'B2 delayed hostility',id:'c2-7',choice:2,ending:'B2',state:{satsu:90}},
  {name:'B2 sword',id:'c4-dance',choice:2,ending:'B2'},
  {name:'B3 anger',find:n=>n.k==='judge'&&n.q.startsWith('范増の合図'),choice:2,ending:'B3',state:{ikari:80}},
  {name:'B4 return',id:'c6-leave',choice:1,ending:'B4'},
  {name:'B5 leave together',id:'c6-leave',choice:2,ending:'B5'},
  {name:'B5 route',find:n=>n.g==='route'&&n.t==='game',game:'route',ending:'B5'},
  {name:'B6 stay',id:'c5-go',choice:1,ending:'B6'},
  {name:'B7 delayed gift',find:n=>n.g==='gift'&&n.t==='game',game:'gift',ending:'B7'},
  {name:'B8 reading',id:'c0-11',choice:1,ending:'B8',state:{life:1}}
];
for(const scenario of retryCases)test('retry reopens the causal choice and reaches T1: '+scenario.name,async(t)=>{
  const h=await setup(scenario.id||'c0-1',{state:scenario.state}),K=h.w.KOUMON;
  const id=scenario.id||Object.values(h.app._nodes()).find(x=>scenario.find(x.n)).n.id;
  if(!scenario.id){h.app._go(id);await h.flush();}
  if(scenario.game==='gift'){
    for(const [item,to]of Object.entries(K.games.gift.ans)){await h.click('[data-km="giftitem"][data-it="'+item+'"]');await h.click('[data-km="gifttarget"][data-t="'+(to==='u'?'zo':'u')+'"]');}
    await h.click('[data-km="giftdone"]');
  }else if(scenario.game==='route')await h.click('[data-km="routepick"][data-i="'+K.games.route.steps[0].o.findIndex(o=>!o.ok)+'"]');
  else await h.click('[data-km="pick"][data-i="'+scenario.choice+'"]');
  await chooseCanonical(h);
  assert.ok(h.app._meta().endings[scenario.ending]);assert.equal(h.app._state().cp.node,id);
  assert.equal(h.saved().save.node,id);assert.equal(h.saved().save.phase,null);assert.equal(h.saved().save.game,null);
  assert.match(h.doc.querySelector('[data-km="retry"]').textContent,/選び直す：/);
  await h.click('[data-km="retry"]');assert.equal(h.app._state().node,id);
  assert.equal(h.app._mode(),scenario.game?'game':'ask');
  await chooseCanonical(h);assert.ok(h.app._meta().endings.T1,'alternate choice must escape bad ending');
  assert.ok(h.app._state().rewinds.length<=64);
  assert.ok(h.app._state().rewinds.every(p=>p.snap.cp===null&&p.snap.rewinds.length===0),'checkpoints must not recursively copy history');
  assert.ok(JSON.stringify(h.app._state()).length<1000000,'one playthrough stays within a bounded save size');
  assert.ok(h.maxSavedLength()<1000000,'saved metadata also stays within the size bound');
  t.diagnostic('largest saved JSON: '+h.maxSavedLength()+' characters');
  assert.deepEqual(h.errors,[]);h.close();
});

test('bad ending reload returns to gift assignment before its committed result',async()=>{
  let h=await setup('c7-1',{state:{flags:{giftWrong:true,kyodai:true}}});
  await chooseCanonical(h);assert.ok(h.app._meta().endings.B7);
  const saved=h.saved();assert.equal(saved.save.ch,'c6');h.close();
  h=await setup(saved.save.node,{saved});assert.equal(h.app._mode(),'game');assert.equal(h.app._state().game.kind,'gift');
  assert.equal(Object.keys(h.app._state().game.to).length,0);await chooseCanonical(h);
  assert.ok(h.app._meta().endings.T1);assert.deepEqual(h.errors,[]);h.close();
});

test('legacy delayed bond failure recovers to the actual relationship choice',async()=>{
  const h=await setup('c4-dance',{state:{flags:{},cp:{node:'c4',snap:{node:'c4',flags:{},life:3}}}});
  await h.click('[data-km="pick"][data-i="0"]');await chooseCanonical(h);
  assert.equal(h.app._state().cp.node,'c1-haku');await h.click('[data-km="retry"]');
  assert.equal(h.app._state().node,'c1-haku');assert.equal(h.app._mode(),'ask');
  await chooseCanonical(h);assert.ok(h.app._meta().endings.T1);h.close();
});

test('checkpoint history remains bounded when choices are revisited repeatedly',async(t)=>{
  const h=await setup('c0-11');
  for(let i=0;i<80;i++){
    h.app._go(i%2?'c0-11':'c2-7');await h.flush();
    await h.click('[data-km="pick"][data-i="0"]');
    await h.click(h.app._mode()==='react'?'[data-km="next"]':'[data-km="fbnext"]');
  }
  assert.equal(h.app._state().rewinds.length,64);
  assert.ok(h.app._state().rewinds.every(p=>p.snap.cp===null&&p.snap.rewinds.length===0));
  assert.ok(h.maxSavedLength()<1000000);t.diagnostic('largest saved JSON at 64 checkpoints: '+h.maxSavedLength()+' characters');h.close();
});
