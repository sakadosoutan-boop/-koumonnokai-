"""Build anatomically connected hand meshes from Blender Studio CC0 base meshes.

The preserved source and editable working hand live in hands-assets.blend.
Canonical runtime coordinates: wrist origin, +Y fingers, +Z dorsal, -X thumb.
"""
import bpy, math, json, sys, os, base64, struct
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / '3d-runtime/human-base/human_base_meshes_bundle.blend'
if '--source' in sys.argv:
    SOURCE = Path(sys.argv[sys.argv.index('--source')+1]).expanduser().resolve()
elif os.environ.get('KOMON_HUMAN_BASE'):
    SOURCE = Path(os.environ['KOMON_HUMAN_BASE']).expanduser().resolve()
if not SOURCE.exists():
    SOURCE = ROOT / 'source-assets/hands.blend'
OUT = ROOT / 'model-preview-output/asset-rebuild'
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
collection = bpy.data.collections.get('Collection')
collection.name = 'HAND_ASSETS'
backup = bpy.data.collections.new('SOURCE_CC0_PRESERVED')
bpy.context.scene.collection.children.link(backup)
with bpy.data.libraries.load(str(SOURCE), link=False) as (src, dst):
    dst.objects = ['Hand  - Realistic', 'Hand - Stylized ']
for ob in dst.objects:
    backup.objects.link(ob)
bpy.context.view_layer.update()
source = bpy.data.objects['Hand  - Realistic']
for ob in backup.objects:
    ob.hide_render = True
    ob.hide_set(True)
backup.hide_render = True

def rgb(h):
    vals=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in vals)

def mat(name, color, rough=.52):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb(color),1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb(color),1)
    p.inputs['Roughness'].default_value=rough
    return m

skin = mat('Runtime reference skin cba38a','cba38a')

def mesh_object(name, coords, faces, material=skin):
    me=bpy.data.meshes.new(name); me.from_pydata(coords, [], faces); me.update()
    ob=bpy.data.objects.new(name,me); collection.objects.link(ob); me.materials.append(material)
    for p in me.polygons: p.use_smooth=True
    return ob

def evaluated(ob, level=1):
    for mod in ob.modifiers:
        if mod.type=='MULTIRES':
            print('MULTIRES',mod.total_levels,mod.levels,mod.sculpt_levels,mod.render_levels)
            mod.levels=level; mod.render_levels=level
    ev=ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); me=ev.to_mesh()
    coords=[v.co.copy() for v in me.vertices]; faces=[tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear(); return coords,faces

def setup_render():
    sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.samples=24; sc.cycles.use_denoising=True
    sc.render.resolution_x=640; sc.render.resolution_y=720; sc.render.resolution_percentage=100
    sc.world.color=(.24,.24,.24); sc.view_settings.view_transform='AgX'
    bpy.ops.object.camera_add(); ca=bpy.context.object; ca.name='Hand validation camera'; sc.camera=ca
    ca.data.type='ORTHO'; ca.data.ortho_scale=.32
    for name,loc,power,size in [('Key',(-.3,.25,.4),14,.3),('Fill',(.4,.1,.2),7,.3),('Rim',(.1,.35,-.35),10,.25)]:
        bpy.ops.object.light_add(type='AREA',location=loc); ob=bpy.context.object; ob.name=name
        ob.data.energy=power; ob.data.size=size
        ob.rotation_euler=(Vector((0,.07,0))-ob.location).to_track_quat('-Z','Y').to_euler()
    sc.render.image_settings.file_format='PNG'

def view(name,loc,target=(0,.07,0),span=.32):
    sc=bpy.context.scene; sc.camera.location=loc
    # Runtime uses world Y up. Blender's track-quaternion assumes world Z up,
    # so construct a camera basis explicitly for upright runtime review views.
    z=(sc.camera.location-Vector(target)).normalized()
    x=Vector((0,1,0)).cross(z).normalized();y=z.cross(x).normalized()
    sc.camera.rotation_euler=Matrix((x,y,z)).transposed().to_quaternion().to_euler()
    sc.camera.data.ortho_scale=span; sc.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)

