/* CSS / JS をすべてインライン化して、一枚で開ける dist/index.html を作る。
   単一ファイルなのでオフラインでも、配布用の USB からでもそのまま開ける。 実行: node tools/build.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => '<style>\n' + fs.readFileSync(path.join(root, href.split(/[?#]/)[0]), 'utf8') + '\n</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, s) => '<script>\n' + fs.readFileSync(path.join(root, s.split(/[?#]/)[0]), 'utf8') + '\n</script>');
// 表紙の画像も埋め込み、配布版のオフライン利用を保つ。
html = html.replace(/\.\.\/assets\/([\w.-]+\.png)/g, (_, name) => 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'src/assets', name)).toString('base64'));
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log('✔ dist/index.html  (' + Math.round(Buffer.byteLength(html) / 1024) + ' KB)');
