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

宴席の剣・卮・生肉と冠は原作成メッシュ（MIT）です。出典と補間表現は docs/model-quality.md と banquet-props.manifest.json を参照。動作は src/js/koumon-cast3d.js、冠は koumon-heads.js が生成元です。
