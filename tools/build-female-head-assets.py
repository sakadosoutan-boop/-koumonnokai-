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
OUT=ROOT/'model-preview-output/gu-neck-repair-nov18';OUT.mkdir(parents=True,exist_ok=True)
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
 # The original CC0 mesh supplies the continuous cheek and jaw in all views.
 # Keep the proportional shortening gradual from orbit to upper neck.
 lower_face=smooth(.010,-.077,y)*smooth(-.163,-.092,y)
 y+=.006*lower_face
 # Taper below the mouth only, then blend the adjustment out under the jaw.
 jaw=smooth(-.042,-.065,y)*smooth(-.135,-.095,y)
 x*=1-.035*jaw
 chin=smooth(-.039,-.072,y)*smooth(-.114,-.086,y)
 y+=.0035*chin
 z-=.0014*gauss(x,.023)*gauss(y+.064,.017)*smooth(.020,.046,z)
 z+=.0009*gauss(abs(x)-.038,.013)*gauss(y+.051,.017)*smooth(.023,.060,z)
 # Shape the neck below the jaw, where the skin meets the costume collar.
 x*=1-.12*smooth(-.085,-.161,y)
 # Preserve the source neck/clavicle topology, placing its widening below the
 # neckline instead of extruding the jaw cut into a long polygonal column.
 neck=smooth(-.075,-.135,y)
 y-=.065*neck
 x*=1-.18*gauss(y+.116,.036)*smooth(-.073,-.098,y)
 # Keep nose and mouth refinements local to the central features.
 nose=gauss(y+.010,.021)*smooth(.042,.071,z)
 x*=1-.18*gauss(x,.022)*nose
 # Use a broad transition from the bridge through the tip and into each wing.
 nose_tip=gauss(x,.016)*gauss(y+.015,.014)*smooth(.057,.075,z)
 y-=.0024*nose_tip
 y-=.0012*gauss(abs(x)-.012,.006)*gauss(y+.016,.007)*smooth(.055,.074,z)
 z-=.0008*gauss(abs(x)-.013,.009)*gauss(y+.020,.013)*smooth(.044,.065,z)
 z-=.0060*gauss(x,.018)*gauss(y+.013,.020)*smooth(.049,.073,z)
 z-=.0022*gauss(x,.018)*gauss(y+.040,.012)*smooth(.042,.068,z)
 z+=.0008*gauss(x,.011)*gauss(y+.045,.0045)*smooth(.037,.056,z)
 y+=.0014*gauss(abs(x)-.016,.010)*gauss(y+.041,.010)*smooth(.030,.052,z)
 return Vector((x,y,z))

