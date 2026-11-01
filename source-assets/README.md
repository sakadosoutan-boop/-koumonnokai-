# 編集用の人物アセット

`heads.blend`、`hands.blend`、`costumes.blend`、`banquet-props.blend` はBlender 4.5 LTSで保存した編集用の造形です。ゲームはBlenderを必要とせず、書き出した頂点・法線・色・インデックスをJavaScriptから読み込みます。配布用HTMLにもこのデータを内包し、実行時のモデル取得は行いません。

頭部と手の基礎は[Blender公式のHuman Base Meshes](https://www.blender.org/download/demo-files/#assets) v1.2.0（CC0）。元の解剖メッシュを非表示のコレクションに保持し、作業用の複製を人物別に変形しています。出典、取得元、照合値は[manifest.csv](../docs/assets/manifest.csv)に記録しています。配布bundleのメタデータでは個別作者を確認できなかったため、公開元をBlender Studioとして記録しています。衣装はこのプロジェクト独自の連続した布と鎧のメッシュで、MITです（[衣装manifest](costumes.manifest.json)）。

## 書き出し

```powershell
$env:BLENDER_EXE = 'C:/path/to/blender.exe'
# --sourceを省略すると作業環境の公式bundle、なければ保存済み原本を利用
& $env:BLENDER_EXE -b --python tools/build-head-assets.py
& $env:BLENDER_EXE -b --python tools/build-hand-assets.py
node tools/author-costume-assets.cjs
node tools/author-banquet-assets.cjs
npm test
npm run build
```

公式bundleを別の場所へ保存した場合は両Pythonスクリプトの `-- --source PATH`、または `KOMON_HUMAN_BASE` 環境変数で指定します。衣装の形は `src/js/koumon-costume.js` が生成元で、上のNodeスクリプトが実際のゲーム用メッシュをBlenderへ保存します。頭部と手はPythonスクリプトが生成元です。`.blend` の作業用オブジェクトだけを直接編集しても、再生成時にその変更は自動で取り込まれないため、恒久的な変更は生成スクリプトか原本側にも反映してください。

`tools/character-gallery.html` は実際のThree.js素材を使う人物確認ページです。[形状と検証範囲](../docs/model-quality.md)も参照してください。Blenderの照明で作った画像と、ブラウザーのWebGL画面は別の検証です。

2026-11-01版は、`heads.blend` 内に肖像アトラスを梱包した非表示・選択不可の `REFERENCE_LOCKED` と、元の人体を残す `BODY_BASE` を持ちます。精細な肌は49,281頂点、軽量な肌は3,143頂点。衣装には色・織り・凹凸・粗さの各画像を梱包し、冠は人物別の曲面と厚みを保存しています。

試作は `-- --preview --ids ryo,u,zo --lod both --out model-preview-output/portrait-prototype` で原本を上書きせず作れます。既存の試作を全身へ組み込んで確認する場合は `node tools/model-preview.cjs OUTPUT ryo,u,zo high --head-assets=PATH/TO/head-assets-preview.js` を使います。試作に含まれない人物はエラーにし、旧造形への代替を比較画像へ紛れ込ませません。`tools/export-model-scene.cjs` も同じ引数に対応しています。

肌・眼球の実交差と外唇の接触位置は `node tools/verify-portrait.cjs OUTPUT.json` で検査します。この値は表示可能な目と接触の確認で、肖像への類似度を数値化したものではありません。

宴席の剣・卮・生肉と冠は原作成メッシュ（MIT）です。出典と補間表現は docs/model-quality.md と banquet-props.manifest.json を参照。動作は src/js/koumon-cast3d.js、冠は koumon-heads.js が生成元です。

変更前後の比較は、変更前のコミットを `MODEL_REF=9983031` として `tools/model-preview.cjs` で `model-preview-output/portrait-before` に8人のhigh肖像を描き、環境変数を解除して現在のhigh/low肖像と4方向を `portrait-final` に描いた後、`tools/portrait-evidence.py` で組みます。比較に使う元の肖像画像自体は変更しません。
