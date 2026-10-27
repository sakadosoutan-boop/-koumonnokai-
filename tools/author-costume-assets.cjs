/* Save the runtime's authored garment meshes as an inspectable Blender asset.
 * node tools/author-costume-assets.cjs
 * BLENDER_EXE may override the portable Blender executable.
 * The .blend contains original garment surfaces, not an external kitbash.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {createCanvas}=require(process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas'));
const root=path.resolve(__dirname,'..'),output=path.join(root,'model-preview-output/costume-rebuild/source');fs.mkdirSync(output,{recursive:true});
const context={console,performance:require('node:perf_hooks').performance,document:{createElement(){return createCanvas(1,1);}}};context.window=context;vm.createContext(context);
for(const file of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-costume.js','src/js/koumon-cast3d.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const T=context.THREE,K=context.KM_COSTUME,V=T.Vector3,scene=new T.Group();
const cloth=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:T.DoubleSide,roughness:.88});
K.setQuality('high');
const themes=[['hai',1.04],['u',1.20],['sou',1.0]];
for(const [i,[id,b]] of themes.entries()){
  const c=K.resolveStyle(id,context.KM_CAST3D.CAST[id]);
  const model=new T.Group();model.name=id+'-atelier-reference';model.position.x=(i-1)*1.05;scene.add(model);
  const chest=new T.Group();chest.position.y=1.25;model.add(chest);
  const thorax=new T.Mesh(K.thorax(1,b,c.armor?c.lace:c.robe),cloth);thorax.name='continuous-folded-bodice';chest.add(thorax,K.collar(c,1,b,!!c.armor),K.waist(c,1,b,!!c.armor));
  if(c.armor)chest.add(K.armor(c,1,b,'torso'));
  if(c.cape)chest.add(K.cape(c,1,b));
  const pelvis=new T.Group();pelvis.position.y=.95;model.add(pelvis);
  pelvis.add(K.skirt({len:c.armor?.62:.935,r0:.17,r1:c.armor?.25*b:.33,hip:.03,depth:.82,fold:.016,color:c.robe,trim:c.trim,frontLift:.03,wrap:!c.armor},cloth));
  if(c.armor)pelvis.add(K.armor(c,1,b,'skirt'));
  for(const sd of [-1,1]){
    const shoulder=new T.Group();shoulder.position.set(sd*.188*b,.145,-.005);chest.add(shoulder);
    const armColor=c.armor?(c.legs||c.robe):c.robe,def=new V(-sd*.5,0,-.86),upper=K.sleeve({upper:true,fitted:!!c.armor,side:sd,scale:1,len:.31,y0:.005,r:u=>(1-u)*(c.armor?.062:.069)*b+u*(c.armor?.049:.062),H:u=>c.armor?0:.04*(u*u*(3-2*u)),def,color:armColor},cloth);shoulder.add(upper);
    if(c.armor)shoulder.add(K.armor(c,1,b,'shoulder',sd));
    const elbow=new T.Group();elbow.position.y=-.29;shoulder.add(elbow);
    const fore=K.sleeve(c.armor?{fitted:true,side:sd,scale:1,len:.25,y0:.01,r:u=>.052*(1-u)+.045*u,def,color:armColor}:{side:sd,scale:1,len:.270,y0:.016,r:u=>u<.55?.060+(.068-.060)*u/.55:.068+(.043-.068)*(u-.55)/.45,H:u=>{const ease=(a,b,v)=>{const x=Math.max(0,Math.min(1,(v-a)/(b-a)));return x*x*(3-2*x);};return .04+(.17-.04)*ease(0,.62,u)-.17*.82*ease(.62,1,u);},def,color:armColor,trim:c.trim,sag:.065,slide:true},cloth);elbow.add(fore);upper.userData.elbowJoint=elbow;fore.userData.elbowJoint=elbow;upper.userData.bag(new V(0,-1,0));fore.userData.bag(new V(0,-1,0));
    if(c.armor)elbow.add(K.bracer(c,1));
  }
}
scene.updateMatrixWorld(true);
const geometries=[],materials=[],objects=[],geometryIds=new Map(),materialIds=new Map();
function geometryId(g){if(geometryIds.has(g.uuid))return geometryIds.get(g.uuid);const id=geometries.length;geometryIds.set(g.uuid,id);const p=g.attributes.position,c=g.attributes.color,uv=g.attributes.uv;geometries.push({positions:Array.from(p.array),indices:g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i),colors:c?Array.from(c.array):null,uv:uv?Array.from(uv.array):null});return id;}
function materialId(m){if(materialIds.has(m.uuid))return materialIds.get(m.uuid);const id=materials.length;materialIds.set(m.uuid,id);let map=null;if(m.map&&m.map.image&&m.map.image.toBuffer){map=path.join(output,'fabric-'+id+'.png');fs.writeFileSync(map,m.map.image.toBuffer('image/png'));}materials.push({color:[m.color.r,m.color.g,m.color.b],roughness:m.roughness,metalness:m.metalness,vertexColors:m.vertexColors,map,repeat:m.map?[m.map.repeat.x,m.map.repeat.y]:[1,1]});return id;}
scene.traverse(o=>{if(!o.isMesh)return;const geo=geometryId(o.geometry),mat=materialId(o.material);for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){const M=o.matrixWorld.clone();if(o.isInstancedMesh){const local=new T.Matrix4();o.getMatrixAt(i,local);M.multiply(local);}objects.push({name:o.name||'garment-panel',geometry:geo,material:mat,matrix:Array.from(M.elements)});}});
const source=path.join(output,'costume-scene.json'),blend=path.join(root,'source-assets/costumes.blend');fs.mkdirSync(path.dirname(blend),{recursive:true});
fs.writeFileSync(source,JSON.stringify({geometries,materials,objects,atlas:path.join(root,'src/assets/character-atlas.png')}));
const blender=process.env.BLENDER_EXE||path.resolve(root,'../3d-runtime/blender-4.5.15/blender-4.5.15-windows-x64/blender.exe');
execFileSync(blender,['--background','--factory-startup','--python',path.join(__dirname,'author-costume-assets.py'),'--',source,blend],{stdio:'inherit',maxBuffer:2000000});
const manifest={asset:'楚漢衣装アトリエ v1',generatedAt:new Date().toISOString(),nativeSource:'source-assets/costumes.blend',runtime:'src/js/koumon-costume.js',reproduce:'node tools/author-costume-assets.cjs',author:'Original meshes authored for this project by Codex',sourceKind:'Original continuous parametric cut-and-drape garment surfaces; no third-party garment imports',license:'MIT, matching the project license',reference:'src/assets/character-atlas.png (project-supplied reference)',contents:['folded bodice with open crossed neckline','sewn layered collars and nape stand','folded girdle and curved belt tails','underrobe and separate overlapping curved front','double-surface gravity-deformed bag sleeves','padded lamellar backing, curved bevelled lamellae, through-laces and rivets','three sloping shoulder lames with suspension straps','four divided tassets and bound edges','gathered thick cloak and mounted brooches'],validation:'CPU multiview and pose images in model-preview-output/costume-rebuild; CPU rendering is not runtime WebGL or cloth simulation',geometryAssets:geometries.length,meshInstances:objects.length};
fs.writeFileSync(path.join(root,'source-assets/costumes.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({blend,geometryAssets:geometries.length,meshInstances:objects.length,bytes:fs.statSync(blend).size}));
