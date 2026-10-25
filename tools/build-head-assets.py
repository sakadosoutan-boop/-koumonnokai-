"""Build the cast's game heads from Blender Studio's CC0 Human Base Meshes.

Source: https://www.blender.org/download/demo-files/#assets
Human Base Meshes v1.2.0, CC0, see docs/assets/manifest.csv.
Run with Blender 4.5: blender -b --python tools/build-head-assets.py -- [--prototype] [--source PATH]
Canonical export: metres, +Y up, +Z face. The source is +Z up, -Y face.
"""
import bpy, bmesh, math, json, os, sys, copy, base64, struct, shutil
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / '3d-runtime/human-base/human_base_meshes_bundle.blend'
if '--source' in sys.argv: SOURCE=Path(sys.argv[sys.argv.index('--source')+1]).expanduser().resolve()
elif os.environ.get('KOMON_HUMAN_BASE'):SOURCE=Path(os.environ['KOMON_HUMAN_BASE']).expanduser().resolve()
elif not SOURCE.exists():SOURCE=ROOT/'source-assets/heads.blend'
OUT = ROOT / 'model-preview-output/asset-rebuild'
OUT.mkdir(parents=True, exist_ok=True)
if SOURCE.resolve()==(ROOT/'source-assets/heads.blend').resolve():
    # Blender protects an append-library file from being overwritten in the same
    # process. Read an exact working copy, so the canonical source can be saved.
    rebuild_source=OUT/'heads-library-input.blend'
    shutil.copyfile(SOURCE,rebuild_source)
    SOURCE=rebuild_source
PROTO = '--prototype' in sys.argv

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
collection = bpy.data.collections.get('Collection'); collection.name = 'HEAD_ASSETS'
backup = bpy.data.collections.new('BODY_BASE'); bpy.context.scene.collection.children.link(backup)
names = ['GEO-head_sculpting_realistic', 'GEO-head_sculpting_realistic.sclera.R', 'GEO-head_sculpting_realistic.sclera.L']
with bpy.data.libraries.load(str(SOURCE), link=False) as (src, dst): dst.objects = names[:]
for ob in dst.objects:
    backup.objects.link(ob)
bpy.context.view_layer.update()
source = bpy.data.objects['GEO-head_sculpting_realistic']
source_inv = source.matrix_world.inverted()
eye_source = []
for n in names[1:]:
    ob = bpy.data.objects[n]
    eye_source.append((source_inv @ ob.matrix_world.translation, .0188 * .639556 / .9))
for ob in backup.objects:
    ob.hide_render = True; ob.hide_set(True)
backup.hide_render = True

def canon(v):
    return Vector((v.x * .64, (v.z-.261) * .76, -v.y * .64 - .014))

def mat(name, rgb, rough=.5, metal=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    return m

def rgb(h):
    v=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in v)

def mesh_object(name, coords, faces, material):
    me=bpy.data.meshes.new(name); me.from_pydata(coords, [], faces); me.update()
    ob=bpy.data.objects.new(name,me); collection.objects.link(ob); ob.data.materials.append(material)
    for p in me.polygons: p.use_smooth=True
    return ob

def normalized_source(level=1):
    source.modifiers[0].levels=level
    dg=bpy.context.evaluated_depsgraph_get(); ev=source.evaluated_get(dg); me=ev.to_mesh()
    coords=[canon(v.co) for v in me.vertices]; faces=[tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear(); return coords, faces

def gauss(x,w): return math.exp(-((x/w)**2))
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a))); return t*t*(3-2*t)
def mix(a,b,t): return a*(1-t)+b*t

# Primary forms are authored independently. Values describe actual anatomy,
# never an atlas face pasted over a common round head.
CAST={
 'ryo': dict(width=1.00,jaw=.96,cheek=1.03,length=1.02,nose=.000,bridge=-.001,eye=.67,tilt=.0026,space=1.06,age=.05,skin='d4b297',hair='13100e',grey=0,brow=.0018,slope=.001,beard=0,recede=.0,knot=.025),
 'hai': dict(width=1.11,jaw=1.10,cheek=1.03,length=1.04,nose=.009,bridge=.003,eye=.69,tilt=.000,space=1.02,age=.8,skin='b68c6b',hair='25201a',grey=.23,brow=.003,slope=-.001,beard=.105,recede=.010,knot=.024),
 'u': dict(width=1.14,jaw=1.19,cheek=1.08,length=1.00,nose=.005,bridge=.003,eye=.60,tilt=.0040,space=1.03,age=.22,skin='bf9475',hair='17120f',grey=0,brow=.0038,slope=.004,beard=.043,recede=.001,knot=.037),
 'zo': dict(width=.99,jaw=.93,cheek=1.06,length=1.09,nose=.008,bridge=.002,eye=.59,tilt=-.0015,space=1.00,age=1.45,skin='be9877',hair='b8b3a7',grey=.95,brow=.0030,slope=-.002,beard=.178,recede=.020,knot=.023),
 'haku': dict(width=1.15,jaw=1.07,cheek=1.11,length=.95,nose=.003,bridge=.001,eye=.72,tilt=-.002,space=1.04,age=.85,skin='b88d6e',hair='302a24',grey=.40,brow=.0028,slope=-.002,beard=.061,recede=.011,knot=.025),
 'kai': dict(width=1.23,jaw=1.25,cheek=1.15,length=.98,nose=.007,bridge=.002,eye=.58,tilt=.004,space=1.05,age=.60,skin='aa7c5e',hair='17130f',grey=.06,brow=.0046,slope=.004,beard=.068,recede=.004,knot=.034),
 'sou': dict(width=1.05,jaw=1.01,cheek=1.06,length=1.01,nose=.001,bridge=.001,eye=.64,tilt=.0042,space=1.07,age=.04,skin='c59b7c',hair='18130f',grey=0,brow=.0028,slope=.004,beard=0,recede=.0,knot=.033),
 'chin': dict(width=1.01,jaw=.98,cheek=1.00,length=1.05,nose=.004,bridge=.001,eye=.72,tilt=.0018,space=1.05,age=.18,skin='caa587',hair='201913',grey=.03,brow=.0022,slope=.000,beard=.030,recede=.005,knot=.025)
}
BASE_EYES=[canon(c) for c,r in eye_source]
ER=eye_source[0][1]*.64

