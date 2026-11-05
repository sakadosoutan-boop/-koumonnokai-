// プリント演習は物語とは別に採点・保存し、本文を根拠に読み直せる。
const fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),KEY='kanbun-dojo:koumon:v1';
const activityScripts=['src/data/koumon-activities.js','src/js/koumon-activities.js'];
const plain=value=>JSON.parse(JSON.stringify(value));
function load(w,files){for(const file of files)w.eval(fs.readFileSync(path.join(root,file),'utf8'));}
function moduleHarness(){
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{runScripts:'outside-only'});
  load(dom.window,activityScripts);
  return {w:dom.window,api:dom.window.KoumonActivities,data:dom.window.KOUMON_ACTIVITIES,close:()=>dom.window.close()};
}
async function setup(options={}){
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:options.url||'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,errors=[];let serial=0;
  w.addEventListener('error',e=>{errors.push(e.message);e.preventDefault();});
  w.matchMedia=()=>({matches:true});w.Element.prototype.scrollIntoView=function(){};
  w.setInterval=()=>++serial;w.clearInterval=()=>{};w.setTimeout=()=>++serial;w.clearTimeout=()=>{};
  w.URL.createObjectURL=()=>'blob:record';w.URL.revokeObjectURL=()=>{};
  w.KoumonStage=new Proxy({S:{stageId:'feast'},is3D:false,setScene:()=>Promise.resolve()},{get:(o,k)=>k in o?o[k]:()=>{}});
  const state={node:'c0-11',ch:'c0',life:2,maxLife:3,ikari:40,satsu:40,saku:2,flags:{kyodai:true},items:[],streak:0,q:2,ok:1,hints:1,picks:[],log:[],cp:null,hinted:{},phase:null,...options.state};
  w.localStorage.setItem(KEY,JSON.stringify(options.saved||{v:2,save:state,endings:{},gen:{},cleared:{},sound:false,plays:0,best:null,view:'2d',classroom:true,instant:true,...options.meta}));
  load(w,['src/data/kuho.js','src/js/learning.js','src/data/koumon.js','src/js/koumon-classroom.js',...activityScripts,'src/js/koumon.js']);
  const app=w.Koumon,doc=w.document;
  async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
  async function click(selector){const button=doc.querySelector(selector);assert.ok(button,'missing '+selector);assert.notEqual(button.disabled,true,'disabled '+selector);button.click();await flush();}
  app.open({standalone:true});await flush();
  if(options.start)await click('[data-km="continue"]');
  return {w,doc,app,click,flush,errors,close:()=>w.close(),saved:()=>JSON.parse(w.localStorage.getItem(KEY))};
}

function fill(api,a,state,correct){
  if(a.type==='order'){
    if(!correct)return state;
    for(let target=0;target<a.answer.length;target++){
      const card=a.answer[target];
      while(state.order.indexOf(card)>target)state=api.act(a.id,state,'up',{card});
    }
    return state;
  }
  for(const q of a.questions){
    assert.ok(q.options.some(o=>o.id===q.answer),a.id+'/'+q.id+' has an available answer');
    state=api.act(a.id,state,'answer',{question:q.id,value:correct?q.answer:q.options.find(o=>o.id!==q.answer).id});
  }
  return state;
}

