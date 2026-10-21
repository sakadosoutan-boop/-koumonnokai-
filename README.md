# 鴻門の会 —— 楚漢の章（史記）

史記「鴻門之会」を、**沛公（劉邦）になって 3D の舞台で演じながら読む**漢文の物語ゲームです。
高校の古典探究「史記」（鴻門之会・四面楚歌・項王自刎／高祖の三傑・大風歌）の授業用に作りました。
[漢文道場](https://github.com/sakadosoutan-boop/kanbun) の「楚漢の章」を単独で遊べるように切り出したものです。

## 遊び方

- `index.html` をブラウザで開く（ビルド不要）。一枚にまとめた版は `dist/index.html`（オフラインでも開ける）。
- **あなたは沛公**：台詞の漢文を読み解き（読解）、沛公として決断する（決断）。読み違えると**命**が減る。
  言葉づかいで**項王の怒気**・**范増の殺気**が上下し、張良に問う**策**（ヒント）には限りがある。
- 史記と違う道を選ぶと**異聞の結末**（全8種）。直前の分かれ道からやり直せる。
- 三つの遊び：座次図（東嚮・南嚮・北嚮・西嚮）、献上品（白璧と玉斗）、霸上への逃げ道。
- 第二部「垓下・烏江」は項王の視点、終章「雒陽南宮」は高祖の視点。
- **原文帳**：物語で読んだ原文 24 段（白文・書き下し文・現代語訳・注）。教科書の範囲には「教科書」と表示。
- 表紙の「表示」で **3D** と **影絵（軽量）** を切り替えられる。WebGL が使えない端末では自動で影絵になる。
- 記録はブラウザの localStorage に保存（キー `kanbun-dojo:koumon:v1`。漢文道場と共通）。

## 授業で使う

- **范増になって項王を説得する（AI ロールプレイ）**：終章のあと、AI に項王を演じさせる指示文をコピーできる。
  教員向けの手引きは [`docs/hanzo-roleplay.md`](docs/hanzo-roleplay.md)、
  ワークシート（A4横・表裏）は [`docs/worksheets/hanzo-roleplay.docx`](docs/worksheets/hanzo-roleplay.docx)（`python3 tools/worksheet.py` で再生成）。
- 人物や舞台の姿の根拠（劉邦の隆準・美須髯と劉氏冠、項羽の重瞳、漢の衣と甲など）は
  [`docs/soukan-visual-reference.md`](docs/soukan-visual-reference.md)。

## ファイル

```
index.html                 入口
src/data/koumon.js         台本・原文帳・結末・AI 指示文
src/data/kuho.js           句法の解説（ヒントで使う）
src/js/koumon.js           進行・画面・保存・小さな遊び・音
src/js/koumon-3d.js        3D の舞台（Three.js）
src/js/koumon-cast3d.js    3D の人物（衣・甲冑・冠・持ち物・姿勢）と馬
src/js/koumon-figkit.js    頭部・髪・手の SDF 彫刻
src/js/koumon-stage.js     影絵（2D）の舞台
src/js/learning.js         訓点の表示
src/js/soukan.js           単独ページの起動
src/styles/                画面のスタイル
src/vendor/three.min.js    Three.js r128（MIT）
tools/build.mjs            一枚にまとめる（node tools/build.mjs → dist/index.html）
```

## ライセンス

MIT（`LICENSE`）。Three.js r128 は MIT。