# A lid is not a vertically scaled copy of another actor's lid. These profiles
# change the two arches, their apex, the canthi and the tissue above/below them.
# Dimensions are measured in the unmodified source orbit, in metres.
EYE_FORMS={
 'ryo': dict(width=1.30,upper=.61,lower=.54,tilt=.0008,apex=-.24,arch=.00025,hood=.00015,bag=.00015,crease=.00030,brow_y=.0390,brow_arch=.0025,brow_angle=.0006,brow_peak=.49),
 'hai': dict(width=1.11,upper=.59,lower=.73,tilt=-.0004,apex=-.10,arch=-.0004,hood=.00125,bag=.00135,crease=.00055,brow_y=.0405,brow_arch=.0010,brow_angle=-.0013,brow_peak=.35),
 'u': dict(width=1.08,upper=.52,lower=.52,tilt=.0033,apex=-.38,arch=-.0009,hood=.00125,bag=.00020,crease=.00025,brow_y=.0375,brow_arch=.0011,brow_angle=.0075,brow_peak=.63),
 'zo': dict(width=1.10,upper=.34,lower=.82,tilt=-.0014,apex=.10,arch=-.0008,hood=.00265,bag=.00280,crease=.00090,brow_y=.0400,brow_arch=.0015,brow_angle=-.0022,brow_peak=.40),
 'haku': dict(width=1.00,upper=.98,lower=.92,tilt=-.0025,apex=-.05,arch=.0008,hood=.00085,bag=.00150,crease=.00060,brow_y=.0405,brow_arch=.0048,brow_angle=-.0025,brow_peak=.34),
 'kai': dict(width=1.27,upper=.49,lower=.58,tilt=.0015,apex=-.50,arch=-.0010,hood=.00155,bag=.00060,crease=.00030,brow_y=.0370,brow_arch=.0003,brow_angle=.0040,brow_peak=.25),
 'sou': dict(width=1.26,upper=.38,lower=.46,tilt=.0045,apex=-.30,arch=-.0007,hood=.00035,bag=.00010,crease=.00025,brow_y=.0380,brow_arch=.0014,brow_angle=.0065,brow_peak=.66),
 'chin': dict(width=1.22,upper=.68,lower=.55,tilt=.0001,apex=-.12,arch=-.0005,hood=.00040,bag=.00020,crease=.00070,brow_y=.0398,brow_arch=.0014,brow_angle=.0002,brow_peak=.55)
}

def ocular_form(p):
    return EYE_FORMS[next(k for k,v in CAST.items() if v is p)]

def eye_anchor(e,p):
    # The globe follows the same spacing and horizontal orbit transform as the
    # complete skin loop. Vertical lid compression deliberately occludes it.
    center=sculpt(e,p)
    f=ocular_form(p)
    return dict(center=[round(c,6) for c in center],radius=round(ER,6),
                scale=[round(p['width']*f['width'],5),1,1])

