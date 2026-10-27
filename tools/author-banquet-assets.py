"""Native save of authored game props; no third-party geometry is imported."""
import bpy,json,sys
from mathutils import Matrix
args=sys.argv[sys.argv.index('--')+1:]
data=json.load(open(args[0],encoding='utf-8'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
collections={}
for name in ['ORIGINAL_BANQUET_PROPS','FITTED_HEADWEAR','MATERIAL_TESTS']:
    coll=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(coll);collections[name]=coll
materials=[]
for m in data['materials']:
    mat=bpy.data.materials.new(m['name']);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*m['color'],1)
    bsdf.inputs['Roughness'].default_value=m['roughness'];bsdf.inputs['Metallic'].default_value=m['metalness']
    if m.get('vertexColors'):
        node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='SurfaceColor';mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
    if m.get('map'):
        image=bpy.data.images.load(m['map']);image.colorspace_settings.name='sRGB' if m['srgb'] else 'Non-Color';image.pack()
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    materials.append(mat)
meshes=[]
for i,g in enumerate(data['geometries']):
    mesh=bpy.data.meshes.new('authored-surface-%03d'%i)
    mesh.from_pydata(list(zip(*[iter(g['positions'])]*3)),[],list(zip(*[iter(g['indices'])]*3)));mesh.update()
    if g.get('colors'):
        attr=mesh.color_attributes.new(name='SurfaceColor',type='FLOAT_COLOR',domain='POINT')
        for j,c in enumerate(zip(*[iter(g['colors'])]*3)):attr.data[j].color=(*c,1)
    if g.get('uv'):
        layer=mesh.uv_layers.new(name='SurfaceUV');coords=list(zip(*[iter(g['uv'])]*2))
        for loop in mesh.loops:layer.data[loop.index].uv=coords[loop.vertex_index]
    for face in mesh.polygons:face.use_smooth=True
    for group in g['groups']:
        for face in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]:face.material_index=group['materialIndex']
    meshes.append(mesh)
conversion=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
for o in data['objects']:
    mesh=meshes[o['geometry']]
    if not mesh.materials:
        for index in o['materials']:mesh.materials.append(materials[index])
    ob=bpy.data.objects.new(o['name'],mesh);collections['FITTED_HEADWEAR' if o['headwear'] else 'ORIGINAL_BANQUET_PROPS'].objects.link(ob)
    ob.matrix_world=conversion@Matrix([o['matrix'][i:i+4] for i in range(0,16,4)]).transposed()
    ob['provenance']='Original project mesh, MIT; source in src/js/koumon-banquet-props.js and koumon-heads.js'
bpy.context.scene['notes']='Creative reconstruction. Zhi form after Western Han lacquer vessel research; classroom motion is separate runtime code.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=args[1],compress=True)
