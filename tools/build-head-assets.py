"""Build the cast's game heads from Blender Studio's CC0 Human Base Meshes.

Source: https://www.blender.org/download/demo-files/#assets
Human Base Meshes v1.2.0, CC0, see docs/assets/manifest.csv.
Run with Blender 4.5: blender -b --python tools/build-head-assets.py -- [--prototype] [--source PATH]
Canonical export: metres, +Y up, +Z face. The source is +Z up, -Y face.
"""
import bpy, bmesh, math, json, os, sys, copy, base64, struct, shutil, random, bisect
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
 'u': dict(width=1.07,jaw=1.04,cheek=1.04,length=1.075,nose=.006,bridge=.004,eye=.60,tilt=.0040,space=1.03,age=.22,skin='bf9475',hair='17120f',grey=0,brow=.0039,slope=.004,beard=.014,recede=.001,knot=.037),
 'zo': dict(width=.99,jaw=.93,cheek=1.06,length=1.09,nose=.008,bridge=.002,eye=.59,tilt=-.0015,space=1.00,age=1.45,skin='be9877',hair='b8b3a7',grey=.95,brow=.0030,slope=-.002,beard=.178,recede=.020,knot=.023),
 'haku': dict(width=1.15,jaw=1.07,cheek=1.11,length=.95,nose=.003,bridge=.001,eye=.72,tilt=-.002,space=1.04,age=.85,skin='b88d6e',hair='302a24',grey=.40,brow=.0028,slope=-.002,beard=.061,recede=.011,knot=.025),
 'kai': dict(width=1.28,jaw=1.34,cheek=1.20,length=.96,nose=.007,bridge=.002,eye=.58,tilt=.004,space=1.05,age=.55,skin='aa7c5e',hair='17130f',grey=.06,brow=.0053,slope=.004,beard=.032,recede=.001,knot=.038),
 'sou': dict(width=1.05,jaw=1.01,cheek=1.06,length=1.01,nose=.001,bridge=.001,eye=.64,tilt=.0042,space=1.07,age=.04,skin='c59b7c',hair='18130f',grey=0,brow=.0028,slope=.004,beard=0,recede=.0,knot=.033),
 'chin': dict(width=1.01,jaw=.98,cheek=1.00,length=1.05,nose=.004,bridge=.001,eye=.72,tilt=.0018,space=1.05,age=.18,skin='caa587',hair='201913',grey=.03,brow=.0022,slope=.000,beard=.030,recede=.005,knot=.025)
}
BASE_EYES=[canon(c) for c,r in eye_source]
ER=eye_source[0][1]*.64

FACE_FORMS={
 'ryo':dict(nasal=.95,chin=.0015,plane=.0012,corner=.0009,lip=.00050),
 'hai':dict(nasal=1.02,chin=.0010,plane=.0006,corner=.0004,lip=.00020),
 'u':dict(nasal=.95,chin=.0025,plane=.0022,corner=.0014,lip=.00050),
 'zo':dict(nasal=1.00,chin=.0007,plane=.0007,corner=.0002,lip=.00015),
 'haku':dict(nasal=1.06,chin=.0006,plane=.0003,corner=.0008,lip=.00025),
 'kai':dict(nasal=1.23,chin=.0018,plane=.0008,corner=.0004,lip=.00040),
 'sou':dict(nasal=.94,chin=.0020,plane=.0018,corner=.0012,lip=.00045),
 'chin':dict(nasal=.97,chin=.0014,plane=.0011,corner=.0011,lip=.00055)
}