def sculpt(v,p):
    x,y,z=v; ax=abs(x); side=1 if x>=0 else -1
    front=smooth(.005,.040,z)
    neck=smooth(-.130,-.070,y)
    jaw=gauss(y+.051,.034)*front*neck
    cheek=gauss(y+.002,.030)*gauss(ax-.045,.035)*front
    xx=x*(1+(p['width']-1)*neck)*(1+(p['jaw']-1)*jaw)*(1+(p['cheek']-1)*cheek*.45)
    yy=.028+(y-.028)*(1+(p['length']-1)*neck)
    zz=z
    # Asian nasal structure: lower radix, relatively restrained projection,
    # and a narrow continuous bridge. The tip stays part of the facial mesh.
    zz+=p['nose']*gauss(x,.014)*gauss(y+.002,.022)*front
    zz+=p['bridge']*gauss(x,.010)*gauss(y-.023,.026)*front
    zz-=.0013*gauss(ax-.020,.010)*gauss(y+.016,.014)*front
    # Independent upper/lower lid maps retain the continuous source topology.
    # The upper arch apex can move medially; the lower arch can stay rounded or
    # taut. Canthal tilt is applied to the complete orbit, including tear duct.
    ec=BASE_EYES[0] if x<0 else BASE_EYES[1]
    f=ocular_form(p);u=(ax-abs(ec.x))/.0100;ly=ec.y-.0014
    orbit=gauss(x-ec.x,.020)*gauss(y-ly,.017)*smooth(.033,.057,z)
    lid=gauss(x-ec.x,.017)*gauss(y-ly,.012)*smooth(.033,.057,z)
    upper=f['upper'];lower=f['lower'];asym=0
    if p is CAST['hai']:
        upper+=(-.10 if x<0 else .07);asym=(-.00035 if x<0 else .00015)
    scale=mix(lower,upper,smooth(ly-.0006,ly+.0008,y))
    yy+=(y-ly)*(scale-1)*lid
    yy+=(f['tilt']*u+asym)*orbit
    # A peaked inner upper lid and a straighter outer half are visibly distinct
    # from a symmetric arc even in clay and in the low resolution topology.
    uppermask=smooth(ly-.0003,ly+.002,y)*gauss(y-(ly+.003),.006)
    arch=f['arch']*gauss(u-f['apex'],.74)
    yy+=arch*uppermask*orbit
    xx+=side*abs(ec.x)*(p['space']-1)*orbit
    xx+=side*(ax-abs(ec.x))*(f['width']-1)*orbit*p['width']
    # Anatomical tissue, not floating lid strips: hood/bag/crease are displacements
    # on the same skin surface. The heavy elder's fold drops over the aperture.
    archline=ly+.0031+.0012*gauss(u-f['apex'],.8)
    zz+=f['hood']*gauss(y-(archline+.0027),.0028)*gauss(u,.98)*front
    yy-=f['hood']*.22*gauss(y-(archline+.0020),.0030)*gauss(u,1.0)*front
    zz-=f['crease']*gauss(y-(archline+.0058),.0010)*gauss(u,1.05)*front
    zz+=f['bag']*gauss(y-(ly-.0085),.0031)*gauss(u,.98)*front
    zz-=f['bag']*.38*gauss(y-(ly-.0125),.0011)*gauss(u,1.04)*front
    # Brow shelf / zygoma, with a soft plane transition into the cheek.
    zz+=.0016*gauss(ax-.030,.026)*gauss(y-.045,.011)*front
    zz+=.0015*gauss(ax-.043,.021)*gauss(y+.003,.020)*front
    if p['beard']:
        # Reserve a shallow bed under the beard at the convex chin tip. This
        # hidden compression prevents skin from emerging between hair-envelope
        # samples without adding more visible beard bulk.
        zz-=.0030*gauss(y+.069,.008)*gauss(x,.040)*front
    if p['age']>.3:
        age=p['age']
        zz-=.0018*age*gauss(ax-.042,.016)*gauss(y+.025,.023)*front
        yy-=.0013*age*gauss(ax-.043,.022)*gauss(y+.024,.025)*front
        # Nasolabial crease follows the anatomical cheek into the upper lip.
        fold=.015+max(0,-y-.010)*.40
        zz-=.0011*age*gauss(ax-fold,.0022)*gauss(y+.027,.027)*front
        # Fine forehead / lower-lid folds are sculpted into the continuous skin.
        for fy in (.065,.075,.084):
            zz-=.00070*age*gauss(y-fy-.002*math.cos(x*35),.0011)*gauss(x,.048)*front
        zz-=.00045*age*gauss(y-(ec.y-.012+.045*(ax-abs(ec.x))),.0010)*gauss(x-ec.x,.015)*front
        zz-=.0009*age*(gauss(x-.006,.0015)+gauss(x+.006,.0015))*gauss(y-.045,.011)*front
        for tilt in (-.25,.05,.28):
            zz-=.0005*age*gauss(y-(ec.y+(ax-.042)*tilt),.0010)*gauss(ax-.048,.008)*front
        if p is CAST['zo']:
            # Deep orbital bags and hollow temples change the old man's actual
            # facial planes, rather than relying on white hair as an age cue.
            zz-=.0032*gauss(ax-.050,.012)*gauss(y-.025,.025)*front
            yy-=.0030*gauss(ax-.043,.022)*gauss(y+.018,.028)*front
            zz-=.0014*(gauss(x-.005,.0018)+gauss(x+.005,.0018))*gauss(y-.047,.013)*front
    return Vector((xx,yy,zz))

def trim_neck(ob):
    bm=bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,-.095,0),plane_no=(0,1,0),clear_inner=True)
    edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.y+.095)<.00001 for v in e.verts)]
    ret=bmesh.ops.extrude_edge_only(bm,edges=edges)
    nv=[v for v in ret['geom'] if isinstance(v,bmesh.types.BMVert)]
    for v in nv:
        # Continue inside the standing/sitting costume collars, so side views
        # cannot expose the closed neck cap above the opening.
        v.co.y=-.205; v.co.x*=.92; v.co.z=(v.co.z+.020)*.92-.020
    end=[e for e in bm.edges if e.is_boundary and all(abs(v.co.y+.205)<.00001 for v in e.verts)]
    bmesh.ops.holes_fill(bm,edges=end,sides=0)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(ob.data); bm.free(); ob.data.update()

def surface_bvh(ob):
    return BVHTree.FromPolygons([v.co for v in ob.data.vertices],[list(p.vertices) for p in ob.data.polygons],all_triangles=False)

def sample(bvh,x,y,default=.045):
    r=bvh.ray_cast(Vector((x,y,.3)),Vector((0,0,-1)))
    return r[0].z if r[0] else default

