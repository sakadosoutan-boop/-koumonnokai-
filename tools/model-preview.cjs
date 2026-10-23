/* Offline geometry/material inspection; deliberately does not drive a browser.
 * Usage: node tools/model-preview.cjs [output-dir] [hai,u] [low|high] [--portraits|--clay-faces]
 * Set CANVAS_MODULE to an installed @napi-rs/canvas directory if required.
 * Lambert shading approximates material base color; no WebGL PBR, shadows,
 * normal/bump maps, antialiasing or transparency sorting is reproduced.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const {execFileSync}=require('node:child_process');
const canvasModule=process.env.CANVAS_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const {createCanvas}=require(canvasModule);
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'model-preview-output'));
const ids=(process.argv[3]||'hai,u').split(','),quality=process.argv[4]||'low';
fs.mkdirSync(out,{recursive:true});
const context={console,performance,document:{createElement(tag){if(tag!=='canvas')throw Error(tag);return createCanvas(1,1);}},setTimeout,clearTimeout};
context.window=context;vm.createContext(context);
for(const file of ['src/vendor/three.min.js','src/js/koumon-figkit.js','src/js/koumon-cast3d.js']){
  const source=process.env.MODEL_REF?execFileSync('git',['show',process.env.MODEL_REF+':'+file],{cwd:root,encoding:'utf8',maxBuffer:10000000}):fs.readFileSync(path.join(root,file),'utf8');
  vm.runInContext(source,context,{filename:file});
}
const T=context.THREE,V=T.Vector3;
context.KM_CAST3D.setQuality(quality);
const textureCache=new Map(),linear=Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});
function srgb(c){c=Math.max(0,Math.min(1,c));return Math.round(255*(c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055));}
function textureData(t){
  if(!t||!t.image)return null;
  if(textureCache.has(t))return textureCache.get(t);
  const im=t.image;let data;
  if(im.getContext)data=im.getContext('2d').getImageData(0,0,im.width,im.height).data;
  else if(im.data)data=im.data;
  else return null;
  const r={data,w:im.width,h:im.height,srgb:t.encoding===T.sRGBEncoding};textureCache.set(t,r);return r;
}
function collect(object){
  object.updateMatrixWorld(true);const meshes=[];let triangles=0,vertices=0;
  object.traverseVisible(m=>{
    if(!m.isMesh)return;
    const g=m.geometry,p=g.attributes.position;if(!p)return;
    if(!g.attributes.normal)g.computeVertexNormals();
    const n=g.attributes.normal,c=g.attributes.color,uv=g.attributes.uv,fw=g.attributes.frontW;
    for(let instance=0;instance<(m.isInstancedMesh?m.count:1);instance++){
    const world=m.matrixWorld.clone(),instanceColor=new T.Color(1,1,1);
    if(m.isInstancedMesh){const local=new T.Matrix4();m.getMatrixAt(instance,local);world.multiply(local);if(m.instanceColor)m.getColorAt(instance,instanceColor);}
    const normalMatrix=new T.Matrix3().getNormalMatrix(world),positions=new Float32Array(p.count*3),normals=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
      const v=new V().fromBufferAttribute(p,i).applyMatrix4(world),q=new V().fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
      if(![v.x,v.y,v.z,q.x,q.y,q.z].every(Number.isFinite))throw Error('Non-finite geometry '+m.name);
      positions.set([v.x,v.y,v.z],i*3);normals.set([q.x,q.y,q.z],i*3);
    }
    const indices=g.index?g.index.array:Uint32Array.from({length:p.count},(_,i)=>i);
    for(const i of indices)if(i>=p.count)throw Error('Invalid index');
    const materials=Array.isArray(m.material)?m.material:[m.material];
    const groups=Array.isArray(m.material)&&g.groups.length?g.groups:[{start:0,count:indices.length,materialIndex:0}];
    meshes.push({positions,normals,indices,c,uv,fw,materials,groups,instanceColor});vertices+=p.count;triangles+=indices.length/3;
    }
  });return {meshes,vertices,triangles};
}
function render(model,center,span,angles,width,height){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height),data=image.data;
  for(let i=0;i<data.length;i+=4){data[i]=235;data[i+1]=232;data[i+2]=225;data[i+3]=255;}
  const depth=new Float32Array(width*height);depth.fill(-Infinity);
  const yaw=angles[0]*Math.PI/180,pitch=angles[1]*Math.PI/180,toward=new V(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  const right=new V().crossVectors(new V(0,1,0),toward).normalize(),up=new V().crossVectors(toward,right).normalize();
  const light=toward.clone().multiplyScalar(.7).add(up.clone().multiplyScalar(.8)).add(right.clone().multiplyScalar(-.5)).normalize();
  const scale=height/span;
  for(const m of model.meshes){
    const p=m.positions,n=m.normals,count=p.length/3,screen=new Float32Array(count*3),illum=new Float32Array(count);
    for(let i=0;i<count;i++){
      const v=new V(p[i*3]-center.x,p[i*3+1]-center.y,p[i*3+2]-center.z);
      screen[i*3]=width/2+v.dot(right)*scale;screen[i*3+1]=height/2-v.dot(up)*scale;screen[i*3+2]=v.dot(toward);
      illum[i]=.38+.62*Math.max(0,n[i*3]*light.x+n[i*3+1]*light.y+n[i*3+2]*light.z);
    }
    for(const group of m.groups){
      const mat=m.materials[group.materialIndex];if(!mat||mat.visible===false||mat.opacity<.25)continue;
      const tex=textureData(mat.map),base=mat.color||{r:1,g:1,b:1},end=Math.min(m.indices.length,group.start+group.count);
      for(let t=group.start;t<end;t+=3){
        const a=m.indices[t],b=m.indices[t+1],c=m.indices[t+2],ax=screen[a*3],ay=screen[a*3+1],bx=screen[b*3],by=screen[b*3+1],cx=screen[c*3],cy=screen[c*3+1];
        const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-8)continue;
        const minx=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxx=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx))),miny=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxy=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
        for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
          const wa=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/den,wb=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/den,wc=1-wa-wb;
          if(wa<0||wb<0||wc<0)continue;
          const z=wa*screen[a*3+2]+wb*screen[b*3+2]+wc*screen[c*3+2],pixel=y*width+x;if(z<=depth[pixel])continue;
          let r=base.r*m.instanceColor.r,g=base.g*m.instanceColor.g,bl=base.b*m.instanceColor.b;
          if(mat.vertexColors&&m.c){r*=wa*m.c.getX(a)+wb*m.c.getX(b)+wc*m.c.getX(c);g*=wa*m.c.getY(a)+wb*m.c.getY(b)+wc*m.c.getY(c);bl*=wa*m.c.getZ(a)+wb*m.c.getZ(b)+wc*m.c.getZ(c);}
          if(tex&&m.uv){
            let u=wa*m.uv.getX(a)+wb*m.uv.getX(b)+wc*m.uv.getX(c),v=wa*m.uv.getY(a)+wb*m.uv.getY(b)+wc*m.uv.getY(c);
            u=u*mat.map.repeat.x+mat.map.offset.x;v=v*mat.map.repeat.y+mat.map.offset.y;
            u=mat.map.wrapS===T.RepeatWrapping?u-Math.floor(u):Math.max(0,Math.min(1,u));v=mat.map.wrapT===T.RepeatWrapping?v-Math.floor(v):Math.max(0,Math.min(1,v));
            if(mat.map.flipY)v=1-v;
            const q=(Math.min(tex.h-1,Math.floor(v*tex.h))*tex.w+Math.min(tex.w-1,Math.floor(u*tex.w)))*4,alpha=tex.data[q+3]/255;
            if(mat.alphaTest&&alpha<mat.alphaTest)continue;
            const w=m.fw?wa*m.fw.getX(a)+wb*m.fw.getX(b)+wc*m.fw.getX(c):1;
            r*=1-w+w*(tex.srgb?linear[tex.data[q]]:tex.data[q]/255);g*=1-w+w*(tex.srgb?linear[tex.data[q+1]]:tex.data[q+1]/255);bl*=1-w+w*(tex.srgb?linear[tex.data[q+2]]:tex.data[q+2]/255);
          }
          const shade=wa*illum[a]+wb*illum[b]+wc*illum[c];depth[pixel]=z;data[pixel*4]=srgb(r*shade);data[pixel*4+1]=srgb(g*shade);data[pixel*4+2]=srgb(bl*shade);
        }
      }
    }
  }
  ctx.putImageData(image,0,0);return canvas;
}
const views=[['Front',0,0],['Side',90,0],['Three-quarter',35,8],['Overhead',35,35]],report=[];
const clayFaces=process.argv.includes('--clay-faces');
const portraitsOnly=process.argv.includes('--portraits')&&!clayFaces;
const portraits=portraitsOnly?createCanvas(1440,Math.ceil(ids.length/4)*420):null;
const claySheet=clayFaces?createCanvas(1920,Math.ceil(ids.length/4)*440):null;
const names={hai:'Liu Bang',u:'Xiang Yu',ryo:'Zhang Liang',zo:'Fan Zeng',haku:'Xiang Bo',kai:'Fan Kuai',sou:'Xiang Zhuang',chin:'Chen Ping'};
for(const id of ids){
  if(clayFaces){
    const started=performance.now(),K=context.KM_FIGKIT;
    const P=Object.assign({},context.KM_CAST3D.CAST[id].head,{beard:'none',scalp:null,eboshi:false});
    // Match runtime head resolution and preserve its complete face/morph parameters.
    const built=K.buildHead(K.Res(),P,quality==='high'?'medium':'low'),face=new T.Group();
    // Use the exact runtime portrait warp before stripping decorative meshes.
    if(context.KM_CAST3D.sculptPortrait)context.KM_CAST3D.sculptPortrait(built.group,P);
    for(const mesh of built.group.children.slice(0,2)){
      mesh.material=mesh.material.clone();mesh.material.map=null;mesh.material.bumpMap=null;
      mesh.material.vertexColors=false;mesh.material.color.setHex(0x999999);face.add(mesh);
    }
    const model=collect(face),box=new T.Box3().setFromObject(face),pc=claySheet.getContext('2d');
    const i=ids.indexOf(id),x=i%4*480,y=Math.floor(i/4)*440;
    pc.fillStyle='#ebe8e1';pc.fillRect(x,y,480,440);
    [[0,0],[35,8]].forEach((angle,j)=>pc.drawImage(render(model,new V(0,-.005,.01),.36,angle,240,370),x+j*240,y+45));
    pc.fillStyle='#262a2a';pc.font='18px sans-serif';pc.fillText(names[id]||id,x+12,y+24);
    pc.font='12px sans-serif';pc.fillText('Front / same scale',x+12,y+42);pc.fillText('Three-quarter / same scale',x+252,y+42);
    pc.fillText('Uniform clay / CPU geometry preview / not WebGL',x+12,y+432);
    const entry={id,quality,vertices:model.vertices,triangles:model.triangles,bounds:box,seconds:Math.round((performance.now()-started)/100)/10};
    report.push(entry);console.log(JSON.stringify(entry));continue;
  }
  const started=performance.now(),figure=context.KM_CAST3D.makeFigure(id);figure.userData.update(0,0);figure.updateMatrixWorld(true);
  const model=collect(figure),box=new T.Box3().setFromObject(figure),center=box.getCenter(new V()),span=box.max.y-box.min.y;
  const head=figure.userData.rig.headPiv.getWorldPosition(new V());head.y+=.08;
  if(portraitsOnly){
    const pc=portraits.getContext('2d'),i=ids.indexOf(id),x=i%4*360,y=Math.floor(i/4)*420;
    pc.fillStyle='#ebe8e1';pc.fillRect(x,y,360,420);
    pc.drawImage(render(model,head,.48,[25,4],360,370),x,y+35);
    pc.fillStyle='#262a2a';pc.font='18px sans-serif';pc.fillText(names[id]||id,x+12,y+25);
    pc.font='12px sans-serif';pc.fillText('CPU geometry preview / not WebGL',x+12,y+414);
  }else{
  const sheet=createCanvas(1440,1120),s=sheet.getContext('2d');s.fillStyle='#ebe8e1';s.fillRect(0,0,1440,1120);
  for(let i=0;i<views.length;i++){
    const [name,yaw,pitch]=views[i];s.drawImage(render(model,center,span*1.12,[yaw,pitch],360,690),i*360,35);
    s.drawImage(render(model,head,.56,[yaw,pitch],360,360),i*360,745);
    s.fillStyle='#262a2a';s.font='18px sans-serif';s.fillText(id+' / '+name,i*360+12,25);s.fillText('Head / CPU preview (not WebGL)',i*360+12,738);
  }
  fs.writeFileSync(path.join(out,id+'-'+quality+'.png'),sheet.toBuffer('image/png'));
  }
  const entry={id,quality,vertices:model.vertices,triangles:model.triangles,bounds:box,seconds:Math.round((performance.now()-started)/100)/10};report.push(entry);console.log(JSON.stringify(entry));
}
if(portraitsOnly)fs.writeFileSync(path.join(out,'portraits-'+quality+'.png'),portraits.toBuffer('image/png'));
if(clayFaces)fs.writeFileSync(path.join(out,'clay-faces-'+quality+'.png'),claySheet.toBuffer('image/png'));
fs.writeFileSync(path.join(out,clayFaces?'clay-report.json':'report.json'),JSON.stringify({generatedAt:new Date().toISOString(),renderer:'CPU Lambert; not runtime WebGL',models:report},null,2));