for(const id of ['relationships','sword-order','omitted-people','argument','formation','evidence'])test(id+': answers, retries, duplicate checks and explanation',()=>{
  const h=moduleHarness();try{
    const {api}=h,a=h.data.find(a=>a.id===id),total=a.type==='order'?a.cards.length:a.questions.length;
    let state=api.initial(id);
    if(a.type!=='order'){
      assert.deepEqual(plain(api.act(id,state,'check')),plain(state),'unanswered work is not graded');
      const missing=a.questions.at(-1);
      for(const q of a.questions.slice(0,-1))state=api.act(id,state,'answer',{question:q.id,value:q.answer});
      assert.equal(api.act(id,state,'check').tries,0,'one missing answer blocks grading');
      assert.match(api.render(id,state),/data-action="check" disabled/);
      assert.equal(state.answers[missing.id],undefined);
      state=api.initial(id);
    }else{
      assert.equal(state.order.length,total,'ordering starts with every card');
      assert.deepEqual(plain(api.act(id,state,'up',{card:state.order[0]})),plain(state));
      assert.deepEqual(plain(api.act(id,state,'down',{card:state.order.at(-1)})),plain(state));
    }
    state=fill(api,a,state,false);state=api.act(id,state,'check');
    assert.equal(state.checked,true);assert.equal(state.tries,1);assert.equal(state.firstScore,0);assert.equal(state.best,0);
    assert.match(api.render(id,state),/本文を確認|順序を確認/);
    assert.deepEqual(plain(api.act(id,state,'check')),plain(state),'duplicate grading is idempotent');
    state=fill(api,a,state,true);assert.equal(state.checked,false);
    state=api.act(id,state,'check');assert.equal(state.tries,2);assert.equal(state.best,total);assert.equal(state.firstScore,0);
    assert.match(api.render(id,state),new RegExp(total+' / '+total));
    assert.deepEqual(plain(api.restore({[id]:state})[id]),plain(state),'valid progress round trips');
    const reset=api.act(id,state,'reset');assert.equal(reset.checked,false);assert.equal(reset.tries,2);assert.equal(reset.best,total);assert.equal(reset.firstScore,0);
    assert.deepEqual(plain(reset.answers),{});
  }finally{h.close();}
});

test('malformed activity storage is bounded, filtered and safe to render',()=>{
  const h=moduleHarness();try{
    for(const invalid of [null,[],42,'bad'])assert.deepEqual(plain(h.api.restore(invalid)),{});
    const saved={unknown:{checked:true}};
    for(const a of h.data)saved[a.id]={answers:{unknown:'<img src=x onerror=alert(1)>'},order:['unknown','unknown'],checked:true,tries:-1,best:Infinity,firstScore:'100',reflection:123};
    const restored=h.api.restore(saved);assert.equal(Object.keys(restored).length,6);assert.equal(restored.unknown,undefined);
    for(const a of h.data){
      const state=restored[a.id];assert.equal(state.checked,false);assert.equal(state.tries,0);assert.equal(state.best,0);assert.equal(state.firstScore,null);assert.equal(state.reflection,'');
      assert.deepEqual(plain(state.answers),{});assert.doesNotThrow(()=>h.api.render(a.id,state));
      const total=a.type==='order'?a.cards.length:a.questions.length;
      const bounded=h.api.restore({[a.id]:{tries:999999,best:999999,firstScore:999999,checked:true,answers:{},reflection:'x'.repeat(1300)}})[a.id];
      assert.equal(bounded.tries,9999);assert.equal(bounded.best,total);assert.equal(bounded.firstScore,total);
      assert.equal(bounded.checked,a.type==='order');assert.equal(bounded.reflection.length,a.reflection?1200:0);
      const before=h.api.initial(a.id);
      assert.deepEqual(plain(h.api.act(a.id,before,'answer',{question:a.questions?.[0]?.id,value:'__proto__'})),plain(before));
    }
    assert.equal(h.api.initial('unknown'),null);assert.equal(h.api.act('unknown',{},'check'),null);
  }finally{h.close();}
});

test('reflection is ungraded, length limited and escaped in rendered HTML',()=>{
  const h=moduleHarness();try{
    const a=h.data.find(a=>a.id==='evidence'),payload='</textarea><img src=x onerror="alert(1)"><script>alert(1)</script>&';
    let state=fill(h.api,a,h.api.initial(a.id),true);state=h.api.act(a.id,state,'check');
    state=h.api.act(a.id,state,'reflect',{value:payload});assert.equal(state.tries,1);assert.equal(state.best,a.questions.length);
    h.w.document.body.innerHTML=h.api.render(a.id,state);
    assert.equal(h.w.document.querySelector('textarea').value,payload);assert.equal(h.w.document.querySelector('img,script'),null);
    assert.ok(h.api.summary({[a.id]:state}).join('\n').includes(payload));
    assert.equal(h.api.act(a.id,state,'reflect',{value:'x'.repeat(1300)}).reflection.length,1200);
    assert.equal(h.api.act(a.id,state,'reset').reflection,payload);
    assert.equal(h.api.act('relationships',null,'reflect',{value:payload}).reflection,'');
  }finally{h.close();}
});

async function choose(h,question,value){
  const input=h.doc.querySelector('[data-activity-answer="'+question+'"]');assert.ok(input,question);
  input.value=value;input.dispatchEvent(new h.w.Event('change',{bubbles:true}));await h.flush();
}

