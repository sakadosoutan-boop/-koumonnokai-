/* Neutral-material contact inspection using the existing CPU preview renderer.
 * node tools/costume-contact-preview.cjs output-dir ryo,u high
 * Keeps exactly the runtime meshes, poses and camera framing.
 */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.join(__dirname,'model-preview.cjs');let source=fs.readFileSync(filename,'utf8');
const needle='const model=collect(figure)';
if(!source.includes(needle))throw Error('Preview integration point changed');
source=source.replace(needle,`figure.traverse(o=>{if(!o.isMesh)return;const apply=mat=>{const m=mat.clone();m.map=null;m.bumpMap=null;m.normalMap=null;m.vertexColors=false;m.color.setHex(0x999999).convertSRGBToLinear();return m;};o.material=Array.isArray(o.material)?o.material.map(apply):apply(o.material);});\n  ${needle}`);
const runner=new Module(filename,module);runner.filename=filename;runner.paths=Module._nodeModulePaths(__dirname);runner._compile(source,filename);