HAIR_FORMS={
 'ryo':dict(front=.080,temple=.028,sideburn=.046,top=.0060,side=.0045,rough=.10,part=.35),
 'hai':dict(front=.078,temple=.033,sideburn=.036,top=.0040,side=.0040,rough=.08,part=.05),
 'u':dict(front=.077,temple=.025,sideburn=.049,top=.0095,side=.0060,rough=.13,part=.08),
 'zo':dict(front=.084,temple=.038,sideburn=.028,top=.0040,side=.0042,rough=.13,part=.10),
 'haku':dict(front=.079,temple=.032,sideburn=.038,top=.0050,side=.0050,rough=.12,part=.08),
 'kai':dict(front=.071,temple=.021,sideburn=.052,top=.0090,side=.0100,rough=.48,part=-.18),
 'sou':dict(front=.079,temple=.027,sideburn=.048,top=.0070,side=.0052,rough=.18,part=.22),
 'chin':dict(front=.080,temple=.029,sideburn=.043,top=.0060,side=.0048,rough=.07,part=.06)
}

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
    identity=next(k for k,vv in CAST.items() if vv is p);facial=FACE_FORMS[identity]
    neck_fill={'u':1.23,'kai':1.36,'hai':1.10,'haku':1.12}.get(identity,1.0)
    neck_mask=1-smooth(-.145,-.077,y)
    xx*=1+(neck_fill-1)*neck_mask
    zz=-.018+(zz+.018)*(1+(neck_fill-1)*.75*neck_mask)
    # Source-topology changes to nasal wings, cheek planes and lip/chin profile.
    # They preserve continuous anatomy and separate the long-faced general from
    # the broad-jawed guard before hair or material differences are considered.
    xx+=x*(facial['nasal']-1)*gauss(x,.025)*gauss(y+.003,.022)*front
    zz+=facial['chin']*gauss(x,.026)*gauss(y+.063,.013)*front
    zz-=facial['plane']*gauss(ax-.041,.016)*gauss(y+.024,.020)*front
    yy+=facial['corner']*gauss(ax-.020,.009)*gauss(y+.038,.009)*front
    zz+=facial['lip']*gauss(x,.018)*(gauss(y+.035,.0022)+.8*gauss(y+.041,.0025))*front
    if identity in ('u','sou','ryo','chin'):
        zz+=.0013*gauss(x,.008)*gauss(y-.015,.025)*front
        zz-=.0008*gauss(x,.013)*gauss(y+.005,.010)*front
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
    if p['beard'] and identity in ('hai','zo'):
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

class GroomMesh:
    """Static three-sided tapered fibres; no particles or runtime grooming."""
    def __init__(self):self.vertices=[];self.faces=[];self.shades=[];self.blends=[]
    def fibre(self,points,radius,shade=1,blend=.0,sides=3):
        start=len(self.vertices);count=len(points)
        for j,point in enumerate(points):
            t=j/(count-1);tangent=(points[min(j+1,count-1)]-points[max(0,j-1)]).normalized()
            axis=tangent.cross(Vector((0,0,1)))
            if axis.length<.01:axis=tangent.cross(Vector((1,0,0)))
            axis.normalize();other=tangent.cross(axis).normalized()
            r=radius*(.86+.14*math.sin(math.pi*t))*(1-t)**.68+.000008
            for k in range(sides):
                a=k*math.tau/sides;self.vertices.append(point+r*(axis*math.cos(a)+other*math.sin(a)))
                self.shades.append(shade*(.87+.22*t));self.blends.append(blend*(1-smooth(0,.25,t)))
            if j:
                for k in range(sides):self.faces.append((start+(j-1)*sides+k,start+(j-1)*sides+(k+1)%sides,start+j*sides+(k+1)%sides,start+j*sides+k))
    def object(self,name,material):
        ob=mesh_object(name,self.vertices,self.faces,material)
        for name,values in [('GroomShade',self.shades),('SkinBlend',self.blends)]:
            attr=ob.data.attributes.new(name=name,type='FLOAT',domain='POINT')
            for i,value in enumerate(values):attr.data[i].value=value
        return ob