def canon(v):
    return Vector((-v.x*.76, -v.z*.76+.024, -v.y*.76))

coords,faces=evaluated(source,1)
hand=mesh_object('working_realistic_right_hand',[canon(v) for v in coords],faces)
hand['source']='Blender Studio Human Base Meshes v1.2.0 / Hand  - Realistic / CC0'
setup_render()
if '--inspect' in sys.argv:
    for n,loc in [('dorsal',(0,.07,.6)),('palm',(0,.07,-.6)),('side',(.6,.07,0)),('threequarter',(.35,.25,.45))]:
        view('hand-source-'+n,loc)
    (OUT/'hands-inspect.json').write_text(json.dumps({'positions':[list(canon(v)) for v in coords],'faces':faces}),encoding='utf8')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hands-assets.blend'))
    sys.exit()

# Bind joint centers follow the source's spread hand. Every pose deforms the
# original connected surface; no cylinders or fused finger approximations.
JOINTS = [
    [(-.025,.091,0),(-.0335,.126,0),(-.039,.151,-.005),(-.040,.167,-.009)],
    [(-.008,.096,0),(-.010,.137,0),(-.013,.161,-.005),(-.014,.179,-.010)],
    [(.010,.094,0),(.011,.132,-.001),(.010,.155,-.009),(.009,.171,-.014)],
    [(.026,.087,-.006),(.034,.115,-.007),(.038,.138,-.013),(.038,.150,-.014)],
    [(-.018,.037,-.006),(-.041,.067,-.012),(-.058,.091,-.018),(-.068,.109,-.019)],
]
JOINTS=[[Vector(v) for v in row] for row in JOINTS]
# joint flexion in radians: MCP, PIP, DIP; source splay is kept only for reach.
POSES = {
 'relax':{'flex':[[.20,.34,.18],[.24,.38,.22],[.30,.44,.26],[.36,.50,.28]],'spread':.22,'thumb':0},
 'rest':{'flex':[[.12,.20,.10],[.16,.24,.13],[.20,.30,.16],[.26,.35,.20]],'spread':.28,'thumb':0},
 'lap':{'flex':[[.16,.27,.12],[.20,.32,.16],[.25,.38,.20],[.31,.44,.24]],'spread':.22,'thumb':0},
 'hold':{'flex':[[.16,.27,.13],[.20,.32,.16],[.28,.38,.20],[.34,.44,.24]],'spread':.45,'thumb':-.12},
 'book':{'flex':[[.07,.13,.06],[.09,.14,.07],[.13,.18,.08],[.19,.25,.10]],'spread':.58,'thumb':-.15},
 'reach':{'flex':[[.02,.06,.03],[.03,.07,.03],[.04,.08,.04],[.06,.10,.05]],'spread':1,'thumb':-.08},
 'grasp':{'flex':[[.92,1.48,.88],[1.00,1.50,.91],[1.08,1.53,.92],[1.14,1.55,.92]],'spread':.02,'thumb':1},
 'fist':{'flex':[[1.12,1.58,1.02],[1.18,1.62,1.04],[1.24,1.64,1.04],[1.29,1.64,1.04]],'spread':0,'thumb':1.1},
 'fan':{'flex':[[.80,1.22,.76],[.93,1.43,.89],[1.04,1.52,.92],[1.10,1.55,.92]],'spread':.02,'thumb':.88},
 'brush':{'flex':[[.52,.66,.36],[.70,.98,.52],[1.14,1.53,.93],[1.20,1.58,.96]],'spread':.10,'thumb':.80},
 'point':{'flex':[[.03,.07,.04],[1.14,1.55,.96],[1.20,1.60,.98],[1.26,1.62,1]],'spread':.1,'thumb':.84},
}

