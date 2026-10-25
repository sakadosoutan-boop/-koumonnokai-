/* Export the actual game meshes for an independent Blender lighting/contact review.
 * node tools/export-model-scene.cjs [out-dir] [id] [pose] [quality]
 * This is not a WebGL screenshot. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const {execFileSync}=require('node:child_process');
const {createCanvas}=require(process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'model-preview-output/blender-scene');
const id=process.argv[3]||'ryo',pose=process.argv[4]||'idle',quality=process.argv[5]||'high';
fs.mkdirSync(out,{recursive:true});
const context={console,performance,document:{createElement(){return createCanvas(1,1);}},setTimeout,clearTimeout};context.window=context;vm.createContext(context);
for(const file of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-head-assets.js','src/js/koumon-heads.js','src/js/koumon-hand-assets.js','src/js/koumon-hands.js','src/js/koumon-costume.js','src/js/koumon-cast3d.js']){
  let source;
  if(process.env.MODEL_REF){try{source=execFileSync('git',['show',process.env.MODEL_REF+':'+file],{cwd:root,encoding:'utf8',maxBuffer:50000000,stdio:['ignore','pipe','ignore']});}catch(error){if(file.endsWith('three.min.js')||file.endsWith('koumon-figkit.js')||file.endsWith('koumon-cast3d.js'))throw error;continue;}}
  else{const target=path.join(root,file);if(!fs.existsSync(target))continue;source=fs.readFileSync(target,'utf8');}
  vm.runInContext(source,context,{filename:file});
}
const T=context.THREE;context.KM_CAST3D.setQuality(quality);
const figure=context.KM_CAST3D.makeFigure(id);figure.userData.setPose(pose);figure.userData.update(0,0);figure.updateMatrixWorld(true);
const positions=[],colors=[],uv=[],faces=[],materialIndices=[],materials=[],registry=new Map();
function materialIndex(m){
  if(registry.has(m.uuid))return registry.get(m.uuid);
  const index=materials.length,entry={name:m.name||('material-'+index),roughness:m.roughness==null?.7:m.roughness,metalness:m.metalness||0,opacity:m.opacity==null?1:m.opacity};
  for(const channel of ['map','bumpMap','roughnessMap']){
    const tex=m[channel];if(!tex||!tex.image||!tex.image.toBuffer)continue;
    const name=id+'-'+pose+'-mat'+index+'-'+channel+'.png';fs.writeFileSync(path.join(out,name),tex.image.toBuffer('image/png'));
    entry[channel]={file:name,repeat:[tex.repeat.x,tex.repeat.y],offset:[tex.offset.x,tex.offset.y],flipY:tex.flipY};
  }
  entry.bumpScale=m.bumpScale||0;registry.set(m.uuid,index);materials.push(entry);return index;
}
figure.traverseVisible(o=>{
  if(!o.isMesh||!o.geometry.attributes.position)return;
  const g=o.geometry,p=g.attributes.position,t=g.attributes.uv;
  let c=g.attributes.color;
  if(c&&c.normalized){const divisor=c.array.constructor.name==='Uint8Array'?255:c.array.constructor.name==='Uint16Array'?65535:1;c=new T.BufferAttribute(Float32Array.from(c.array,v=>v/divisor),c.itemSize);}
  const mats=Array.isArray(o.material)?o.material:[o.material],groups=Array.isArray(o.material)&&g.groups.length?g.groups:[{start:0,count:g.index?g.index.count:p.count,materialIndex:0}];
  const indices=g.index?g.index.array:Uint32Array.from({length:p.count},(_,i)=>i);
  for(let inst=0;inst<(o.isInstancedMesh?o.count:1);inst++){
    const matrix=o.matrixWorld.clone(),ic=new T.Color(1,1,1);
    if(o.isInstancedMesh){const m=new T.Matrix4();o.getMatrixAt(inst,m);matrix.multiply(m);if(o.instanceColor)o.getColorAt(inst,ic);}
    for(const group of groups){
      const mat=mats[group.materialIndex||0],mi=materialIndex(mat),base=mat.color||new T.Color(1,1,1),local=new Map();
      for(let i=group.start;i<Math.min(indices.length,group.start+group.count);i+=3){
        const face=[];
        for(let k=0;k<3;k++){
          const j=indices[i+k];let v=local.get(j);
          if(v==null){
            v=positions.length/3;local.set(j,v);const q=new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(matrix);
            if(![q.x,q.y,q.z].every(Number.isFinite))throw Error('Invalid geometry');
            positions.push(q.x,q.y,q.z);colors.push(base.r*ic.r*(mat.vertexColors&&c?c.getX(j):1),base.g*ic.g*(mat.vertexColors&&c?c.getY(j):1),base.b*ic.b*(mat.vertexColors&&c?c.getZ(j):1),1);
            uv.push(t?t.getX(j):0,t?t.getY(j):0);
          }face.push(v);
        }
        // Negative scales reflect winding as Three's renderer does.
        if(matrix.determinant()<0)[face[1],face[2]]=[face[2],face[1]];
        faces.push(face);materialIndices.push(mi);
      }
    }
  }
});
const bounds=new T.Box3().setFromObject(figure),head=figure.userData.rig.headPiv.getWorldPosition(new T.Vector3());head.y+=.08;
const file=path.join(out,id+'-'+pose+'.json');fs.writeFileSync(file,JSON.stringify({id,pose,quality,positions,colors,uv,faces,materialIndices,materials,bounds,head}));
console.log(JSON.stringify({file,vertices:positions.length/3,triangles:faces.length,materials:materials.length}));
