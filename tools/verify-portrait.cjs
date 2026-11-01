/* Inspect actual runtime face/eye geometry. Measures visibility, not likeness.
 * node tools/verify-portrait.cjs [output.json] [--head-assets=prototype.js]
 * Eye openings are ray-tested against skin and eyes, with no browser needed.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require(process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas'));
const root=path.resolve(__dirname,'..'),assetArg=process.argv.find(a=>a.startsWith('--head-assets='));
const C={console,document:{createElement:()=>createCanvas(1,1)},atob:s=>Buffer.from(s,'base64').toString('binary')};C.window=C;vm.createContext(C);
for(const file of ['src/vendor/three.min.js','src/js/koumon-head-assets.js','src/js/koumon-heads.js']){
  const source=file.endsWith('head-assets.js')&&assetArg?path.resolve(assetArg.slice(14)):path.join(root,file);
  vm.runInContext(fs.readFileSync(source,'utf8'),C,{filename:file});
}
const T=C.THREE,V=T.Vector3,ray=new T.Raycaster(),rows=[];
for(const quality of ['low','high'])for(const id of Object.keys(C.KM_HEAD_ASSETS.cast)){
  const h=C.KM_HEADS.build(id,{},quality);h.group.updateMatrixWorld(true);
  const p=h.surface.geometry.attributes.position,skin=[];
  for(let i=0;i<p.count;i++)skin.push(new V().fromBufferAttribute(p,i));
  function width(lo,hi){const band=skin.filter(v=>v.y>=lo&&v.y<=hi&&v.z>.015&&Math.abs(v.x)<.085);return band.length?Math.max(...band.map(v=>v.x))-Math.min(...band.map(v=>v.x)):null;}
  const eyes=[];
  for(const anchor of h.anchors.eyes){
    const [x,y]=anchor.center,scan=[];
    for(let i=0;i<=96;i++){
      const py=y-.012+i*.024/96;
      ray.set(new V(x,py,.3),new V(0,0,-1));
      const hits=ray.intersectObjects([h.surface,h.eyes],true),hit=hits[0];
      if(hit&&hit.object.userData.part==='eyes')scan.push(py);
    }
    eyes.push({center:anchor.center,visibleVerticalSpan:scan.length?Math.max(...scan)-Math.min(...scan):0,visibleSamples:scan.length});
  }
  // Independently sample the indexed skin, rather than trusting exported or
  // runtime helper coordinates to validate themselves.
  ray.set(new V(0,-.038,.3),new V(0,0,-1));
  const lip=ray.intersectObject(h.surface,false)[0];
  if(!lip)throw Error(id+'/'+quality+' actual outer lip ray missed');
  const anchor=new V().fromArray(h.anchors.mouth),mouth={anchor:anchor.toArray(),surface:lip.point.toArray(),surfaceGap:anchor.distanceTo(lip.point)};
  if(mouth.surfaceGap>.001)throw Error(id+'/'+quality+' mouth anchor is not on the actual skin within one millimetre');
  const bounds={};
  h.group.traverseVisible(o=>{if(!o.isMesh)return;const part=o.userData.part||'other';const box=new T.Box3().setFromObject(o);if(!bounds[part])bounds[part]=new T.Box3();bounds[part].union(box);});
  const row={id,quality,skinVertices:p.count,cheekWidth:width(-.020,.015),jawWidth:width(-.065,-.040),eyes,mouth,bounds};
  if(eyes.some(e=>e.visibleSamples<2))throw Error(id+'/'+quality+' eye is fully occluded by skin');
  rows.push(row);console.log(JSON.stringify({id,quality,eyeOpeningsMillimetres:eyes.map(e=>Math.round(e.visibleVerticalSpan*1e5)/100),cheekWidth:row.cheekWidth,jawWidth:row.jawWidth,mouthSurfaceGapMillimetres:mouth.surfaceGap*1000}));
}
const out=path.resolve(process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:'model-preview-output/portrait-geometry.json');fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({validation:'Actual skin/eye ray intersections, independent outer-lip surface rays and mesh bounds; does not measure likeness or PBR appearance',rows},null,2));
