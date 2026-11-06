"""Append Gu's genuine female CC0 head without rebuilding the eight male heads.
Blender -b --python tools/build-female-head-assets.py
Source input can be overridden with --source PATH. Existing assets are retained verbatim.
"""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
# Reuse the established canonical exporter, mesh helpers and render rig only.
ns={'__file__':str(ROOT/'tools/build-head-assets.py')}
exec((ROOT/'tools/build-head-assets.py').read_text(encoding='utf-8').split('assets={};render_objects={};base_coords={}')[0],ns)
globals().update(ns)
OUT=ROOT/'model-preview-output/gu-head';OUT.mkdir(parents=True,exist_ok=True)
source_path=ROOT.parent/'3d-runtime/human-base/human_base_meshes_bundle.blend'
if '--source' in sys.argv:source_path=Path(sys.argv[sys.argv.index('--source')+1]).resolve()
elif not source_path.exists():source_path=ROOT/'source-assets/gu-head.blend'
if source_path.resolve()==(ROOT/'source-assets/gu-head.blend').resolve():
 copy_path=OUT/'female-library-input.blend';shutil.copyfile(source_path,copy_path);source_path=copy_path
names=['GEO-body_female_realistic','GEO-body_female_realistic.eye.R','GEO-body_female_realistic.eye.L']
female_collection=bpy.data.collections.new('FEMALE_SOURCE_CC0_UNMODIFIED');bpy.context.scene.collection.children.link(female_collection)
with bpy.data.libraries.load(str(source_path),link=False) as (s,d):d.objects=names[:]
for o in d.objects:female_collection.objects.link(o);o.hide_render=True;o.hide_set(True)
bpy.context.view_layer.update()
female=bpy.data.objects[names[0]]
def female_canon(v):
 x,y,z=v.x*.90,(v.z-1.5144)*.90,-v.y*.90-.045
 # Retain the actual female topology; gently refine jaw and nasal breadth.
 x*=1-.045*gauss(y+.050,.035)
 x*=1-.10*gauss(x,.016)*gauss(y+.010,.028)*smooth(.045,.070,z)
 return Vector((x,y,z))
eyes=[]
for name in names[1:]:
 o=bpy.data.objects[name];local=female.matrix_world.inverted()@o.matrix_world.translation
 eyes.append(dict(center=list(female_canon(local)),radius=.0120*.9,scale=[1.20,1.04,1]))
record=dict(skin='e2b99e',hair='181316',age=.02,gender='female',sourceObject=names[0],anchors=dict(eyes=eyes,hat=dict(offset=[0,0,0],scale=[1,1,1]),crown=[0,.12,-.03],chin=[0,-.074,.04],neck=[0,-.205,-.02]),lod={})
render_parts=[]
def pigment(ob,hair=False):
 for old in list(ob.data.color_attributes):ob.data.color_attributes.remove(old)
 a=ob.data.color_attributes.new(name='Complexion',type='BYTE_COLOR',domain='POINT');base=rgb(record['hair'] if hair else record['skin'])
 for i,v in enumerate(ob.data.vertices):
  x,y,z=v.co
  if hair:c=base
  else:
   lip=gauss(x,.018)*gauss(y+.043,.0090)*smooth(.015,.035,z)
   blush=.13*gauss(abs(x)-.043,.021)*gauss(y+.008,.019)*smooth(.03,.07,z)
   c=[mix(mix(base[k],rgb('c27b72')[k],blush),rgb('a3283e')[k],lip*.98) for k in range(3)]
  a.data[i].color=(*c,1)
 n=ob.data.materials[0].node_tree.nodes;l=ob.data.materials[0].node_tree.links;node=n.new('ShaderNodeVertexColor');node.layer_name='Complexion';l.new(node.outputs['Color'],n.get('Principled BSDF').inputs['Base Color'])
def hair_surface(head,ma,quality):
 def line(v):
  x,y,z=v;angle=abs(math.atan2(x,z+.02))
  return y-(.080-.041*smooth(.45,1.55,angle)-.097*smooth(1.55,3.14,angle)+.005*gauss(x-.020,.028)*smooth(.035,.065,z))
 vv=[];ff=[]
 for f in head.data.polygons:
  poly=[(head.data.vertices[i].co.copy(),head.data.vertices[i].normal.copy()) for i in f.vertices];out=[]
  for i,(v,n) in enumerate(poly):
   a,an=poly[i-1];da=line(a);db=line(v)
   if (da>=0)!=(db>=0):
    t=da/(da-db);out.append((a.lerp(v,t),an.lerp(n,t).normalized()))
   if db>=0:out.append((v,n))
  if len(out)<3:continue
  ids=[]
  for v,n in out:ids.append(len(vv));vv.append(v+n*.0028)
  ff.append(tuple(ids))
 ob=mesh_object('gu_swept_hair',vv,ff,ma)
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();ob.data.update()
 parts=[ob];g=GroomMesh();rng=random.Random(35)
 # Rooted combed strands conform to the female scalp, swept towards the rear crown.
 bvh=surface_bvh(ob);center=Vector((0,.035,-.015))
 for i in range(220 if quality=='high' else 90):
  a=rng.uniform(-math.pi,math.pi);h=rng.uniform(.02,.12);root=Vector((.09*math.sin(a),h,.08*math.cos(a)-.02));hit=bvh.find_nearest(root)
  if not hit[0]:continue
  start=hit[0];target=Vector((start.x*.25,.118,-.044));pts=[]
  for j in range(7):
   t=j/6;p=start.lerp(target,t);near=bvh.find_nearest(p);pts.append(near[0]+near[1]*.0006 if near[0] else p)
  g.fibre(pts,.00032 if quality=='high' else .0005,.8+rng.random()*.6)
 # High rear bun is an authored compact coil seated directly in the scalp.
 vv=[];ff=[];N=56 if quality=='high' else 32;R=24 if quality=='high' else 16
 for j in range(R+1):
  p=math.pi*j/R
  for i in range(N):
   a=math.tau*i/N;r=1+.035*math.sin(a*13+p*8)
   vv.append((.034*math.sin(p)*math.cos(a)*r,.127+.033*math.cos(p),-.062+.033*math.sin(p)*math.sin(a)*r))
   if j:ff.append(((j-1)*N+i,(j-1)*N+(i+1)%N,j*N+(i+1)%N,j*N+i))
 parts.append(mesh_object('gu_high_coiled_bun',vv,ff,ma))
 for i in range(56 if quality=='high' else 24):
  a=math.tau*i/(56 if quality=='high' else 24);pts=[]
  for j in range(17):
   p=.10+(math.pi-.20)*j/16;ang=a+.7*p
   pts.append(Vector((.0348*math.sin(p)*math.cos(ang),.127+.0335*math.cos(p),-.062+.0338*math.sin(p)*math.sin(ang))))
  g.fibre(pts,.00042,.9)
 parts.append(g.object('gu_swept_hair_fibres',ma));return join_parts(parts,'gu_'+quality+'_hair')