def add_brows(cid,p,bvh,material,quality='high'):
    groom=GroomMesh();f=EYE_FORMS[cid];rng=random.Random(cid+'-brows')
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
        for j in range(250 if quality=='high' else 60):
            t=rng.random();x,y=brow_point(s,t)
            fullness=(.30+.70*math.sin(math.pi*t)**.55)*(1-.32*t)
            y+=(rng.random()*2-1)*p['brow']*.73*fullness
            extent=mix(.0027,.0041,math.sin(math.pi*t))*(.75+.5*rng.random())
            points=[]
            for k in range(3):
                q=k/2;xx=x+s*extent*.76*q;yy=y+extent*(.68-.65*t)*q
                points.append(Vector((xx,yy,sample(bvh,xx,yy)+.00020+.00045*math.sin(math.pi*q))))
            groom.fibre(points,.00016 if cid!='zo' else .00020,.7+rng.random()*.9,.20)
    return [groom.object(cid+'_rooted_brow_groom',material)]

def hair_height(a,p):
    f=HAIR_FORMS[next(k for k,v in CAST.items() if v is p)]
    knots=[(0,f['front']-.003),(.40,f['front']+.003),(.70,f['front']-.027),(1.00,.035),(1.35,f['temple']+.005),(1.68,f['temple']),(2.08,-.008),(2.50,-.055),(math.pi,-.080)]
    h=knots[-1][1]
    for (a0,h0),(a1,h1) in zip(knots,knots[1:]):
        if a<=a1:h=mix(h0,h1,smooth(a0,a1,a));break
    h-=f['sideburn']*gauss(a-1.15,.17)
    h+=p['recede']*gauss(a-.88,.35)
    return h

def hairline(v,p):
    x,y,z=v;a=abs(math.atan2(x,z+.020));f=HAIR_FORMS[next(k for k,vv in CAST.items() if vv is p)]
    h=hair_height(a,p)
    h+=f['rough']*(.0016*math.sin(a*21+x*29)+.0009*math.sin(a*47-y*25))
    # A swept, asymmetric forehead edge with small rooted irregularities.
    # The temple boundary stays dense; only the exposed frontal edge varies.
    h+=(.0024*math.sin(x*53+.65)+.0010*math.sin(x*331+.3))*smooth(.005,.050,z)
    if p is CAST['ryo']:h+=.0045*max(-1,min(1,x/.06))*smooth(.005,.045,z)
    return y-h

