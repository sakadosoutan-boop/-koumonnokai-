/* 授業プリントに対応する練習。設問・説明は独自作成。引用は『史記』本文。 */
(function () {
  'use strict';
  var people = [
    { id: 'u', label: '項王（項羽）' },
    { id: 'hai', label: '沛公（劉邦）' },
    { id: 'haku', label: '項伯' },
    { id: 'sou', label: '項荘' },
    { id: 'ryo', label: '張良' },
    { id: 'kai', label: '樊噲' },
    { id: 'zo', label: '范増' }
  ];
  var camps = [{ id: 'so', label: '項王側' }, { id: 'han', label: '沛公側' }];
  var roles = [
    { id: 'precedent', label: '秦が滅んだ前例を示す' },
    { id: 'promise', label: '王となる条件を示す' },
    { id: 'defense', label: '沛公の行動を弁護する' },
    { id: 'criticism', label: '項王の対応を批判する' }
  ];
  var evidenceKinds = [
    { id: 'text', label: '本文に記された言動' },
    { id: 'reading', label: '言動から考えた人物像・心情' }
  ];
  window.KOUMON_ACTIVITIES = [
    {
      id: 'relationships', title: '所属と行動をつなぐ', type: 'match', minutes: 4,
      lead: '誰の陣営にいるかと、誰に働きかけたかを分けて考えよう。',
      source: '授業プリント PDF内2・6・7・12ページ',
      questions: [
        { id: 'haku-camp', prompt: '項伯が所属するのは、どちらの陣営？', quote: '楚左尹項伯者、項羽季父也。', options: camps, answer: 'so', why: '項伯は項羽の叔父で、楚の左尹。沛公を助けても、ここでの所属は項王側。' },
        { id: 'mushou-camp', prompt: '曹無傷が仕えているのは、どちらの陣営？', quote: '此沛公左司馬曹無傷言之。', options: camps, answer: 'han', why: '「沛公左司馬」とある。項王に内通した人物だが、所属は沛公側。' },
        { id: 'mushou-target', prompt: '曹無傷の密告が伝えられた相手は？', quote: '沛公左司馬曹無傷使人言於項羽曰', options: people, answer: 'u', why: '曹無傷は人を遣わして項羽に知らせた。所属と密告先は異なる。' },
        { id: 'zo-target', prompt: '范増が宴席の外へ呼び、暗殺を命じた相手は？', quote: '范増起、出召項荘。', options: people, answer: 'sou', why: '范増が呼び出すのは項荘。その後、剣舞を利用して沛公を殺すよう命じる。' },
        { id: 'haku-target', prompt: '項伯が剣舞の中でかばった相手は？', quote: '常以身翼蔽沛公。', options: people, answer: 'hai', why: '「翼蔽沛公」とあり、身をもって沛公を守っている。' },
        { id: 'ryo-target', prompt: '張良が軍門で危機を知らせた相手は？', quote: '張良至軍門、見樊噲。', options: people, answer: 'kai', why: '張良は軍門で樊噲に会い、項荘が沛公を狙っていると説明する。' },
        { id: 'haku-debt', prompt: '昔、項伯の命を助けたのは誰？', quote: '張良曰、秦時与臣游。項伯殺人、臣活之。', options: people, answer: 'ryo', why: 'この発言の「臣」は話し手の張良。「臣活之」は、張良が項伯を助けたということ。' },
        { id: 'chin-command', prompt: '陳平に、沛公を呼ぶよう命じたのは誰？', quote: '項王使都尉陳平召沛公。', options: people, answer: 'u', why: '「項王使…」なので、命令する人は項王、実際に呼ぶ人は陳平。' },
        { id: 'kai-defense', prompt: '樊噲が項王の前で功績を述べ、弁護したのは誰？', quote: '今沛公、先破秦入咸陽。', options: people, answer: 'hai', why: '樊噲は沛公の功績を挙げ、功労者を殺そうとする項王の対応を批判する。' }
      ]
    },
    {
      id: 'sword-order', title: '剣舞の危機を組み立てる', type: 'order', minutes: 3,
      lead: '合図から暗殺の失敗まで、本文に沿ってカードを並べよう。',
      source: '授業プリント PDF内5〜6ページ',
      cards: [
        { id: 'signal', text: '范増が玉玦を挙げて合図する', quote: '挙所佩玉玦以示之者三。' },
        { id: 'silence', text: '項王は黙ったまま応じない', quote: '項王黙然不応。' },
        { id: 'command', text: '范増が項荘を呼んで暗殺を指示する', quote: '范増起、出召項荘。' },
        { id: 'dance', text: '項荘が剣舞を始める', quote: '項荘抜剣起舞。' },
        { id: 'protect', text: '項伯も舞い、沛公をかばう', quote: '項伯亦抜剣起舞、常以身翼蔽沛公。' },
        { id: 'failure', text: '項荘は沛公を撃てない', quote: '荘不得撃。' }
      ],
      answer: ['signal', 'silence', 'command', 'dance', 'protect', 'failure'],
      initial: ['failure', 'protect', 'dance', 'command', 'silence', 'signal'],
      why: '項王が動かないため、范増は項荘に実行を命じる。項荘は剣舞で狙うが、項伯がかばったため、沛公を撃つ機会を得られない。'
    },
    {
      id: 'omitted-people', title: '省略された人物を補う', type: 'match', minutes: 4,
      lead: '直前の文や話し手を確かめ、誰が誰に働きかけるのかを読み取ろう。',
      source: '授業プリント PDF内5・7・9・12ページ',
      questions: [
        { id: 'signal-actor', prompt: '玉玦を挙げて合図しているのは誰？', quote: '范増数目項王、挙所佩玉玦以示之者三。', options: people, answer: 'zo', why: '直前から主語は范増。玉玦を挙げる動作も范増のもの。' },
        { id: 'signal-object', prompt: '「示之」の「之」が指す相手は？', quote: '范増数目項王、挙所佩玉玦以示之者三。', options: people, answer: 'u', why: '范増が目くばせしている相手は項王。その項王に玉玦を示す。' },
        { id: 'sword-object', prompt: '項荘が撃てなかった相手を補おう。', quote: '常以身翼蔽沛公。荘不得撃。', options: people, answer: 'hai', why: '項伯がかばう対象は沛公。後の「撃」にも、その沛公が目的語として補われる。' },
        { id: 'shield-object', prompt: '樊噲が盾で突き飛ばした相手を補おう。', quote: '樊噲側其盾以撞。衛士仆地。', options: [{ id: 'ei', label: '門を守る衛士' }, { id: 'u', label: '項王' }, { id: 'sou', label: '項荘' }], answer: 'ei', why: '続く「衛士仆地」で衛士が倒れる。盾で突いた相手は、入場を止める衛士。' },
        { id: 'wine-object', prompt: '「賜之卮酒」の「之」が指す人は？', quote: '項王曰、壮士。賜之卮酒。', options: people, answer: 'kai', why: '項王が「壮士」と呼んだ樊噲に、酒を与えるよう命じている。' },
        { id: 'summon-actor', prompt: '命令を受けて、沛公を呼ぶ人は誰？', quote: '項王使都尉陳平召沛公。', options: [{ id: 'u', label: '項王' }, { id: 'chin', label: '陳平' }, { id: 'kai', label: '樊噲' }], answer: 'chin', why: '「使」は使役。「項王が、陳平に、沛公を呼ばせる」という関係になる。' },
        { id: 'metaphor-other', prompt: '刀俎にたとえられる「人」は、どちら側？', quote: '如今人方為刀俎、我為魚肉。', options: camps, answer: 'so', why: '「人」は相手側である項王側。沛公側の生死を左右できる立場を、包丁とまな板にたとえる。' },
        { id: 'metaphor-us', prompt: '魚肉にたとえられる「我」は、どちら側？', quote: '如今人方為刀俎、我為魚肉。', options: camps, answer: 'han', why: 'ここでの「我」は樊噲一人だけでなく沛公側。命を握られている側を指す。' }
      ]
    },
    {
      id: 'argument', title: '樊噲の弁論を整理する', type: 'match', minutes: 4,
      lead: '樊噲は、どんな順序と役割で言葉を重ねるのか。発言の働きを選ぼう。ここでは樊噲の主張を整理する。',
      source: '授業プリント PDF内10〜11ページ',
      questions: [
        { id: 'qin', prompt: '秦の残忍な支配と、人々の離反を挙げる働きは？', quote: '夫秦王有虎狼之心。天下皆叛之。', options: roles, answer: 'precedent', why: '暴政によって支持を失った秦を前例に置く。最後の「亡秦之続」という警告につながる。' },
        { id: 'promise', prompt: '懐王の約束を持ち出す働きは？', quote: '先破秦入咸陽者、王之。', options: roles, answer: 'promise', why: '先に秦を破って咸陽に入った者を王とする、という条件を示す。' },
        { id: 'palace', prompt: '宮室を閉じて覇上へ戻り、項王を待ったと語る働きは？', quote: '封閉宮室、還軍覇上、以待大王来。', options: roles, answer: 'defense', why: '樊噲はこれらを、沛公に敵意がないという説明に用いる。動機まで中立な事実として述べられているわけではない。' },
        { id: 'gate', prompt: '関所の守備を、盗賊や非常事態への備えと説明する働きは？', quote: '備他盗之出入与非常也。', options: roles, answer: 'defense', why: '項王を締め出すためではない、と関所守備の意味を説明して沛公を弁護する。これは樊噲側の説明。' },
        { id: 'reward', prompt: '功績があるのに賞がなく、殺されようとしていると述べる働きは？', quote: '未有封侯之賞。而聴細説、欲誅有功之人。', options: roles, answer: 'criticism', why: '功績と処遇の食い違いを示し、項王の対応を批判する。' },
        { id: 'warning', prompt: '功労者を殺すことは秦の繰り返しだ、と結ぶ働きは？', quote: '此亡秦之続耳。', options: roles, answer: 'criticism', why: '冒頭の秦の前例へ戻り、同じ道を進むべきではないと項王に警告する。' }
      ]
    },
    {
      id: 'formation', title: '樊噲はどこに立つ？', type: 'formation', minutes: 2,
      lead: '項王は東を向いて座っている。樊噲の立つ位置と、顔の向きを分けて考えよう。細かな侵入経路は本文では確定できない。',
      source: '授業プリント PDF内7〜8ページ',
      questions: [
        { id: 'position', prompt: '西を向いて項王を見る樊噲は、項王から見てどちら側に立つ？', quote: '披帷西嚮立、瞋目視項王。', options: [{ id: 'east', label: '項王の東側' }, { id: 'west', label: '項王の西側' }, { id: 'north', label: '項王の北側' }, { id: 'south', label: '項王の南側' }], answer: 'east', why: '東向きの項王と向き合う位置は、その東側。「西嚮」は立つ場所が西側という意味ではない。' },
        { id: 'direction', prompt: 'その位置で、樊噲の顔はどちらを向く？', quote: '西嚮立', options: [{ id: 'east', label: '東を向く' }, { id: 'west', label: '西を向く' }, { id: 'north', label: '北を向く' }, { id: 'south', label: '南を向く' }], answer: 'west', why: '「西嚮立」は西を向いて立つこと。東側に立ち、西側にいる項王をにらむ。' }
      ]
    },
    {
      id: 'evidence', title: '本文と人物像を分ける', type: 'match', minutes: 4,
      lead: '本文に書かれた言動と、そこから考えた解釈を分けよう。人物像には、根拠に支えられた複数の読みがありうる。',
      source: '授業プリント PDF内4・6・12ページ',
      questions: [
        { id: 'u-action', prompt: '「項王は范増の合図に応じなかった」は、どちら？', quote: '項王黙然不応。', options: evidenceKinds, answer: 'text', why: '応じなかったという行動は明記されている。なぜ応じなかったかという心理は、この一句だけでは決まらない。' },
        { id: 'u-reading', prompt: '「項王は沛公を脅威と思っていなかった」は、どちら？', quote: '項王黙然不応。', options: evidenceKinds, answer: 'reading', why: '沈黙の理由を考えた解釈。約束を守ろうとした、暗殺を避けたかった、など別の読みも検討できる。' },
        { id: 'hai-action', prompt: '「沛公は別れの挨拶をどうするか尋ねた」は、どちら？', quote: '今者出、未辞也。為之奈何。', options: evidenceKinds, answer: 'text', why: '挨拶をまだしていないと言い、どうするか尋ねる発言が本文にある。' },
        { id: 'hai-reading', prompt: '「沛公は部下の知恵を引き出すのが上手い」は、どちら？', quote: '為之奈何。', options: evidenceKinds, answer: 'reading', why: '問いかけから評価した人物像。同じ言動を、慎重さや迷いの表れと読むこともできる。' }
      ],
      reflection: {
        prompt: '項王と沛公をどう捉えた？ 本文の言動を一つずつ挙げて比べよう。',
        hint: '「この言動から、私はこう考える」の形で書こう。意見の違いは誤答ではない。この記述は採点しない。'
      }
    }
  ];
}());