def color_skin(ob,p):
    base=rgb(p['skin']); lip=rgb('a57165'); red=rgb('b67d69')
    a=ob.data.color_attributes.new(name='Complexion',type='BYTE_COLOR',domain='POINT')
    for i,v in enumerate(ob.data.vertices):
        x,y,z=v.co; front=smooth(.025,.050,z)
        # Keep the lip mask on the original vermilion, with local color variation.
        ly=-.038*p['length']; lw=gauss(x,.019)*gauss(y-ly,.0044)*front
        cheek=.15*gauss(abs(x)-.042,.021)*gauss(y+.003,.025)*front
        eye=.055*sum(gauss(x-e.x*p['width'],.018)*gauss(y-e.y,.013) for e in BASE_EYES)*front
        if p is CAST['zo']:
            eye+=.15*sum(gauss(x-e.x,.019)*gauss(y-(e.y-.018),.006) for e in BASE_EYES)*front
        c=[mix(mix(base[k],red[k],cheek),lip[k],lw*.60)*(1-eye) for k in range(3)]
        a.data[i].color=(*c,1)
    n=ob.data.materials[0].node_tree.nodes; l=ob.data.materials[0].node_tree.links
    attr=n.new('ShaderNodeVertexColor'); attr.layer_name='Complexion'; l.new(attr.outputs['Color'],n.get('Principled BSDF').inputs['Base Color'])
    ps=n.get('Principled BSDF'); ps.inputs['Subsurface Weight'].default_value=.045

def tube(name,points,radii,material,sides=7):
    # Interpolate the guide smoothly instead of exposing rigid polyline corners.
    if len(points)<8 and 'brow_strand' not in name:
        pp=[];rr=[]
        for j in range(len(points)-1):
            a=Vector(points[max(0,j-1)]);b=Vector(points[j]);c=Vector(points[j+1]);d=Vector(points[min(len(points)-1,j+2)])
            for k in range(6):
                t=k/6;pp.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t));rr.append(mix(radii[j],radii[j+1],t))
        pp.append(Vector(points[-1]));rr.append(radii[-1]);points=pp;radii=rr
    vv=[]; ff=[]
    for j,pt in enumerate(points):
        pt=Vector(pt); tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        tangent.normalize(); axis=tangent.cross(Vector((0,0,1)))
        if axis.length<.01: axis=tangent.cross(Vector((1,0,0)))
        axis.normalize(); other=tangent.cross(axis).normalized()
        for k in range(sides):
            a=k*math.tau/sides; vv.append(pt+radii[j]*(math.cos(a)*axis+math.sin(a)*other))
        if j:
            for k in range(sides): ff.append(((j-1)*sides+k,(j-1)*sides+(k+1)%sides,j*sides+(k+1)%sides,j*sides+k))
    ff.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+k for k in range(sides))])
    return mesh_object(name,vv,ff,material)

def add_brows(cid,p,bvh,material):
    result=[];f=EYE_FORMS[cid]
    def brow_point(s,t):
        # Inner crowding, peak position, direction and tail fall differ by actor.
        inner=.0085 if cid in ('u','kai') else .0105
        x=s*mix(inner,.046*p['width'],t)
        arch=max(0,1-((t-f['brow_peak'])/.65)**2)*f['brow_arch']
        y=f['brow_y']+arch+f['brow_angle']*(t-.45)
        if cid=='hai':y+=(-.0009 if s<0 else .0005)*(1-t)
        if cid=='zo':y-=.0017*smooth(.55,1,t)
        return x,y
    for s in (-1,1):
        pts=[]; rr=[]
        for j in range(25):
            t=j/24;x,y=brow_point(s,t)
            z=sample(bvh,x,y)+.00065
            pts.append((x,y,z)); rr.append(p['brow']*(.28+.72*math.sin(math.pi*t)**.6)*(.95-.38*t))
        result.append(tube(cid+'_brow_'+str(s),pts,rr,material,8))
        # Short tapered hair strokes support the brow silhouette at close range.
        for j in range(20):
            t=(j+.3)/21;x,y=brow_point(s,t)
            stroke=[]
            for k in range(3):
                xx=x+s*k*.0006; yy=y+k*.00065; stroke.append((xx,yy,sample(bvh,xx,yy)+.0010))
            result.append(tube(cid+'_brow_strand',stroke,[.00035,.00025,.00005],material,4))
    return result

def hairline(v,p):
    x,y,z=v; a=abs(math.atan2(x,z+.020))
    if a<.75: h=.077+.006*(a/.75)
    elif a<1.6:h=mix(.083,.014,(a-.75)/.85)
    else:h=mix(.014,-.077,(a-1.6)/(math.pi-1.6))
    h+=p['recede']*gauss(a-.95,.40)-.004*gauss(a,.28)
    if p is CAST['ryo']:h+=.009+.011*max(-1,min(1,x/.06))*smooth(.005,.045,z)
    return y-h

