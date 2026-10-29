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
  const select=h.doc.querySelector('[data-chaplink]');assert.ok(select);assert.equal(select.querySelectorAll('option').length,14);h.close();
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
test('intro "鴻門への道" is the prelude and hands off to the 霸上の夜 tutorial',async()=>{
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
  await h.click('[data-intro="step"][data-step="6"]');assert.match(h.doc.querySelector('[data-intro="done"]').textContent,/霸上の夜/);
  await h.click('[data-intro="done"]');assert.equal(h.app._state().ch,'c0');assert.deepEqual(h.errors,[]);h.close();
});
test('intro scenes open as a picture story on the main stage, then switch to the unchanged notes',async()=>{
  const h=await setup('c0-1',{start:false,classroom:true}),calls=[];
  h.w.KoumonStage.setScene=(stage,light,cast)=>{calls.push([stage,light,cast.join(',')]);return Promise.resolve();};
  await h.click('[data-km="intro"]');
  assert.ok(h.doc.querySelector('#km-intro.km-intro-drama'));assert.ok(h.doc.querySelector('#km').classList.contains('km-intro-staging'));
  assert.equal(h.doc.querySelector('.km-intro-layout').hidden,true);
  const scenes=h.w.KoumonClassroom.scenes;
  for(let i=0;i<scenes.length;i++){
    await h.click('[data-intro="step"][data-step="'+i+'"]');
    const n=scenes[i].drama.length;assert.ok(n>=2&&n<=6,'scene '+i+' has a short picture story');
    for(let c=1;c<n;c++){assert.match(h.doc.querySelector('.km-drama-count').textContent,new RegExp('^'+c+' / '+n));await h.click('[data-intro="cutnext"]');}
    assert.match(h.doc.querySelector('[data-intro="cutnext"]').textContent,i<scenes.length-1?/次の場面へ/:/霸上の夜/);
    await h.click('.km-drama-notes');
    assert.equal(h.doc.querySelector('.km-drama'),null);assert.equal(h.doc.querySelector('.km-intro-layout').hidden,false);
    assert.equal(h.doc.querySelector('.km-intro-copy h2').textContent,scenes[i].title,'notes stay as written');
  }
  for(const s of scenes)for(const c of s.drama){assert.ok(c.stage&&c.light&&Array.isArray(c.cast),'cut inherits its stage');assert.ok(['shiki','retold','fiction'].includes(c.kind));if(c.w)assert.ok(c.cast.includes(c.w),c.w+' is on stage');}
  assert.ok(['koumon','bashang','road'].every(id=>calls.some(c=>c[0]===id)),'the main story stages are reused');
  await h.click('[data-intro="view"][data-view="drama"]');assert.ok(h.doc.querySelector('.km-drama'));
  await h.click('.km-drama');assert.match(h.doc.querySelector('.km-drama-count').textContent,/^2 \//);
  h.doc.querySelector('.km-drama-card').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await h.flush();
  assert.match(h.doc.querySelector('.km-drama-count').textContent,/^3 \//);
  await h.click('[data-intro="cutprev"]');assert.match(h.doc.querySelector('.km-drama-count').textContent,/^2 \//);
  await h.click('[data-intro="exit"]');assert.equal(h.doc.querySelector('#km').classList.contains('km-intro-staging'),false);
  assert.deepEqual(h.errors,[]);h.close();
});
test('intro stage arrangements reuse the main stage builders and only add positions',()=>{
  const w={KoumonStage3D:{STAGES:{nangong:{build:'b3',pos:{ko:1},officials:[1]},gate:{build:'g3',pos:{}}}},KoumonStage:{STAGES:{nangong:{layers:'l2',pos:{},officials:[1]},gate:{layers:'g2',pos:{}}}}};
  new Function('window',fs.readFileSync(path.join(root,'src/js/koumon-intro-stages.js'),'utf8'))(w);
  const court=w.KoumonStage3D.STAGES['intro-court'];assert.equal(court.build,'b3');assert.equal(court.officials,null);assert.ok(court.pos.hai&&court.pos.u);
  assert.equal(w.KoumonStage.STAGES['intro-field'].layers,'g2');assert.ok(w.KoumonStage.STAGES['intro-field'].pos.u.h);
  const used=new Set();
  const d=new JSDOM('',{runScripts:'outside-only'}).window;d.eval(fs.readFileSync(path.join(root,'src/js/koumon-classroom.js'),'utf8'));
  for(const s of d.KoumonClassroom.scenes)for(const c of s.drama){used.add(c.stage);const st=w.KoumonStage3D.STAGES[c.stage]||{pos:null};if(c.stage.startsWith('intro-'))for(const id of c.cast)assert.ok(st.pos[id],c.stage+' places '+id);}
  for(const id of used)assert.ok(id.startsWith('intro-')||['nangong','bashang','koumon','gate','road','tent'].includes(id),id);
  d.close();
});
test('figures from the earlier intro (alliance map, relation diagram, next-morning map) remain available',async()=>{
  const h=await setup('c0-1',{start:false,classroom:true});await h.click('[data-km="intro"]');
  await h.click('[data-intro="step"][data-step="1"]');await h.click('[data-intro="view"][data-view="notes"]');
  assert.ok(h.doc.querySelector('.km-intro-pair'));await h.click('[data-intro="fig"][data-fig="1"]');
  assert.ok(h.doc.querySelector('svg.km-intro-map.allies'));assert.match(h.doc.querySelector('.km-intro-visual').textContent,/城陽/);
  await h.click('[data-intro="step"][data-step="6"]');await h.click('[data-intro="view"][data-view="notes"]');
  assert.ok(h.doc.querySelector('svg.km-intro-map.eve'));
  await h.click('[data-intro="fig"][data-fig="1"]');assert.equal(h.doc.querySelectorAll('.km-intro-people [data-person]').length,3);assert.match(h.doc.querySelector('.km-intro-visual').textContent,/旧交が、陣営をつなぐ/);
  await h.click('[data-intro="fig"][data-fig="2"]');assert.ok(h.doc.querySelector('svg.km-intro-map.hongmen'));assert.match(h.doc.querySelector('.km-intro-visual').textContent,/翌朝、百余騎で謝罪へ/);
  for(const m of ['promise','routes','arrival','tension']){assert.ok(h.w.KoumonClassroom.scenes.some(s=>s.map===m),m+' map kept');}
  assert.deepEqual(h.errors,[]);h.close();
});
test('plain-language labels: picture-story Shiji lines show the reading and a separate modern translation',async()=>{
  const h=await setup('c0-1',{start:false,classroom:true});await h.click('[data-km="intro"]');
  assert.match(h.doc.querySelector('.km-drama-card .km-evidence-label').textContent,/史記の言葉/);
  assert.match(h.doc.querySelector('.km-drama-text').textContent,/^嗟乎、大丈夫当に此くのごとくなるべきなり。$/);
  assert.match(h.doc.querySelector('.km-drama-gloss').textContent,/現代語訳ああ、男と生まれたからには/);
  await h.click('[data-intro="exit"]');await h.click('[data-km="endings"]');
  assert.match(h.doc.querySelector('.km-m-ends').textContent,/史記と違う結末（異聞）/);h.close();
});

test('the shortened intro moves straight to the next scene and ends by starting the 霸上の夜 tutorial',async()=>{
  const h=await setup('c0-1',{start:false,classroom:true});await h.click('[data-km="intro"]');
  const scenes=h.w.KoumonClassroom.scenes;assert.ok(scenes.reduce((a,s)=>a+s.drama.length,0)<=20,'about 18 cuts in total');
  assert.match(scenes.at(-1).body.join(''),/チュートリアル「霸上の夜」/,'the last scene points to the tutorial');
  for(let i=0;i<scenes.length;i++){
    assert.equal(h.doc.querySelector('[data-intro="step"][aria-current="step"]').dataset.step,String(i));
    for(let c=0;c<scenes[i].drama.length-1;c++)await h.click('[data-intro="cutnext"]');
    if(i<scenes.length-1){await h.click('[data-intro="cutnext"]');assert.ok(h.doc.querySelector('.km-drama'),'next scene opens as a picture story');}
  }
  await h.click('[data-intro="cutnext"]');assert.equal(h.doc.querySelector('#km-intro').hidden,true);assert.equal(h.app._state().ch,'c0');assert.equal(h.app._state().tutorial,true);
  await h.click('[data-km="quit"]');await h.click('[data-km="menu"]');
  const order=[...h.doc.querySelectorAll('.km-chap')].map(b=>b.dataset.c);assert.deepEqual(order.slice(0,2),['c2','c3']);assert.deepEqual(order.slice(-2),['c0','c1']);
  assert.ok(h.doc.querySelector('.km-chap-group'));assert.deepEqual(h.errors,[]);h.close();
});
test('challenge mode opens the textbook start and the supplementary prelude without clearing them first',async()=>{
  const h=await setup('c0-1',{start:false,saved:{v:2,save:null,endings:{},gen:{},cleared:{},classroom:false,view:'2d'}});
  await h.click('[data-km="menu"]');
  for(const id of ['c0','c1','c2'])assert.equal(h.doc.querySelector('.km-chap[data-c="'+id+'"]').disabled,false,id);
  assert.equal(h.doc.querySelector('.km-chap[data-c="c3"]').disabled,true);h.close();
});
test('tutorial plays the 霸上 prelude with one-time tips, then hands off to 鴻門に謝す',async()=>{
  const h=await setup('c0-1',{start:false,saved:{v:2,save:null,endings:{},gen:{},cleared:{},classroom:true,view:'2d',instant:true}});
  assert.match(h.doc.querySelector('[data-km="tutorial"]').textContent,/チュートリアル/);
  await h.click('[data-km="tutorial"]');
  assert.equal(h.app._state().ch,'c0');assert.equal(h.app._state().tutorial,true);
  // 台詞・原文の段・読み解け・解説・決断の初回に一度ずつ説明が出る
  const seen=new Set();
  for(let guard=0;guard<200&&h.app._state().tutorial;guard++){
    const tip=h.doc.querySelector('.km-tip');if(tip){const kinds=Object.keys(h.app._state().tips);seen.add(kinds.at(-1));await h.click('[data-km="tipclose"]');assert.equal(h.doc.querySelector('.km-tip'),null);}
    const mode=h.app._mode(),n=h.app._nodes()[h.app._state().node].n;
    if(mode==='scene'){for(const [id,j] of [...h.timeouts])if(j.ms===10){h.timeouts.delete(id);j.fn();}await h.flush();}
    else if(mode==='card')await h.click('#km-card');
    else if(mode==='say'||mode==='react')await h.click('[data-km="next"]');
    else if(mode==='gen')await h.click('[data-km="gennext"]');
    else if(mode==='ask')await h.click('[data-km="pick"][data-i="'+n.o.findIndex(o=>o.ok)+'"]');
    else if(mode==='feedback')await h.click('[data-km="fbnext"]');
    else if(mode==='end')break;
    else throw new Error(mode);
  }
  for(const k of ['say','gen','read','feedback','judge','react'])assert.ok(seen.has(k),'tip '+k);
  assert.ok(h.doc.querySelector('[data-km="tutnext"]'),'tutorial end screen');assert.match(h.doc.querySelector('.km-m-end').textContent,/霸上の夜、終わり/);
  assert.equal(h.saved().save.ch,'c2','progress is saved at the textbook start');
  await h.click('[data-km="tutnext"]');assert.equal(h.app._state().ch,'c2');assert.equal(h.app._state().tutorial,false);
  assert.deepEqual(h.errors,[]);h.close();
});
test('tutorial can be left at its end and resumed from the textbook start; it is also reachable from the intro',async()=>{
  let h=await setup('c1-45',{state:{tutorial:true,tips:{say:true}},classroom:true});
  for(let i=0;i<5&&h.app._mode()!=='end';i++)await h.click('[data-km="next"]');
  await h.click('[data-km="totitle"]');assert.equal(h.app._mode(),'title');
  await h.click('[data-km="continue"]');assert.equal(h.app._state().ch,'c2');assert.equal(h.app._state().tutorial,false);h.close();
  h=await setup('c0-1',{start:false,classroom:true});await h.click('[data-km="intro"]');await h.click('[data-intro="step"][data-step="6"]');
  const n=h.w.KoumonClassroom.scenes[6].drama.length;for(let c=1;c<n;c++)await h.click('[data-intro="cutnext"]');
  await h.click('[data-intro="cutnext"]');assert.equal(h.app._state().ch,'c0');assert.equal(h.app._state().tutorial,true);h.close();
});

test('home lays out prelude → tutorial → review, and each continue button resumes its own part',async()=>{
  let h=await setup('c0-1',{start:false,saved:{v:2,save:null,endings:{},gen:{},cleared:{},classroom:true,view:'2d'}});
  const labels=()=>[...h.doc.querySelectorAll('.km-home-actions .km-btn')].map(b=>b.textContent.replace(/\s+/g,''));
  assert.match(labels()[0],/^01鴻門への道/);assert.match(labels()[1],/^02チュートリアル：霸上の夜/);assert.match(labels()[2],/^03本編で復習する/);assert.match(labels()[3],/^04范増として考える/);
  await h.click('.km-home-tutorial');assert.equal(h.app._state().tutorial,true);await h.click('[data-km="quit"]');
  assert.match(labels()[1],/チュートリアルの続きから/);assert.match(labels()[2],/本編で復習する/);h.close();
  h=await setup('c3-1',{start:false,classroom:true});
  assert.match(labels()[1],/チュートリアル：霸上の夜/);assert.match(labels()[2],/本編の続きから/);h.close();
});

test('返り点：合符を読み取り、各設問の返り点が正しく対応している',async()=>{
  const h=await setup('c1-sonchou',{classroom:true});
  const t=h.w.Learning.tokens('孰‐与^二君^一少長');
  assert.equal(t[0].c,'孰');assert.equal(t[0].join,true);assert.equal(t[1].c,'与');assert.equal(t[1].mark,'二');assert.equal(t[2].mark,'一');
  assert.ok(h.doc.querySelector('.km-stem .kc .join'),'合符 is drawn');
  const stems=[];Object.values(h.w.KOUMON.script).forEach(a=>a.forEach(n=>{if(n.stem)stems.push([n.id,n.stem]);}));
  const byId=Object.fromEntries(stems);
  assert.equal(byId['c1-33'],'豈敢反乎','豈敢反乎 needs no 返り点 (乎 is read last)');
  assert.match(byId['c9-3'],/所‐以\^三有\^二天下\^一/);
  for(const [id,s] of stems){
    const marks=h.w.Learning.tokens(s).map(x=>x.mark).filter(Boolean);
    assert.equal(/\^/.test(h.w.Learning.tokens(s).map(x=>x.c).join('')),false,id+': every ^ attaches to a character');
    // 二 needs an earlier-closing 一 after it, 三 needs 二 after it; 下 needs 上 after it.
    marks.forEach((m,i)=>{const rest=marks.slice(i+1);
      if(m==='二')assert.ok(rest.includes('一'),id+': 二 without 一');
      if(m==='三')assert.ok(rest.includes('二'),id+': 三 without 二');
      if(m==='下')assert.ok(rest.includes('上'),id+': 下 without 上');});
    const toks=h.w.Learning.tokens(s).filter(x=>/[㐀-鿿]/.test(x.c));
    assert.ok(!toks.at(-1).mark||toks.at(-1).mark==='一',id+': the last character cannot carry レ/二');
  }
  h.close();
});
