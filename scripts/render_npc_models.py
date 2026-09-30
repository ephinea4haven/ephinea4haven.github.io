"""Direct Blender rendering of local PSOBB NPC assets; reuses the Mag mesh pipeline."""
import sys, math, struct, copy, json
from pathlib import Path
import bpy
from mathutils import Matrix, Vector, Euler
sys.dont_write_bytecode=True
sys.path.insert(0,"/Users/wangzhen/study/bb-psov4")
from tools.psomodel.binary import Reader
from tools.psomodel import nj
from tools.psomodel.ir import Vertex, Material
BASE=Path(__file__).resolve().parents[1]/'artifacts/npc-models'
OUT=BASE; BONES=[]; TEXTURES=[]; TINT=None
BAMS=2*math.pi/65536
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def local(flags,pos,rot,scale):
    t=Matrix.Translation(Vector((0,0,0) if flags&1 else pos))
    r=Euler(tuple(0 if flags&2 else a*BAMS for a in rot),'ZXY' if flags&32 else 'XYZ').to_matrix().to_4x4()
    s=Matrix.Diagonal(Vector((1,1,1,1) if flags&4 else (*scale,1)))
    return t@r@s

def read_polygons(reader, offset, cache, polygon_cache):
    result = []
    material = Material()
    while True:
        h = reader.u16(offset); kind = h & 255; attr = h >> 8
        if kind == 255:
            return result
        if kind == 4:
            polygon_cache[attr] = offset + 2
            return result
        if kind == 5:
            assert attr in polygon_cache
            result.extend(read_polygons(reader, polygon_cache[attr], cache, polygon_cache))
            offset += 2
        elif kind in (0,1,2,3):
            offset += 2
        elif kind in (8,9):
            material.texture_index = reader.u16(offset+2) & 8191
            offset += 4
        elif 16 <= kind <= 31:
            if kind & 1:
                a,r,g,b = reader.data[offset+4:offset+8]
                material.diffuse = (r,g,b,a)
            offset += 4 + reader.u16(offset+2)*2
        elif 64 <= kind <= 75:
            size=reader.u16(offset+2); header=reader.u16(offset+4); cur=offset+6
            for _ in range(header & 16383):
                primitive,cur=nj._read_strip(reader,cur,kind,header>>14,cache)
                primitive.material=copy.deepcopy(material)
                primitive.material.use_alpha=bool(attr&8)
                primitive.material.double_sided=bool(attr&16)
                result.append(primitive)
            assert cur <= offset+4+size*2
            offset += 4+size*2
        else:
            raise ValueError(f'Unsupported polygon chunk {kind:#x}')

def weighted_model(data):
    # NPC meshes reuse indices between limbs. Resolve each polygon draw against
    # that moment's vertex cache, rather than the final cache for the whole model.
    BONES.clear()
    start=data.index(b'NJCM');size=struct.unpack_from('<I',data,start+4)[0];body=data[start+8:start+8+size];reader=Reader(body,'<')
    accum={}; result=[]; polygon_cache={}
    def nodes(off,parent):
        while True:
            flags,attach=struct.unpack_from('<2I',body,off)
            world=parent@local(flags,struct.unpack_from('<3f',body,off+8),struct.unpack_from('<3i',body,off+20),struct.unpack_from('<3f',body,off+32))
            BONES.append(world.copy())
            if attach and not flags&8:
                vp,pp=struct.unpack_from('<2I',body,attach)
                while vp:
                    h,second=struct.unpack_from('<2I',body,vp);kind=h&255;attr=h>>8&255
                    if kind==255:break
                    assert kind in (0x25,0x2c,0x29),(hex(kind),off)
                    base=second&65535;n=second>>16;cur=vp+8;end=vp+4+(h>>16)*4
                    for vi in range(n):
                        pos=world@Vector(struct.unpack_from('<3f',body,cur));cur+=12
                        normal=None
                        if kind in (0x2c,0x29):
                            normal=world.to_3x3().inverted().transposed()@Vector(struct.unpack_from('<3f',body,cur));cur+=12
                        if kind==0x29:idx=base+vi;weight=1.0
                        else:
                            idx,w=struct.unpack_from('<2H',body,cur);cur+=4;idx+=base;weight=w/255
                        assert 0<=weight<=1
                        if kind == 0x29 or attr & 3 == 0:
                            accum[idx] = {}
                        accum.setdefault(idx,{})[attr&3]=(pos,normal,weight)
                    assert cur==end,(cur,end)
                    vp=end
                if pp:
                    cache = {}
                    for idx, slots in accum.items():
                        total = sum(v[2] for v in slots.values())
                        assert total > 0
                        pos = sum((p*w for p,n,w in slots.values()), Vector()) / total
                        nor = sum((n*w for p,n,w in slots.values() if n is not None), Vector())
                        cache[idx] = Vertex(tuple(pos), tuple(nor.normalized()) if nor.length else None)
                    result.extend((p, Matrix.Identity(4)) for p in read_polygons(reader,pp,cache,polygon_cache))
            child,sib=struct.unpack_from('<2I',body,off+44)
            if child and not flags&16:nodes(child,world)
            if not sib:break
            off=sib
    nodes(0,Matrix.Identity(4))
    return result

