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
OUT=ROOT/'model-preview-output/gu-beauty-v2';OUT.mkdir(parents=True,exist_ok=True)
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
 x*=1-.18*gauss(y+.058,.032)*smooth(-.120,-.067,y)
 x*=1-.15*smooth(-.082,-.168,y)
 y+=.009*gauss(y+.073,.025)*smooth(.015,.053,z)
 x*=1-.30*gauss(x,.019)*gauss(y+.010,.021)*smooth(.042,.071,z)
 z-=.0024*gauss(x,.014)*gauss(y+.013,.017)*smooth(.049,.073,z)
 return Vector((x,y,z))
eyes=[]
for name in names[1:]:
 o=bpy.data.objects[name];local=female.matrix_world.inverted()@o.matrix_world.translation
 eyes.append(dict(center=list(female_canon(local)),radius=.0120*.9,scale=[1.23,1.07,1]))
record=dict(skin='e5bda4',hair='21181e',age=.02,gender='female',sourceObject=names[0],anchors=dict(eyes=eyes,hat=dict(offset=[0,0,0],scale=[1,1,1]),crown=[0,.12,-.03],chin=[0,-.067,.04],neck=[0,-.205,-.02]),lod={})
render_parts=[]
def pigment(ob,hair=False):
 for old in list(ob.data.color_attributes):ob.data.color_attributes.remove(old)
 a=ob.data.color_attributes.new(name='Complexion',type='BYTE_COLOR',domain='POINT');base=rgb(record['hair'] if hair else record['skin'])
 for i,v in enumerate(ob.data.vertices):
  x,y,z=v.co
  if hair:
   grain=ob.data.attributes.get('HairGrain')
   tone=grain.data[i].value if grain else 0
   c=[value*(tone or 1) for value in base]
  else:
   lip_center=-.043+.0015*gauss(abs(x)-.006,.003)
   lip=gauss(x,.019)*gauss(y-lip_center,.007)*smooth(.020,.043,z)
   blush=.13*gauss(abs(x)-.043,.021)*gauss(y+.008,.019)*smooth(.03,.07,z)
   shadow=.22*gauss(abs(x)-.034,.021)*gauss(y-.023,.008)*smooth(.040,.063,z)
   c=[mix(mix(mix(base[k],rgb('c27b72')[k],blush),rgb('8b4647')[k],shadow),rgb('94263a')[k],lip) for k in range(3)]
  a.data[i].color=(*c,1)
 n=ob.data.materials[0].node_tree.nodes;l=ob.data.materials[0].node_tree.links;node=n.new('ShaderNodeVertexColor');node.layer_name='Complexion';l.new(node.outputs['Color'],n.get('Principled BSDF').inputs['Base Color'])
def set_hair_grain(ob, tones):
 attr=ob.data.attributes.new(name='HairGrain',type='FLOAT',domain='POINT')
 attr.data.foreach_set('value',tones)