def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)

def closest(v, joints):
    best=(1e9,0,0)
    for i,(a,b) in enumerate(zip(joints,joints[1:])):
        d=b-a; t=max(0,min(1,(v-a).dot(d)/d.length_squared)); ds=(v-(a+d*t)).length_squared
        if ds<best[0]:best=(ds,i,t)
    return best

def binding(v, forced=None):
    # Thumb/palm web is split along the anatomical thenar crease; other digit
    # roots blend over 14 mm, retaining the palm web and knuckle volume.
    if forced is not None: digit=forced
    elif v.y>.073 or (v.x<-.026 and v.y>.034):
        digit=min(range(5),key=lambda i:closest(v,JOINTS[i])[0])
    else:return (-1,0,0,0)
    def part(d):
        dist,seg,t=closest(v,JOINTS[d])
        weight=smooth(.026,.061,v.y)*smooth(.022,.044,-v.x) if d==4 else smooth(JOINTS[d][0].y-.013,JOINTS[d][0].y+.006,v.y)
        return [d,seg,t,weight]
    primary=part(digit)
    if forced is None:
        second=min((i for i in range(5) if i!=digit),key=lambda i:closest(v,JOINTS[i])[0])
        delta=math.sqrt(closest(v,JOINTS[second])[0])-math.sqrt(closest(v,JOINTS[digit])[0])
        mix=(1-smooth(0,.009,delta))*.5
        if mix>.00001:
            secondary=part(second); primary[3]*=1-mix; secondary[3]*=mix
            return tuple(primary+secondary)
    return tuple(primary)

def targets(pose):
    out=[]; cfg=POSES[pose]
    for i,bind in enumerate(JOINTS):
        if i<4:
            spread=(-.17,-.025,.035,.24)[i]*cfg['spread']
            pts=[bind[0].copy()]; angle=0
            for j in range(3):
                angle+=cfg['flex'][i][j]
                direction=Vector((math.sin(spread)*math.cos(angle),math.cos(spread)*math.cos(angle),-math.sin(angle)))
                pts.append(pts[-1]+direction*(bind[j+1]-bind[j]).length)
        else:
            grip=cfg['thumb']; pts=[bind[0].copy()]
            if grip>0:
                # CMC opposition sweeps the thumb across the proximal index,
                # clearing the handle rather than folding into the palm.
                dirs=[Vector((-.64+.22*grip,.66,-.30-.24*grip)),Vector((.10+.62*grip,.60,-.42)),Vector((.45+.32*grip,.30,-.12))]
            else:
                dirs=[(bind[j+1]-bind[j]).normalized() for j in range(3)]
                dirs=[Vector((d.x,d.y,d.z+grip*.25)) for d in dirs]
            for j,d in enumerate(dirs):pts.append(pts[-1]+d.normalized()*(bind[j+1]-bind[j]).length)
        transforms=[]
        for j in range(3):
            q=(bind[j+1]-bind[j]).normalized().rotation_difference((pts[j+1]-pts[j]).normalized())
            transforms.append((q,pts[j]-q@bind[j]))
        out.append(transforms)
    return out

def deform(v, bind, transforms):
    digit,seg,t,weight=bind[:4]
    if digit<0:return v.copy()
    trans=transforms[digit]
    def apply(j):
        q,d=trans[j];return q@v+d
    p=apply(seg)
    # Blend adjacent rigid phalanges only in a small region around joints.
    # This preserves finger-pad thickness and gives rounded flexion creases.
    if t<.22 and seg>0:p=p.lerp(apply(seg-1),(1-smooth(0,.22,t))*.5)
    elif t>.78 and seg<2:p=p.lerp(apply(seg+1),smooth(.78,1,t)*.5)
    result=v.lerp(p,weight)
    if len(bind)>4:result+=deform(v,bind[4:],transforms)-v
    return result

