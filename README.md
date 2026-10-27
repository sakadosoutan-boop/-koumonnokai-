# 鴻門の会 —— 楚漢の章（史記）

史記「鴻門之会」を、**沛公（劉邦）になって 3D の舞台で演じながら読む**漢文の物語ゲームです。
高校の古典探究「史記」（鴻門之会・四面楚歌・項王自刎／高祖の三傑・大風歌）の授業用に作りました。
[漢文道場](https://github.com/sakadosoutan-boop/kanbun) の「楚漢の章」を単独で遊べるように切り出したものです。

## 遊び方

- `index.html` をブラウザで開く（ビルド不要）。一枚にまとめた版は `dist/index.html`（オフラインでも開ける）。
- **授業モード**が初期設定です。全章・全原文を開け、誤答で命が減らず、時間制限もありません。読み違えたときは一度目はヒントを添えて選び直せ、二度目に正解と解説が出ます（読解率は一度目の答えで数えます）。項王の怒気・范増の殺気は参考として表示します。授業設定で投影向けの大きな文字、文字の即時表示、怒気・殺気の表示も切り替えられます。
- 選択肢は問いごとに並べ替えて表示します（読解の正解・決断の史記どおりの選択とも位置は固定されません）。1〜4 キーでも選べます（画面に並んだ順）。
- **あなたは沛公**：台詞の漢文を読み解き（読解）、沛公として決断する（決断）。挑戦モードでは読み違えると**命**が減る。
  言葉づかいで**項王の怒気**・**范増の殺気**が上下し、張良に問う**策**（ヒント）には限りがある。
- 史記と違う道を選ぶと**異聞の結末**（全9種。第二部の烏江にも一つ）。失敗の原因になった選択からやり直せる。
- 結末では**あなたの道と史記の道**を並べ、史記と違う決断と、本文からいくつも説明できる「あなたの読み」を振り返れる。
- 三つの遊び：座次図（東嚮・南嚮・北嚮・西嚮）、献上品（白璧と玉斗）、霸上への逃げ道。
- 第二部「垓下・烏江」は項王の視点、終章「雒陽南宮」は高祖の視点。
- **原文帳**：原文 24 段（白文・書き下し文・現代語訳・注）。挑戦モードでは読んだ段から開き、授業モードでは全段を開けます。教科書の範囲には「教科書」と表示。
- 「授業設定」で **3D** と **影絵（軽量）** を切り替えられる。WebGL が使えない端末では自動で影絵になる。
- 記録はブラウザの localStorage に保存（キー `kanbun-dojo:koumon:v1`。漢文道場と共通）。

## スマホ・タブレット・PCの実機で見る

GitHub Pages で公開すると、どの端末のブラウザーからも URL で開けます（このリポジトリは公開設定なので無料で使えます）。

1. GitHub のリポジトリで **Settings → Pages** を開く。
2. **Build and deployment** の Source を「Deploy from a branch」にし、Branch で確認したいブランチ（例：`main`）と `/ (root)` を選んで **Save**。
3. 1〜2分後、`https://sakadosoutan-boop.github.io/-koumonnokai-/` で開ける（同じページの上部にも URL が出ます）。ブランチに push するたびに更新されます。

`.nojekyll` を置いているので、ファイルはそのまま配信されます。PC だけで確かめるときは、`dist/index.html` をダウンロードしてブラウザーで開いても遊べます（一枚にまとめた版で、オフラインでも動きます）。

## 授業で使う

- **導入「鴻門への道」**：本編（序幕「霸上の夕べ」）より前の流れを、七つの場面でたどる紙芝居です。秦の乱れ、劉邦と項羽の挙兵、懐王の約、北と西の二つの道、劉邦の先着、函谷関、霸上の夕べへ。各場面はまず**紙芝居**（本編と同じ 3D／影絵の舞台と人物で、ナレーションと台詞を数コマで演じる）で始まり、続く**解説**に年表・地図・ことばの説明・『史記』の短い原文（白文・書き下し・現代語訳）・確かめの問いが付きます。紙芝居のコマには「史記の記述（書き下し）」「本文をもとにした再構成」「ゲーム上の創作」の別を表示します。上部の「場面／解説」で切り替えられます。以前の導入にあった「共闘の地図」「人のつながり（項伯→張良→劉邦）」「翌朝の道」の図も、「挙兵」「霸上の夕べへ」の解説で図を切り替えて見られます。前後移動、自動再生（問いの場面で一時停止）に対応し、最後に序幕へつながります。
- **范増として考える（AI ロールプレイ）**：表紙・鴻門の会の結末・終章から開けます。剣舞前を場面とし、選んだ原文と段番号を添えて指示文をコピーします。外部のAIへは手動で貼り付けます。本文の記述・解釈・創作を分け、AIの数値を成績にしません。
  教員向けの手引きは [`docs/hanzo-roleplay.md`](docs/hanzo-roleplay.md)、
  ワークシート（A4横・表裏）は [`docs/worksheets/hanzo-roleplay.docx`](docs/worksheets/hanzo-roleplay.docx)（`python3 tools/worksheet.py` で再生成）。
  印刷用の PDF 版は [`docs/worksheets/hanzo-roleplay.pdf`](docs/worksheets/hanzo-roleplay.pdf)（`npm run worksheet:pdf`。LibreOffice で書き出し、UD デジタル教科書体の代わりに IPAゴシックを使うため字形は Word 版と異なります）。
- **振り返り**：引用、根拠から考えたこと、AIと本文の違い、次の工夫を端末内に保存し、テキストで出力できます。
- **読み直し帳**：読み違えた「読み解け」の問いが集まり、表紙・結末から解き直せます。読み解くと帳から外れます。
- **学習記録**：章・結末・原文帳・読解率・史記と違う決断・読み直し帳・振り返りを一つのテキストにまとめ、コピーまたはファイル保存できます。提出フォームなどに貼り付けて回収できます（記録自体は端末内のみ）。
- **場面リンク**：URL の末尾に `#c3`（章）、`#intro`（導入）、`#ai`（AI活動）、`#review`（読み直し帳）を付けて開くと、その場面から始まります。授業モードの目次からリンクをコピーできます。挑戦モードでは、まだ開いていない章は表紙のままです。
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
src/js/koumon-intro-stages.js 導入の紙芝居用の立ち位置（本編の舞台の作りを流用）
src/js/learning.js         訓点の表示
src/js/soukan.js           単独ページの起動
src/styles/                画面のスタイル（study.css は読み直し・学習記録など学習機能の部品）
src/vendor/three.min.js    Three.js r128（MIT）
tools/build.mjs            一枚にまとめる（node tools/build.mjs → dist/index.html）
tools/character-gallery.html 人物を回転・拡大して確認するページ
tools/banquet-scenes.html   乗り込み・剣舞・翼蔽・飲酒・食事を再生／巻き戻しするページ
tools/verify-banquet.cjs    握り・接触・関節範囲・動きの連続性の検査
tools/model-preview.cjs     実モデルのCPU画像・連続フレームを出力
tools/compose-motion-preview.py 連続フレームから確認用GIFを作成（Pillow）
tools/worksheet-pdf.py     ワークシートの PDF 版を作る
tests/                     回帰テスト（*.test.cjs）と実ブラウザーの画面確認（browser-smoke.cjs）
.github/workflows/ci.yml   GitHub Actions（テスト・配布HTMLの更新漏れ・実ブラウザー確認）
```

## 開発時の確認

`npm ci` のあと `npm test` で進行・保存・再開・学習機能の回帰テスト、`npm run build` で配布用HTMLを生成します。`npm run test:browser` は Playwright の Chromium で PC（1440×800）と縦長（390×844）の画面を開き、「次へ」が画面内にあるか、設問の縦書きが潰れていないか、3D の舞台が初期化できるかを確かめます（Playwright と縦書き対応の日本語フォントが必要。`SKIP_3D=1` で 3D を省略）。GitHub Actions では push・プルリクエストごとに、テスト、`dist/index.html` の更新漏れ、実ブラウザー確認を実行します。ソースを変えたら `npm run build` の結果もコミットしてください。画面の見た目や操作感は、PCと縦長画面のブラウザでも確認してください。導入・授業モードなどの受け入れ確認は [`docs/implementation-audit.md`](docs/implementation-audit.md)、表紙画像の制作情報は [`docs/visual-assets.md`](docs/visual-assets.md) に記録します。

形状と動きをCPUで確認する場合は、`node tools/model-preview.cjs model-preview-output/dance sou low --pose=dance --motion-frames=64`、続いて `python tools/compose-motion-preview.py model-preview-output/dance/motion-sou-low model-preview-output/dance/dance.gif` を実行します。Canvas用モジュールの場所は `CANVAS_MODULE` で指定できます。このGIFは実モデルの動作確認用で、ブラウザーのPBR・影・透過の表示とは区別します。

人物と宴席の確認範囲は[3D品質の記録](docs/model-quality.md)、剣舞で参照した動画と動きの設計は[参考映像と動作設計](docs/sword-dance-reference.md)を参照してください。

## ライセンス

人物ガイド・導入・会話には主要8人の肖像を使用しています。画像の制作情報と創作表現の範囲は [`docs/character-art.md`](docs/character-art.md)、検証済みの範囲と実画面・印刷の未確認項目は [`docs/implementation-audit.md`](docs/implementation-audit.md) を参照してください。

MIT（`LICENSE`）。Three.js r128 は MIT。頭部と手はBlender公式Human Base Meshes（CC0）を基礎に造形しています。[出典manifest](docs/assets/manifest.csv)と[編集用アセットの説明](source-assets/README.md)を参照してください。