def scalp(cid,p,head,material,quality):
    vv=[]; ff=[]; positions=[v.co.copy() for v in head.data.vertices]
    normals=[v.normal.copy() for v in head.data.vertices]
    # Clip source skull polygons at the anatomical hairline and offset along
    # their own normals; this keeps temples, ears and the back of the skull fitted.
    for face in head.data.polygons:
        poly=[(positions[i],normals[i]) for i in face.vertices]
        out=[]
        for i,(v,n) in enumerate(poly):
            a,an=poly[i-1]; da=hairline(a,p); db=hairline(v,p)
            if (da>=0)!=(db>=0):
                t=da/(da-db); out.append((a.lerp(v,t),an.lerp(n,t).normalized()))
            if db>=0:out.append((v,n))
        if len(out)<3:continue
        face_idx=[]
        for v,n in out:
            a=math.atan2(v.x,v.z+.02); ridge=.00028*math.sin(a*72+v.y*26)
            loft=.0035*gauss(v.y-.09,.04)*smooth(.015,.060,v.z)
            v=v+n*(.0028+ridge+loft); face_idx.append(len(vv)); vv.append(v)
        ff.append(tuple(face_idx))
    ob=mesh_object(cid+'_hair',vv,ff,material)
    bm=bmesh.new();bm.from_mesh(ob.data); bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bm.to_mesh(ob.data);bm.free()
    solid=ob.modifiers.new('Hairline thickness','SOLIDIFY');solid.thickness=.0022;solid.offset=-1
    parts=[ob]
    bvh=surface_bvh(head)
    # Broad swept locks lie on the source skull, so their roots are physically
    # embedded in the hairline and their highlight describes combed hair volume.
    vv=[];ff=[];nc=15 if quality=='high' else 11;steps=27 if quality=='high' else 18;sides=7
    center=Vector((0,.036,-.014));destination=Vector((0,.93,-.37)).normalized()
    for lock in range(nc):
        a=mix(-1.68,1.68,lock/(nc-1));a+=.018*math.sin(lock*2.7)
        root_y=.076 if abs(a)<.72 else mix(.076,.018,(abs(a)-.72)/.96)
        if cid=='ryo':root_y+=.009+.011*math.sin(a)
        start=Vector((math.sin(a)*.068,root_y-center.y,math.cos(a)*.090)).normalized()
        pts=[];norms=[]
        for j in range(steps):
            t=j/(steps-1);d=(start*(1-t)+destination*t).normalized()
            d.x+=.09*math.sin(math.pi*t)*(1 if cid=='ryo' else .3);d.normalize()
            hit=bvh.ray_cast(center+d*.30,-d)
            if hit[0]:point=hit[0];n=hit[1]
            else:point=center+d*.08;n=d
            pts.append(point+n*(.0010+.0021*math.sin(t*math.pi)**.35));norms.append(n)
        # Embed the guides into the exact clipped cap at both ends.
        for j in range(steps):
            if hairline(pts[j],p)<0:pts[j]-=norms[j]*.0024
        offset=len(vv)
        for j in range(steps):
            t=j/(steps-1);tangent=(pts[min(steps-1,j+1)]-pts[max(0,j-1)]).normalized();n=norms[j];across=tangent.cross(n).normalized()
            width=(.0044+.0012*math.sin(a*2)**2)*(.10+.90*math.sin(math.pi*t)**.5)
            for k in range(sides):
                angle=k*math.tau/sides;vv.append(pts[j]+across*(math.cos(angle)*width)+n*(math.sin(angle)*width*.10))
            if j:
                for k in range(sides):q=offset+j*sides+k;ff.append((offset+(j-1)*sides+k,offset+(j-1)*sides+(k+1)%sides,offset+j*sides+(k+1)%sides,q))
    parts.append(mesh_object(cid+'_swept_locks',vv,ff,material))
    # A swept, looped chignon. Strands are ribbed around its actual volume.
    k=p['knot']; vv=[]; ff=[]
    for j in range(25):
        a=math.tau*j/24
        for i in range(33):
            b=math.tau*i/32; r=k*(.66+.30*math.cos(b)); strand=.00035*math.sin(b*16+a*3)
            vv.append(((r+strand)*math.sin(a),.123+k*.28+math.sin(b)*k*.55,-.027+(r+strand)*math.cos(a)*.82))
    for j in range(24):
        for i in range(32):
            a=j*33+i;ff.append((a,a+1,a+34,a+33))
    parts.append(mesh_object(cid+'_chignon',vv,ff,material))
    # Face framing wisps, attached to scalp at their roots, with pointed tips.
    for s in (-1,1):
        if cid in ('ryo','sou'):
            xx=s*.054;yy=.086;zz=sample(bvh,xx,yy)
            pts=[(xx,yy,zz+.001),(s*.059,.047,.031),(s*.058,.010,.043),(s*.054,-.023,.050),(s*.052,-.047,.046)]
            parts.append(tube(cid+'_temple_lock',pts,[.0015,.0016,.0012,.0007,.00005],material,10))
        pts=[(s*.061,.052,-.011),(s*.070,.004,-.022),(s*.061,-.035,-.035),(s*.049,-.073,-.040)]
        if cid in ('u','kai','zo'):pts.append((s*.045,-.103,-.039))
        parts.append(tube(cid+'_side_lock',pts,[.0020,.0022,.0016,.0001]+([.00005] if len(pts)==5 else []),material,10))
    return parts