def scalp(cid,p,head,material,quality):
    f=HAIR_FORMS[cid];vv=[];ff=[]
    ps=material.node_tree.nodes.get('Principled BSDF');ps.inputs['Roughness'].default_value=.66;ps.inputs['Specular IOR Level'].default_value=.30
    positions=[v.co.copy() for v in head.data.vertices];normals=[v.normal.copy() for v in head.data.vertices]
    # The continuous anatomical scalp now includes temple, sideburn and nape.
    # Loft is feathered into embedded roots rather than leaving a floating edge.
    for face in head.data.polygons:
        poly=[(positions[i],normals[i]) for i in face.vertices];out=[]
        for i,(v,n) in enumerate(poly):
            a,an=poly[i-1];da=hairline(a,p);db=hairline(v,p)
            if (da>=0)!=(db>=0):
                t=da/(da-db);out.append((a.lerp(v,t),an.lerp(n,t).normalized()))
            if db>=0:out.append((v,n))
        if len(out)<3:continue
        ids=[]
        for v,n in out:
            angle=math.atan2(v.x,v.z+.020);growth=smooth(0,.023,hairline(v,p))
            top=f['top']*gauss(v.y-.096,.040)*smooth(.005,.060,v.z)
            side=f['side']*gauss(abs(angle)-1.25,.58)*gauss(v.y-.061,.057)
            wave=.00055*math.sin(angle*17+v.y*39)*(1+f['rough'])
            wave+=.0040*gauss(angle+.32,.53)*gauss(v.y-.102,.032)*smooth(.005,.055,v.z)
            wave-=.0012*gauss(angle-.72,.27)*gauss(v.y-.105,.027)
            loft=.0010+(.0030+top+side+wave)*growth
            ids.append(len(vv));vv.append(v+n*loft)
        ff.append(tuple(ids))
    cap=mesh_object(cid+'_continuous_scalp',vv,ff,material)
    bm=bmesh.new();bm.from_mesh(cap.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000015);bm.to_mesh(cap.data);bm.free();cap.data.update()
    solid=cap.modifiers.new('Embedded scalp edge','SOLIDIFY');solid.thickness=.0032;solid.offset=-1
    parts=[cap];bvh=surface_bvh(head);capbvh=surface_bvh(cap);center=Vector((0,.035,-.018))
    def scalp_point(d):
        d=Vector(d).normalized();hit=capbvh.ray_cast(center+d*.30,-d)
        if hit[0] is not None:return hit[0],hit[1]
        hit=bvh.ray_cast(center+d*.30,-d)
        if hit[0] is not None:return hit[0]+hit[1]*.001,hit[1]
        return center+d*.08,d
    def lock_mesh(name,points,norms,widths,heights):
        verts=[];faces=[];sides=9
        for j,point in enumerate(points):
            tangent=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized();normal=norms[j];across=tangent.cross(normal)
            if across.length<.0001:across=Vector((1,0,0))
            across.normalize()
            for k in range(sides):
                a=k*math.tau/sides;verts.append(point+across*(math.cos(a)*widths[j])+normal*(.00015+math.sin(a)*heights[j]))
            if j:
                for k in range(sides):faces.append(((j-1)*sides+k,(j-1)*sides+(k+1)%sides,j*sides+(k+1)%sides,j*sides+k))
        faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+k for k in range(sides))])
        return mesh_object(name,verts,faces,material)
    # Broad flattened locks are laid into this exact lofted cap. They divide the
    # large highlight into a swept flow, with a taller wave for Xiang Yu and a
    # wider, irregular silhouette for Fan Kuai.
    count=(25 if cid=='kai' else 21) if quality=='high' else 15;steps=25 if quality=='high' else 17
    destination=Vector((f['part']*.25,.78,-.62)).normalized()
    for lock in range(count):
        a=mix(-1.86,1.86,lock/(count-1));a+=.025*math.sin(lock*2.39)+f['rough']*.09*math.sin(lock*2.7)
        root_y=hair_height(abs(a),p)+.003+.0017*math.sin(lock*1.93)
        seed=Vector((math.sin(a)*.076*p['width'],root_y-center.y,math.cos(a)*.091))
        start=seed.normalized();points=[];norms=[];widths=[];heights=[]
        for j in range(steps):
            t=j/(steps-1);d=(start*(1-t)+destination*t).normalized()
            d.x+=f['part']*.16*math.sin(math.pi*t)+f['rough']*.05*math.sin(lock*2.1+t*7)*math.sin(math.pi*t);d.normalize()
            point,normal=scalp_point(d)
            point+=normal*(.0001+f['rough']*.0015*math.sin(t*math.pi)**.5)
            points.append(point);norms.append(normal)
            taper=.12+.88*math.sin(math.pi*t)**.55
            widths.append((.0063+.0022*math.sin(lock*1.9)**2)*(1+f['rough']*.25)*taper)
            heights.append((.00035+.00030*math.sin(lock*2.1)**2+f['rough']*.0008)*taper)
        parts.append(lock_mesh(cid+'_swept_hair_mass',points,norms,widths,heights))
    # Continuous side masses arc above the ear and meet the nape behind it.
    for side in (-1,1):
        for band in range(4 if cid=='kai' else 3):
            points=[];norms=[];widths=[];heights=[]
            for j in range(29):
                t=j/28;a=side*mix(.94+band*.08,2.25+band*.035,t)
                y=.034+band*.006+.021*math.sin(math.pi*t)-.052*t
                d=Vector((math.sin(a)*.078*p['width'],y-center.y,math.cos(a)*.085))
                point,normal=scalp_point(d);points.append(point);norms.append(normal)
                taper=.12+.88*math.sin(math.pi*t)**.45
                widths.append((.0062 if cid!='kai' else .0090)*taper);heights.append((.0016 if cid!='kai' else .0027)*taper)
            parts.append(lock_mesh(cid+'_temporal_sweep',points,norms,widths,heights))
        if cid in ('ryo','sou'):
            points=[];norms=[];widths=[];heights=[]
            for j in range(29):
                t=j/28;x=side*(.051+.003*math.sin(t*math.pi))*p['width'];y=mix(.086,-.039 if cid=='ryo' else -.026,t)
                z=sample(bvh,x,y);near=bvh.find_nearest(Vector((x,y,z)));normal=near[1] if near[1] is not None else Vector((0,0,1))
                point=Vector((x,y,z))+normal*(.0012+.0010*math.sin(math.pi*t))
                points.append(point);norms.append(normal);widths.append(.0045*(1-t)**.75+.00005);heights.append(.0010*(1-t)+.00005)
            parts.append(lock_mesh(cid+'_framing_hair_mass',points,norms,widths,heights))
    # Fine swept fibres break the smooth cap highlight and its uniform edge.
    # These are a single static mesh, following the same scalp contact field.
    rng=random.Random(cid+'-scalp-flow');groom=GroomMesh()
    for strand in range(650 if quality=='high' else 160):
        a=mix(-1.89,1.89,rng.random());root_y=hair_height(abs(a),p)+rng.random()*.021
        start=Vector((math.sin(a)*.076*p['width'],root_y-center.y,math.cos(a)*.091)).normalized()
        offset=rng.random();flow_end=.48+.49*rng.random();points=[]
        for j in range(7 if quality=='high' else 5):
            t=j/(6 if quality=='high' else 4)*flow_end
            d=(start*(1-t)+destination*t).normalized()
            d.x+=f['part']*.16*math.sin(math.pi*t)+.008*math.sin(t*9+offset*6)*math.sin(math.pi*t);d.normalize()
            point,normal=scalp_point(d)
            point+=normal*(.00060+.00050*math.sin(math.pi*t)+f['rough']*.0006*math.sin(t*7+offset*6))
            points.append(point)
        groom.fibre(points,(.00014+.00008*rng.random())*(1 if quality=='high' else 1.45),.7+.7*rng.random())
    parts.append(groom.object(cid+'_combed_surface_fibres',material))
    # Looped chignon, shaped as combed hair rather than unassigned headwear.
    k=p['knot'];verts=[];faces=[]
    for j in range(25):
        a=math.tau*j/24
        for i in range(33):
            b=math.tau*i/32;r=k*(.66+.30*math.cos(b));strand=.00032*math.sin(b*16+a*3)
            verts.append(((r+strand)*math.sin(a),.123+k*.28+math.sin(b)*k*.55,-.027+(r+strand)*math.cos(a)*.82))
    for j in range(24):
        for i in range(32):
            a=j*33+i;faces.append((a,a+1,a+34,a+33))
    parts.append(mesh_object(cid+'_chignon',verts,faces,material))
    return parts

