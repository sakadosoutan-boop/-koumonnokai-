# 人物の頭部アセット

主要8人は Blender 公式 Human Base Meshes v1.2.0 の `GEO-head_sculpting_realistic` を基礎とする。出典・CC0確認・配布物のハッシュは [manifest.csv](manifest.csv) に記録。編集用原型は `source-assets/heads.blend` の非表示 `BODY_BASE` collection に残している。

頭蓋、鼻、眼瞼、口、耳、顎、首は連続した人体メッシュ。顔幅、下顎、頬、下顔面長、鼻梁、目尻、瞼の開き、加齢の溝を人物ごとに造形している。髪は頭皮から切り出した密着面と後方へ流す毛束。短髭は連続した顔面へ色・量感を統合し、根元を埋めた細い毛を追加。長髭は顎から前へ垂れる閉じた量感。冠の編集用メッシュは source-assets/banquet-props.blend に保存。

## 再生成

Blender 4.5 LTS でリポジトリ直下から実行する。

```powershell
blender -b --python tools/build-head-assets.py -- --source "PATH/TO/human_base_meshes_bundle.blend"
```

`KOMON_HUMAN_BASE` 環境変数でも原本を指定できる。指定なしでは隣接する `../3d-runtime/human-base/human_base_meshes_bundle.blend` を探す。`--prototype` は張良のみを作り、試作のJSを `model-preview-output/asset-rebuild/head-assets-prototype.js` に保存する。

全員を再生成すると `src/js/koumon-head-assets.js`、編集用 `source-assets/heads.blend`、制作確認用 `model-preview-output/asset-rebuild/heads-assets.blend` と各人物の画像を出力する。runtime factory は `src/js/koumon-heads.js`。

## Runtime contract

`KM_HEADS.build(id, headParams, quality)` は `{group, surface, eyes, anchors, asset, headwear}` を返す。`surface` は肌の Mesh、`eyes` は眼球と虹彩の Group。各 Mesh の `userData.part` は `skin`、`eyes`、`hair`、`brow`、`beard`、`headwear` のいずれか。`asset:true` の場合は旧 SDF の髪と輪郭変形を重ねない。

座標はメートル、+Y が上、+Z が正面。首の下端は Y=-0.165。`anchors.eyes` は新メッシュから求めた眼球の中心・半径・倍率。`anchors.hat.offset` と `scale` は旧冠の補正用。張良・項羽・樊噲・曹無傷は髻に接する帯・小冠を含み、`headwear:true` の場合は旧冠を重ねない。

肌は high が12,414頂点、low が3,143頂点で、両方とも眼瞼の元のループを保持する。座標は10μm単位のint16、法線はint8、肌色は線形RGBのuint8。三角形のindexを共有し、lowは眉・髭をhighと共有する。JSは約6.1MB、gzip約3.3MB。

その他の男性は近い主要人物から小さく変形する。女性の虞氏 `gu` は適切な専用原型の仕上げが未実施のため、従来factoryへ戻す。

## 確認記録

Blenderで主要8人の正面、斜め、側面、上方を確認。首、眼瞼と眼球、頬から髭の根元、頭皮の接続を確認した。画像と寸法ログは `model-preview-output/asset-rebuild/` と `multiview/audit.json`。CPU previewの主要8人highの肌・眼球検証が完走している。最終のゲーム照明・WebGL表示は統合側の確認も必要。

残る表現上の制約として、髪と髭はゲーム向けの毛束表現で、個々の産毛や皮膚の写真テクスチャを使った実写表現ではない。
