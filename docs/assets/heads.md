# 人物の頭部アセット

主要8人は Blender 公式 Human Base Meshes v1.2.0 の `GEO-head_sculpting_realistic` を基礎とする。出典・CC0確認・配布物のハッシュは [manifest.csv](manifest.csv) に記録。編集用原型は `source-assets/heads.blend` の非表示 `BODY_BASE` collection に残している。`REFERENCE_LOCKED` collection には変更していない `src/assets/character-atlas.png` をpackして保存し、render対象・選択対象から外している。

頭蓋、鼻、眼瞼、口、耳、顎、首は連続した人体メッシュ。額・頬骨・頬の窪み・下顎角・顎先の高さ帯と、鼻梁・鼻翼・眼窩・上瞼/下瞼・口角を人物別に造形する。highでは作業複製の解像度を上げ、加齢の面と溝も肌の形状に刻む。

- 張良 `ryo`：成年の細長い輪郭、頬骨から顎へ続く面、直線的な鼻梁、口唇の山、非対称に流す黒髪と頬沿いの毛束。
- 劉邦 `hai`：成熟した左右差、長い鼻、幅と奥行を持つ不揃いな長髭。
- 項羽 `u`：広い眉骨と下顎角、口髭へつながる短い全顎髭。
- 范増 `zo`：内眉の圧縮、眼窩・こめかみ・頬の窪み、下がった口角、長い白眉と層のある白髭。後方の白髪は頭皮に接続した3層の曲線guideで流す。
- 項伯 `haku`：心配そうな眉と年長者の丸みを残す下顔面、白髪混じりの短い髭。
- 樊噲 `kai`：項羽より広い鼻翼と下顎、厚い頬髭と口髭、不揃いな髪の量感。
- 項荘 `sou`：若い引き締まった頬と顎、警戒した目と眉、上へ流す髪。
- 陳平 `chin`：細長い輪郭、細い口髭と中央へ先細りする短い顎髭。

頭髪は耳の面を除外した密着scalpと大きな流れ、眉・短髭は肌に沿う毛束面と立体的な繊維を組み合わせる。長髭は丸い断面の層と全周の繊維で構成する。毛根面の縁は肌色へ薄く移行し、点描や硬い黒い切断線を抑える。冠はruntime側で作り、編集用メッシュは `source-assets/banquet-props.blend` に保存する。

## 再生成

Blender 4.5 LTS でリポジトリ直下から実行する。

```powershell
blender -b --python tools/build-head-assets.py -- --source "PATH/TO/human_base_meshes_bundle.blend"
```

`KOMON_HUMAN_BASE` 環境変数でも原本を指定できる。指定なしでは隣接する `../3d-runtime/human-base/human_base_meshes_bundle.blend` を探し、なければ保存した `source-assets/heads.blend` の原型を読み込む。

通常実行は全員・両LODを作り、`src/js/koumon-head-assets.js` と編集用 `source-assets/heads.blend` を更新する。`--out` 先には `heads-portrait.blend` と確認画像を保存する。今回の最終制作版は `model-preview-output/portrait-final-heads/heads-portrait.blend`。runtime factory は `src/js/koumon-heads.js`。

試作はcanonicalを上書きしない。

```powershell
blender -b --python tools/build-head-assets.py -- --preview --ids ryo,u,zo --lod high --out model-preview-output/portrait-fidelity/prototype --all-views
blender -b --python tools/build-head-assets.py -- --preview --lod both --out model-preview-output/portrait-fidelity/all-eight-preview --all-views
```

`--prototype` は張良のみの試作、`--ids` は対象指定、`--lod high|low|both` は解像度指定。`--views front,threequarter,side,top` で画像を絞り、`--no-render` で書き出しだけ行える。試作JSの名前は `head-assets-preview.js`。部分指定や片方のLODだけを作る場合も自動的に試作扱いとなる。`--packing-audit` は同じ書き出しの非圧縮index比較用JSを保存する。

## Runtime contract

`KM_HEADS.build(id, headParams, quality)` は `{group, surface, eyes, anchors, asset, headwear}` を返す。`surface` は肌の Mesh、`eyes` は眼球と虹彩の Group。各 Mesh の `userData.part` は `skin`、`eyes`、`hair`、`brow`、`beard`、`headwear` のいずれか。`asset:true` の場合は旧 SDF の髪と輪郭変形を重ねない。

座標はメートル、+Y が上、+Z が正面。首メッシュの下端と公開metadata `anchors.neck` は `[0,-.205,-.020]` まで襟の内側へ延長する。これはアニメーションが用いる解剖学上の首pivot `[0,-.165,0]` と区別する。

`anchors.eyes` は新メッシュから求めた眼球の中心・半径・倍率。`anchors.hat.offset` と `scale` は旧冠の補正用。髻の根元は Y=.123、Z=-.027を維持する。`headwear:true` の場合は旧冠を重ねない。

`anchors.mouth` はfactoryが実際の肌メッシュへ `(0,-.038,.3)` から-Z方向のrayを当てて求める外唇の接触点。id/LODごとに一度だけ計算し、呼び出しごとに配列を複製する。rigはこれを `rig.mouthContact` として公開する。器の口縁・肩肉の接触targetには、ともに `(0,-.001*s,.001*s)` のoffsetを用いる（`s` は人物scale）。SDFへのfallbackでは従来の `[0,-.038,.073]` を維持する。

肌は high が49,281頂点、low が3,143頂点で、両方とも眼瞼の元のループを保持する。各パートはuint16の頂点上限内に収める。座標は10μm単位のint16、法線はint8、肌色は線形RGBのuint8。三角形indexは差分・zigzag・varintで可逆圧縮し、デコード時に頂点範囲とストリーム終端を検査する。lowの眉・髭・頭髪は専用形状。今回の全8人・両LODのJSは約29.6MB、編集用blendは約42.2MB。

同じ書き出しの量子化後position・normal・color各60 streamをbytesで照合し、index60 streamを実runtime decoderで展開して全要素が一致することを確認した。記録は `model-preview-output/portrait-final-heads/packing-audit.json`。

その他の男性は近い主要人物から小さく変形する。女性の虞氏 `gu` は適切な専用原型の仕上げが未実施のため、従来factoryへ戻す。

## 確認記録

Blenderのprototypeと全8人previewで正面・斜め・側面・上方を出力し、頭皮・耳・首・髭の接続を検討した。画像は `model-preview-output/portrait-fidelity/`。最終寸法と両LODの眼裂ray検査は `model-preview-output/portrait-final-heads/geometry.json`。口元の基準点と実外唇の比較は `lip-contact-audit.json` に記録した。

口元のcontact検証は `anchors.mouth` を正解として比較せず、独立した実肌rayで外唇を求めて1mm以内かを検査する。飲食のunit testと宴席auditは、実world口縁・bite pointとこの実表面との距離を `3mm*s` 未満に制限する。樊噲のdrink phase .5を調べた独立probeでは、器本体の実triangleから外唇まで約1.9mm、口縁markerから約1.52mmだった。記録は `model-preview-output/portrait-final-heads/mouth-offset-probe.json`。

この作業の表示確認はBlenderとCPU previewに限る。Work設定でローカルブラウザー利用が無効のため、ブラウザーのWebGL表示を確認したとは扱わない。

残る表現上の制約として、髪と髭はゲーム向けの毛束表現で、個々の産毛や皮膚の写真テクスチャを使った実写表現ではない。
