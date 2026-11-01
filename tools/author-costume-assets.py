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
    mat=bpy.data.materials.new(m.get('name') or 'atelier-material-%03d'%i);mat.diffuse_color=(*m['color'],1);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*m['color'],1);bsdf.inputs['Roughness'].default_value=m['roughness'];bsdf.inputs['Metallic'].default_value=m['metalness']
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    color=nodes.new('ShaderNodeRGB');color.outputs[0].default_value=(*m['color'],1);color_output=color.outputs[0]
    def multiply(a,b):
        node=nodes.new('ShaderNodeMixRGB');node.blend_type='MULTIPLY';node.inputs[0].default_value=1;links.new(a,node.inputs[1]);links.new(b,node.inputs[2]);return node.outputs['Color']
    if m.get('vertexColors'):
        attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='GarmentColor';color_output=multiply(color_output,attr.outputs['Color'])
    for channel,texture in m.get('maps',{}).items():
        if not os.path.exists(texture['file']):continue
        image=bpy.data.images.load(texture['file'],check_existing=True);image.colorspace_settings.name='sRGB' if texture.get('srgb') else 'Non-Color';image.pack();tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.label=channel
        mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(*texture['repeat'],1)
        uv=nodes.new('ShaderNodeTexCoord');links.new(uv.outputs['UV'],mapping.inputs[0]);links.new(mapping.outputs['Vector'],tex.inputs['Vector'])
        if channel=='map':color_output=multiply(color_output,tex.outputs['Color'])
        elif channel=='bumpMap':
            bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=1;bump.inputs['Distance'].default_value=m.get('bumpScale',.0002);links.new(tex.outputs['Color'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
        elif channel in ['roughnessMap','metalnessMap']:
            amount=nodes.new('ShaderNodeMath');amount.operation='MULTIPLY';amount.inputs[1].default_value=m['roughness'] if channel=='roughnessMap' else m['metalness'];links.new(tex.outputs['Color'],amount.inputs[0]);links.new(amount.outputs[0],bsdf.inputs['Roughness' if channel=='roughnessMap' else 'Metallic'])
    object_info=nodes.new('ShaderNodeObjectInfo');color_output=multiply(color_output,object_info.outputs['Color']);links.new(color_output,bsdf.inputs['Base Color'])
    materials.append(mat)
for i,o in enumerate(data['objects']):
    mesh=meshes[o['geometry']]
    ob=bpy.data.objects.new(o.get('character','cast')+' / '+o['name'],mesh)
    ob.color=(*o.get('tint',[1,1,1]),1)
    ob['character']=o.get('character','cast')
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