def beard_growth(cid,p,v,n):
    """A soft density field over actual cheek, jaw and under-chin anatomy."""
    x,y,z=v;ax=abs(x);under=smooth(-.050,-.078,y)
    if cid=='chin':
        top=-.047+.002*math.cos(x*90);limit=.022
    else:
        cheek={'u':.027,'kai':.036,'hai':.029,'zo':.027,'haku':.028}[cid]
        top=-.047+cheek*smooth(.012,.060*p['width'],ax)
        top+=.003*math.sin(x*79)+.0012*math.sin(x*431)
        limit=(.066 if cid=='kai' else .060)*p['width']
    return min(top-y,y+.087,limit-ax,z-mix(.026,.008,under),
               (n.z-mix(.16,-.45,under))*.040,
               mix(.025,(-n.y-.025)*.050,under))

def add_beard(cid,p,bvh,material,head,quality='high'):
    if not p['beard']:return []
    long=cid in ('hai','zo');rng=random.Random(cid+'-groom')
    groom=GroomMesh();me=head.data;me.calc_loop_triangles();triangles=[];areas=[];area=0
    # Sample by triangle area, so source topology density cannot make clumps or
    # regular rows. Roots lie on the anatomical surface, including the underside.
    for tri in me.loop_triangles:
        verts=[me.vertices[i] for i in tri.vertices]
        center=sum((v.co for v in verts),Vector())/3
        normal=sum((v.normal for v in verts),Vector()).normalized()
        if beard_growth(cid,p,center,normal)<-.006:continue
        area+=tri.area;areas.append(area);triangles.append(verts)
    # Low LOD keeps a filled beard mass: reduce each fibre's curve rings first,
    # then use fewer, broader rooted fibres rather than leaving skin-wide gaps.
    count=(2600 if long else 3000 if cid in ('kai','u') else 2250 if cid=='haku' else 1200) if quality=='high' else (850 if long else 1200 if cid in ('kai','u') else 1000 if cid=='haku' else 650)
    steps=(5 if long else 4) if quality=='high' else (4 if long else 3)
    accepted=0;attempts=0
    while accepted<count and attempts<count*18:
        attempts+=1;tri=triangles[min(len(triangles)-1,bisect.bisect_left(areas,rng.random()*area))]
        a=math.sqrt(rng.random());b=rng.random();weights=(1-a,a*(1-b),a*b)
        root=sum((v.co*w for v,w in zip(tri,weights)),Vector())
        normal=sum((v.normal*w for v,w in zip(tri,weights)),Vector()).normalized()
        density=smooth(-.002,.006,beard_growth(cid,p,root,normal))
        if rng.random()>density:continue
        accepted+=1;x,y,z=root;side=1 if x>0 else -1;ax=abs(x)
        jitter=rng.random();phase=rng.random()*math.tau
        if long:
            # Root every long lock in a cheek/jaw follicle. The lower mass has
            # an oval cross-section: side fibres wrap behind the chin rather
            # than all collapsing into the same thin front-facing sheet.
            hanging={'hai':.112,'zo':.177}[cid]
            root_band=smooth(-.026,-.067,y)
            length=mix(.017,hanging,root_band)*(.90+.14*jitter)*(.72+.28*gauss(x,.033))
            target_y=-.077-length
            target_x=x*(.22+.16*jitter)+.003*math.sin(phase)
            target_z=.065+(.014 if cid=='hai' else .010)*math.sin(phase)+.25*(z-.050)
            target=Vector((target_x,target_y,target_z))
            points=[]
            for j in range(steps):
                t=j/(steps-1);ease=smooth(0,1,t)
                point=root.lerp(target,ease)
                point+=normal*(.00025+.0065*math.sin(math.pi*t)*(1-.35*t))
                point.x+=.0025*math.sin(t*7+phase)*math.sin(math.pi*t)
                point.z+=.0028*math.sin(t*6+x*107)*math.sin(math.pi*t)
                # First growth follows the source cheek before it hangs freely.
                if t<.55:
                    near=bvh.ray_cast(Vector((point.x,point.y,.3)),Vector((0,0,-1)))
                    if near[0] is not None:point.z=max(point.z,near[0].z+.00035+.003*t)
                points.append(point)
            radius=(.00065 if quality=='high' else .00135)*(.65+.65*jitter)
        else:
            base={'u':.0095,'kai':.022,'haku':.016,'chin':.026}[cid]
            chin=gauss(x,.029)*smooth(-.040,-.071,y)
            length=base*(.50+.65*jitter)*(.62+.38*chin)
            if cid=='kai':length*=1+.25*math.sin(x*173+y*113)**2
            direction=Vector((side*.15,-.92,.12))
            points=[]
            for j in range(steps):
                t=j/(steps-1)
                point=root+normal*(.00018+length*.42*math.sin(t*math.pi*.5))+direction*length*t
                point.x+=length*.10*math.sin(phase+t*5)*t
                near=bvh.find_nearest(point)
                if near[0] is not None and (point-near[0]).dot(near[1])<.00015:point=near[0]+near[1]*.00018
                points.append(point)
            radius=({'u':.00043,'kai':.00061,'haku':.00047,'chin':.00043}[cid])*(.65+.65*jitter)*(1 if quality=='high' else 2.3)
        # Root pigment is local to each strand. Exposed skin is never painted
        # black and no fitted beard-mask shell is needed to hide sparse growth.
        groom.fibre(points,radius,.65+rng.random()*.95,.30)
    # The moustache is a small groom in two flowing lobes, leaving the philtrum
    # and vermilion readable instead of covering the mouth with a single tube.
    reach={'u':.025,'kai':.034,'hai':.031,'zo':.032,'haku':.028,'chin':.023}[cid]
    for side in (-1,1):
        for strand in range(180 if quality=='high' else 100):
            u=rng.random();x=side*mix(.002,reach*.87,u)
            y=-.0268-.002*u+(rng.random()-.5)*(.0044 if cid=='kai' else .0032)
            root=Vector((x,y,sample(bvh,x,y)+.00016));points=[]
            extent=(.004+.007*u)*( .75+.5*rng.random())
            for j in range(3):
                t=j/2;xx=x+side*extent*t;yy=y-(.0015+.003*u)*t
                zz=sample(bvh,xx,yy)+.00025+.0008*math.sin(math.pi*t)
                points.append(Vector((xx,yy,zz)))
            groom.fibre(points,(.00021 if cid=='u' else .00030)*(.8+.4*rng.random())*(1 if quality=='high' else 1.5),.72+.8*rng.random(),.22)
    return [groom.object(cid+'_anatomical_fibre_beard',material)]

