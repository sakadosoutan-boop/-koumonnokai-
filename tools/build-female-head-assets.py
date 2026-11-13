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
OUT=ROOT/'model-preview-output/gu-fringe-v5';OUT.mkdir(parents=True,exist_ok=True)
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
 # Refine the profile while retaining the source facial topology.
 x*=1-.18*gauss(y+.058,.032)*smooth(-.120,-.067,y)
 x*=1-.15*smooth(-.082,-.168,y)
 y+=.009*gauss(y+.073,.025)*smooth(.015,.053,z)
 x*=1-.30*gauss(x,.019)*gauss(y+.010,.021)*smooth(.042,.071,z)
 z-=.0038*gauss(x,.014)*gauss(y+.013,.017)*smooth(.049,.073,z)
 z-=.0035*gauss(x,.025)*gauss(y+.040,.016)*smooth(.040,.065,z)
 # Soften the transition under the mouth and fill the lower cheek plane.
 z+=.0018*gauss(abs(x)-.034,.015)*gauss(y+.052,.021)*smooth(.025,.055,z)
 z+=.0012*gauss(x,.020)*gauss(y+.060,.009)*smooth(.035,.060,z)
 return Vector((x,y,z))
eyes=[]
for name in names[1:]:
 o=bpy.data.objects[name];local=female.matrix_world.inverted()@o.matrix_world.translation
 eyes.append(dict(center=list(female_canon(local)),radius=.0120*.9,scale=[1.23,1.07,1]))
