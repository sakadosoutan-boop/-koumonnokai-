// 学習・授業運営の機能（読み直し・読み直し帳・史記との比較・学習記録・場面リンク・怒気殺気の参考表示）
const fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),KEY='kanbun-dojo:koumon:v1';
async function setup(id='c0-1',options={}){
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:options.url||'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,timeouts=new Map(),errors=[];let serial=0;
  w.addEventListener('error',e=>{errors.push(e.message);e.preventDefault();});
  w.matchMedia=()=>({matches:true});w.Element.prototype.scrollIntoView=function(){};
  w.setInterval=()=>++serial;w.clearInterval=()=>{};
  w.setTimeout=(fn,ms)=>{timeouts.set(++serial,{fn,ms});return serial;};w.clearTimeout=id=>timeouts.delete(id);
  w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
  w.KoumonStage=new Proxy({S:{stageId:'feast'},is3D:false,setScene:()=>Promise.resolve()},{get:(o,k)=>k in o?o[k]:()=>{}});
  const st={node:id,ch:id.split('-')[0],life:3,maxLife:3,ikari:40,satsu:40,saku:3,flags:{kyodai:true},items:[],streak:0,q:0,ok:0,hints:0,picks:[],log:[],cp:null,hinted:{},phase:null,...options.state};
  if(!options.fresh)w.localStorage.setItem(KEY,JSON.stringify(options.saved||{v:2,save:st,endings:{},gen:{},cleared:{},sound:false,plays:0,best:null,view:'2d',classroom:!!options.classroom,instant:true,...options.meta}));
  for(const f of ['src/data/kuho.js','src/js/learning.js','src/data/koumon.js','src/js/koumon-classroom.js','src/js/koumon.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));
  const app=w.Koumon,doc=w.document;
  async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
  async function click(selector){const b=doc.querySelector(selector);assert.ok(b,'missing '+selector);assert.notEqual(b.disabled,true,'disabled '+selector);b.click();await flush();}
  app.open({standalone:true});await flush();
  if(options.start!==false)await click('[data-km="continue"]');
  const node=id=>app._nodes()[id].n;
  const wrong=id=>node(id).o.findIndex(o=>!o.ok),right=id=>node(id).o.findIndex(o=>o.ok);
  return {w,doc,app,click,flush,errors,node,wrong,right,timeouts,close:()=>w.close(),saved:()=>JSON.parse(w.localStorage.getItem(KEY))};
}
async function playCanonical(h){
  for(let guard=0;guard<400;guard++){
    const mode=h.app._mode(),n=h.app._nodes()[h.app._state().node].n;
    if(mode==='end')return n.e;
    if(mode==='scene'){for(const [id,j] of [...h.timeouts])if(j.ms===10){h.timeouts.delete(id);j.fn();}await h.flush();}
    else if(mode==='card')await h.click('#km-card');
    else if(mode==='say'||mode==='react')await h.click('[data-km="next"]');
    else if(mode==='gen')await h.click('[data-km="gennext"]');
    else if(mode==='ask')await h.click('[data-km="pick"][data-i="'+n.o.findIndex(o=>o.ok)+'"]');
    else if(mode==='feedback')await h.click('[data-km="fbnext"]');
    else if(mode!=='scene')throw new Error('Unexpected mode '+mode);
  }
  assert.fail('no ending');
}

test('classroom reading asks again with a hint before revealing the answer, and survives reload',async()=>{
  let h=await setup('c0-11',{classroom:true});const id='c0-11',bad=h.node(id).o.map((o,i)=>i).filter(i=>!h.node(id).o[i].ok);
  await h.click('[data-km="pick"][data-i="'+bad[0]+'"]');
  assert.equal(h.app._mode(),'ask');assert.equal(h.app._state().q,0);
  assert.ok(h.doc.querySelector('.km-fb-retry'));assert.equal(h.doc.querySelector('#km-hint').hidden,false);
  assert.equal(h.doc.querySelector('.km-opt[data-i="'+bad[0]+'"]').disabled,true);
  assert.equal(h.doc.querySelector('.km-fb-right'),null,'the answer is not revealed on the first miss');
  assert.equal(h.app._meta().missed[id],1);
  const saved=h.saved();h.close();
  h=await setup(id,{saved});assert.equal(h.app._mode(),'ask');assert.equal(h.doc.querySelector('.km-opt[data-i="'+bad[0]+'"]').disabled,true);
  await h.click('[data-km="pick"][data-i="'+h.right(id)+'"]');
  assert.equal(h.app._mode(),'feedback');assert.match(h.doc.querySelector('.km-fb-h').textContent,/読み直して/);
  assert.equal(h.app._state().q,1);assert.equal(h.app._state().ok,0,'reading rate counts the first attempt');
  assert.equal(h.app._meta().missed[id],1);assert.deepEqual(h.errors,[]);h.close();
});
test('second classroom miss reveals the answer once, without charging life',async()=>{
  const h=await setup('c0-11',{classroom:true}),id='c0-11',bad=h.node(id).o.map((o,i)=>i).filter(i=>!h.node(id).o[i].ok);
  await h.click('[data-km="pick"][data-i="'+bad[0]+'"]');await h.click('[data-km="pick"][data-i="'+bad[1]+'"]');
  assert.equal(h.app._mode(),'feedback');assert.ok(h.doc.querySelector('.km-fb-right'));assert.equal(h.app._state().life,3);
  assert.equal(h.app._meta().missed[id],1,'one question is logged once per attempt');h.close();
});
test('number keys follow the on-screen order even after an option is disabled',async()=>{
  const h=await setup('c0-11',{classroom:true});
  const buttons=()=>[...h.doc.querySelectorAll('.km-opts .km-opt')];
  const firstWrong=buttons().findIndex(b=>!h.node('c0-11').o[+b.dataset.i].ok);
  buttons()[firstWrong].click();await h.flush();
  const key=k=>h.doc.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:k,bubbles:true}));
  key(String(firstWrong+1));await h.flush();assert.equal(h.app._mode(),'ask','disabled option ignores its key');
  const target=buttons().findIndex(b=>h.node('c0-11').o[+b.dataset.i].ok);
  key(String(target+1));await h.flush();assert.equal(h.app._mode(),'feedback');
  assert.match(h.doc.querySelector('.km-fb-h').textContent,/読み解いた/);h.close();
});
test('review book replays missed questions and clears them once read correctly',async()=>{
  const h=await setup('c0-11');await h.click('[data-km="pick"][data-i="'+h.wrong('c0-11')+'"]');
  assert.equal(h.app._meta().missed['c0-11'],1);
  await h.click('[data-km="quit"]');assert.match(h.doc.querySelector('[data-km="review"]').textContent,/1/);
  await h.click('[data-km="review"]');assert.match(h.doc.querySelector('.km-m-review').textContent,/使者が伝えた/);
  await h.click('[data-km="revpick"][data-i="'+h.wrong('c0-11')+'"]');assert.equal(h.app._meta().missed['c0-11'],2);
  await h.click('[data-km="revnext"]');await h.click('[data-km="review"]');
  await h.click('[data-km="revpick"][data-i="'+h.right('c0-11')+'"]');assert.equal(h.app._meta().missed['c0-11'],undefined);
  await h.click('[data-km="revnext"]');assert.match(h.doc.querySelector('.km-m-review').textContent,/すべて読み解きました/);
  assert.deepEqual(h.errors,[]);h.close();
});
test('ending compares each decision with the Shiji route',async()=>{
  const h=await setup('c6-leave');await h.click('[data-km="pick"][data-i="1"]');
  assert.equal(await playCanonical(h),'B4');
  const differ=h.doc.querySelector('.km-route-list li.differ');assert.ok(differ);assert.match(differ.textContent,/史記/);
  assert.match(h.doc.querySelector('.km-end-picks summary').textContent,/史記と違う選択 1/);h.close();
});
test('the Wujiang crossing is a Part 2 alternative ending that retries back to the decision',async()=>{
  const h=await setup('c8-ukou');await h.click('[data-km="pick"][data-i="1"]');
  assert.equal(await playCanonical(h),'B9');assert.ok(h.app._meta().endings.B9);
  assert.match(h.doc.querySelector('.km-end-fact').textContent,/杜牧/);
  await h.click('[data-km="retry"]');assert.equal(h.app._state().node,'c8-ukou');assert.equal(h.app._mode(),'ask');
  assert.equal(await playCanonical(h),'T2');assert.deepEqual(h.errors,[]);h.close();
});
test('prologue decision is an interpretive choice recorded as the player\'s reading',async()=>{
  const h=await setup('c0-mind');await h.click('[data-km="pick"][data-i="2"]');
  assert.equal(h.app._mode(),'react');const p=h.app._state().picks.at(-1);assert.equal(p.interp,true);assert.equal(p.hist,undefined);h.close();
});
test('URL hash opens a chapter in classroom mode and leaves locked chapters closed in challenge mode',async()=>{
  let h=await setup('c0-1',{start:false,classroom:true,url:'http://localhost/#c5'});assert.equal(h.app._state().ch,'c5');h.close();
  h=await setup('c0-1',{start:false,fresh:true,url:'http://localhost/#c5'});h.app._meta();
  // 初回は授業モードが既定なので、挑戦モードを明示した記録で確かめる
  h.close();h=await setup('c0-1',{start:false,saved:{v:2,save:null,endings:{},gen:{},cleared:{},classroom:false,view:'2d'},url:'http://localhost/#c5'});
  assert.equal(h.app._mode(),'title');h.close();
  h=await setup('c0-1',{start:false,classroom:true,url:'http://localhost/#review'});assert.ok(h.doc.querySelector('.km-m-review'));h.close();
  h=await setup('c0-1',{classroom:true});await h.click('.km-top [data-km="menu"]');
  const select=h.doc.querySelector('[data-chaplink]');assert.ok(select);assert.equal(select.querySelectorAll('option').length,13);h.close();
});
test('learning record gathers progress, routes, review items and reflection',async()=>{
  const h=await setup('c0-11',{meta:{reflection:{quote:'[g10] 項王黙然不応'}}});
  await h.click('[data-km="pick"][data-i="'+h.wrong('c0-11')+'"]');await h.click('[data-km="quit"]');
  await h.click('[data-km="record"]');const text=h.doc.querySelector('.km-record').value;
  for(const part of ['■ 進み具合','■ 結末（0 / 11）','■ 読み直し帳（まだ読み解けていない問い 1 問）','使者が伝えた','■ 振り返り','項王黙然不応'])assert.ok(text.includes(part),part);
  await h.click('[data-km="copyrecord"]');assert.match(h.doc.querySelector('#km-record-status').textContent,/コピー/);
  await h.click('[data-km="saverecord"]');assert.deepEqual(h.errors,[]);h.close();
});
test('classroom mode shows anger and hostility meters as a reference that can be turned off',async()=>{
  const h=await setup('c3-2',{classroom:true,state:{flags:{meters:true,kyodai:true}}});
  assert.ok(h.doc.querySelector('.km-meter.ikari'));
  await h.click('.km-top [data-km="settings"]');const pref=h.doc.querySelector('[data-pref="meters"]');pref.checked=false;pref.dispatchEvent(new h.w.Event('change'));
  assert.equal(h.doc.querySelector('.km-meter'),null);assert.equal(h.app._meta().meters,false);h.close();
});
test('tapping the original-text panel advances, and checkpoints no longer copy the dialogue log',async()=>{
  const h=await setup('c0-10');assert.equal(h.app._mode(),'gen');
  h.doc.querySelector('.km-yaku').click();await h.flush();assert.equal(h.app._mode(),'ask');
  assert.ok(h.app._state().rewinds.every(p=>p.snap.log.length===0));h.close();
});

