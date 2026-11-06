/* Rebuild the original continuous horse asset as an inspectable Blender source.
 * node tools/author-horse-assets.cjs [output-directory] [--before=git-ref]
 * Review output is ignored; no extra runtime mesh download is required.
 */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'model-preview-output/horse-after'));
const before=process.argv.find(a=>a.startsWith('--before='));
const env={...process.env};if(before)env.MODEL_REF=before.slice(9);
fs.mkdirSync(out,{recursive:true});
execFileSync(process.execPath,[path.join(__dirname,'export-model-scene.cjs'),out,'zhui','stand','high'],{cwd:root,env,stdio:'inherit'});
const blender=process.env.BLENDER_EXE||path.resolve(root,'../3d-runtime/blender-4.5.15/blender-4.5.15-windows-x64/blender.exe');
execFileSync(blender,['-b','--python',path.join(__dirname,'render-model-scene.py'),'--',path.join(out,'zhui-stand.json'),out,'full'],{cwd:root,stdio:'inherit',maxBuffer:2000000});
console.log('Horse source and front / side / three-quarter / overhead evidence:',out);
