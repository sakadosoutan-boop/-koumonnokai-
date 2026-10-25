"""Blender background renderer of meshes exported from the game. Not WebGL QA.
blender -b --python tools/render-model-scene.py -- input.json output-dir
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]).resolve(); out=Path(args[1]).resolve(); out.mkdir(parents=True,exist_ok=True)
data=json.loads(source.read_text(encoding='utf-8'))
only_crop=args[2] if len(args)>2 else None
only_view=args[3] if len(args)>3 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Studio World');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.14,.17,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35

def xyz(v): return (v[0],-v[2],v[1])
verts=[xyz(data['positions'][i:i+3]) for i in range(0,len(data['positions']),3)]
mesh=bpy.data.meshes.new('Actual runtime geometry');mesh.from_pydata(verts,[],data['faces']);mesh.update()
obj=bpy.data.objects.new(data['id']+'-'+data['pose'],mesh);scene.collection.objects.link(obj)
color=mesh.color_attributes.new(name='RuntimeColor',type='FLOAT_COLOR',domain='POINT')
color.data.foreach_set('color',data['colors'])
uv=mesh.uv_layers.new(name='RuntimeUV')
for poly in mesh.polygons:
    poly.use_smooth=True
    for li in poly.loop_indices:
        vi=mesh.loops[li].vertex_index;uv.data[li].uv=data['uv'][vi*2:vi*2+2]
for entry in data['materials']:
    mat=bpy.data.materials.new(entry['name']);mat.use_nodes=True
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=entry['roughness'];shader.inputs['Metallic'].default_value=entry['metalness']
    attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='RuntimeColor';base=attr.outputs['Color']
    for channel in ['map','bumpMap','roughnessMap']:
        if channel not in entry:continue
        spec=entry[channel];tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(source.parent/spec['file']))
        coords=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value=(spec['repeat'][0],spec['repeat'][1] if spec['flipY'] else -spec['repeat'][1],1)
        mapping.inputs['Location'].default_value=(spec['offset'][0],spec['offset'][1] if spec['flipY'] else 1-spec['offset'][1],0)
        links.new(coords.outputs['UV'],mapping.inputs['Vector']);links.new(mapping.outputs['Vector'],tex.inputs['Vector'])
        if channel=='map':
            mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
            links.new(base,mix.inputs[1]);links.new(tex.outputs['Color'],mix.inputs[2]);base=mix.outputs[0]
        elif channel=='bumpMap':
            tex.image.colorspace_settings.name='Non-Color';bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.3;bump.inputs['Distance'].default_value=min(.002,entry.get('bumpScale',.001))
            links.new(tex.outputs['Color'],bump.inputs['Height']);links.new(bump.outputs[0],shader.inputs['Normal'])
        else: links.new(tex.outputs['Color'],shader.inputs['Roughness'])
    links.new(base,shader.inputs['Base Color']);mesh.materials.append(mat)
for poly,mi in zip(mesh.polygons,data['materialIndices']):poly.material_index=mi

def area(name,position,power,size):
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size
    o=bpy.data.objects.new(name,light);scene.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(2.5,-3.5,4),450,3);area('Fill',(-3,-1.2,2.8),260,2.5);area('Rim',(1,3,3.5),650,2)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object
floor_mat=bpy.data.materials.new('Warm neutral floor');floor_mat.diffuse_color=(.24,.23,.21,1);floor.data.materials.append(floor_mat)
cam_data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',cam_data);scene.collection.objects.link(cam);scene.camera=cam
cam_data.type='ORTHO'
height=data['bounds']['max']['y']-data['bounds']['min']['y']
width=max(data['bounds']['max'][axis]-data['bounds']['min'][axis] for axis in ('x','z'))
frame=max(height,width/(scene.render.resolution_x/scene.render.resolution_y))*1.13
center=Vector((0,0,(data['bounds']['min']['y']+data['bounds']['max']['y'])/2))
head=Vector(xyz([data['head']['x'],data['head']['y'],data['head']['z']]))
for crop,target,scale in [('full',center,frame),('head',head,.46)]:
    if only_crop and crop!=only_crop: continue
    cam_data.ortho_scale=scale
    for name,yaw,pitch in [('front',0,0),('side',90,0),('three-quarter',35,8),('overhead',35,35)]:
        if only_view and name!=only_view: continue
        y=math.radians(yaw);p=math.radians(pitch);cam.location=target+Vector((math.sin(y)*math.cos(p),-math.cos(y)*math.cos(p),math.sin(p)))*5
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(data['id']+'-'+data['pose']+'-'+crop+'-'+name+'.png'))
        bpy.ops.render.render(write_still=True)
scene['Review limitation']='Actual runtime geometry with Blender Cycles lighting; not game WebGL output.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/(data['id']+'-'+data['pose']+'-review.blend')))
print('RENDER_COMPLETE',out)
