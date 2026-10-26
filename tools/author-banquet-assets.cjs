/* Save the actual runtime props and fitted crowns as editable Blender meshes. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {createCanvas}=require(process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'model-preview-output/banquet-source');fs.mkdirSync(out,{recursive:true});
const C={console,document:{createElement:()=>createCanvas(1,1)},atob:s=>Buffer.from(s,'base64').toString('binary')};C.window=C;vm.createContext(C);
for(const f of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-head-assets.js','src/js/koumon-heads.js','src/js/koumon-banquet-props.js','src/js/koumon-cast3d.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});
const T=C.THREE,B=C.KM_BANQUET,scene=new T.Group();B.setQuality('high');
const props=[B.sword(true),B.sword(false),B.zhi(),B.porkShoulder(),B.morsel()];
props.forEach((o,i)=>{o.position.set((i-2)*.38,i<2?.88:.09,0);scene.add(o);});
for(const [i,id] of ['hai','u','ryo','zo','haku','kai','sou','chin'].entries()){
 const h=C.KM_HEADS.build(id,C.KM_CAST3D.CAST[id].head,'high').group;
 const cap=h.children.find(o=>o.userData.part==='headwear');if(cap){cap.position.x+=(i-3.5)*.19;cap.position.y+=.35;cap.position.z+=.40;cap.name=id+' fitted headwear';scene.add(cap);}
}
scene.updateMatrixWorld(true);const geometries=[],materials=[],objects=[],gids=new Map(),mids=new Map();
function geometry(g){if(gids.has(g.uuid))return gids.get(g.uuid);const id=geometries.length,p=g.attributes.position,c=g.attributes.color,u=g.attributes.uv;const divisor=c&&c.normalized?255:1;
 geometries.push({positions:Array.from(p.array),indices:g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i),colors:c?Array.from(c.array,x=>x/divisor):null,uv:u?Array.from(u.array):null,groups:g.groups.map(x=>({...x}))});gids.set(g.uuid,id);return id;}
function material(m){if(mids.has(m.uuid))return mids.get(m.uuid);const id=materials.length;let map=null;
 if(m.map?.image?.toBuffer){map=path.join(out,'texture-'+id+'.png');fs.writeFileSync(map,m.map.image.toBuffer('image/png'));}
 materials.push({name:m.name||'Original material',color:[m.color.r,m.color.g,m.color.b],roughness:m.roughness,metalness:m.metalness,vertexColors:m.vertexColors,map,srgb:m.map?.encoding===T.sRGBEncoding});mids.set(m.uuid,id);return id;}
scene.traverse(o=>{if(o.isMesh)objects.push({name:o.name,geometry:geometry(o.geometry),materials:(Array.isArray(o.material)?o.material:[o.material]).map(material),matrix:Array.from(o.matrixWorld.elements),headwear:o.userData.part==='headwear'});});
const input=path.join(out,'banquet-assets.json'),blend=path.join(root,'source-assets/banquet-props.blend');fs.writeFileSync(input,JSON.stringify({geometries,materials,objects}));
const blender=process.env.BLENDER_EXE||path.resolve(root,'../3d-runtime/blender-4.5.15/blender-4.5.15-windows-x64/blender.exe');
execFileSync(blender,['-b','--factory-startup','--python',path.join(__dirname,'author-banquet-assets.py'),'--',input,blend],{stdio:'inherit'});
fs.writeFileSync(path.join(root,'source-assets/banquet-props.manifest.json'),JSON.stringify({date:'2026-10-26',license:'MIT (original project meshes)',generator:'src/js/koumon-banquet-props.js; src/js/koumon-heads.js',contents:['double-edged jian and lacquer scabbard','single-ring-ear lacquer zhi','raw pork shoulder and pierced morsel','eight fitted crowns and hair wraps'],historicalReference:'https://img.dpm.org.cn/Uploads/File/2020/12/29/u5feaced521ab7.pdf',note:'Creative reconstruction after Western Han examples. Motion is authored separately in koumon-cast3d.js.'},null,2)+'\n');
console.log(JSON.stringify({blend,bytes:fs.statSync(blend).size,objects:objects.length}));