def hair_surface(head, material, quality):
 # A close-fitting scalp foundation carries the asymmetric part and temples.
 def hairline(v):
  x,y,z=v
  angle=abs(math.atan2(x,z+.020))
  sweep=.035*gauss(x+.044,.040)*smooth(.012,.060,z) + .017*gauss(x-.060,.019)*smooth(.008,.034,z)
  part=.009*gauss(x-.024,.010)*smooth(.023,.052,z)
  return y-(.077-.046*smooth(.45,1.67,angle)-.075*smooth(1.58,3.14,angle)-sweep+part)
 def comb(v):
  x,y,z=v
  return 48*math.atan2(x+.025,z+.040)+178*y+3*math.sin(y*17)
 vertices=[];faces=[]
 for f in head.data.polygons:
  poly=[(head.data.vertices[i].co.copy(),head.data.vertices[i].normal.copy()) for i in f.vertices]
  clipped=[]
  for i,(v,n) in enumerate(poly):
   a,an=poly[i-1];da=hairline(a);db=hairline(v)
   if (da>=0)!=(db>=0):
    t=da/(da-db)
    clipped.append((a.lerp(v,t),an.lerp(n,t).normalized()))
   if db>=0:clipped.append((v,n))
  if len(clipped)<3:continue
  faces.append(tuple(range(len(vertices),len(vertices)+len(clipped))))
  for v,n in clipped:
   volume=.0033+.006*gauss(v.y-.077,.043)*gauss(v.x+.032,.081)
   volume-=.0008*gauss(v.x-.024,.014)*smooth(.024,.055,v.z)
   vertices.append(v+n*(volume+.00015*math.sin(comb(v))))
 scalp=mesh_object('gu_parted_scalp',vertices,faces,material)
 bm=bmesh.new();bm.from_mesh(scalp.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(scalp.data);bm.free();scalp.data.update()
 set_hair_grain(scalp,[1+.15*math.sin(comb(v.co))+.07*math.sin(comb(v.co)*.51) for v in scalp.data.vertices])
 parts=[scalp]
 # Groomed ribbon lofts have a continuous oval section, lengthwise ridges,
 # and width controls at the same knots that define their silhouette.
 def lock(name,knots,normal):
  points=[Vector(k[:3]) for k in knots]
  if name.endswith('fold'):
   for p in points:
    above=max(0,p.y-.096)
    p.y-=above*.27
    p.z-=above*.17
  def catmull(a,b,c,d,t):
   return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
  def interpolate(values,i,t):
   return catmull(values[max(i-1,0)],values[i],values[i+1],values[min(i+2,len(values)-1)],t)
  radii=[Vector(k[3:]) for k in knots]
  preferred=Vector(normal)
  steps=(len(knots)-1)*(7 if quality=='high' else 4)
  sides=28 if quality=='high' else 16
  vertices=[];faces=[]
  for j in range(steps+1):
   u=j*(len(knots)-1)/steps;i=min(int(u),len(knots)-2);t=u-i
   center=interpolate(points,i,t)
   tangent=(interpolate(points,i,t+.003)-interpolate(points,i,t-.003)).normalized()
   width_axis=tangent.cross(preferred).normalized()
   depth_axis=width_axis.cross(tangent).normalized()
   w,d=interpolate(radii,i,t)
   for k in range(sides):
    a=math.tau*k/sides
    ripple=1+.028*math.cos(a*(9 if quality=='high' else 5)+u*.75)
    vertices.append(center+(width_axis*(max(w,.0002)*math.cos(a))+depth_axis*(max(d,.0002)*math.sin(a)))*ripple)
    if j:
     start=(j-1)*sides;next_k=(k+1)%sides
     faces.append((start+k,start+sides+k,start+sides+next_k,start+next_k))
  faces.extend([tuple(reversed(range(sides))),tuple(range(steps*sides,len(vertices)))])
  ob=mesh_object('gu_'+name,vertices,faces,material)
  bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(ob.data);bm.free()
  set_hair_grain(ob,[1+.16*math.sin(math.tau*(i%sides)*7/sides+(i//sides)*.025)
                          +.09*math.sin(math.tau*(i%sides)*3/sides) for i in range(len(vertices))])
  parts.append(ob)
 lock('near_temple_lock',[(-.050,.067,.042,.002,.002),(-.063,.038,.045,.008,.003),(-.073,.005,.038,.007,.003),(-.073,-.028,.037,.005,.002),(-.066,-.057,.042,.003,.002),(-.061,-.085,.038,.00035,.00035)],(0,0,1))
 lock('near_free_wisp',[(-.066,.030,.041,.002,.001),(-.078,-.012,.036,.002,.001),(-.075,-.047,.039,.0016,.001),(-.064,-.069,.048,.00025,.00025)],(0,0,1))
 lock('far_temple_lock',[(.059,.063,.027,.002,.001),(.067,.041,.036,.005,.003),(.072,.012,.037,.006,.003),(.076,-.021,.028,.006,.002),(.074,-.045,.032,.003,.002),(.066,-.072,.043,.00035,.00035)],(0,0,1))
 lock('far_free_wisp',[(.070,.036,.031,.001,.001),(.075,.012,.030,.002,.001),(.080,-.015,.026,.003,.0015),(.078,-.040,.031,.0013,.001),(.072,-.058,.034,.00025,.00025)],(0,0,1))
 lock('raised_fold',[(-.028,.084,-.063,.017,.012),(-.023,.117,-.065,.023,.014),(-.002,.150,-.061,.023,.015),(.018,.155,-.068,.021,.014),(.031,.144,-.077,.019,.013),(.026,.122,-.087,.020,.014),(.003,.092,-.092,.014,.010)],(0,0,1))
 lock('crossed_fold',[(.049,.096,-.049,.009,.009),(.046,.117,-.070,.016,.010),(.024,.132,-.082,.019,.014),(-.009,.133,-.092,.019,.014),(-.037,.120,-.103,.016,.013),(-.039,.098,-.109,.013,.011),(-.008,.081,-.105,.014,.011)],(0,0,1))
 lock('binding_fold',[(.050,.097,-.059,.008,.006),(.041,.113,-.071,.013,.009),(.020,.124,-.077,.015,.011),(-.008,.114,-.086,.014,.009),(-.026,.092,-.099,.008,.007)],(0,0,1))
 lock('back_curtain',[(.004,.099,-.079,.024,.008),(.005,.049,-.098,.058,.011),(.001,-.021,-.088,.067,.013),(.003,-.083,-.092,.062,.011),(.014,-.139,-.099,.048,.010),(.004,-.189,-.106,.026,.008),(.001,-.216,-.103,.003,.002)],(0,0,1))
 lock('back_fall_left',[(-.024,.100,-.083,.012,.007),(-.035,.049,-.092,.025,.012),(-.043,-.025,-.080,.030,.014),(-.045,-.097,-.081,.028,.014),(-.032,-.163,-.091,.022,.010),(-.028,-.210,-.102,.014,.006),(-.044,-.225,-.109,.005,.002),(-.046,-.229,-.111,.001,.001)],(0,0,1))
 lock('back_fall_center',[(.012,.111,-.085,.011,.006),(.010,.051,-.104,.028,.012),(.004,-.030,-.097,.032,.016),(.011,-.110,-.102,.033,.016),(-.006,-.177,-.106,.022,.011),(.014,-.223,-.103,.013,.007),(.027,-.237,-.107,.006,.002),(.033,-.241,-.109,.001,.001)],(0,0,1))
 lock('back_fall_right',[(.037,.097,-.079,.012,.007),(.040,.036,-.092,.023,.012),(.043,-.038,-.087,.025,.014),(.054,-.103,-.084,.022,.012),(.055,-.153,-.092,.022,.010),(.045,-.197,-.098,.014,.006),(.056,-.214,-.104,.005,.002),(.060,-.219,-.106,.001,.001)],(0,0,1))
 return join_parts(parts,'gu_'+quality+'_hair')
def hair_ornament(quality):
 # A cast leaf cluster pins the fold, with carved red inlay and fine drops.
 material=mat('gu_hairpin_gold',rgb('bf914b'),.38)
 material.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.48
 threads=GroomMesh()
 detailed=quality=='high'
 def strand(points,radius):
  threads.fibre([Vector(p) for p in points],radius,1,sides=6 if detailed else 5)
 strand([(.021,.107,-.086),(.043,.113,-.075),(.062,.118,-.058),(.077,.120,-.044)],.0021)
 motif=Vector((.070,.112,-.041))
 for x,y,z in [(.081,.130,-.047),(.090,.118,-.046),(.087,.104,-.041),(.078,.095,-.033),(.061,.121,-.043)]:
  tip=Vector((x,y,z));mid=(tip+motif)*.5
  offset=Vector((-(tip.y-motif.y),tip.x-motif.x,.0)).normalized()*.0038
  for side in (-1,1):
   strand([motif,mid+offset*side+Vector((0,0,.002)),tip],.00135)
  if detailed:strand([motif,mid+Vector((0,0,.003)),tip],.00075)
 for start,end in [((.078,.103,-.035),(.082,.067,-.027)),((.086,.106,-.039),(.095,.080,-.036)),((.070,.100,-.036),(.073,.079,-.026))]:
  a,b=Vector(start),Vector(end)
  strand([a,a.lerp(b,.35),a.lerp(b,.70),b] if detailed else [a,a.lerp(b,.5),b],.00065)
  strand([b+Vector((0,.002,0)),b-Vector((0,.002,0)),b-Vector((0,.007,0))],.0021)
 gold=threads.object('gu_botanical_hairpin',material)
 jewel=GroomMesh()
 jewel.fibre([motif+Vector((0,dy,.0035)) for dy in (.004,.001,-.002,-.005)],.0046,1,sides=10 if detailed else 7)
 gem=jewel.object('gu_hairpin_red_inlay',material)
 for ob,hex_color in ((gold,'cda35c'),(gem,'a03941')):
  color=ob.data.color_attributes.new(name='Complexion',type='BYTE_COLOR',domain='POINT')
  for vertex in color.data:vertex.color=(*rgb(hex_color),1)
 attr=material.node_tree.nodes.new('ShaderNodeVertexColor')
 attr.layer_name='Complexion'
 material.node_tree.links.new(attr.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 ob=join_parts([gold,gem],'gu_'+quality+'_ornament')
 for v in ob.data.vertices:v.co.y-=.007
 ob.data.update()
 return ob
for quality,level in [('high',1),('low',0)]:
 female.modifiers[0].levels=level
 ev=female.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
 head=mesh_object('gu_'+quality+'_skin',[female_canon(v.co) for v in me.vertices],[tuple(f.vertices) for f in me.polygons],mat('gu_'+quality+'_skin',rgb(record['skin']),.5));ev.to_mesh_clear()
 trim_neck(head)
 for v in head.data.vertices:
  for e in eyes:
   c=Vector(e['center']);d=v.co-c;w=gauss(d.x,.022)*gauss(d.y,.017)*smooth(.025,.050,v.co.z)
   v.co.x+=d.x*.22*w
   v.co.y+=d.x*(1 if c.x>0 else -1)*.09*w
   v.co.y+=d.y*.10*w
 for v in head.data.vertices:
  for e in eyes:
   c=Vector(e['center']);d=v.co-c
   # Set a calm almond upper lid over the iris while keeping the aperture open.
   v.co.y-=.0011*gauss(d.x,.014)*gauss(d.y-.006,.0045)*smooth(.045,.060,v.co.z)
 head.data.update();pigment(head);bvh=surface_bvh(head)
 hair=hair_surface(head,mat('gu_'+quality+'_hair',rgb(record['hair']),.76),quality);pigment(hair,True)
 groom=GroomMesh()
 for side in [-1,1]:
  for k in range(30 if quality=='high' else 16):
   t=k/(29 if quality=='high' else 15);x=side*(.013+.038*t);y=.032+.006*math.sin(math.pi*t)-.003*t
   pts=[Vector((x+side*j*.0015,y-j*.00035,sample(bvh,x+side*j*.0015,y-j*.00035)+.0005)) for j in range(3)]
   groom.fibre(pts,.00045*(1-.5*t),.9)
 brow=groom.object('gu_'+quality+'_brow',mat('gu_'+quality+'_brow',rgb(record['hair']),.7));pigment(brow,True)
 # Follow the actual upper globe/lid contact so eyeliner follows the face at each LOD.
 liner=GroomMesh()
 for e in eyes:
  cx,cy,cz=e['center'];r=e['radius'];sx,sy,_=e['scale']
  side=1 if cx>0 else -1
  rim=[]
  for i in range(23 if quality=='high' else 13):
   x=cx+side*mix(-.0085,.0115,i/(22 if quality=='high' else 12))
   upper=0
   for j in range(42):
    y=cy-.003+j*.00035
    radial=r*r-((x-cx)/sx)**2-((y-cy)/sy)**2
    if radial>0 and cz+math.sqrt(radial)>sample(bvh,x,y):
     upper=y
   if upper:
    rim.append(Vector((x,upper+.00055,sample(bvh,x,upper+.00055)+.00065)))
  if len(rim)>5:
   end=rim[-1]
   for i in range(1,5):
    x=end.x+side*.0013*i;y=end.y+.0006*i+.00007*i*i
    rim.append(Vector((x,y,sample(bvh,x,y)+.0006)))
   for i in range(2,len(rim)-1):
    u=i/(len(rim)-1)
    radius=.00079*math.sin(math.pi*u)**.70
    liner.fibre(rim[i-2:i+2],radius,.95,sides=5)
 eye_line=liner.object('gu_'+quality+'_upper_lashes',mat('gu_lashes',rgb('352026'),.68))
 pigment(eye_line,True)
 brow=join_parts([brow,eye_line],'gu_'+quality+'_brow')
 parts=dict(skin=head,hair=hair,brow=brow,ornament=hair_ornament(quality));record['lod'][quality]={k:export_mesh(o) for k,o in parts.items()}
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
setup_render();bpy.context.scene.cycles.samples=20;bpy.context.scene.render.resolution_x=512;bpy.context.scene.render.resolution_y=640;bpy.context.scene.camera.data.ortho_scale=.465
for name,pos in [('front',(0,0,.7)),('threequarter',(.4,.025,.55)),('side',(.7,0,.001)),('top',(.12,.6,.25))]:
 target_camera(pos,(0,-.039,-.007));bpy.context.scene.render.filepath=str(OUT/('gu-head-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source-assets/gu-head.blend'),compress=True)
print('GU_HEAD',[(q,{k:(v['v'],v['t']) for k,v in d.items()}) for q,d in record['lod'].items()])