def material(name,p):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.7
    bs.inputs['Base Color'].default_value=tuple(v/255 for v in p.material.diffuse)
    idx=p.material.texture_index
    file=BASE/TEXTURES[idx] if idx is not None else None
    if idx is not None:
        assert file is not None and file.exists(),file
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(file),check_existing=True);tex.interpolation='Linear'
        if TINT is None:
            m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        else:
            mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY'
            mix.inputs[0].default_value=1
            mix.inputs[2].default_value=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in TINT)+(1,)
            m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1])
            m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
        if p.material.use_alpha:
            m.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
    return m

def model_object(name,primitives):
    verts=[];faces=[];uv=[];face_mats=[];mats=[];normals=[]
    for p,m in primitives:
        base=len(verts);verts.extend(tuple(C@m@Vector(v.position)) for v in p.vertices);uv.extend(v.uv or (0,0) for v in p.vertices)
        nm=(C@m).to_3x3().inverted().transposed()
        normals.extend(tuple((nm@Vector(v.normal)).normalized()) if v.normal else (0,0,0) for v in p.vertices)
        mats.append(material(f'{name}_{len(mats)}',p));n=len(p.vertices)
        if p.topology=='triangle_strip':
            triangles=[(i-2,i-1,i) if (i%2==0)!=p.reversed else (i-1,i-2,i) for i in range(2,n)]
        elif p.topology=='triangle_fan':triangles=[(0,i-1,i) for i in range(2,n)]
        else:triangles=[(i,i+1,i+2) for i in range(0,n,3)]
        for tri in triangles:
            if len(set(tuple(verts[base+i]) for i in tri))<3:continue
            indices=tuple(base+i for i in tri)
            a,b,c=(Vector(verts[i]) for i in indices)
            normal=sum((Vector(normals[i]) for i in indices),Vector())
            if (b-a).cross(c-a).dot(normal)<0:indices=(indices[0],indices[2],indices[1])
            faces.append(indices);face_mats.append(len(mats)-1)
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    for mat in mats:mesh.materials.append(mat)
    layer=mesh.uv_layers.new()
    for poly,mi in zip(mesh.polygons,face_mats):
        poly.material_index=mi;poly.use_smooth=True
        for li in poly.loop_indices:
            u,v=uv[mesh.loops[li].vertex_index];layer.data[li].uv=(u,1-v)
    mesh.normals_split_custom_set_from_vertices(normals)
    print(name,'vertices',len(verts),'triangles',len(faces),flush=True)
    return obj



def add_part(name, filename, textures, transform=None, tint=None):
    global TEXTURES, TINT
    TEXTURES = textures
    TINT = tint
    primitives = weighted_model((BASE / filename).read_bytes())
    if transform is not None:
        primitives = [(p, transform @ m) for p, m in primitives]
    return model_object(name, primitives)


def render_character(job):
    name=job['id']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body_bones=[]
    for index,part in enumerate(job['parts']):
        transform=None
        if 'attach_bone' in part:
            transform=body_bones[part['attach_bone']].copy()
        elif 'position' in part:
            transform=Matrix.Translation(part['position'])
        add_part(f'{name}-{index}',part['model'],part['textures'],transform,part.get('tint'))
        if index==0:
            body_bones=[bone.copy() for bone in BONES]
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if 'proportions' in job:
        px,py = job['proportions']
        height = 1 + (job['class_height']-py)/3
        width = height + (abs(px-.5)-.16666)*1.2
        for obj in objects:
            for vertex in obj.data.vertices:
                vertex.co.x *= width
                vertex.co.y *= width
                vertex.co.z *= height
    points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    print(name, 'bounds', tuple(low), tuple(high), flush=True)
    center = (low + high) / 2
    size = max(high-low)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 64
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    scene.world = bpy.data.worlds.new('World'); scene.world.color = (.8,.8,.8)
    cd = bpy.data.cameras.new('Camera'); cd.type='ORTHO'; cd.ortho_scale=size*1.12
    cam = bpy.data.objects.new('Camera',cd); scene.collection.objects.link(cam); scene.camera=cam
    cam.location = center + Vector((0,-size*3,0)); cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    cd.clip_end = size * 100
    for label, direction, strength in [('Key',Vector((-.6,-1,.8)),2.8),('Fill',Vector((.8,-.6,-.3)),.7)]:
        ld=bpy.data.lights.new(label,'SUN');ld.energy=strength;ld.angle=math.radians(30)
        light=bpy.data.objects.new(label,ld);scene.collection.objects.link(light)
        light.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'{name}-full.png');bpy.ops.render.render(write_still=True)
    # Portrait composition: eye-level front view, native proportions retained.
    portrait_size=(high.z-low.z)*job.get('portrait_fraction',.30)
    center.z=high.z-portrait_size*.44
    cd.ortho_scale=portrait_size
    cam.location=center+Vector((0,-size*3,0));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'{name}.png');bpy.ops.render.render(write_still=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{name}.blend'))

if __name__ == '__main__':
    selected=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else None
    for job in json.loads((BASE/'render-jobs.json').read_text()):
        if selected is None or job['id'] in selected:
            render_character(job)

