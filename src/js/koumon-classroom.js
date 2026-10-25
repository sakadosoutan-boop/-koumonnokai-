/* 導入・人物・根拠付きAI活動。描画や物語の状態から独立した授業用の表示。 */
(function () {
  'use strict';
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var people = {
    hai: ['劉邦', 'りゅうほう', '沛公', '先に関中へ入った人', '張良の助言を受け、項羽との衝突を避けようとする。', 'han'],
    u: ['項羽', 'こうう', '項王・籍', '大軍を率いる楚の将軍', '劉邦と共に秦と戦った。范増の進言を受ける立場。', 'so'],
    ryo: ['張良', 'ちょうりょう', '子房', '劉邦に策を授ける人', '以前から項伯と親しく、そのつながりが仲介の糸口になる。', 'han'],
    zo: ['范増', 'はんぞう', '亜父', '項羽に進言する人', '劉邦を将来の脅威と考え、早く討つよう項羽に説く。', 'so'],
    haku: ['項伯', 'こうはく', '項羽の叔父', '両陣営をつなぐ人', '張良を助けようと夜の陣を訪れる。宴では劉邦をかばう。', 'so'],
    kai: ['樊噲', 'はんかい', '沛公の参乗', '劉邦を守る武人', '宴に入り、劉邦の功績を述べて項羽に訴える。', 'han'],
    sou: ['項荘', 'こうそう', '項羽の一族', '剣舞をする人', '范増の指示を受け、剣舞にかこつけて劉邦を狙う。', 'so'],
    chin: ['陳平', 'ちんぺい', '楚の都尉', '項羽の命令を伝える人', '席を立った劉邦を、項羽の命令で呼びに行く。', 'so']
  };
  var scenes = [
    {tag:'共闘',title:'二人には、共通の敵がいた。',body:'秦への反乱が広がるなか、劉邦と項羽も秦と戦う。二人は、以前に共に城陽などを攻めた仲だった。',point:'はじめから敵どうしだったわけではない。',source:'項羽本紀・高祖本紀：二人の共闘',map:'allies'},
    {tag:'約束',title:'「先に関中へ」が、王への条件。',body:'楚の懐王は、先に関中を平定した者をその地の王にする、と将軍たちと約束した。関中は秦の都・咸陽を含む地域。',point:'関中への先着には、政治的な意味があった。',source:'高祖本紀「先入定関中者王之」',map:'promise'},
    {tag:'進軍',title:'北で戦う項羽。西へ進む劉邦。',body:'項羽は北方で秦の大軍と戦い、軍事的な力と威信を高める。一方、劉邦は西へ進み、関中を目指した。',point:'「戦いの功績」と「関中への先着」は、同じではない。',source:'項羽本紀・高祖本紀：鉅鹿の戦いと劉邦の西進',map:'routes'},
    {tag:'先着',title:'先に関中へ入ったのは、劉邦。',body:'秦王の子嬰は劉邦に降伏する。劉邦は咸陽に入ったあと、秦の宮室や倉庫を封じ、霸上へ軍を戻した。',point:'懐王の約束に照らすと、劉邦に王となる根拠がある。',source:'高祖本紀：子嬰の降伏と還軍霸上',map:'arrival'},
    {tag:'対立',title:'約束は劉邦。兵力は項羽。',body:'劉邦側は関を閉ざしていたが、項羽軍は突破して鴻門に到着する。曹無傷の報告を聞いた項羽は怒り、范増は劉邦を討つよう進言した。',point:'曹無傷が「報告したこと」と、その内容が真実かどうかは分けて読む。',source:'項羽本紀：距関・曹無傷の密告・范増の進言',map:'tension',quiz:true},
    {tag:'仲介',title:'夜の使者が、人のつながりを動かす。',body:'項伯は親しい張良を助けようと、劉邦の陣を訪れた。張良は劉邦に危機を伝え、劉邦は項伯を通じて、項羽へ弁明する。',point:'項伯 → 張良 → 劉邦。敵味方の線を越える関係がある。',source:'項羽本紀「項伯乃夜馳之沛公軍」以下',map:'people'},
    {tag:'翌朝',title:'百余騎で、鴻門の宴へ。',body:'劉邦は翌朝、百騎あまりを従えて項羽に会い、謝罪する。かつての共闘相手に、どんな言葉をかけるのか。ここから本文を読んでいこう。',point:'言葉と人物の動きが、劉邦の運命を左右する。',source:'項羽本紀「沛公旦日従百余騎来見項王」',map:'hongmen'}
  ];
  var panel, index=0, auto=false, timer=null, callbacks;
  var answers={promise:null,force:null};
  function homeHTML(meta, is3D) {
    return '<div class="km-home"><div class="km-home-art" aria-hidden="true"></div><div class="km-home-shade"></div><div class="km-home-content">' +
      '<div class="km-eyebrow"><span class="km-stamp">史記</span> INTERACTIVE CLASSICS</div><p class="km-home-kicker">一席の宴が、天下を分ける。</p><h1>鴻門の会</h1><p class="km-home-description">その言葉を、どう読むか。<br>その場にいたら、どう動くか。</p>' +
      '<div class="km-home-actions"><button class="km-btn gold" data-km="intro"><span>01</span> 鴻門前夜をみる <small>7つの場面で背景をつかむ</small><b>→</b></button>' +
      '<button class="km-btn" data-km="' + (meta.save?'continue':'new') + '"><span>02</span> ' + (meta.save?'物語の続きから':'物語をはじめる') + '<small>原文と決断で宴を体験</small><b>→</b></button>' +
      '<button class="km-btn" data-km="ai"><span>03</span> 范増として考える <small>原文を根拠にAIと対話</small><b>→</b></button></div>' +
      '<div class="km-home-links"><button data-km="menu">章を選ぶ</button><button data-km="book">原文帳</button><button data-km="characters">人物相関</button><button data-km="reflection">振り返り</button><button data-km="endings">結末帳</button>' +
      '<button data-km="review">読み直し帳' + (meta.missed && Object.keys(meta.missed).length ? '<small>' + Object.keys(meta.missed).length + '</small>' : '') + '</button><button data-km="record">学習記録</button></div>' +
      '<div class="km-home-footer"><span>' + (meta.classroom?'授業モード · 時間制限なし':'挑戦モード · 命と決断') + '</span><button data-km="settings">表示・授業設定</button><span>' + (is3D?'3Dの舞台':'影絵の舞台') + '</span></div>' +
      '<p class="km-art-note">表紙・舞台は学習のためのイメージ表現です。</p></div></div>';
  }
  // 4列×2行の人物画。セルは正方形のまま切り出し、氏名は隣の本文で示す。
  var portraitOrder = ['hai','u','ryo','zo','haku','kai','sou','chin'];
  function portraitHTML(id) {
    var at=portraitOrder.indexOf(id);
    if(at<0)return '';
    return '<span class="km-portrait km-portrait-'+id+'" aria-hidden="true" style="background-position:'+((at%4)*100/3)+'% '+(Math.floor(at/4)*100)+'%"></span>';
  }
  function personHTML(id) {
    var p=people[id];return '<article class="km-person-card '+p[5]+'">'+portraitHTML(id)+'<div><span class="km-evidence-label">人物ガイド</span><h4><ruby>'+p[0]+'<rt>'+p[1]+'</rt></ruby></h4><b>'+p[2]+'</b><p>'+p[3]+'</p><small>'+p[4]+'</small></div></article>';
  }
  function charactersHTML() {
    return '<h3>同じ人に、いくつもの呼び名。</h3><p class="km-m-lead">本文の呼称を確かめよう。人物画と衣の色は、見分けるためのイメージです。</p><div class="km-relation"><span>張良が、劉邦に助言する。</span><b>張良と項伯には、以前からの交友がある。</b><span>項伯は項羽の叔父。范増は項羽に進言する。</span></div><div class="km-person-grid">'+Object.keys(people).map(personHTML).join('')+'</div>';
  }
  function mapSVG(s) {
    var a=s.map, routes=['routes','arrival','tension','hongmen'].indexOf(a)>=0;
    if(a==='people') return '<div class="km-intro-people">'+['haku','ryo','hai'].map(function(id,i){return (i?'<span class="km-relation-arrow">→<small>'+(i===1?'知らせる':'伝える')+'</small></span>':'')+'<button data-person="'+id+'">'+portraitHTML(id)+'<strong>'+people[id][0]+'</strong><small>'+people[id][2]+'</small></button>';}).join('')+'</div><p class="km-map-caption">旧交が、陣営をつなぐ。</p>';
    return '<svg class="km-intro-map '+a+'" viewBox="0 0 800 470" role="group" aria-label="劉邦と項羽の動きを示す模式図。西に関中、東に楚、北に鉅鹿。人物名を押すと紹介が開きます。">'+
      '<defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#b49b73" opacity=".12"/></pattern><marker id="arrow-han" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="#7cc8be"/></marker><marker id="arrow-so" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="#dc8b76"/></marker></defs>' +
      '<rect width="800" height="470" fill="url(#map-grid)"/><path class="km-land" d="M35 230 Q95 120 190 150L270 110L380 145L490 95L650 110L750 190L715 350L615 390L450 365L340 405L200 360L80 345Z"/>'+
      '<path class="km-river" d="M75 120Q160 85 220 165T390 180Q490 120 560 165T770 180"/><path class="km-mountain" d="M70 335L105 275L125 305L155 245L195 320L225 280L265 340 M340 110L375 68L400 95L425 54L468 115"/>'+
      '<ellipse class="km-guanzhong" cx="190" cy="230" rx="120" ry="80"/><text class="km-region" x="150" y="213">関中</text><text class="km-region" x="610" y="330">楚</text><text class="km-water-label" x="440" y="150">黄河</text>'+
      (routes?'<path class="km-army-path han" d="M580 300Q400 350 290 285T155 240" marker-end="url(#arrow-han)"/><path class="km-army-path so" d="M590 290Q620 180 585 90" marker-end="url(#arrow-so)"/>':'')+
      (a==='tension'||a==='hongmen'?'<path class="km-army-path so late" d="M580 95Q490 195 265 230" marker-end="url(#arrow-so)"/>':'')+
      '<g class="km-place"><circle cx="145" cy="240" r="5"/><text x="112" y="265">咸陽</text><circle cx="225" cy="285" r="5"/><text x="208" y="314">霸上</text><circle cx="274" cy="229" r="5"/><text x="265" y="212">鴻門</text><circle cx="583" cy="85" r="5"/><text x="605" y="91">鉅鹿</text></g>'+
      '<g class="km-map-seal han" data-person="hai" role="button" tabindex="0" aria-label="劉邦、別名は沛公。人物紹介を開く" transform="translate('+(a==='arrival'||a==='tension'||a==='hongmen'?'205 250':'490 328')+')"><circle r="26"/><text y="6">劉邦</text></g>'+
      '<g class="km-map-seal so" data-person="u" role="button" tabindex="0" aria-label="項羽、別名は項王。人物紹介を開く" transform="translate('+(a==='tension'||a==='hongmen'?'310 264':a==='routes'||a==='arrival'?'560 115':'635 292')+')"><circle r="26"/><text y="6">項羽</text></g>'+
      (a==='promise'?'<g class="km-promise"><rect x="300" y="203" width="390" height="80" rx="5"/><text x="495" y="238">先に関中を平定した者を</text><text x="495" y="265">その地の王にする。</text></g>':'')+
      (a==='tension'?'<text class="km-troops han" x="123" y="370">劉邦 十万</text><text class="km-troops so" x="343" y="370">項羽 四十万</text><text class="km-map-foot" x="123" y="395">兵力は『項羽本紀』の記述による</text>':'')+
      (a==='hongmen'?'<path class="km-army-path han" d="M228 268Q254 251 282 249" marker-end="url(#arrow-han)"/><text class="km-troops han" x="300" y="355">翌朝、百余騎で謝罪へ</text>':'')+
      '<text class="km-map-foot" x="24" y="445">位置・経路・距離を簡略化した模式図</text><text class="km-map-foot" x="720" y="35">北 ↑</text></svg>';
  }
  function stopAuto(){clearTimeout(timer);timer=null;}
  function schedule(){stopAuto();if(auto&&!document.hidden&&!scenes[index].quiz&&index<scenes.length-1)timer=setTimeout(function(){index++;render();},45000);}
  function quizHTML(){
    return '<fieldset class="km-intro-quiz"><legend>いったん止まって、考えよう。</legend>'+[
      ['promise','約束の上で、王となる根拠があるのは？','hai'],
      ['force','この時点で、兵力が大きいのは？','u']
    ].map(function(q,i){return '<div class="km-quiz-question"><p><span>問い '+(i+1)+'</span>'+q[1]+'</p><div class="km-quiz-choices" role="group" aria-label="'+q[1]+'">'+['hai','u'].map(function(id){return '<button data-intro="quiz" data-question="'+q[0]+'" data-answer="'+id+'" aria-pressed="'+(answers[q[0]]===id)+'">'+people[id][0]+'</button>';}).join('')+'</div><div class="km-quiz-answer" role="status">'+(answers[q[0]]?(answers[q[0]]===q[2]?'そうですね。':'もう一度、図を確かめよう。')+(q[0]==='promise'?'約束の基準は「先に関中を平定」。先着した劉邦に根拠があります。':'本文では劉邦十万、項羽四十万。兵力は項羽が上回ります。'):'選んでから、理由も話してみよう。')+'</div></div>';}).join('')+(answers.promise&&answers.force?'<p class="km-quiz-takeaway">約束と兵力。その二つの基準のずれが、対立の背景です。</p>':'')+'</fieldset>';
  }
  function render(){
    var s=scenes[index];if(s.quiz||index===scenes.length-1)auto=false;callbacks.step(index);
    panel.innerHTML='<header class="km-intro-head"><button data-intro="exit">← 表紙</button><span>鴻門前夜 <small>背景をつかむ、7つの場面</small></span><button data-intro="auto" aria-pressed="'+auto+'">'+(auto?'Ⅱ 一時停止':'▷ 自動で進む')+'</button></header>'+
      '<div class="km-intro-layout"><div class="km-intro-visual"><span class="km-visual-no" aria-hidden="true">0'+(index+1)+'</span>'+mapSVG(s)+'<div class="km-map-legend"><span>● 劉邦側</span><span>● 項羽側</span><small>人物名を押すと紹介</small></div><div id="km-intro-person" aria-live="polite"></div></div>'+
      '<article class="km-intro-copy" aria-live="polite"><span class="km-eyebrow">'+s.tag+' / 0'+(index+1)+'</span><h2 tabindex="-1">'+s.title+'</h2><p>'+s.body+'</p><div class="km-intro-point"><small>ここを押さえよう</small><b>'+s.point+'</b></div>'+
      (s.quiz?quizHTML():'')+
      '<details class="km-intro-source"><summary>本文とのつながり</summary><p>'+s.source+'</p><a href="https://zh.wikisource.org/wiki/史記/卷007" target="_blank" rel="noopener">項羽本紀</a> · <a href="https://zh.wikisource.org/wiki/史記/卷008" target="_blank" rel="noopener">高祖本紀</a><p>説明は学習用の要約。地図と人物画は模式的な表現です。</p></details></article></div>'+
      '<footer class="km-intro-nav"><button data-intro="prev" '+(index===0?'disabled':'')+'>← 前へ</button><nav aria-label="紙芝居の場面">'+scenes.map(function(x,i){return '<button data-intro="step" data-step="'+i+'" aria-label="'+(i+1)+' '+x.tag+'" aria-current="'+(i===index?'step':'false')+'"><i></i><span>'+x.tag+'</span></button>';}).join('')+'</nav><button class="km-btn gold" data-intro="'+(index===6?'done':'next')+'">'+(index===6?'本文を読みはじめる →':'次へ →')+'</button><small class="km-intro-playback">'+(auto?'45秒ごとに進む · 問いで一時停止':'手動で進む · ← → キーでも操作')+'</small></footer>';
    schedule();
  }
  function open(root,start,cb){
    if(!panel){panel=document.createElement('section');panel.id='km-intro';panel.className='km-intro';panel.setAttribute('aria-label','鴻門前夜の紙芝居');root.appendChild(panel);
      panel.addEventListener('click',function(e){
        var p=e.target.closest('[data-person]');if(p){auto=false;stopAuto();var toggle=panel.querySelector('[data-intro="auto"]');toggle.setAttribute('aria-pressed','false');toggle.textContent='▷ 自動で進む';panel.querySelector('.km-intro-playback').textContent='手動で進む · ← → キーでも操作';document.getElementById('km-intro-person').innerHTML=personHTML(p.dataset.person)+'<button class="km-person-close" data-intro="close-person">紹介を閉じる ×</button>';return;}
        var b=e.target.closest('[data-intro]');if(!b)return;e.stopPropagation();
        var a=b.dataset.intro;
        if(a==='close-person'){document.getElementById('km-intro-person').innerHTML='';panel.querySelector('[data-person]').focus();return;}
        if(a==='exit'){hide();callbacks.exit();return;}if(a==='done'){hide();callbacks.done();return;}
        if(a==='auto')auto=!auto;
        else auto=false;
        if(a==='next')index=Math.min(6,index+1);if(a==='prev')index=Math.max(0,index-1);
        if(a==='step')index=Number(b.dataset.step);
        if(a==='quiz')answers[b.dataset.question]=b.dataset.answer;
        var question=b.dataset.question, answer=b.dataset.answer;
        render();
        var target=a==='quiz'?panel.querySelector('[data-question="'+question+'"][data-answer="'+answer+'"]'):a==='auto'?panel.querySelector('[data-intro="auto"]'):panel.querySelector('h2');
        if(target)target.focus({preventScroll:a==='quiz'||a==='auto'});
      });
      panel.addEventListener('keydown',function(e){if(e.target.matches('input,textarea'))return;if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-person][role="button"]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();auto=false;index=Math.max(0,Math.min(6,index+(e.key==='ArrowRight'?1:-1)));render();panel.querySelector('h2').focus();}if(e.key==='Escape'){hide();callbacks.exit();}});
      document.addEventListener('visibilitychange',function(){if(panel&&!panel.hidden){if(document.hidden)stopAuto();else schedule();}});
    }
    callbacks=cb;index=Math.max(0,Math.min(6,Math.floor(Number(start)||0)));auto=false;answers={promise:null,force:null};panel.hidden=false;root.classList.add('km-at-intro');render();panel.querySelector('h2').focus();
  }
  function hide(){stopAuto();auto=false;if(panel){panel.hidden=true;panel.parentNode.classList.remove('km-at-intro');}}
  function buildPrompt(ids){
    var K=window.KOUMON;
    return K.aiPrompt+'\n\n【資料：引用はこの範囲から】\n'+ids.filter(function(id){return K.genbun[id];}).map(function(id){var g=K.genbun[id];return '['+id+'] '+g.src+'「'+g.title+'」\n原文：'+g.hakubun+'\n書き下し（学習用）：'+g.yomi;}).join('\n\n');
  }
  window.KoumonClassroom={homeHTML:homeHTML,charactersHTML:charactersHTML,people:people,portraitHTML:portraitHTML,open:open,hide:hide,buildPrompt:buildPrompt,scenes:scenes};
})();
