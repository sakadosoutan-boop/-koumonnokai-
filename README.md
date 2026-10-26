# 鴻門の会 —— 楚漢の章（史記）

史記「鴻門之会」を、**沛公（劉邦）になって 3D の舞台で演じながら読む**漢文の物語ゲームです。
高校の古典探究「史記」（鴻門之会・四面楚歌・項王自刎／高祖の三傑・大風歌）の授業用に作りました。
[漢文道場](https://github.com/sakadosoutan-boop/kanbun) の「楚漢の章」を単独で遊べるように切り出したものです。

## 遊び方

- `index.html` をブラウザで開く（ビルド不要）。一枚にまとめた版は `dist/index.html`（オフラインでも開ける）。
- **授業モード**が初期設定です。全章・全原文を開け、誤答で命が減らず、時間制限もありません。授業設定で投影向けの大きな文字、文字の即時表示も切り替えられます。
- **あなたは沛公**：台詞の漢文を読み解き（読解）、沛公として決断する（決断）。挑戦モードでは読み違えると**命**が減る。
  言葉づかいで**項王の怒気**・**范増の殺気**が上下し、張良に問う**策**（ヒント）には限りがある。
- 史記と違う道を選ぶと**異聞の結末**（全8種）。失敗の原因になった選択からやり直せる。
- 三つの遊び：座次図（東嚮・南嚮・北嚮・西嚮）、献上品（白璧と玉斗）、霸上への逃げ道。
- 第二部「垓下・烏江」は項王の視点、終章「雒陽南宮」は高祖の視点。
- **原文帳**：原文 24 段（白文・書き下し文・現代語訳・注）。挑戦モードでは読んだ段から開き、授業モードでは全段を開けます。教科書の範囲には「教科書」と表示。
- 「授業設定」で **3D** と **影絵（軽量）** を切り替えられる。WebGL が使えない端末では自動で影絵になる。
- 記録はブラウザの localStorage に保存（キー `kanbun-dojo:koumon:v1`。漢文道場と共通）。

## 授業で使う

- **七場面の導入**：鴻門の会に至る流れを、地図・人物説明付きの紙芝居でたどります。前後移動、自動再生、一時停止に対応し、約束と軍勢を比べて考えます。
- **范増として考える（AI ロールプレイ）**：表紙・鴻門の会の結末・終章から開けます。剣舞前を場面とし、選んだ原文と段番号を添えて指示文をコピーします。外部のAIへは手動で貼り付けます。本文の記述・解釈・創作を分け、AIの数値を成績にしません。
  教員向けの手引きは [`docs/hanzo-roleplay.md`](docs/hanzo-roleplay.md)、
  ワークシート（A4横・表裏）は [`docs/worksheets/hanzo-roleplay.docx`](docs/worksheets/hanzo-roleplay.docx)（`python3 tools/worksheet.py` で再生成）。
- **振り返り**：引用、根拠から考えたこと、AIと本文の違い、次の工夫を端末内に保存し、テキストで出力できます。
- 人物や舞台の姿の根拠（劉邦の隆準・美須髯と劉氏冠、項羽の重瞳、漢の衣と甲など）は
  [`docs/soukan-visual-reference.md`](docs/soukan-visual-reference.md)。

## ファイル

```
index.html                 入口
src/data/koumon.js         台本・原文帳・結末・AI 指示文
src/data/kuho.js           句法の解説（ヒントで使う）
src/js/koumon.js           進行・画面・保存・小さな遊び・音
src/js/koumon-classroom.js 導入の紙芝居・人物案内・資料付きAI指示文
src/js/koumon-3d.js        3D の舞台（Three.js）
src/js/koumon-lighting.js  肌・布・金属を照らす共有の環境反射
src/js/koumon-cast3d.js    3D の人物（衣・甲冑・冠・持ち物・姿勢）と馬
src/js/koumon-heads.js     人物別の人体ベース頭部・眼球・髪・髭
src/js/koumon-hands.js     解剖メッシュによる手と握り
src/js/koumon-costume.js   厚みのある布・重ね襟・袖・札甲・披風
src/js/koumon-figkit.js    補助・予備のSDF造形
src/js/*-assets.js         Blenderから書き出した圧縮メッシュ
source-assets/            編集用Blenderアセットと再現手順
src/js/koumon-stage.js     影絵（2D）の舞台
src/js/learning.js         訓点の表示
src/js/soukan.js           単独ページの起動
src/styles/                画面のスタイル
src/vendor/three.min.js    Three.js r128（MIT）
tools/build.mjs            一枚にまとめる（node tools/build.mjs → dist/index.html）
tools/character-gallery.html 人物を回転・拡大して確認するページ
tools/banquet-scenes.html   剣舞・翼蔽・飲酒・食事を再生／一時停止するページ
tools/verify-banquet.cjs    握り・接触・関節範囲・動きの連続性の検査
```

## 開発時の確認

`npm ci` のあと `npm test` で進行・保存・再開などの回帰テスト、`npm run build` で配布用HTMLを生成します。画面の見た目や操作感は、PCと縦長画面のブラウザでも確認してください。導入・授業モードなどの受け入れ確認は [`docs/implementation-audit.md`](docs/implementation-audit.md)、表紙画像の制作情報は [`docs/visual-assets.md`](docs/visual-assets.md) に記録します。

## ライセンス

人物ガイド・導入・会話には主要8人の肖像を使用しています。画像の制作情報と創作表現の範囲は [`docs/character-art.md`](docs/character-art.md)、検証済みの範囲と実画面・印刷の未確認項目は [`docs/implementation-audit.md`](docs/implementation-audit.md) を参照してください。

MIT（`LICENSE`）。Three.js r128 は MIT。頭部と手はBlender公式Human Base Meshes（CC0）を基礎に造形しています。[出典manifest](docs/assets/manifest.csv)と[編集用アセットの説明](source-assets/README.md)を参照してください。