def retain_anatomical_neck(ob):
 bm=bmesh.new();bm.from_mesh(ob.data)
 end=-.205
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,end,0),plane_no=(0,1,0),clear_inner=True)
 edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.y-end)<.00001 for v in e.verts)]
 bmesh.ops.holes_fill(bm,edges=edges,sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(ob.data);bm.free();ob.data.update()

def relax_face_planes(head):
 # Ease short ridges on the cheek-to-jaw and upper alar surfaces.
 # Keep the lip seam, nostril rims and lids outside the smoothing masks.
 positions=[v.co.copy() for v in head.data.vertices]
 neighbors=[[] for _ in positions]
 for edge in head.data.edges:
  a,b=edge.vertices;neighbors[a].append(b);neighbors[b].append(a)
 for v,point,adjacent in zip(head.data.vertices,positions,neighbors):
  x,y,z=point
  cheek=gauss(abs(x)-.041,.014)*gauss(y+.051,.021)*smooth(.022,.039,abs(x))*smooth(.022,.050,z)
  alar=gauss(abs(x)-.017,.007)*gauss(y+.012,.010)*smooth(-.022,-.013,y)*smooth(.055,.075,z)
  weight=.66*max(cheek,alar)
  if weight<.005 or not adjacent:continue
  average=sum((positions[i] for i in adjacent),Vector((0,0,0)))/len(adjacent)
  offset=(average-point)*weight
  if offset.length>.00048:offset.length=.00048
  v.co=point+offset

eyes=[]
for name in names[1:]:
 o=bpy.data.objects[name];local=female.matrix_world.inverted()@o.matrix_world.translation
 eyes.append(dict(center=list(female_canon(local)),radius=.0120*.9,scale=[1.23,1.07,1]))
record=dict(skin='e5bda4',hair='21181e',age=.02,gender='female',sourceObject=names[0],anchors=dict(eyes=eyes,hat=dict(offset=[0,0,0],scale=[1,1,1]),crown=[0,.12,-.03],chin=[0,-.067,.04],neck=[0,-.205,-.02]),lod={})
render_parts=[]
low_parts=[]
def pigment(ob,hair=False,tint=None):
 for old in list(ob.data.color_attributes):ob.data.color_attributes.remove(old)
 a=ob.data.color_attributes.new(name='Complexion',type='BYTE_COLOR',domain='POINT');base=rgb(tint or record['hair' if hair else 'skin'])
 for i,v in enumerate(ob.data.vertices):
  x,y,z=v.co
  if hair:
   grain=ob.data.attributes.get('HairGrain')
   tone=grain.data[i].value if grain else 0
   c=[value*(tone or 1) for value in base]
  else:
   lip_center=-.0375+.0015*gauss(abs(x)-.006,.003)+.0010*gauss(abs(x)-.016,.008)
   lip=gauss(x,.017)*gauss(y-lip_center,.006)*smooth(.020,.043,z)
   blush=.19*gauss(abs(x)-.041,.018)*gauss(y+.009,.018)*smooth(.029,.066,z)
   shadow=.30*gauss(abs(x)-.034,.022)*gauss(y-.019,.010)*smooth(.040,.063,z)
   c=[mix(mix(mix(base[k],rgb('cf827d')[k],blush),rgb('a65c62')[k],shadow),rgb('a74758')[k],min(1,lip*1.10)) for k in range(3)]
   mark=gauss(x,.0021)*gauss(y-.048,.0030)*smooth(.040,.064,z)
   for k in range(3):c[k]=mix(c[k],rgb('a84a50')[k],.65*mark)

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
  sweep=.009*gauss(abs(x)-.057,.019)*smooth(.012,.060,z)
  part=.004*gauss(x,.013)*smooth(.023,.052,z)
  # Lower the frontal part and carry the rear hairline down behind the ear.
  nape=.041*smooth(-.013,-.054,z)
  # Draw the underlayer closer to the back of the ear before it meets the fall.
  nape+=.012*gauss(z+.043,.018)*smooth(.040,.064,abs(x))
  ear=.014*gauss(z+.008,.012)*smooth(.057,.077,abs(x))
  bridge=.008*gauss(x+.055,.018)*smooth(.026,.056,z)
  return y-(.080-.067*smooth(.40,1.62,angle)-.060*smooth(1.60,3.14,angle)-sweep+part
            -.004*gauss(x-.008,.046)*smooth(.025,.055,z)-nape+ear-bridge)
 def comb(v):
  # Meridians around the line from the offset part to the tied back hair.
  # Adjacent locks keep their flow in depth instead of circling the head.
  x,y,z=v
  depth=smooth(.061,-.080,z)
  axis_x=mix(.020,.002,depth)
  angle=math.atan2(x-axis_x,max(.011,y+.016))
  return angle+.09*math.sin(3*angle+2.2*depth)+.19*depth
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
   panel=.5+.5*math.cos(12*flow)
   groove=(1-panel)**5
   volume=.0022+.0027*gauss(v.y-.075,.050)*gauss(v.x+.025,.085)
   volume+=.0013*panel-.00070*groove+.00016*math.cos(41*flow)+.00010*math.cos(63*flow)
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
 set_hair_grain(scalp,[.93+.19*(.5+.5*math.cos(12*comb(v.co)))+.079*math.cos(41*comb(v.co))+.037*math.cos(63*comb(v.co)) for v in scalp.data.vertices])
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
 # Paired lifted temple waves expose the forehead and meet at the central part.
 for side in (-1,1):
  fitted_fringe('gu_open_wave',[(side*.002,.085,.0005,.002),
   (side*.017,.083,.010,.008),(side*.038,.074,.015,.012),
   (side*.057,.057,.014,.011),(side*.065,.039,.009,.007),
   (side*.066,.024,.003,.004),(side*.064,.015,.0002,.001)],.98)
  fitted_fringe('gu_wave_edge',[(side*.005,.082,.0003,.003),
   (side*.026,.075,.005,.010),(side*.046,.060,.007,.013),
   (side*.060,.042,.006,.009),(side*.065,.025,.003,.005),
   (side*.064,.014,.0002,.001)],1.07,True)
 # Follow the upper scalp from the part to the bun with overlapping locks.
 # Fitting to the scalp keeps their roots and fine edges seated in the hair.
 crown_guide=surface_bvh(scalp)
 def crown_lock(name,knots,shade):
  route=[Vector(k) for k in knots]
  rows=(len(route)-1)*(7 if quality=='high' else 4)
  columns=16 if quality=='high' else 8
  verts=[];tones=[];faces=[]
  for j in range(rows+1):
   t=j/rows
   x,z,width,lift=sample_route(route,t)
   before=sample_route(route,max(0,t-.002))
   after=sample_route(route,min(1,t+.002))
   tangent=Vector((after[0]-before[0],after[1]-before[1])).normalized()
   across=Vector((-tangent.y,tangent.x))
   for k in range(columns+1):
    v=k/columns
    q=2*v-1
    px,pz=Vector((x,z))+across*(q*max(.00010,width))
    hit=crown_guide.ray_cast(Vector((px,.18,pz)),Vector((0,-1,0)),.14)[0]
    if hit is None:
     px,pz=x,z
     hit=crown_guide.ray_cast(Vector((x,.18,z)),Vector((0,-1,0)),.14)[0]
    if hit is None:raise ValueError(f'{name} outside crown at {x:.4f}, {z:.4f}')
    ridge=(1-q*q)**1.3
    filament=math.cos(math.tau*(v*5+.13*t+.035*math.sin(7*t)))
    layer=.00012+(max(0,lift)+.00018*filament)*ridge
    verts.append((px,hit.y+layer,pz))
    tones.append(shade+.12*ridge+.105*filament+.05*math.sin(math.tau*(8*v-.13*t)))
    if j and k:
     a=(j-1)*(columns+1)+k-1
     b=j*(columns+1)+k-1
     faces.append((a,b,b+1,a+1))
  a,b,c=(Vector(verts[i]) for i in faces[len(faces)//2][:3])
  if (b-a).cross(c-a).y<0:faces=[tuple(reversed(face)) for face in faces]
  ob=mesh_object(name,verts,faces,material)
  set_hair_grain(ob,tones);parts.append(ob)
 crown_lock('gu_crown_long',[(.013,.055,.0003,.0005),(.001,.030,.010,.0024),
  (-.025,.004,.015,.0032),(-.036,-.021,.015,.0034),(-.031,-.049,.012,.0031),
  (-.017,-.068,.006,.0022),(-.004,-.074,.0003,.0005)],1.0)
 crown_lock('gu_crown_center',[(.021,.055,.0003,.0006),(.017,.031,.010,.0027),
  (.008,.002,.014,.0035),(-.002,-.023,.015,.0036),(-.010,-.049,.011,.0030),
  (-.010,-.069,.006,.0020),(-.001,-.074,.0003,.0005)],.97)
 crown_lock('gu_crown_short',[(.027,.052,.0003,.0005),(.039,.026,.009,.0023),
  (.044,-.005,.011,.0030),(.042,-.030,.012,.0032),(.031,-.050,.009,.0030),
  (.017,-.067,.006,.0019),(.009,-.075,.0003,.0005)],.99)
 # Groomed ribbon lofts have a continuous oval section, lengthwise ridges,
 # and width controls at the same knots that define their silhouette.
 def lock(name,knots,normal,shade=1):
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
    ripple=1+.018*math.cos(a*(27 if quality=='high' else 15)+u*.75)
    pos=center+(width_axis*(max(w,.0002)*math.cos(a))+depth_axis*(max(d,.0002)*math.sin(a)))*ripple
    vertices.append(pos)
    if j:
     start=(j-1)*sides;next_k=(k+1)%sides
     faces.append((start+k,start+sides+k,start+sides+next_k,start+next_k))
  faces.extend([tuple(reversed(range(sides))),tuple(range(steps*sides,len(vertices)))])
  ob=mesh_object('gu_'+name,vertices,faces,material)
  bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
  bm.to_mesh(ob.data);bm.free()
  set_hair_grain(ob,[shade+.24*math.sin(math.tau*(i%sides)*11/sides+(i//sides)*.026)
                              +.11*math.sin(math.tau*(i%sides)*3/sides) for i in range(len(vertices))])
  parts.append(ob)
 # Scalp-fitted side locks. The longitudinal axis runs from the swept
 # fringe to the nape. The lower edge skirts the upper rim of the ear.
 def side_lock(name,side,knots,shade):
  # In profile: depth, height, half width, lift from the underlying skin.
  route=[Vector(k) for k in knots]
  rows=(len(route)-1)*(7 if quality=='high' else 5)
  columns=16 if quality=='high' else 10
  verts=[];tones=[];faces=[]
  for j in range(rows+1):
   t=j/rows
   z,y,width,lift=sample_route(route,t)
   before=sample_route(route,max(0,t-.002))
   after=sample_route(route,min(1,t+.002))
   tangent=Vector((after[0]-before[0],after[1]-before[1])).normalized()
   across=Vector((-tangent.y,tangent.x))
   for k in range(columns+1):
    v=k/columns
    q=2*v-1
    pz,py=Vector((z,y))+across*(q*max(.00012,width))
    # At the ear keep the panel above the helix, where the skin projection
    # follows the skull. A separate narrow lock hangs in front of the ear.
    rim=smooth(.014,-.001,pz)*smooth(-.036,-.022,pz)
    minimum_y=mix(-.048,.023,rim)
    # Soft limit avoids a ridge where a lock curves across the top of the ear.
    margin=py-minimum_y
    py=minimum_y+.5*(margin+math.sqrt(margin*margin+.0015**2))
    hit=head_guide.ray_cast(Vector((side*.18,py,pz)),Vector((-side,0,0)),.34)[0]
    if hit is None:
     pz,py=z,y
     hit=head_guide.ray_cast(Vector((side*.18,py,pz)),Vector((-side,0,0)),.34)[0]
    if hit is None:
     raise ValueError(f'{name} outside side scalp at {pz:.4f}, {py:.4f}')
    ridge=max(0,1-q*q)**.68
    grain=math.sin(math.tau*(v*5+.22*t+.065*math.sin(6*t)))
    amount=.0011+max(0,lift)*ridge+.00018*grain*ridge
    verts.append((hit.x+side*amount,py,pz))
    tones.append(shade+.09*ridge+.12*grain+.068*math.cos(math.tau*(8*v-.16*t)))
    if j and k:
     a=(j-1)*(columns+1)+k-1
     b=j*(columns+1)+k-1
     faces.append((a,b,b+1,a+1))
  a,b,c=(Vector(verts[i]) for i in faces[len(faces)//2][:3])
  if side*(b-a).cross(c-a).x<0:faces=[tuple(reversed(face)) for face in faces]
  ob=mesh_object(name,verts,faces,material)
  set_hair_grain(ob,tones);parts.append(ob)
 for side in (-1,1):
  # Main mass covers the temple and joins the back of the head. Two narrower
  # overlapping locks continue the diagonal flow from the part into this mass.
  stagger=.004 if side<0 else 0
  side_lock('gu_temple_sweep',side,[(.056,.061+stagger,.0005,.001),
   (.039,.047+stagger,.012,.0058),(.023,.033,.015,.0070),(.005,.036,.015,.0067),
   (-.018,.038,.015,.0062),(-.041,.033,.014,.0056),(-.061,.028,.007,.0033),
   (-.075,.027,.0002,.0006)],.98)
  side_lock('gu_upper_sweep',side,[(.044,.083,.0005,.001),(.028,.078,.008,.0039),
   (.004,.071,.012,.0046),(-.022,.062,.014,.0049),(-.043,.054,.013,.0042),
   (-.062,.051,.007,.0047),(-.072,.052,.0002,.0012)],1.00)
  side_lock('gu_side_earlock',side,[(.040,.049,.0003,.003),(.034,.034,.006,.007),
   (.025,.018,.0055,.0058),(.024,.003,.004,.0045),(.030,-.010,.0024,.0033),
   (.038,-.022,.0003,.0020)],.96)
  # Slim, unequal cheek locks emerge from under the attached side mass.
  lock('gu_cheek_lock',[(side*.053,.065,.055,.0005,.0004),
   (side*.065,.040,.044,.003,.0015),(side*.069,.012,.040,.004,.0018),
   (side*.067,-.015,.042,.003,.0013),(side*.064,-.039,.047,.0019,.0008),
   (side*.058,-.064+stagger,.051,.0002,.0002)],(0,0,1))
  lock('gu_cheek_wisp',[(side*.064,.039,.047,.0005,.0005),
   (side*.070,.013,.043,.0012,.0006),(side*.072,-.012,.042,.0011,.0006),
   (side*.068,-.034,.047,.0007,.0005),(side*.059,-.048+stagger,.051,.0001,.0001)],(0,0,1))
 # High folded loops and low lateral rolls give the coiffure its silhouette.
 for side in (-1,1):
  lock('royal_loop',[(side*.018,.090,-.056,.012,.008),
   (side*.030,.113,-.059,.014,.009),(side*.030,.145,-.069,.015,.010),
   (side*.010,.153,-.085,.012,.009),(side*.002,.135,-.096,.011,.008),
   (side*.014,.113,-.090,.012,.008)],(0,0,1),.98)
  lock('lower_roll',[(side*.053,.048,-.043,.011,.008),
   (side*.059,.020,-.063,.015,.011),(side*.055,-.018,-.073,.017,.012),
   (side*.037,-.031,-.082,.016,.011),(side*.022,-.014,-.086,.012,.009),
   (side*.029,.028,-.081,.010,.008)],(0,0,1),1.02)
  lock('back_sweep',[(side*.025,.107,-.082,.012,.008),
   (side*.044,.071,-.095,.022,.012),(side*.046,.016,-.096,.023,.014),
   (side*.027,-.040,-.090,.020,.012),(side*.011,-.065,-.084,.010,.007),
   (side*.004,-.053,-.079,.001,.001)],(0,0,1),.92)
 return join_parts(parts,'gu_'+quality+'_hair')
def hair_ornament(quality, head, hair):
 """Seat a gilt plum comb and a smaller counter-spray in Gu's swept hair."""
 detailed=quality=='high'
 material=mat('gu_gilt_plum_comb',rgb('ddae62'),.38)
 shader=material.node_tree.nodes.get('Principled BSDF')
 shader.inputs['Metallic'].default_value=.48
 node=material.node_tree.nodes.new('ShaderNodeVertexColor')
 node.layer_name='Complexion'
 material.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
 vertices=[];faces=[];colors=[]
 gold=rgb('dfb369');bright=rgb('f3cb81');shadow=rgb('9c6130')
 red=rgb('be6867');red_edge=rgb('f0a19a');pearl=rgb('f1d4a6')
 jade=rgb('78aa92');up=Vector((0,1,0))
 scalp=surface_bvh(hair);skin=surface_bvh(head)

 def vertex(point,color):
  vertices.append(point);colors.append(color)
  return len(vertices)-1

 def tube(points,radii,color,sides=None,closed=False):
  sides=sides or (6 if detailed else 4)
  start=len(vertices);count=len(points)
  guide=(points[1]-points[0]).normalized()
  axis=guide.cross(Vector((0,0,1)))
  if axis.length<.1:axis=guide.cross(up)
  axis.normalize()
  for i,point in enumerate(points):
   left=points[(i-1)%count] if closed or i else point
   right=points[(i+1)%count] if closed or i<count-1 else point
   tangent=(right-left).normalized()
   axis=(axis-axis.dot(tangent)*tangent).normalized()
   cross=tangent.cross(axis)
   for j in range(sides):
    a=math.tau*j/sides
    vertex(point+radii[i]*(axis*math.cos(a)+cross*math.sin(a)),color)
  for i in range(count if closed else count-1):
   a=start+i*sides;b=start+((i+1)%count)*sides
   for j in range(sides):
    k=(j+1)%sides
    faces.append((a+j,a+k,b+k,b+j))
  if not closed:
   faces.append(tuple(reversed(range(start,start+sides))))
   faces.append(tuple(range(start+(count-1)*sides,start+count*sides)))

 def bead(center,width,height,normal,color):
  # The vertical axis and faceted shoulders give the drops a cut-stone profile.
  vertical=(up-normal.dot(up)*normal).normalized()
  points=[center+vertical*(height*t) for t in (-1,-.56,.20,.64,.84)]
  tube(points,[width*t for t in (.10,.78,1,.73,.15)],color,8 if detailed else 6)

 def strand(points,radius,color):
  tube(points,[radius]*len(points),color)

 def leaf(base,tip,normal,width,color,engrave=False):
  # Hammered, cupped petals with an uninterrupted folded edge.
  tangent=(tip-base).normalized();cross=normal.cross(tangent).normalized()
  rows=5 if detailed else 4;cols=3 if detailed else 2
  start=len(vertices);layer=(rows+1)*(cols+1)
  for back in (False,True):
   for j in range(rows+1):
    t=j/rows
    mid=base.lerp(tip,t)
    profile=max(.028,math.sin(math.pi*t)**.73)*(1+.33*t)
    for k in range(cols+1):
     u=2*k/cols-1
     cup=width*(.18*math.sin(math.pi*t)+(.58*u*u-.28)*t+.44*t*t)
     depth=cup+(-.0007 if back else 0)
     highlight=.14*t+.10*(1-abs(u))-.10
     tint=tuple(min(1,c*(1+highlight)) for c in color)
     vertex(mid+cross*(width*u*profile)+normal*depth,tint)
  for j in range(rows):
   for k in range(cols):
    a=start+j*(cols+1)+k;b=a+cols+1
    faces.extend(((a,b,b+1,a+1),(a+layer,a+1+layer,b+1+layer,b+layer)))
  border=list(range(cols+1))
  border.extend(j*(cols+1)+cols for j in range(1,rows+1))
  border.extend(rows*(cols+1)+k for k in range(cols-1,-1,-1))
  border.extend(j*(cols+1) for j in range(rows-1,0,-1))
  for i,a in enumerate(border):
   b=border[(i+1)%len(border)]
   faces.append((start+a,start+b,start+b+layer,start+a+layer))
  if engrave:
   vein=[base.lerp(tip,t)+normal*(width*(.18*math.sin(math.pi*t)-.28*t+.44*t*t)+.00032)
         for t in (.12,.3,.5,.69,.87)]
   strand(vein,max(.00034,width*.105),bright)

 def comb_seat(direction):
  center=Vector((0,.044,-.021))
  normal=Vector(direction).normalized()
  hit=scalp.ray_cast(center+.22*normal,-normal,.23)[0]
  if hit is None:
   raise ValueError(f'Gu ornament seat missed the hair at {direction}')
  return hit,normal

 def flower(hit,normal,size,rotation,enameled=False,hero=False):
  # Broad outer petals, a tighter inner row, and a small warm stone at the boss.
  center=hit+normal*.0027
  if hero:
   # Tip the principal flower a little forward into the portrait's light.
   center+=normal*.0021
   normal=normal.lerp(Vector((.15,.37,.92)),.67).normalized()
  vertical=(up-normal.dot(up)*normal).normalized()
  across=vertical.cross(normal).normalized()
  bead(center-normal*.0010,size*.34,size*.33,normal,shadow)
  rows=((0,7,1),(1,6,.66)) if hero else ((0,5,1),(1,3,.61))
  for row,count,scale in rows:
   for i in range(count):
    a=rotation+math.tau*i/count+row*.48
    radial=across*math.cos(a)+vertical*math.sin(a)
    length=size*scale*(1+.08*math.sin(3*a))
    root=center+radial*(size*.14)+normal*(row*.0018)
    color=(red_edge if row else red) if enameled else (bright if (i+row)%3 else gold)
    leaf(root,center+radial*length+normal*(-.001+row*.0022),normal,size*.29*scale,color,hero and row==0 and detailed)
  boss=center+normal*.0047
  bead(boss,size*.25,size*.22,normal,gold)
  bead(boss+normal*.0013,size*.151,size*.15,normal,pearl if enameled else red_edge)
  return center

 def spray(positions,primary):
  feet=[comb_seat(direction) for direction,_,_,_ in positions]
  # The tines follow the hairstyle underneath the frontmost flower petals.
  track=[support+normal*.0016 for support,normal in feet]
  anchor,normal=feet[0]
  strand([anchor-normal*.006,track[0],*track[1:]],.00118 if primary else .0009,shadow)
  for index,((hit,normal),(_,size,angle,enameled)) in enumerate(zip(feet,positions)):
   flower(hit,normal,size,angle,enameled,primary and index==0)
   if index not in (0,len(feet)-1):continue
   stem_vertical=(up-normal.dot(up)*normal).normalized()
   stem_across=stem_vertical.cross(normal).normalized()
   fan_side=1 if primary else -1
   directions=((.93,-.67),(.67,.89),(-.54,-.83)) if index==0 else ((.95,-.48),(.31,.82))
   for j,(rise,reach) in enumerate(directions):
    offset=stem_vertical*rise+stem_across*(fan_side*reach)
    start=track[index]+offset*(size*.22)
    tip=track[index]+offset*(size*(1.55-.12*j))+normal*(.0006+.001*j)
    leaf(start,tip,normal,size*(.18-.022*j),gold if j%2 else bright,True)
  return feet[-1]

 def link(center,width,height,normal,twist):
  side=up.cross(normal).normalized()
  side=(side*math.cos(twist)+normal*math.sin(twist)).normalized()
  steps=9 if detailed else 7
  ring=[center+side*(width*math.cos(math.tau*i/steps))+up*(height*math.sin(math.tau*i/steps))
        for i in range(steps)]
  tube(ring,[.00057 if detailed else .00065]*steps,gold,closed=True)

 def chain(start,end,normal,count,width):
  for i in range(count):
   t=(i+.5)/count
   point=start.lerp(end,t)+normal*(.0015*math.sin(math.pi*t))
   link(point,width,(start-end).length/count*.59,normal,.53*(-1)**i)

 def tassel(start,direction,length,width):
  # Gathered silk flares gradually and separates into an uneven hem.
  knot=start+Vector((0,-.003,0))
  bead(knot,width*.72,.003,Vector((0,0,1)),bright)
  end=knot+direction*length
  tube([knot,knot.lerp(end,.24),knot.lerp(end,.68),end],
       [width*.40,width*.64,width*.88,width*.98],red,12 if detailed else 8)
  count=15 if detailed else 8
  for i in range(count):
   angle=math.tau*i/count;radial=Vector((math.cos(angle),0,math.sin(angle)))
   tip=end+radial*width*(1.02+.1*math.sin(i*2.7))
   tip.y+=.0016*math.sin(i*2.3)
   tube([knot+radial*width*.38,knot.lerp(tip,.5)+radial*width*.34,tip],
        [.00040,.00046,.00030],red_edge if i%4==1 else red,5 if detailed else 4)

 # Twin pierced sprays rise from a jade boss seated on the front coiffure.
 seat,normal=comb_seat((0,.89,.48))
 base=seat+normal*.004
 bead(base,.010,.011,normal,gold)
 bead(base+normal*.003,.0078,.0088,normal,jade)
 for side in (-1,1):
  branch=base+Vector((side*.029,.030,-.012))
  stem=[base,base+Vector((side*.010,.012,-.004)),branch]
  strand(stem,.00085,gold)
  for j in range(4):
   t=.28+j*.19
   start=base.lerp(branch,t)
   direction=1 if j%2==0 else -1
   tip=start+Vector((side*(.007+direction*.005),.010+j*.002,.001))
   leaf(start,tip,Vector((0,.25,.97)).normalized(),.0024,bright,True)
  bead(branch,.0016,.0020,Vector((0,0,1)),pearl)
 end,normal=spray([
  ((.58,.78,.60),.0200,.46,True),
  ((.57,.76,.61),.0113,.62,True),
  ((.77,.62,.59),.0086,.98,False),
  ((.93,.43,.44),.0095,.14,False),
 ],True)
 # The chain exits laterally before it hangs down, clearing the swept temple.
 start=end+normal*.009+Vector((.007,-.003,.001))
 strand([end+normal*.004,start+up*.0015,start],.00105,bright)
 hanging=Vector((.67,0,.74))
 pendant=start+Vector((.004,-.033,.006))
 chain(start,pendant,hanging,8 if detailed else 6,.00165)
 tassel(pendant,Vector((.09,-1,.11)).normalized(),.040,.0043)
 short=start+Vector((-.006,-.003,.006))
 jade_end=short+Vector((.004,-.026,.006))
 chain(short,jade_end,hanging,6 if detailed else 5,.00120)
 bead(jade_end-up*.002,.0024,.0045,hanging,jade)
 end,normal=spray([
  ((-.58,.78,.60),.0175,.29,True),
  ((-.79,.66,.59),.0082,.66,True),
  ((-.95,.54,.39),.0073,.43,False),
 ],False)
 start=end+normal*.008+Vector((-.004,-.005,0))
 strand([end+normal*.004,start+up*.0014,start],.00086,gold)
 hanging=Vector((-.67,0,.74))
 pendant=start+Vector((-.004,-.023,.007))
 chain(start,pendant,hanging,6 if detailed else 5,.00138)
 tassel(pendant,Vector((-.13,-1,.08)).normalized(),.032,.0031)

 for side in (-1,1):
  # Frontmost lobe ray gives each stud a positive seat on both face LODs.
  hits=(skin.ray_cast(Vector((side*x,y,.25)),Vector((0,0,-1)),.5)[0]
        for x in (.071,.068,.074,.065) for y in (-.028,-.024,-.032,-.020))
  hit=next((point for point in hits if point is not None),None)
  if hit is None:continue
  normal=Vector((side*.34,0,.94)).normalized()
  stud=hit+normal*.0012
  bead(stud,.0028,.0033,normal,bright)
  bead(stud+normal*.0013,.0019,.0022,normal,pearl)
  start=stud+Vector((side*.001,-.002,.002))
  end=start+Vector((side*.003,-.016,.004))
  chain(start,end,normal,4,.00112)
  bead(end-up*.002,.0031,.0041,normal,gold)
  bead(end-up*.002+normal*.0015,.0022,.0030,normal,jade)
  bead(end-up*.007,.0013,.0020,normal,pearl)

 ornament=mesh_object('gu_'+quality+'_ornament',vertices,faces,material)
 bm=bmesh.new();bm.from_mesh(ornament.data)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(ornament.data);bm.free();ornament.data.update()
 attr=ornament.data.color_attributes.new(name='Complexion',type='BYTE_COLOR',domain='POINT')
 for v,color in zip(attr.data,colors):v.color=(*color,1)
 return ornament

for quality,level in [('high',1),('low',0)]:
 female.modifiers[0].levels=level
 ev=female.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
 head=mesh_object('gu_'+quality+'_skin',[female_canon(v.co) for v in me.vertices],[tuple(f.vertices) for f in me.polygons],mat('gu_'+quality+'_skin',rgb(record['skin']),.5));ev.to_mesh_clear()
 retain_anatomical_neck(head)
 relax_face_planes(head)
 for v in head.data.vertices:
  for e in eyes:
   c=Vector(e['center']);d=v.co-c;w=gauss(d.x,.022)*gauss(d.y,.017)*smooth(.025,.050,v.co.z)
   v.co.x+=d.x*.28*w
   v.co.y+=d.x*(1 if c.x>0 else -1)*.09*w
   # Move the orbital skin away from the fissure, upper lid more than
   # lower. The underlying globe stays fixed and the corners remain tapered.
   v.co.y+=d.y*(.12 if d.y>0 else .10)*w
 for v in head.data.vertices:
  for e in eyes:
   c=Vector(e['center']);d=v.co-c
   # Allow the upper lid to cover the iris slightly while the lower rim stays seated.
   lateral=d.x*(1 if c.x>0 else -1)
   v.co.y-=.00135*gauss(lateral-.002,.011)*gauss(d.y-.0048,.005)*smooth(.045,.060,v.co.z)
   v.co.y+=.00075*gauss(d.x,.008)*gauss(d.y+.005,.0038)*smooth(.046,.063,v.co.z)
 head.data.update();pigment(head);bvh=surface_bvh(head)
 hair=hair_surface(head,mat('gu_'+quality+'_hair',rgb(record['hair']),.82),quality);pigment(hair,True)
 groom=GroomMesh()
 for side in [-1,1]:
  for k in range(42 if quality=='high' else 22):
   t=k/(41 if quality=='high' else 21);x=side*(.014+.037*t);y=.029+.0042*math.sin(math.pi*t)-.0018*t
   pts=[Vector((x+side*j*.0015,y-j*.00035,sample(bvh,x+side*j*.0015,y-j*.00035)+.0005)) for j in range(3)]
   groom.fibre(pts,.00073*(1-.58*t),.98+.25*gauss(t,.20))
 brow=groom.object('gu_'+quality+'_brow',mat('gu_'+quality+'_brow',rgb('38292a'),.7));pigment(brow,True,'38292a')
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
    rim.append(Vector((x,upper+.00055,sample(bvh,x,upper+.00055)+.00054)))
  if len(rim)>5:
   # Small lashes grow from the fitted lid rather than floating over the iris.
   for fraction in ((.63,.71,.79,.87) if quality=='high' else (.69,.83)):
    root=rim[round(fraction*(len(rim)-1))]
    length=mix(.0012,.0023,fraction)
    liner.fibre([root,root+Vector((side*length*.36,length*.32,.0007)),
                 root+Vector((side*length*.75,length*.63,.0012))],.00031,.96,sides=5)
   end=rim[-1]
   for i in range(1,3):
    x=end.x+side*.0013*i;y=end.y+.00025*i
    rim.append(Vector((x,y,sample(bvh,x,y)+.00054)))
   for i in range(2,len(rim)-1):
    u=i/(len(rim)-1)
    radius=.00061*math.sin(math.pi*u)**.76
    liner.fibre(rim[i-2:i+2],radius,.95,sides=5)
 eye_line=liner.object('gu_'+quality+'_upper_lashes',mat('gu_lashes',rgb('493334'),.68))
 pigment(eye_line,True,'493334')
 brow=join_parts([brow,eye_line],'gu_'+quality+'_brow')
 parts=dict(skin=head,hair=hair,brow=brow,ornament=hair_ornament(quality,head,hair));record['lod'][quality]={k:export_mesh(o) for k,o in parts.items()}
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
for name,pos in [('front',(0,0,.7)),('threequarter',(.4,.025,.55)),('side',(.7,0,.001)),('other-side',(-.7,0,.001)),('rear-quarter',(.46,.018,-.55)),('back',(0,0,-.7)),('top',(.12,.6,.25))]:
 target_camera(pos,(0,-.039,-.007));bpy.context.scene.render.filepath=str(OUT/('gu-head-'+name+'.png'));bpy.ops.render.render(write_still=True)
# Review the real low-LOD geometry at the same camera angles.
for ob in render_parts:
 if ob.name.startswith('gu_high_'):ob.hide_render=True;ob.hide_set(True)
for ob in low_parts:ob.hide_render=False;ob.hide_set(False)
for name,pos in [('front',(0,0,.7)),('threequarter',(.4,.025,.55)),('side',(.7,0,.001)),('other-side',(-.7,0,.001)),('rear-quarter',(.46,.018,-.55)),('back',(0,0,-.7)),('top',(.12,.6,.25))]:
 target_camera(pos,(0,-.039,-.007));bpy.context.scene.render.filepath=str(OUT/('gu-head-low-'+name+'.png'));bpy.ops.render.render(write_still=True)
for ob in low_parts:ob.hide_render=True;ob.hide_set(True)
for ob in render_parts:ob.hide_render=False;ob.hide_set(False)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source-assets/gu-head.blend'),compress=True)
print('GU_HEAD',[(q,{k:(v['v'],v['t']) for k,v in d.items()}) for q,d in record['lod'].items()])