def nails_for(coords,faces,segs):
    tree=BVHTree.FromPolygons(coords,faces,all_triangles=False)
    pts=[]; polys=[]; binds=[]
    widths=[.0082,.0090,.0080,.0063,.0088]
    lengths=[.0105,.0118,.0105,.0082,.0100]
    for i,row in enumerate(JOINTS):
        d=(row[3]-row[2]).normalized(); axis=Vector((d.x,d.y,0)).normalized(); cross=Vector((axis.y,-axis.x,0))
        center=row[3]-axis*lengths[i]*.65
        start=len(pts)
        for ring in range(3):
            count=1 if ring==0 else segs; radius=ring/2
            for j in range(count):
                a=j*math.tau/count
                p=center+axis*(math.sin(a)*lengths[i]*.5*radius)+cross*(math.cos(a)*widths[i]*.5*radius)
                hit,normal,_,_=tree.ray_cast(Vector((p.x,p.y,.12)),Vector((0,0,-1)),.25)
                if hit is None:
                    # The base LOD has a tighter thumb silhouette at its edge.
                    # Pull the plate's rim toward its bed until it is supported.
                    for _ in range(5):
                        p=p.lerp(center,.18)
                        hit,normal,_,_=tree.ray_cast(Vector((p.x,p.y,.12)),Vector((0,0,-1)),.25)
                        if hit is not None:break
                if hit is None:raise RuntimeError('Nail outside fingertip '+str((i,list(p))))
                p=hit+normal*(.00012+.00020*(1-radius*radius))
                pts.append(p);binds.append(binding(p,i))
        for j in range(segs):
            polys.append((start,start+1+j,start+1+(j+1)%segs))
            polys.append((start+1+j,start+1+segs+j,start+1+segs+(j+1)%segs,start+1+(j+1)%segs))
    return pts,polys,binds

def pack16(values,signed=False):
    return base64.b64encode(struct.pack('<'+('h' if signed else 'H')*len(values),*values)).decode('ascii')

def triangles(faces):
    return [idx for f in faces for j in range(1,len(f)-1) for idx in (f[0],f[j],f[j+1])]

def bake(level):
    source_coords,source_faces=evaluated(source,level)
    coords=[canon(v) for v in source_coords];binds=[binding(v) for v in coords]
    nail_coords,nail_faces,nail_binds=nails_for(coords,source_faces,16 if level else 10)
    nv=len(coords); faces=source_faces+[tuple(i+nv for i in f) for f in nail_faces]
    coords+=nail_coords; binds+=nail_binds
    skin_indices=triangles(source_faces); nail_indices=triangles([tuple(i+nv for i in f) for f in nail_faces])
    poses={}
    for pose in POSES:
        trans=targets(pose); deformed=[deform(v,b,trans) for v,b in zip(coords,binds)]
        poses[pose]=pack16([round(c*100000) for v in deformed for c in v],True)
    # Broad palm/knuckle warmth only. Fine anatomy comes from geometry.
    marks=[]
    for n,(v,b) in enumerate(zip(coords,binds)):
        digit,seg,t,w=b[:4]
        palm=smooth(-.009,.014,-v.z)*.25
        knuckle=(1-min(1,abs(v.y-.094)/.025))*.20 if digit<4 and digit>=0 else .02
        marks.extend([round(255*palm),round(255*knuckle),255 if n>=nv else 0])
    export={'vertices':len(coords),'skinCount':len(skin_indices),'indices':pack16(skin_indices+nail_indices),'marks':base64.b64encode(bytes(marks)).decode('ascii'),'poses':poses}
    if level:
        edges=set(tuple(sorted((a,b))) for f in source_faces for a,b in zip(f,f[1:]+f[:1]))
        trans=targets('grasp'); posed=[deform(v,b,trans) for v,b in zip(coords,binds)]
        stretched=[]
        for a,b in edges:
            before=(coords[a]-coords[b]).length;after=(posed[a]-posed[b]).length
            if before>.00001 and after/before>3:stretched.append({'ratio':after/before,'a':list(coords[a]),'b':list(coords[b]),'bind_a':binds[a],'bind_b':binds[b]})
        (OUT/'hands-deformation-audit.json').write_text(json.dumps({'stretchedEdges':sorted(stretched,key=lambda v:-v['ratio'])[:30]},indent=2),encoding='utf8')
    return export,coords,faces,binds