def add_beard(cid,p,bvh,material,head):
    if not p['beard']:return []
    result=[];length={'hai':.118,'zo':.177,'u':.014,'haku':.021,'kai':.032,'chin':.025}[cid]
    long=cid in ('hai','zo');wide=(.044*p['width']) if cid!='chin' else .017
    ps=material.node_tree.nodes.get('Principled BSDF');ps.inputs['Specular IOR Level'].default_value=.18;ps.inputs['Roughness'].default_value=.80
    # Skin-fitted cheek roots. The underside is part of the closed beard volume,
    # so a facial mask can never spill onto the neck or the ear lobes.
    def growth(v,n):
        x,y,z=v;ax=abs(x)
        top=(-.048 if cid=='chin' else -.049+.043*smooth(.010,.055*p['width'],ax))
        top+=.0006*math.sin(x*670)+.00025*math.sin(x*1790)
        return min(top-y,y+.066,z-mix(.026,.034,smooth(.033,.053*p['width'],ax)),
                   ((.019 if cid=='chin' else .054*p['width'])-ax),(n.z-.12)*.03)
    vv=[];ff=[]
    for face in head.data.polygons:
        if face.normal.z<.10:continue
        poly=[(head.data.vertices[i].co.copy(),head.data.vertices[i].normal.copy()) for i in face.vertices];clipped=[]
        for i,(v,n) in enumerate(poly):
            a,an=poly[i-1];da=growth(a,an);db=growth(v,n)
            if (da>=0)!=(db>=0):
                t=da/(da-db);clipped.append((a.lerp(v,t),an.lerp(n,t).normalized()))
            if db>=0:clipped.append((v,n))
        if len(clipped)<3:continue
        ids=[]
        for v,n in clipped:ids.append(len(vv));vv.append(v+n*.0005)
        ff.append(tuple(ids))
    coat=mesh_object(cid+'_beard_roots',vv,ff,material)
    bm=bmesh.new();bm.from_mesh(coat.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000015);bm.to_mesh(coat.data);bm.free();coat.data.update()
    feather=coat.data.attributes.new(name='SkinBlend',type='FLOAT',domain='POINT')
    for i,v in enumerate(coat.data.vertices):
        # Feather only the cheek growth line. A skin-coloured feather along the
        # bottom root would remain visible on top of the dark beard envelope.
        feather.data[i].value=.85*(1-smooth(.0001,.003,growth(v.co,v.normal)))*smooth(-.058,-.044,v.co.y)
    result.append(coat)
    # A closed cross-section follows the narrowing jaw before the hanging part
    # tapers. The source skin under this envelope is fitted after smoothing.
    end=-.075-length;nr=65;nt=41
    def beard_point(a,t):
        rooty=-.043+.009*abs(math.sin(a));y=mix(rooty,end,t)
        below=smooth(-.073,end,y)
        jawtaper=1-.40*smooth(-.048,-.078,y)
        taper=max(.001,jawtaper*(1-.999*below**.80))
        x=math.sin(a)*wide*taper
        center=mix(.026,.051 if long else .038,t);depth=.026*taper
        z=center+math.cos(a)*depth
        if math.cos(a)>-.24:
            # Reserve room for both the convex source chin between sampled
            # vertices and the smoothed envelope. A sub-mm offset is insufficient
            # there: the denser skin otherwise pokes through coarse beard quads.
            hit=bvh.ray_cast(Vector((x,y,.3)),Vector((0,0,-1)))
            if hit[0] is not None:z=max(z,hit[0].z+.0045*smooth(0,.035,t))
        return Vector((x,y,z))
    vv=[];ff=[]
    for j in range(nt):
        t=j/(nt-1)
        for i in range(nr):
            a=i/(nr-1)*math.tau;point=beard_point(a,t)
            point.z+=.00010*math.sin(a*37+t*8)*math.sin(math.pi*t)
            vv.append(point)
            if j and i:q=j*nr+i;ff.append((q-nr-1,q-nr,q,q-1))
    ff.append(tuple(range(nr-1,-1,-1)));ff.append(tuple((nt-1)*nr+i for i in range(nr)))
    core=mesh_object(cid+'_beard_volume',vv,ff,material)
    bm=bmesh.new();bm.from_mesh(core.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0000002)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(core.data);bm.free();core.data.update()
    # Gentle smoothing removes the source chin-to-neck transition from the
    # outer hair envelope, while retaining the embedded root and closed tip.
    sm=core.modifiers.new('Soft combed hair envelope','SMOOTH');sm.factor=.34;sm.iterations=3
    bpy.context.view_layer.objects.active=core
    bpy.ops.object.modifier_apply(modifier=sm.name)
    # Recess only skin actually covered by the final closed envelope. This is a
    # hidden contact bed, and handles the dense source chin between coarse hair
    # quads without changing any exposed face, neck, mouth or eye surface.
    envelope=surface_bvh(core)
    for vertex in head.data.vertices:
        x,y,z=vertex.co
        if not (-.088<y<-.043 and z>.025 and abs(x)<wide*1.02):continue
        hit=envelope.ray_cast(Vector((x,y,.3)),Vector((0,0,-1)))
        if hit[0] is not None and hit[1].z>.08 and z>hit[0].z-.0012:
            vertex.co.z=hit[0].z-.0012
    head.data.update()
    result.append(core)
    for strand in range(37 if long else 23):
        count=37 if long else 23;u=(strand+.5)/count*2-1;pts=[];rr=[]
        for j in range(nt):
            t=j/(nt-1);a=math.asin(u*.96)+.015*math.sin(t*5+strand)*math.sin(math.pi*t)
            point=beard_point(a,t);point.z+=.00015*math.sin(math.pi*t)
            pts.append(point);rr.append((.00008+.00024*math.sin(math.pi*t)**.5)*(1-.94*t))
        result.append(tube(cid+'_beard_fibre',pts,rr,material,5))
    for side in (-1,1):
        pts=[];rr=[]
        for j in range(17):
            t=j/16;x=side*mix(.001,.027 if cid!='chin' else .022,t)
            y=-.024-.006*t-.010*t*t*(1 if cid in ('zo','hai','haku') else .2)
            pts.append((x,y,sample(bvh,x,y)+.0015+.001*math.sin(math.pi*t)))
            rr.append((.0015+.0014*math.sin(math.pi*t))*(1-.78*t))
        result.append(tube(cid+'_moustache',pts,rr,material,10))
    return result