test('answer order varies across questions instead of always placing the correct answer last',async()=>{
  const h=await setup('c0-1',{classroom:true}),nodes=Object.values(h.app._nodes()).map(x=>x.n);
  const position=(id)=>{h.app._go(id);return [...h.doc.querySelectorAll('.km-opts .km-opt')].findIndex(b=>h.node(id).o[+b.dataset.i].ok);};
  const reads=nodes.filter(n=>n.t==='ask'&&n.k==='read').map(n=>position(n.id));
  for(const p of [0,1,2,3])assert.ok(reads.filter(x=>x===p).length>=3,'correct answer appears in slot '+(p+1)+': '+reads.join(''));
  const judges=nodes.filter(n=>n.t==='ask'&&n.k==='judge'&&n.o.filter(o=>o.ok).length===1).map(n=>position(n.id));
  assert.ok(judges.some(p=>p!==0),'historical choice is not always first');
  assert.equal(position('c0-11'),position('c0-11'),'order is stable for the same question');h.close();
});
test('intro "鴻門への道" covers the road before the prologue and hands off to 霸上の夕べ',async()=>{
  const h=await setup('c0-1',{start:false,classroom:true});
  assert.match(h.doc.querySelector('[data-km="intro"]').textContent,/鴻門への道/);assert.doesNotMatch(h.doc.body.textContent,/鴻門前夜/);
  await h.click('[data-km="intro"]');const tags=[...h.doc.querySelectorAll('[data-intro="step"]')].map(b=>b.textContent);
  assert.deepEqual(tags,['乱世','挙兵','約束','二つの道','先着','函谷関','霸上の夕べへ']);
  for(let i=0;i<7;i++){
    await h.click('[data-intro="step"][data-step="'+i+'"]');
    assert.ok(h.doc.querySelector('.km-timeline [aria-current="true"]'),'timeline marks scene '+i);
    assert.ok(h.doc.querySelector('.km-intro-quote .km-quote-haku'),'original text in scene '+i);
    assert.ok(h.doc.querySelector('.km-intro-terms, .km-intro-watch'),'terms or watch list in scene '+i);
  }
  await h.click('[data-intro="step"][data-step="4"]');
  await h.click('[data-intro="quiz"][data-question="take"][data-answer="burn"]');assert.match(h.doc.querySelector('.km-quiz-answer').textContent,/もう一度/);
  await h.click('[data-intro="quiz"][data-question="take"][data-answer="seal"]');assert.match(h.doc.querySelector('.km-quiz-answer').textContent,/財物取る所無く/);
  await h.click('[data-intro="step"][data-step="1"]');assert.equal(h.doc.querySelectorAll('.km-pair-card').length,2);
  await h.click('.km-pair-card [data-person="u"]');assert.match(h.doc.querySelector('#km-intro-person').textContent,/項羽/);
  await h.click('[data-intro="step"][data-step="6"]');assert.match(h.doc.querySelector('[data-intro="done"]').textContent,/霸上の夕べ/);
  await h.click('[data-intro="done"]');assert.equal(h.app._state().ch,'c0');assert.deepEqual(h.errors,[]);h.close();
});