for quality,level in [('high',1),('low',0)]:
 female.modifiers[0].levels=level
 ev=female.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
 head=mesh_object('gu_'+quality+'_skin',[female_canon(v.co) for v in me.vertices],[tuple(f.vertices) for f in me.polygons],mat('gu_'+quality+'_skin',rgb(record['skin']),.5));ev.to_mesh_clear()
 trim_neck(head)
 for v in head.data.vertices:
  for e in eyes:
   c=Vector(e['center']);d=v.co-c;w=gauss(d.x,.022)*gauss(d.y,.017)*smooth(.025,.050,v.co.z)
   v.co.x+=d.x*.20*w;v.co.y+=d.y*.04*w
 for v in head.data.vertices:
  for e in eyes:
   c=Vector(e['center']);d=v.co-c
   # Set a calm almond upper lid over the iris while keeping the aperture open.
   v.co.y-=.0018*gauss(d.x,.014)*gauss(d.y-.006,.004)*smooth(.045,.060,v.co.z)
 head.data.update();pigment(head);bvh=surface_bvh(head)
 hair=hair_surface(head,mat('gu_'+quality+'_hair',rgb(record['hair']),.65),quality);pigment(hair,True)
 groom=GroomMesh()
 for side in [-1,1]:
  for k in range(30 if quality=='high' else 16):
   t=k/(29 if quality=='high' else 15);x=side*(.013+.040*t);y=.033+.007*math.sin(math.pi*t)-.003*t
   pts=[Vector((x+side*j*.0015,y-j*.00035,sample(bvh,x+side*j*.0015,y-j*.00035)+.0005)) for j in range(3)]
   groom.fibre(pts,.00045*(1-.5*t),.9)
 brow=groom.object('gu_'+quality+'_brow',mat('gu_'+quality+'_brow',rgb(record['hair']),.7));pigment(brow,True)
 parts=dict(skin=head,hair=hair,brow=brow);record['lod'][quality]={k:export_mesh(o) for k,o in parts.items()}
 for o in parts.values():o.hide_set(True);o.hide_render=True
 if quality=='high':render_parts=list(parts.values())
# Append unique new pools and only Gu record; all existing packed records stay identical.
p=ROOT/'src/js/koumon-head-assets.js';prefix,payload=p.read_text(encoding='utf-8').split('window.KM_HEAD_ASSETS=',1);existing=json.loads(payload.strip().rstrip(';'))
for key in list(existing['indices']):
 if key.startswith('gu_'):del existing['indices'][key]
for key,value in list(INDEX_POOL.items()):
 new='gu_'+key;existing['indices'][new]=value
 for lod in record['lod'].values():
  for mesh in lod.values():
   if mesh['i']==key:mesh['i']=new
import importlib.util
spec=importlib.util.spec_from_file_location('codec',ROOT/'tools/pack-head-assets.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
for lod in record['lod'].values():
 for mesh in lod.values():
  enc={}
  for k in ['p','n','c']:
   raw=base64.b64decode(mesh[k]);packed=codec.pack(raw,k=='p')
   if len(packed)<len(raw):mesh[k]=base64.b64encode(packed).decode();enc[k]='delta-rle-v1'
  if enc:mesh['encoding']=enc
existing['cast']['gu']=record;p.write_text(prefix+'window.KM_HEAD_ASSETS='+json.dumps(existing,separators=(',',':'))+';\n',encoding='utf-8')
render_parts+=eyes_render('gu',{},eyes)
for o in render_parts:o.hide_render=False;o.hide_set(False)
setup_render();bpy.context.scene.cycles.samples=24;bpy.context.scene.render.resolution_x=512;bpy.context.scene.render.resolution_y=640
for name,pos in [('front',(0,0,.7)),('threequarter',(.4,.025,.55)),('side',(.7,0,.001)),('top',(.12,.6,.25))]:
 target_camera(pos,(0,-.015,.005));bpy.context.scene.render.filepath=str(OUT/('gu-head-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source-assets/gu-head.blend'),compress=True)
print('GU_HEAD',[(q,{k:(v['v'],v['t']) for k,v in d.items()}) for q,d in record['lod'].items()])