def join_parts(parts,name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:ob.hide_set(False);ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    for ob in parts:
        bpy.context.view_layer.objects.active=ob
        for mod in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();parts[0].name=name
    return parts[0]

INDEX_POOL={}
def export_mesh(ob):
    me=ob.data;me.calc_loop_triangles()
    pos=[c for v in me.vertices for c in v.co]
    # 1/100000m quantization is finer than a rendered portrait pixel.
    encoded=base64.b64encode(struct.pack('<'+'h'*len(pos),*[round(x*100000) for x in pos])).decode()
    normals=base64.b64encode(struct.pack('b'*(len(me.vertices)*3),*[round(max(-1,min(1,c))*127) for v in me.vertices for c in v.normal])).decode()
    idx=[i for tri in me.loop_triangles for i in tri.vertices]
    idata=base64.b64encode(struct.pack('<'+'H'*len(idx),*idx)).decode()
    key=next((k for k,v in INDEX_POOL.items() if v==idata),None)
    if key is None:key='i'+str(len(INDEX_POOL));INDEX_POOL[key]=idata
    result=dict(p=encoded,n=normals,i=key,v=len(me.vertices),t=len(idx)//3)
    attr=me.color_attributes.get('Complexion')
    if attr:
        result['c']=base64.b64encode(bytes(round(max(0,min(1,c))*255) for v in attr.data for c in v.color[:3])).decode()
    return result

def eyes_render(cid,p,anchors):
    result=[]
    white=mat(cid+'_sclera',rgb('c6b8a5'),.24);iris=mat(cid+'_iris',rgb('281c14'),.23);pupil=mat(cid+'_pupil',rgb('080706'),.15)
    for i,e in enumerate(anchors):
        center=Vector(e['center']);r=e['radius']
        for kind,rad,depth,zoff,ma in [('eye',r,r,0,white),('iris',r*.47,r*.06,r*.928,iris),('pupil',r*.205,r*.035,r*.979,pupil)]:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,radius=1,location=center+Vector((0,0,zoff)))
            ob=bpy.context.object;ob.name=cid+'_'+kind+'_'+str(i);ob.scale=(rad*e['scale'][0],rad*e['scale'][1],depth*e['scale'][2]);ob.data.materials.append(ma)
            for f in ob.data.polygons:f.use_smooth=True
            result.append(ob)
    return result

def target_camera(pos, target):
    ca=bpy.context.scene.camera; ca.location=pos
    z=(ca.location-Vector(target)).normalized(); x=Vector((0,1,0)).cross(z).normalized(); y=z.cross(x)
    ca.rotation_euler=Matrix((x,y,z)).transposed().to_euler()

def setup_render():
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.resolution_x=640; scene.render.resolution_y=800; scene.render.resolution_percentage=100
    scene.world.color=(.22,.22,.22)
    scene.view_settings.view_transform='AgX'
    bpy.ops.object.camera_add(); ca=bpy.context.object; ca.name='Head review camera'; scene.camera=ca
    ca.data.type='ORTHO'; ca.data.ortho_scale=.42
    for name, loc, power, size in [('Key',(-.35,.30,.48),6,.35),('Fill',(.38,.10,.20),2,.34),('Rim',(.1,.30,-.35),5,.25)]:
        bpy.ops.object.light_add(type='AREA',location=loc); ob=bpy.context.object; ob.name=name; ob.data.energy=power; ob.data.shape='DISK'; ob.data.size=size
        ob.rotation_euler=(Vector((0,-.01,0))-ob.location).to_track_quat('-Z','Y').to_euler()
    scene.render.image_settings.file_format='PNG'

def color_hair(ob,p,facial=False):
    base=rgb(p['hair']);grey=rgb('b4aea2');skin=rgb(p['skin']);a=ob.data.color_attributes.new(name='Complexion',type='BYTE_COLOR',domain='POINT')
    rootblend=ob.data.attributes.get('SkinBlend')
    for i,v in enumerate(ob.data.vertices):
        x,y,z=v.co; angle=math.atan2(x,z+.020)
        streak=max(0,math.sin(angle*135+y*36))**18
        if facial:streak=max(0,math.sin(x*1270+y*18))**10
        w=p['grey']*((.20+.30*streak) if facial else (.10+.60*streak))
        c=[mix(base[k],grey[k],w) for k in range(3)]
        if rootblend:
            blend=rootblend.data[i].value;c=[mix(c[k],skin[k],blend) for k in range(3)]
        a.data[i].color=(*c,1)
    n=ob.data.materials[0].node_tree.nodes;l=ob.data.materials[0].node_tree.links
    attr=n.new('ShaderNodeVertexColor');attr.layer_name='Complexion';l.new(attr.outputs['Color'],n.get('Principled BSDF').inputs['Base Color'])
    noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=440;noise.inputs['Detail'].default_value=2
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.20;bump.inputs['Distance'].default_value=.00045
    l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],n.get('Principled BSDF').inputs['Normal'])

