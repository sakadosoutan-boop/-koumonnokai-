/* Verify runtime garment geometry across every cast member and required pose.
 * The test exercises the actual dynamic sleeve and cloak deformations. It does
 * not claim physical cloth simulation or replace multiview contact inspection.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{performance}=require('node:perf_hooks');
const {createCanvas}=require(process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas'));
const root=path.resolve(__dirname,'..'),context={console,performance,document:{createElement(){return createCanvas(1,1);}}};context.window=context;vm.createContext(context);
for(const file of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-head-assets.js','src/js/koumon-heads.js','src/js/koumon-hand-assets.js','src/js/koumon-hands.js','src/js/koumon-costume.js','src/js/koumon-cast3d.js']){if(fs.existsSync(path.join(root,file)))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}
const K=context.KM_CAST3D,poses=['stand','sit','kneel','raise','dance','strike','drink','glare','charge','down','run','eat'],report=[];
for(const quality of ['low','high']){
  K.setQuality(quality);
  for(const id of Object.keys(K.CAST)){
    const figure=K.makeFigure(id);
    for(const pose of poses){
      figure.userData.setPose(pose);figure.userData.update(.016,.7);figure.updateMatrixWorld(true);let meshes=0,vertices=0;
      figure.traverseVisible(o=>{
        if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position;meshes++;vertices+=p.count;
        for(const value of o.matrixWorld.elements)if(!Number.isFinite(value))throw Error(`${quality}/${id}/${pose}/${o.name}: non-finite transform`);
        for(const name of ['position','normal','color','uv']){const a=g.attributes[name];if(!a)continue;for(const value of a.array)if(!Number.isFinite(value))throw Error(`${quality}/${id}/${pose}/${o.name}: non-finite ${name}`);}
        if(g.index)for(const i of g.index.array)if(i>=p.count)throw Error(`${quality}/${id}/${pose}/${o.name}: invalid mesh index`);
      });report.push({quality,id,pose,meshes,geometryVertices:vertices});
    }
  }
}
const output=path.join(root,'model-preview-output/costume-rebuild/geometry-audit.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),validation:'Finite runtime mesh attributes, index bounds and world transforms across all cast/poses. Visual contact checked separately.',cases:report.length,results:report},null,2));
console.log(JSON.stringify({cases:report.length,cast:Object.keys(K.CAST).length,poses:poses.length,lods:2,output}));
