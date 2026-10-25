"""Import the exact runtime garment surfaces and save their native source scene."""
import bpy,json,sys,os
from mathutils import Matrix

args=sys.argv[sys.argv.index('--')+1:]
data=json.load(open(args[0],encoding='utf-8'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
collections={}
for name in ['CLOTH_AUTHORED','ARMOR_AUTHORED','REFERENCE_LOCKED','FABRIC_TESTS','OLD_PROCEDURAL_BACKUP']:
    c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);collections[name]=c
meshes=[]
for i,g in enumerate(data['geometries']):
    mesh=bpy.data.meshes.new('atelier-surface-%03d'%i)
    coords=list(zip(*[iter(g['positions'])]*3));faces=list(zip(*[iter(g['indices'])]*3));mesh.from_pydata(coords,[],faces);mesh.update()
    if g.get('colors'):
        colors=mesh.color_attributes.new(name='GarmentColor',type='FLOAT_COLOR',domain='POINT')
        rgb=list(zip(*[iter(g['colors'])]*3))
        for j,co in enumerate(rgb):colors.data[j].color=(*co,1)
    if g.get('uv'):
        uv=mesh.uv_layers.new(name='FabricGrain');coords_uv=list(zip(*[iter(g['uv'])]*2))
        for loop in mesh.loops:uv.data[loop.index].uv=coords_uv[loop.vertex_index]
    for poly in mesh.polygons:poly.use_smooth=True
    meshes.append(mesh)
materials=[]
for i,m in enumerate(data['materials']):
    mat=bpy.data.materials.new('atelier-material-%03d'%i);mat.diffuse_color=(*m['color'],1);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*m['color'],1);bsdf.inputs['Roughness'].default_value=m['roughness'];bsdf.inputs['Metallic'].default_value=m['metalness']
    if m.get('vertexColors'):
        attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='GarmentColor';mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
    if m.get('map') and os.path.exists(m['map']):
        image=bpy.data.images.load(m['map']);image.colorspace_settings.name='Non-Color';image.pack();tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        mapping=mat.node_tree.nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(*m['repeat'],1)
        uv=mat.node_tree.nodes.new('ShaderNodeTexCoord');mat.node_tree.links.new(uv.outputs['UV'],mapping.inputs[0]);mat.node_tree.links.new(mapping.outputs['Vector'],tex.inputs['Vector'])
        mul=mat.node_tree.nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[1].default_value=(*m['color'],1);mat.node_tree.links.new(tex.outputs['Color'],mul.inputs[2]);mat.node_tree.links.new(mul.outputs['Color'],bsdf.inputs['Base Color'])
    materials.append(mat)
for i,o in enumerate(data['objects']):
    mesh=meshes[o['geometry']]
    ob=bpy.data.objects.new(o['name'],mesh)
    # Runtime Y-up to Blender Z-up, while preserving a front-facing source scene.
    transform=Matrix((o['matrix'][0:4],o['matrix'][4:8],o['matrix'][8:12],o['matrix'][12:16])).transposed()
    conversion=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
    ob.matrix_world=conversion@transform
    target='ARMOR_AUTHORED' if any(t in o['name'] for t in ['lamell','rivet','lame','tasset','cuirass','brooch','buckle','shoulder-lac','bound-shoulder']) else 'CLOTH_AUTHORED'
    collections[target].objects.link(ob)
    if not mesh.materials:mesh.materials.append(materials[o['material']])
    ob['provenance']='Original authored cut-and-drape surface. Runtime source: src/js/koumon-costume.js'
if os.path.exists(data.get('atlas','')):
    image=bpy.data.images.load(data['atlas']);image.pack();ref=bpy.data.objects.new('Locked project costume reference',None);ref.empty_display_type='IMAGE';ref.data=image;ref.empty_display_size=3.2;ref.location=(0,1.4,1.2);ref.rotation_euler=(1.5707963,0,0);ref.hide_render=True;ref.hide_select=True;collections['REFERENCE_LOCKED'].objects.link(ref)
scene=bpy.context.scene;scene['asset_notes']='Original authored garment meshes; cloth pose deformation runs in KM_COSTUME. Colors follow the supplied Chinese character atlas.'
bpy.context.preferences.filepaths.save_version=0
scene.world.color=(.18,.18,.18)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.shading.type='MATERIAL';area.spaces.active.region_3d.view_distance=4.0;area.spaces.active.region_3d.view_location=(0,0,1.0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args[1]),compress=True)
print('Saved authored garment source: '+os.path.abspath(args[1]))
