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
  // 鴻門への道：本編（序幕「霸上の夕べ」）より前の流れ。本編で演じる密告・項伯の夜・翌朝の謝罪はここでは扱わない。
  // year は年表（timeline）の位置。quote は『史記』からの短い引用で、書き下し・現代語訳は学習用。
  var timeline = [['前221', '秦の統一'], ['前209', '反乱と挙兵'], ['前208', '懐王の約'], ['前207', '鉅鹿の戦い'], ['前206', '秦の滅亡・鴻門の会']];
  var scenes = [
    {tag:'乱世', era:'前210〜前209年', year:1, map:'rebellion', title:'秦の天下が、揺らぎはじめた。',
      body:['前221年、秦の始皇帝が天下を統一した。けれども厳しい法と重い労役に、人々の不満はたまっていった。','始皇帝が亡くなった翌年の前209年、陳勝・呉広が大沢郷で反乱を起こす。反乱はたちまち各地へ広がった。'],
      terms:[['秦','前221年に中国を統一した王朝。都は咸陽。'],['陳勝・呉広','最初に反乱を起こした農民の指導者。']],
      quote:{src:'史記・陳渉世家', haku:'王侯将相寧有種乎', yomi:'王侯将相寧んぞ種有らんや', yaku:'王や諸侯、将軍や宰相になるのに、決まった家柄などあるものか。'},
      point:'生まれに関係なく、だれもが天下を争う時代が始まった。',
      alt:'秦の都・咸陽と、大沢郷・沛・会稽など各地に広がる反乱を示す模式図。'},
    {tag:'挙兵', era:'前209年', year:1, map:'pair', title:'村の役人・劉邦と、名将の孫・項羽。',
      body:['劉邦は沛の村の役人（亭長）だった。反乱が広がると沛の人々に推されて立ち、「沛公」と呼ばれる。','項羽は楚の名将・項燕の孫。叔父の項梁とともに会稽で兵を挙げた。このとき二十四歳で、劉邦はずっと年上だった。','二人はやがて同じ楚の陣営に入り、城陽などを共に攻めた。はじめから敵どうしだったわけではない。'],
      terms:[['沛公','「沛の長」という意味。鴻門の本文での劉邦の呼び名。'],['項王','項羽のこと。本文では「項羽」「項王」と書かれ、本人は名の「籍」で自分を呼ぶ。']],
      quote:{src:'史記・高祖本紀', haku:'仁而愛人、喜施、意豁如也', yomi:'仁にして人を愛し、施しを喜み、意豁如たり', yaku:'（劉邦は）思いやりがあって人を愛し、人に施すことを好み、心がおおらかだった。'},
      point:'出自も年齢も違う二人が、同じ楚の陣営で秦と戦っていた。'},
    {tag:'約束', era:'前208年', year:2, map:'promise', title:'「先に関中へ」が、王への条件。',
      body:['項梁は楚の王家の子孫を探し出し、王に立てた。楚の懐王である。反乱軍をまとめる旗印だった。','項梁が秦軍との戦いで亡くなると、懐王は将軍たちと一つの約束を結ぶ。「先に関中に入って平定した者を、関中の王にする。」'],
      terms:[['関中','函谷関の西に広がる秦の本拠地。都の咸陽があり、守りが固く豊かな土地。'],['懐王','楚の王家の子孫。反乱軍の名目上の主君。']],
      quote:{src:'史記・高祖本紀', haku:'与諸将約、先入定関中者王之', yomi:'諸将と約す、先に入りて関中を定むる者は之を王とせん', yaku:'（懐王は）将軍たちと約束した。先に関中に入って平定した者を、そこの王にしよう、と。'},
      point:'関中への一番乗りには、「王になる」という政治的な意味があった。',
      quiz:[{id:'cond', q:'懐王の約束で、王になる条件は？', choices:[['battle','秦軍を最も多く破ること'],['first','先に関中に入り、平定すること'],['army','最も多くの兵を集めること']], answer:'first', why:'条件は「先に入りて関中を定むる」こと。戦いの数や兵の多さではない。この基準が、のちの対立の火種になる。'}],
      alt:'楚の懐王がいる彭城と、西の関中を示す模式図。'},
    {tag:'二つの道', era:'前207年', year:3, map:'routes', title:'北で戦う項羽。西へ急ぐ劉邦。',
      body:['懐王は項羽たちを北へ送って趙を救わせ、劉邦には西から関中を目指させた。','項羽は鉅鹿で秦の主力を破り、諸侯の軍を従える実力者になる。のちに、降伏した秦兵二十万あまりを新安で生き埋めにした。','劉邦は、城を力で落とすより降伏させる道を選びながら進み、南の入り口・武関から関中へ入った。'],
      terms:[['鉅鹿の戦い','項羽が秦の主力を破った戦い。退路を断つ「破釜沈船」の故事で知られる。'],['武関','関中の南の入り口。劉邦はここから入った。'],['函谷関','関中の東の入り口。項羽はこちらへ向かう。']],
      quote:{src:'史記・項羽本紀', haku:'皆沈船、破釜甑、焼廬舎、持三日糧', yomi:'皆船を沈め、釜甑を破り、廬舎を焼き、三日の糧を持つ', yaku:'船をすべて沈め、炊事の釜や甑を壊し、陣小屋を焼いて、三日分の食糧だけを持たせた（生きて帰らない覚悟を示した）。'},
      point:'項羽は戦いで名声と大軍を得た。劉邦は早さで、関中への一番乗りを果たそうとした。',
      alt:'項羽は彭城から北の鉅鹿へ、劉邦は南を回って武関から関中へ進む模式図。'},
    {tag:'先着', era:'前206年（漢元年）十月', year:4, map:'arrival', title:'先に関中へ入ったのは、劉邦。',
      body:['秦王の子嬰は、白い車を白い馬に引かせ、首に組み紐をかけて劉邦に降伏した。秦は滅びた。','咸陽の宮殿に入った劉邦は、そこにとどまりたいと思ったが、樊噲や張良にいさめられる。宝物の倉を封じて軍を霸上に戻し、関中の人々と「法は三章だけ」と約束した。人々は大いに喜んだ。'],
      terms:[['子嬰','秦の最後の王。'],['霸上','咸陽の東にある高台。劉邦が軍を置いた場所。'],['約法三章','人を殺せば死刑、人を傷つけたり盗んだりすれば罰する、という三つだけの法。秦の厳しい法を改めた。']],
      quote:{src:'史記・高祖本紀', haku:'与父老約、法三章耳。殺人者死、傷人及盗抵罪。', yomi:'父老と約す、法は三章のみ。人を殺す者は死し、人を傷つけ及び盗むは罪に抵る。', yaku:'土地の長老たちと約束した。法は三か条だけだ。人を殺した者は死刑。人を傷つけた者と盗んだ者は、それに見合う罰を受ける。'},
      point:'劉邦は宝も宮殿も「取らなかった」。序幕で、范増はまさにこの点を恐れる。',
      quiz:[{id:'take', q:'咸陽に入った劉邦が、したことは？', choices:[['burn','咸陽の宮殿を焼きはらった'],['stay','宮殿に住み、宝物を兵に分けた'],['seal','宝物の倉を封じて、霸上へ軍を戻した']], answer:'seal', why:'劉邦は財物に手をつけずに霸上へ戻った。序幕で范増は「財物取る所無く、婦女幸する所無し」と言い、そこに大きな志を見る。宮殿を焼くのは、のちに咸陽へ入る項羽である。'}],
      alt:'咸陽で秦が降伏し、劉邦が霸上へ軍を戻す模式図。'},
    {tag:'函谷関', era:'前206年（漢元年）', year:4, map:'tension', title:'約束は劉邦。兵力は項羽。',
      body:['劉邦は「関を閉ざして諸侯を入れなければ、秦の地すべての王になれる」という進言を受け入れ、函谷関に兵を置いた。この進言の主を、第一幕で張良が問いただす。','遅れて着いた項羽は、関が閉ざされ、しかも劉邦がすでに咸陽を落としたと聞いて激怒する。関を破って進み、鴻門に陣を構えた。'],
      terms:[['鴻門','新豊の近く。項羽が陣を置いた場所。'],['諸侯','各地で秦と戦った将軍や王たち。項羽はその中心にいた。']],
      quote:{src:'史記・項羽本紀', haku:'函谷関有兵守関、不得入。又聞沛公已破咸陽、項羽大怒、使当陽君等撃関。', yomi:'函谷関に兵有りて関を守り、入るを得ず。又沛公已に咸陽を破ると聞き、項羽大いに怒り、当陽君等をして関を撃たしむ。', yaku:'函谷関には兵がいて関を守り、入れなかった。さらに沛公がすでに咸陽を破ったと聞いて、項羽はひどく怒り、当陽君（黥布）らに関を攻めさせた。'},
      point:'約束の上では劉邦、兵力では項羽。二つの基準がぶつかる。',
      quiz:[{id:'promise', q:'約束の上で、王となる根拠があるのは？', choices:[['hai','劉邦'],['u','項羽']], answer:'hai', why:'約束の基準は「先に関中を平定」。先に入った劉邦に根拠がある。'},
        {id:'force', q:'この時点で、兵力が大きいのは？', choices:[['hai','劉邦'],['u','項羽']], answer:'u', why:'本文では劉邦十万、項羽四十万。兵力は項羽が上回る。'}],
      takeaway:'約束と兵力。その二つの基準のずれが、鴻門の会の背景にある。',
      alt:'閉ざされた函谷関を項羽の軍が破り、鴻門に陣を置く模式図。'},
    {tag:'霸上の夕べへ', era:'前206年（漢元年）十二月', year:4, map:'eve', title:'四十里をへだてて、十万と四十万。',
      body:['鴻門の項羽は兵四十万で百万と号し、霸上の劉邦は兵十万で二十万と号した。二つの陣のあいだは四十里（約17キロ）。','この夕べから、物語が始まる。あなたは沛公・劉邦。言葉を一つ読み違えれば、命はない。'],
      watch:[['曹無傷','劉邦の部下。項羽に何を伝えるのか。','序幕'],['范増','項羽の参謀。劉邦の何を恐れたのか。','序幕'],['項伯と張良','敵と味方に分かれた旧友。その夜、何が起こるのか。','第一幕']],
      quote:{src:'史記・高祖本紀', haku:'項羽兵四十万号百万、沛公兵十万号二十万、力不敵。', yomi:'項羽の兵は四十万、百万と号し、沛公の兵は十万、二十万と号す。力敵せず。', yaku:'項羽の兵は四十万で百万と称し、沛公の兵は十万で二十万と称していた。力ではかなわなかった。'},
      point:'強い相手に、どう向き合うか。言葉と決断で、宴を生き延びよう。',
      alt:'霸上の劉邦と鴻門の項羽が四十里をへだてて向かい合う模式図。'}
  ];
  var pair = {
    hai: ['劉邦（沛公）', '沛の村の役人（亭長）', '沛の人々に推されて挙兵', '仁にして人を愛し、施しを喜む', '沛公'],
    u: ['項羽（籍）', '楚の名将・項燕の孫', '叔父の項梁と会稽で挙兵（二十四歳）', '力は能く鼎を扛げ、才気人に過ぐ', '項王']
  };
  var panel, index=0, auto=false, timer=null, callbacks;
  var answers={};
  function homeHTML(meta, is3D) {
    return '<div class="km-home"><div class="km-home-art" aria-hidden="true"></div><div class="km-home-shade"></div><div class="km-home-content">' +
      '<div class="km-eyebrow"><span class="km-stamp">史記</span> INTERACTIVE CLASSICS</div><p class="km-home-kicker">一席の宴が、天下を分ける。</p><h1>鴻門の会</h1><p class="km-home-description">その言葉を、どう読むか。<br>その場にいたら、どう動くか。</p>' +
      '<div class="km-home-actions"><button class="km-btn gold" data-km="intro"><span>01</span> 鴻門への道 <small>宴の前の流れを七つの場面で</small><b>→</b></button>' +
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
  // 地名の座標は位置関係だけを示す模式図。[x, y, 名前, 文字のずれx, ずれy]
  var places = {
    kanyo:[145,240,'咸陽',-36,26], hajo:[225,285,'霸上',-46,6], koumon:[274,229,'鴻門',-8,-16], kankoku:[372,214,'函谷関',-22,28],
    bukan:[300,352,'武関',12,22], shinan:[452,205,'新安',-8,-14], kyoroku:[583,85,'鉅鹿',14,-6], hojo:[640,262,'彭城',12,22],
    hai:[676,226,'沛',12,-6], daitaku:[640,320,'大沢郷',12,22], kaikei:[742,392,'会稽',-48,24]
  };
  var mapLayers = {
    rebellion: { places:['kanyo','daitaku','hai','kaikei'], sparks:[[640,320],[676,226],[742,392],[590,105],[705,160],[540,250]],
      notes:[[100,290,'秦の都'],[560,352,'陳勝・呉広'],[700,198,'劉邦'],[600,448,'項梁・項羽']] },
    promise: { places:['kanyo','hojo'], guanzhong:true, seals:{hai:[580,212],u:[704,212]},
      notes:[[590,308,'懐王がいる']], box:true },
    routes: { places:['kanyo','hajo','bukan','kankoku','shinan','kyoroku','hojo'], seals:{u:[560,122],hai:[440,378]},
      paths:[['so','M640 252Q655 170 592 98'],['so late','M572 96Q505 160 458 203'],['han','M628 272Q470 380 310 356Q250 334 230 296']],
      notes:[[500,190,'のち西へ'],[300,424,'南から関中へ']] },
    arrival: { places:['kanyo','hajo','bukan'], guanzhong:true, seals:{hai:[290,300],u:[560,122]},
      paths:[['han','M153 250Q185 280 216 286'],['so late','M572 96Q505 160 458 203']], notes:[[100,290,'子嬰が降伏'],[120,345,'倉を封じ霸上へ'],[80,175,'約法三章']] },
    tension: { places:['kanyo','hajo','koumon','kankoku','shinan'], seals:{hai:[150,322],u:[318,175]}, gate:true,
      paths:[['so','M452 205Q412 206 378 214Q330 222 284 228']], troops:true },
    eve: { places:['kanyo','hajo','koumon','kankoku'], seals:{hai:[150,322],u:[318,175]}, dusk:true, distance:true, troops:true }
  };
  function placeSVG(k){var p=places[k];return '<g class="km-place"><circle cx="'+p[0]+'" cy="'+p[1]+'" r="5"/><text x="'+(p[0]+p[3])+'" y="'+(p[1]+p[4])+'">'+p[2]+'</text></g>';}
  function sealSVG(id,xy){return '<g class="km-map-seal '+(id==='hai'?'han':'so')+'" data-person="'+id+'" role="button" tabindex="0" aria-label="'+people[id][0]+'、別名は'+people[id][2]+'。人物紹介を開く" transform="translate('+xy[0]+' '+xy[1]+')"><circle r="26"/><text y="6">'+people[id][0]+'</text></g>';}
  function mapSVG(s) {
    var a=s.map, L=mapLayers[a]||{};
    if(a==='pair') return pairHTML();
    return '<svg class="km-intro-map '+a+'" viewBox="0 0 800 470" role="group" aria-label="'+(s.alt||'劉邦と項羽の動きを示す模式図')+'人物名を押すと紹介が開きます。">'+
      '<defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#b49b73" opacity=".12"/></pattern><marker id="arrow-han" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="#7cc8be"/></marker><marker id="arrow-so" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="#dc8b76"/></marker></defs>'+
      '<rect width="800" height="470" fill="url(#map-grid)"/><path class="km-land" d="M35 230Q95 120 190 150L270 110L380 145L490 95L650 70L760 150L778 300L768 432L600 425L450 372L340 405L200 360L80 345Z"/>'+
      '<path class="km-river" d="M75 120Q160 85 220 165T390 180Q490 120 560 165T770 180"/><path class="km-river" d="M300 418Q450 392 560 400T775 368"/><path class="km-mountain" d="M70 335L105 275L125 305L155 245L195 320L225 280L265 340 M340 110L375 68L400 95L425 54L468 115"/>'+
      '<ellipse class="km-guanzhong'+(L.guanzhong?' on':'')+'" cx="190" cy="230" rx="120" ry="80"/><text class="km-region" x="150" y="213">関中</text><text class="km-region" x="545" y="300">楚</text><text class="km-region small" x="505" y="62">趙</text><text class="km-water-label" x="440" y="150">黄河</text><text class="km-water-label" x="470" y="418">長江</text>'+
      (L.dusk?'<rect class="km-dusk" width="800" height="470"/>':'')+
      (L.sparks||[]).map(function(p){return '<circle class="km-spark" cx="'+p[0]+'" cy="'+p[1]+'" r="16"/>';}).join('')+
      (L.paths||[]).map(function(p){return '<path class="km-army-path '+p[0]+'" d="'+p[1]+'" marker-end="url(#arrow-'+p[0].split(' ')[0]+')"/>';}).join('')+
      (L.gate?'<g class="km-gate" transform="translate(372 214)"><rect x="-17" y="-36" width="34" height="26" rx="3"/><text y="-17">閉</text><path d="M-12 -38L-2 -26L-8 -20L6 -8"/><text class="km-gate-break" x="30" y="-16">破</text></g>':'')+
      (L.distance?'<path class="km-distance" d="M232 280L268 236"/><text class="km-distance-label" x="282" y="292">四十里（約17km）</text>':'')+
      (L.places||[]).map(placeSVG).join('')+
      (L.notes||[]).map(function(n){return '<text class="km-map-note" x="'+n[0]+'" y="'+n[1]+'">'+n[2]+'</text>';}).join('')+
      (L.box?'<g class="km-promise"><rect x="300" y="372" width="390" height="70" rx="5"/><text x="495" y="401">先に関中に入り平定した者を、</text><text x="495" y="428">その地の王にする。</text></g>':'')+
      (L.troops?'<text class="km-troops han" x="40" y="400">霸上　劉邦 十万</text><text class="km-troops so" x="360" y="120">鴻門　項羽 四十万</text><text class="km-map-foot" x="40" y="424">兵力は『史記』の記述による</text>':'')+
      Object.keys(L.seals||{}).map(function(id){return sealSVG(id,L.seals[id]);}).join('')+
      '<text class="km-map-foot" x="24" y="455">位置・経路・距離を簡略化した模式図</text><text class="km-map-foot" x="720" y="35">北 ↑</text></svg>';
  }
  function pairHTML(){
    return '<div class="km-intro-pair">'+['hai','u'].map(function(id){var d=pair[id];return '<article class="km-pair-card '+people[id][5]+'">'+portraitHTML(id)+'<h3>'+d[0]+'</h3><dl><dt>出身</dt><dd>'+d[1]+'</dd><dt>挙兵</dt><dd>'+d[2]+'</dd><dt>史記の評</dt><dd>'+d[3]+'</dd><dt>鴻門では</dt><dd>「'+d[4]+'」と呼ばれる</dd></dl><button data-person="'+id+'">人物紹介</button></article>';}).join('')+'</div><p class="km-map-caption">同じ楚の陣営で、秦と戦った。</p>';
  }
  function timelineHTML(s){
    return '<ol class="km-timeline" aria-label="年表">'+timeline.map(function(t,i){return '<li class="'+(i<s.year?'past':i===s.year?'now':'')+'"'+(i===s.year?' aria-current="true"':'')+'><b>'+t[0]+'</b><span>'+t[1]+'</span></li>';}).join('')+'</ol>';
  }
  function copyHTML(s){
    var q=s.quote;
    return '<span class="km-eyebrow">'+s.tag+' · '+s.era+'</span><h2 tabindex="-1">'+s.title+'</h2>'+s.body.map(function(p){return '<p>'+p+'</p>';}).join('')+
      (s.terms?'<dl class="km-intro-terms">'+s.terms.map(function(t){return '<div><dt>'+t[0]+'</dt><dd>'+t[1]+'</dd></div>';}).join('')+'</dl>':'')+
      (s.watch?'<div class="km-intro-watch"><small>物語で注目しよう</small><ul>'+s.watch.map(function(w){return '<li><b>'+w[0]+'</b>'+w[1]+'<span>'+w[2]+'</span></li>';}).join('')+'</ul></div>':'')+
      (q?'<figure class="km-intro-quote"><figcaption>史記の原文　<small>'+q.src+'</small></figcaption><p class="km-quote-haku">'+q.haku+'</p><p class="km-quote-yomi">'+q.yomi+'</p><p class="km-quote-yaku">'+q.yaku+'</p></figure>':'')+
      '<div class="km-intro-point"><small>ここを押さえよう</small><b>'+s.point+'</b></div>'+
      (s.quiz?quizHTML(s):'');
  }
  function stopAuto(){clearTimeout(timer);timer=null;}
  function schedule(){stopAuto();if(auto&&!document.hidden&&!scenes[index].quiz&&index<scenes.length-1)timer=setTimeout(function(){index++;render();},45000);}
  function quizHTML(s){
    var all=s.quiz.every(function(q){return answers[q.id]===q.answer;});
    return '<fieldset class="km-intro-quiz"><legend>いったん止まって、考えよう。</legend>'+s.quiz.map(function(q,i){var a=answers[q.id];
      return '<div class="km-quiz-question"><p><span>問い '+(i+1)+'</span>'+q.q+'</p><div class="km-quiz-choices" role="group" aria-label="'+q.q+'">'+q.choices.map(function(c){return '<button data-intro="quiz" data-question="'+q.id+'" data-answer="'+c[0]+'" aria-pressed="'+(a===c[0])+'">'+c[1]+'</button>';}).join('')+'</div>'+
        '<div class="km-quiz-answer" role="status">'+(!a?'選んでから、理由も話してみよう。':a===q.answer?'そのとおり。'+q.why:'もう一度、地図と本文を確かめよう。')+'</div></div>';}).join('')+
      (s.takeaway&&all?'<p class="km-quiz-takeaway">'+s.takeaway+'</p>':'')+'</fieldset>';
  }
  function render(){
    var s=scenes[index];if(s.quiz||index===scenes.length-1)auto=false;callbacks.step(index);
    panel.innerHTML='<header class="km-intro-head"><button data-intro="exit">← 表紙</button><span>鴻門への道 <small>宴の前の流れを、七つの場面で</small></span><button data-intro="auto" aria-pressed="'+auto+'">'+(auto?'Ⅱ 一時停止':'▷ 自動で進む')+'</button></header>'+
      '<div class="km-intro-layout"><div class="km-intro-visual"><span class="km-visual-no" aria-hidden="true">0'+(index+1)+'</span>'+timelineHTML(s)+mapSVG(s)+'<div class="km-map-legend"><span>● 劉邦側</span><span>● 項羽側</span><small>人物名を押すと紹介</small></div><div id="km-intro-person" aria-live="polite"></div></div>'+
      '<article class="km-intro-copy" aria-live="polite">'+copyHTML(s)+
      '<details class="km-intro-source"><summary>出典と表現について</summary><p>原文は『史記』から短く引きました。書き下し文・現代語訳・説明は学習用です。地図と人物画は模式的な表現です。</p><a href="https://zh.wikisource.org/wiki/史記/卷007" target="_blank" rel="noopener">項羽本紀</a> · <a href="https://zh.wikisource.org/wiki/史記/卷008" target="_blank" rel="noopener">高祖本紀</a> · <a href="https://zh.wikisource.org/wiki/史記/卷048" target="_blank" rel="noopener">陳渉世家</a></details></article></div>'+
      '<footer class="km-intro-nav"><button data-intro="prev" '+(index===0?'disabled':'')+'>← 前へ</button><nav aria-label="紙芝居の場面">'+scenes.map(function(x,i){return '<button data-intro="step" data-step="'+i+'" aria-label="'+(i+1)+' '+x.tag+'" aria-current="'+(i===index?'step':'false')+'"><i></i><span>'+x.tag+'</span></button>';}).join('')+'</nav><button class="km-btn gold" data-intro="'+(index===scenes.length-1?'done':'next')+'">'+(index===scenes.length-1?'序幕「霸上の夕べ」へ →':'次へ →')+'</button><small class="km-intro-playback">'+(auto?'45秒ごとに進む · 問いで一時停止':'手動で進む · ← → キーでも操作')+'</small></footer>';
    schedule();
  }
  function open(root,start,cb){
    if(!panel){panel=document.createElement('section');panel.id='km-intro';panel.className='km-intro';panel.setAttribute('aria-label','鴻門への道の紙芝居');root.appendChild(panel);
      panel.addEventListener('click',function(e){
        var p=e.target.closest('[data-person]');if(p){auto=false;stopAuto();var toggle=panel.querySelector('[data-intro="auto"]');toggle.setAttribute('aria-pressed','false');toggle.textContent='▷ 自動で進む';panel.querySelector('.km-intro-playback').textContent='手動で進む · ← → キーでも操作';document.getElementById('km-intro-person').innerHTML=personHTML(p.dataset.person)+'<button class="km-person-close" data-intro="close-person">紹介を閉じる ×</button>';return;}
        var b=e.target.closest('[data-intro]');if(!b)return;e.stopPropagation();
        var a=b.dataset.intro;
        if(a==='close-person'){document.getElementById('km-intro-person').innerHTML='';panel.querySelector('[data-person]').focus();return;}
        if(a==='exit'){hide();callbacks.exit();return;}if(a==='done'){hide();callbacks.done();return;}
        if(a==='auto')auto=!auto;
        else auto=false;
        if(a==='next')index=Math.min(scenes.length-1,index+1);if(a==='prev')index=Math.max(0,index-1);
        if(a==='step')index=Number(b.dataset.step);
        if(a==='quiz')answers[b.dataset.question]=b.dataset.answer;
        var question=b.dataset.question, answer=b.dataset.answer;
        render();
        var target=a==='quiz'?panel.querySelector('[data-question="'+question+'"][data-answer="'+answer+'"]'):a==='auto'?panel.querySelector('[data-intro="auto"]'):panel.querySelector('h2');
        if(target)target.focus({preventScroll:a==='quiz'||a==='auto'});
      });
      panel.addEventListener('keydown',function(e){if(e.target.matches('input,textarea'))return;if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-person][role="button"]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();auto=false;index=Math.max(0,Math.min(scenes.length-1,index+(e.key==='ArrowRight'?1:-1)));render();panel.querySelector('h2').focus();}if(e.key==='Escape'){hide();callbacks.exit();}});
      document.addEventListener('visibilitychange',function(){if(panel&&!panel.hidden){if(document.hidden)stopAuto();else schedule();}});
    }
    callbacks=cb;index=Math.max(0,Math.min(scenes.length-1,Math.floor(Number(start)||0)));auto=false;answers={};panel.hidden=false;root.classList.add('km-at-intro');render();panel.querySelector('h2').focus();
  }
  function hide(){stopAuto();auto=false;if(panel){panel.hidden=true;panel.parentNode.classList.remove('km-at-intro');}}
  function buildPrompt(ids){
    var K=window.KOUMON;
    return K.aiPrompt+'\n\n【資料：引用はこの範囲から】\n'+ids.filter(function(id){return K.genbun[id];}).map(function(id){var g=K.genbun[id];return '['+id+'] '+g.src+'「'+g.title+'」\n原文：'+g.hakubun+'\n書き下し（学習用）：'+g.yomi;}).join('\n\n');
  }
  window.KoumonClassroom={homeHTML:homeHTML,charactersHTML:charactersHTML,people:people,portraitHTML:portraitHTML,open:open,hide:hide,buildPrompt:buildPrompt,scenes:scenes};
})();