test('activities save and restore progress and reflections independently of the story, and appear in the learning record',async()=>{
  let h=await setup({start:true});
  try{
    const story=plain(h.app._state()),save=h.saved().save,mode=h.app._mode();
    await h.click('.km-top [data-km="menu"]');await h.click('[data-km="activities"]');
    assert.equal(h.doc.querySelectorAll('[data-km="activity-open"]').length,6);
    await h.click('[data-km="activity-open"][data-id="evidence"]');
    assert.equal(h.doc.querySelector('[data-action="check"]').disabled,true);
    const a=h.w.KOUMON_ACTIVITIES.find(a=>a.id==='evidence');
    for(const q of a.questions)await choose(h,q.id,q.answer);
    await h.click('[data-action="check"]');
    h.doc.querySelector('[data-action="check"]').click();await h.flush();
    assert.equal(h.app._meta().activities.evidence.tries,1);
    const reflection='項王は応じなかった。理由は本文から考える。 </textarea><img src=x>';
    const textarea=h.doc.querySelector('[data-activity-reflection]');textarea.value=reflection;textarea.dispatchEvent(new h.w.Event('input',{bubbles:true}));await h.flush();
    assert.equal(h.saved().activities.evidence.reflection,reflection);assert.equal(h.doc.querySelector('.km-act img'),null);
    assert.deepEqual(plain(h.app._state()),story);assert.deepEqual(h.saved().save,save);assert.equal(h.app._mode(),mode);
    const saved=h.saved();assert.deepEqual(h.errors,[]);h.close();h=await setup({saved,start:true});
    assert.deepEqual(plain(h.app._meta().activities),saved.activities);
    await h.click('.km-top [data-km="menu"]');await h.click('[data-km="activities"]');
    assert.match(h.doc.querySelector('[data-id="evidence"]').textContent,/最高 4 \/ 4/);
    await h.click('[data-km="activity-open"][data-id="evidence"]');
    assert.equal(h.doc.querySelector('[data-activity-reflection]').value,reflection);assert.equal(h.doc.querySelector('[data-action="check"]').disabled,true);
    await h.click('[data-km="activities"]');await h.click('[data-km="closemodal"]');
    // The chapter menu beneath the activities is restored by modal navigation.
    assert.ok(h.doc.querySelector('.km-m-menu'));await h.click('[data-km="closemodal"]');await h.click('[data-km="quit"]');
    await h.click('[data-km="record"]');
    const text=h.doc.querySelector('.km-record').value;
    for(const part of ['■ プリント演習','本文と人物像を分ける','初回 4/4','最高 4/4','確認 1 回',reflection,'自動採点なし'])assert.ok(text.includes(part),part);
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});

test('activity URL hashes open the list or a specific activity without replacing the saved story',async()=>{
  for(const hash of ['activities','activity-formation','activity-unknown']){
    const h=await setup({url:'http://localhost/#'+hash});try{
      assert.equal(h.saved().save.node,'c0-11');assert.equal(h.app._mode(),'title');
      if(hash==='activity-formation')assert.ok(h.doc.querySelector('[data-activity-id="formation"]'));
      else assert.equal(h.doc.querySelectorAll('[data-km="activity-open"]').length,6);
      assert.deepEqual(h.errors,[]);
    }finally{h.close();}
  }
});

test('ordering controls and formation positions work through the integrated event handlers',async()=>{
  const h=await setup({url:'http://localhost/#activity-sword-order'});try{
    const a=h.w.KOUMON_ACTIVITIES.find(a=>a.id==='sword-order');
    for(let target=0;target<a.answer.length;target++){
      const card=a.answer[target];
      const order=()=>h.app._meta().activities[a.id]?.order||a.initial;
      while(order().indexOf(card)>target)await h.click('[data-action="up"][data-card="'+card+'"]');
    }
    await h.click('[data-action="check"]');assert.equal(h.saved().activities[a.id].best,6);
    await h.click('[data-km="activities"]');await h.click('[data-km="activity-open"][data-id="formation"]');
    await h.click('[data-action="answer"][data-value="east"]');await choose(h,'direction','west');
    await h.click('[data-action="check"]');assert.equal(h.saved().activities.formation.best,2);
    assert.equal(h.doc.querySelector('[data-value="east"]').getAttribute('aria-pressed'),'true');assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});