record=dict(skin='e5bda4',hair='21181e',age=.02,gender='female',sourceObject=names[0],anchors=dict(eyes=eyes,hat=dict(offset=[0,0,0],scale=[1,1,1]),crown=[0,.12,-.03],chin=[0,-.067,.04],neck=[0,-.205,-.02]),lod={})
render_parts=[]
low_parts=[]
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
   c=[mix(mix(mix(base[k],rgb('c27b72')[k],blush),rgb('8b4647')[k],shadow),rgb('8d2033')[k],min(1,lip*1.35)) for k in range(3)]
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
  sweep=.018*gauss(x+.045,.040)*smooth(.012,.060,z) + .013*gauss(x-.055,.025)*smooth(.008,.034,z)
  part=.003*gauss(x-.018,.019)*smooth(.023,.052,z)
  return y-(.080-.067*smooth(.40,1.62,angle)-.060*smooth(1.60,3.14,angle)-sweep+part + .028*gauss(x-.008,.046)*smooth(.025,.055,z))
 def comb(v):
  x,y,z=v
  # Angular coordinate of a continuous swept sheet, bending rearward as
  # it descends from the off-centre part toward the temples and nape.
  theta=math.atan2(x-.018,z+.035)
  return theta + .24*math.sin(theta)*smooth(.11,-.05,y)
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
   flow=comb(v)
   # The shell is one continuous surface; broad, shallow grooves divide
   # it into swept locks and fine ridges run along those same paths.
   panel=.5+.5*math.cos(7*flow)
   groove=(1-panel)**7
   volume=.0032+.0030*gauss(v.y-.075,.050)*gauss(v.x+.025,.085)
   volume+=.0010*panel-.0007*groove+.00020*math.cos(35*flow)+.00012*math.cos(53*flow)
   volume-=.0008*gauss(v.x-.018,.014)*smooth(.024,.055,v.z)
   # Keep the closure flush where the forehead locks meet it.
   edge=smooth(0,.021,hairline(v))
   front=smooth(.005,.039,v.z)
   volume=mix(volume,.0012+(volume-.0012)*edge,front)
   vertices.append(v+n*volume)
 scalp=mesh_object('gu_parted_scalp',vertices,faces,material)
 bm=bmesh.new();bm.from_mesh(scalp.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(scalp.data);bm.free();scalp.data.update()
 set_hair_grain(scalp,[.93+.15*(.5+.5*math.cos(7*comb(v.co)))+.063*math.cos(35*comb(v.co))+.03*math.cos(53*comb(v.co)) for v in scalp.data.vertices])
 parts=[scalp]
 # The fringe's curves are drawn in the front plane, then fitted to the
 # forehead. Its edges feather into the side hair and follow the skull in depth.
 head_guide=surface_bvh(head)
 def catmull(a,b,c,d,t):
  return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
 def sample_route(route,t):
  u=t*(len(route)-1)
  i=min(int(u),len(route)-2)
  return catmull(route[max(0,i-1)],route[i],route[i+1],route[min(len(route)-1,i+2)],u-i)
 def forehead_depth(x,y):
  hit=head_guide.ray_cast(Vector((x,y,.25)),Vector((0,0,-1)),.5)[0]
  return hit.z if hit else None
 def fitted_fringe(name,knots,shade,detail=False):
  # Knot order is x, y, half width, lift at the centre of the lock.
  route=[Vector(k) for k in knots]
  rows=(len(route)-1)*(6 if quality=='high' else 4)
  columns=(16 if quality=='high' else 10) if not detail else 4
  verts=[];tones=[];faces=[]
  for j in range(rows+1):
   t=j/rows
   x,y,width,lift=sample_route(route,t)
   before=sample_route(route,max(0,t-.002))
   after=sample_route(route,min(1,t+.002))
   tangent=Vector((after[0]-before[0],after[1]-before[1])).normalized()
   cross=Vector((-tangent.y,tangent.x))
   for k in range(columns+1):
    v=k/columns
    q=2*v-1
    px,py=Vector((x,y))+cross*(q*max(.00007,width))
    depth=forehead_depth(px,py)
    if depth is None:
     # Clamp occasional samples near the silhouette onto the visible scalp.
     for shift in (.0005,.0015,.003,.004,.006):
      px-=math.copysign(shift,px)
      depth=forehead_depth(px,py)
      if depth is not None:break
    if depth is None:
     px,py=x,y
     depth=forehead_depth(x,y)
    if depth is None:
     raise ValueError(f'{name} root outside forehead at {x:.4f}, {y:.4f}')
    dome=math.sqrt(max(0,1-q*q))
    fiber=math.sin(math.tau*(v*4+.13*t+.065*math.sin(5*t)))
    base=.0011 if not detail else .0015
    verts.append((px,py,depth+base+lift*dome+.00012*fiber*dome))
    tones.append(shade+.095*dome+.075*fiber+.054*math.sin(math.tau*(v*7-.06*t)))
    if j and k:
     a=(j-1)*(columns+1)+k-1
     b=j*(columns+1)+k-1
     faces.append((a,b,b+1,a+1))
  # Projected faces all look toward the front. Select winding explicitly.
  a,b,c=(Vector(verts[i]) for i in faces[len(faces)//2][:3])
  if (b-a).cross(c-a).z<0:faces=[tuple(reversed(face)) for face in faces]
  ob=mesh_object(name,verts,faces,material)
  set_hair_grain(ob,tones);parts.append(ob)
 # Larger lock drops across the outer brow; shorter opposing lock opens the part.
 fitted_fringe('gu_fringe_sweep',[(.024,.101,.0012,.0013),(.008,.087,.007,.0030),
  (-.016,.071,.016,.0050),(-.035,.050,.016,.0055),(-.052,.030,.011,.0040),
  (-.058,.017,.0048,.0027),(-.060,.010,.0002,.0007)],1.0)
 fitted_fringe('gu_fringe_crown',[(.024,.103,.0003,.002),(.003,.097,.007,.0038),
  (-.022,.089,.012,.0058),(-.046,.075,.014,.0053),(-.061,.055,.009,.004),
  (-.061,.041,.0035,.002),(-.061,.034,.0002,.0010)],.91)
 fitted_fringe('gu_fringe_return',[(.025,.104,.0011,.0015),(.038,.087,.008,.0048),
  (.046,.068,.010,.0050),(.054,.047,.009,.0046),(.057,.035,.005,.0037),
  (.059,.026,.0022,.0026),(.060,.019,.0002,.0010)],.94)
 fitted_fringe('gu_fringe_inner_tip',[(.012,.084,.0003,.0030),(-.003,.072,.003,.0048),
  (-.023,.057,.0045,.0052),(-.039,.040,.0040,.0048),(-.051,.023,.0025,.0036),
  (-.056,.010,.0012,.0024),(-.059,.002,.0001,.0014)],1.06,True)
 # Groomed ribbon lofts have a continuous oval section, lengthwise ridges,
 # and width controls at the same knots that define their silhouette.
 def lock(name,knots,normal):
  points=[Vector(k[:3]) for k in knots]
  if name.endswith('fold'):
   for p in points:
    above=max(0,p.y-.096)
    p.y-=above*.27
    p.z-=above*.17
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
    pos=center+(width_axis*(max(w,.0002)*math.cos(a))+depth_axis*(max(d,.0002)*math.sin(a)))*ripple
    vertices.append(pos)
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
 # Layered, tapering locks sweep away from the part and follow the cheeks.
 lock('near_temple_lock',[(-.035,.074,.046,.001,.001),(-.055,.057,.046,.004,.0015),(-.067,.030,.042,.004,.0015),(-.071,.004,.040,.003,.001),(-.070,-.029,.041,.002,.001),(-.061,-.064,.045,.0002,.0002)],(0,0,1))
 lock('near_free_wisp',[(-.057,.052,.046,.001,.0005),(-.069,.023,.043,.0015,.0007),(-.073,-.011,.043,.0012,.0007),(-.067,-.044,.046,.0008,.0005),(-.057,-.067,.049,.0001,.0001)],(0,0,1))
 lock('far_temple_lock',[(.025,.078,.048,.001,.001),(.049,.064,.045,.004,.0015),(.065,.042,.039,.004,.0015),(.071,.014,.037,.003,.001),(.073,-.018,.038,.002,.001),(.067,-.052,.043,.0002,.0002)],(0,0,1))
 lock('far_free_wisp',[(.054,.052,.043,.001,.0005),(.068,.025,.039,.0015,.0007),(.074,-.005,.039,.0012,.0007),(.071,-.036,.042,.0007,.0005),(.063,-.059,.046,.0001,.0001)],(0,0,1))
 # Compact swept chignon, supported by a continuous back curtain.
 lock('raised_fold',[(-.024,.091,-.073,.013,.008),(-.020,.110,-.076,.018,.009),(-.002,.119,-.080,.020,.010),(.021,.116,-.084,.018,.009),(.031,.099,-.090,.013,.008),(.011,.087,-.094,.010,.006)],(0,0,1))
 lock('crossed_fold',[(.042,.091,-.066,.008,.006),(.030,.104,-.079,.012,.007),(.005,.108,-.091,.014,.008),(-.023,.100,-.099,.012,.007),(-.032,.087,-.101,.008,.006)],(0,0,1))
 lock('back_curtain',[(.004,.095,-.082,.023,.007),(.005,.049,-.098,.055,.009),(.001,-.021,-.090,.062,.010),(.003,-.083,-.094,.060,.009),(.014,-.139,-.100,.048,.008),(.004,-.189,-.106,.025,.006),(.001,-.216,-.103,.002,.001)],(0,0,1))
 for idx,(x,shift) in enumerate([(-.041,-.012),(-.025,.005),(-.008,-.004),(.010,.009),(.028,-.006),(.044,.012)]):
  lock('fall_%d'%idx,[(x*.5,.077,-.091,.007,.003),(x,.030,-.099,.012,.004),(x+shift*.4,-.040,-.096,.013,.005),(x+shift,-.115,-.101,.012,.004),(x+shift*.4,-.180,-.106,.009,.003),(x+shift,-.225,-.110,.001,.001)],(0,0,1))
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
   v.co.x+=d.x*.19*w
   v.co.y+=d.x*(1 if c.x>0 else -1)*.13*w
   v.co.y+=d.y*.025*w
 for v in head.data.vertices:
  for e in eyes:
   c=Vector(e['center']);d=v.co-c
   # Set a calm almond upper lid over the iris while keeping the aperture open.
   v.co.y-=.0015*gauss(d.x,.014)*gauss(d.y-.006,.0045)*smooth(.045,.060,v.co.z)
 head.data.update();pigment(head);bvh=surface_bvh(head)
 hair=hair_surface(head,mat('gu_'+quality+'_hair',rgb(record['hair']),.76),quality);pigment(hair,True)
 groom=GroomMesh()
 for side in [-1,1]:
  for k in range(42 if quality=='high' else 22):
   t=k/(41 if quality=='high' else 21);x=side*(.013+.038*t);y=.030+.004*math.sin(math.pi*t)-.002*t
   pts=[Vector((x+side*j*.0015,y-j*.00035,sample(bvh,x+side*j*.0015,y-j*.00035)+.0005)) for j in range(3)]
   groom.fibre(pts,.00058*(1-.5*t),.9)
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
    radius=.00102*math.sin(math.pi*u)**.70
    liner.fibre(rim[i-2:i+2],radius,.95,sides=5)
 eye_line=liner.object('gu_'+quality+'_upper_lashes',mat('gu_lashes',rgb('352026'),.68))
 pigment(eye_line,True)
 brow=join_parts([brow,eye_line],'gu_'+quality+'_brow')
 parts=dict(skin=head,hair=hair,brow=brow,ornament=hair_ornament(quality));record['lod'][quality]={k:export_mesh(o) for k,o in parts.items()}
 for o in parts.values():o.hide_set(True);o.hide_render=True
 if quality=='high':render_parts=list(parts.values())
 else:low_parts=list(parts.values())
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
# Review the real low-LOD geometry in the same four camera views.
for ob in render_parts:
 if ob.name.startswith('gu_high_'):ob.hide_render=True;ob.hide_set(True)
for ob in low_parts:ob.hide_render=False;ob.hide_set(False)
for name,pos in [('front',(0,0,.7)),('threequarter',(.4,.025,.55)),('side',(.7,0,.001)),('top',(.12,.6,.25))]:
 target_camera(pos,(0,-.039,-.007));bpy.context.scene.render.filepath=str(OUT/('gu-head-low-'+name+'.png'));bpy.ops.render.render(write_still=True)
for ob in low_parts:ob.hide_render=True;ob.hide_set(True)
for ob in render_parts:ob.hide_render=False;ob.hide_set(False)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source-assets/gu-head.blend'),compress=True)
print('GU_HEAD',[(q,{k:(v['v'],v['t']) for k,v in d.items()}) for q,d in record['lod'].items()])