assets={};render_objects={};base_coords={}
for q,level in [('high',1),('low',0)]:
    coords,faces=normalized_source(level)
    temp=mesh_object('normalized_neck_template',coords,faces,mat('temp',(.5,.5,.5)))
    trim_neck(temp)
    base_coords[q]=([v.co.copy() for v in temp.data.vertices],[tuple(f.vertices) for f in temp.data.polygons])
    bpy.data.objects.remove(temp,do_unlink=True)
source.modifiers[0].levels=1
for cid,p in CAST.items():
    if PROTO and cid!='ryo':continue
    record={'lod':{},'skin':p['skin'],'hair':p['hair'],'age':p['age']}
    eye_anchors=[eye_anchor(e,p) for e in BASE_EYES]
    record['eyeForm']=dict(EYE_FORMS[cid])
    record['anchors']={'eyes':eye_anchors,'hat':{'offset':[0,.006,-.005],'scale':[p['width']*.98,1,1]},'crown':[0,.137,-.027],'chin':[0,-.068*p['length'],.045],'neck':[0,-.205,-.020]}
    for quality in ('high','low'):
        coords,faces=base_coords[quality]
        skin=mat(cid+'_'+quality+'_skin',rgb(p['skin']),.54 if p['age']>.5 else .48)
        head=mesh_object(cid+'_'+quality+'_skin',[sculpt(v,p) for v in coords],faces,skin)
        color_skin(head,p);bvh=surface_bvh(head)
        hairmat=mat(cid+'_'+quality+'_hair',rgb(p['hair']),.62)
        hair=join_parts(scalp(cid,p,head,hairmat,quality),cid+'_'+quality+'_hair');color_hair(hair,p)
        browmat=mat(cid+'_'+quality+'_brows',rgb(p['hair']),.70)
        brow=join_parts(add_brows(cid,p,bvh,browmat),cid+'_'+quality+'_brow');color_hair(brow,p,True)
        parts={'skin':head,'hair':hair,'brow':brow}
        beardparts=add_beard(cid,p,bvh,mat(cid+'_'+quality+'_beard',rgb(p['hair']),.72),head)
        if beardparts:
            beard=join_parts(beardparts,cid+'_'+quality+'_beard');color_hair(beard,p,True);parts['beard']=beard
        record['lod'][quality]={name:export_mesh(ob) for name,ob in parts.items() if quality=='high' or name in ('skin','hair')}
        for ob in parts.values():ob['part']=ob.name.rsplit('_',1)[-1];ob['cast_id']=cid;ob.hide_render=True;ob.hide_set(True)
        if quality=='high':render_objects[cid]=list(parts.values())+eyes_render(cid,p,eye_anchors)
    for ob in render_objects[cid]:ob.hide_render=True;ob.hide_set(True)
    assets[cid]=record

out={'version':1,'source':'Blender Studio Human Base Meshes v1.2.0 / CC0','quantization':.00001,'indices':INDEX_POOL,'cast':assets}
js='/* Generated by tools/build-head-assets.py. CC0 source attribution: docs/assets/manifest.csv. */\nwindow.KM_HEAD_ASSETS='+json.dumps(out,separators=(',',':'))+';\n'
export_path=(OUT/'head-assets-prototype.js') if PROTO else (ROOT/'src/js/koumon-head-assets.js')
export_path.write_text(js,encoding='utf-8')
setup_render()
if '--quick-review' in sys.argv:
    bpy.context.scene.cycles.samples=24;bpy.context.scene.render.resolution_x=512;bpy.context.scene.render.resolution_y=640
views=[('front',(0,.0,.7)),('threequarter',(.40,.025,.55)),('side',(.7,.0,.001)),('top',(.12,.6,.25))]
if '--no-render' in sys.argv:views=[]
for cid,objects in render_objects.items():
    for ob in objects:ob.hide_render=False;ob.hide_set(False)
    for name,pos in views:
        if '--quick-review' in sys.argv and (cid not in ('u','haku','hai','zo') or name!='threequarter'):continue
        if not PROTO and '--all-views' not in sys.argv and cid!='ryo' and name not in ('front','threequarter'):continue
        target_camera(pos,(0,-.035,.005));bpy.context.scene.render.filepath=str(OUT/(cid+'-head-'+name+'.png'));bpy.ops.render.render(write_still=True)
    for ob in objects:ob.hide_render=True;ob.hide_set(True)
for ob in render_objects['ryo']:ob.hide_render=False;ob.hide_set(False)
target_camera((.40,.025,.55),(0,-.035,.005))
for ob in backup.objects:
    if ob.asset_data:
        print('ASSET_AUTHOR',ob.name,ob.asset_data.author,ob.asset_data.description)
# Loaded cameras, stale materials and unused source blocks never enter exports.
bpy.ops.outliner.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'heads-assets.blend'))
if not PROTO:
    editable=ROOT/'source-assets';editable.mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(editable/'heads.blend'),compress=True)
print('HEAD_ASSETS',[(k,{q:{n:(d['v'],d['t']) for n,d in v.items()} for q,v in a['lod'].items()}) for k,a in assets.items()])
print('EXPORT_BYTES',len(js.encode('utf-8')))