def join_parts(parts,name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:ob.hide_set(False);ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    for ob in parts:
        bpy.context.view_layer.objects.active=ob
        for mod in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();parts[0].name=name
    return parts[0]

INDEX_POOL={};INDEX_RAW={}
def pack_indices(indices):
    """Lossless signed deltas keep neighbouring fibre/face indices compact."""
    packed=bytearray();previous=0
    for index in indices:
        delta=index-previous;previous=index;value=delta*2 if delta>=0 else -delta*2-1
        while value>=128:packed.append((value&127)|128);value>>=7
        packed.append(value)
    return base64.b64encode(packed).decode()

def export_mesh(ob):
    me=ob.data;me.calc_loop_triangles()
    if len(me.vertices)>65535:raise ValueError(f'{ob.name}: uint16 vertex limit exceeded: {len(me.vertices)}')
    if any(not math.isfinite(c) for v in me.vertices for c in (*v.co,*v.normal)):raise ValueError(f'{ob.name}: non-finite geometry')
    pos=[c for v in me.vertices for c in v.co]
    # 1/100000m quantization is finer than a rendered portrait pixel.
    encoded=base64.b64encode(struct.pack('<'+'h'*len(pos),*[round(x*100000) for x in pos])).decode()
    normals=base64.b64encode(struct.pack('b'*(len(me.vertices)*3),*[round(max(-1,min(1,c))*127) for v in me.vertices for c in v.normal])).decode()
    idx=[i for tri in me.loop_triangles for i in tri.vertices]
    idata=pack_indices(idx)
    key=next((k for k,v in INDEX_POOL.items() if v==idata),None)
    if key is None:key='i'+str(len(INDEX_POOL));INDEX_POOL[key]=idata
    if '--packing-audit' in sys.argv:INDEX_RAW[key]=base64.b64encode(struct.pack('<'+'H'*len(idx),*idx)).decode()
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
    groomshade=ob.data.attributes.get('GroomShade')
    for i,v in enumerate(ob.data.vertices):
        x,y,z=v.co; angle=math.atan2(x,z+.020)
        streak=max(0,math.sin(angle*135+y*36))**18
        if facial:streak=max(0,math.sin(x*1270+y*18))**10
        w=p['grey']*((.20+.30*streak) if facial else (.10+.60*streak))
        c=[mix(base[k],grey[k],w) for k in range(3)]
        if groomshade:c=[value*(groomshade.data[i].value or 1) for value in c]
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
        hairmat=mat(cid+'_'+quality+'_hair',rgb(p['hair']),.76)
        hair=join_parts(scalp(cid,p,head,hairmat,quality),cid+'_'+quality+'_hair');color_hair(hair,p)
        browmat=mat(cid+'_'+quality+'_brows',rgb(p['hair']),.70)
        brow=join_parts(add_brows(cid,p,bvh,browmat,quality),cid+'_'+quality+'_brow');color_hair(brow,p,True)
        parts={'skin':head,'hair':hair,'brow':brow}
        beardparts=add_beard(cid,p,bvh,mat(cid+'_'+quality+'_beard',rgb(p['hair']),.72),head,quality)
        if beardparts:
            beard=join_parts(beardparts,cid+'_'+quality+'_beard');color_hair(beard,p,True);parts['beard']=beard
        record['lod'][quality]={name:export_mesh(ob) for name,ob in parts.items()}
        for ob in parts.values():ob['part']=ob.name.rsplit('_',1)[-1];ob['cast_id']=cid;ob.hide_render=True;ob.hide_set(True)
        if quality=='high':render_objects[cid]=list(parts.values())+eyes_render(cid,p,eye_anchors)
    for ob in render_objects[cid]:ob.hide_render=True;ob.hide_set(True)
    assets[cid]=record

out={'version':2,'indexEncoding':'delta-zigzag-varint','source':'Blender Studio Human Base Meshes v1.2.0 / CC0','quantization':.00001,'indices':INDEX_POOL,'cast':assets}
js='/* Generated by tools/build-head-assets.py. CC0 source attribution: docs/assets/manifest.csv. */\nwindow.KM_HEAD_ASSETS='+json.dumps(out,separators=(',',':'))+';\n'
export_path=(OUT/'head-assets-prototype.js') if PROTO else (ROOT/'src/js/koumon-head-assets.js')
export_path.write_text(js,encoding='utf-8')
if '--packing-audit' in sys.argv:
    # Keep a same-export raw reference: Blender may choose equivalent quad
    # diagonals differently across builds, so cross-build byte comparison is
    # not a valid test of a lossless wire encoding.
    rawout=dict(out,version=1,indices=INDEX_RAW);rawout.pop('indexEncoding')
    (OUT/'head-assets-packing-audit-uncompressed.js').write_text('window.KM_HEAD_ASSETS='+json.dumps(rawout,separators=(',',':'))+';\n',encoding='utf-8')
setup_render()
if '--quick-review' in sys.argv:
    bpy.context.scene.cycles.samples=24;bpy.context.scene.render.resolution_x=512;bpy.context.scene.render.resolution_y=640
views=[('front',(0,.0,.7)),('threequarter',(.40,.025,.55)),('side',(.7,.0,.001)),('top',(.12,.6,.25))]
if '--no-render' in sys.argv:views=[]
review_cast=sys.argv[sys.argv.index('--review-cast')+1].split(',') if '--review-cast' in sys.argv else None
for cid,objects in render_objects.items():
    if review_cast and cid not in review_cast:continue
    for ob in objects:ob.hide_render=False;ob.hide_set(False)
    for name,pos in views:
        if '--quick-review' in sys.argv and not review_cast and (cid not in ('u','kai','ryo','sou','chin') or name not in ('front','threequarter','side')):continue
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