low,_,_,_=bake(0)
high,rest_coords,rest_faces,binds=bake(1)
hand.hide_render=True; hand.hide_set(True)
working=mesh_object('editable_connected_hand_with_pose_shape_keys',rest_coords,rest_faces)
working.data.materials.append(mat('Natural translucent nail bed','d3ac9b',.36))
for poly in working.data.polygons:
    if min(poly.vertices)>=len(rest_coords)-165:poly.material_index=1
working.shape_key_add(name='Source open hand')
for pose in POSES:
    key=working.shape_key_add(name=pose)
    trans=targets(pose)
    for v,bind,dst in zip(rest_coords,binds,key.data):dst.co=deform(v,bind,trans)
working['source']='Blender Studio Human Base Meshes v1.2.0 / Hand  - Realistic / CC0'
working['frame']='metres; wrist origin; +Y fingers; +Z dorsal; -X thumb'
working['runtimeLOD']='low: base mesh, high: original Multires level 1'
data={'source':'Blender Studio Human Base Meshes v1.2.0, CC0','frame':'wrist +Y fingers +Z dorsal -X thumb','scale':100000,'lod':{'low':low,'high':high}}
(ROOT/'src/js/koumon-hand-assets.js').write_text('/* Generated by tools/build-hand-assets.py from CC0 Blender Studio Human Base Meshes. */\nwindow.KM_HAND_ASSETS='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf8')

if '--no-render' not in sys.argv:
    # Skin shows better at runtime-like light levels than overexposed clay.
    for light in bpy.data.lights:
        light.energy*=.22
    for pose in ['relax','hold','grasp','point']:
        for key in working.data.shape_keys.key_blocks:key.value=1 if key.name==pose else 0
        for name,loc in [('dorsal',(0,.08,.6)),('palm',(0,.08,-.6)),('side',(.6,.08,0)),('threequarter',(.4,.25,.5)),('top',(.05,.6,.12))]:
            view('hand-'+pose+'-'+name,loc,(0,.075,-.015),.28)
    # A physical wrist plug uses the cast's exposed forearm radius .026 m.
    for key in working.data.shape_keys.key_blocks:key.value=1 if key.name=='grasp' else 0
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.016,depth=.17,location=(0,.102,-.024),rotation=(0,math.pi/2,0))
    shaft=bpy.context.object; shaft.name='Grip contact gauge diameter 32mm'; shaft.data.materials.append(mat('Handle contact gauge','352117',.68))
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.026,depth=.09,location=(0,-.065,0),rotation=(math.pi/2,0,0))
    wrist=bpy.context.object; wrist.name='Cast forearm contact gauge'; wrist.data.materials.append(skin)
    for name,loc in [('threequarter',(.4,.25,.5)),('side',(.6,.08,0)),('top',(.05,.6,.12))]:
        view('hand-grip-contact-'+name,loc,(0,.05,-.015),.30)
    shaft.hide_render=True; wrist.hide_render=True
for key in working.data.shape_keys.key_blocks:key.value=1 if key.name=='relax' else 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hands-assets.blend'),compress=True)
source_out=ROOT/'source-assets';source_out.mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source_out/'hands.blend'),compress=True)
print('HAND_EXPORT',json.dumps({'low':low['vertices'],'high':high['vertices'],'poses':list(POSES),'file':str(OUT/'hands-assets.blend')}))
