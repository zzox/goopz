import { Vec2, vec2, vec3, Vec3, vec4, Vec4 } from 'wgpu-matrix'
import { MeshProps } from '../core/mesh'

export const makeFloor = (x:number, z:number, length:number, width:number, y:number = 0):MeshProps =>
  planeMesh(
    vec3.create(x, y, z + length),
    vec3.create(x + width, y, z + length),
    vec3.create(x + width, y, z),
    vec3.create(x, y, z),
  )

export const makeWall = (p1:Vec2, p2:Vec2, height:number):MeshProps =>
  planeMesh(
    vec3.create(p1[0], 0, p1[1]),
    vec3.create(p2[0], 0, p2[1]),
    vec3.create(p2[0], height, p2[1]),
    vec3.create(p1[0], height, p1[1])
  )

export const planeMesh = (v1?:Vec3, v2?:Vec3, v3?:Vec3, v4?:Vec3):MeshProps => {
  v1 ??= vec3.create(-1, -1, 0)
  v2 ??= vec3.create(1, -1, 0)
  v3 ??= vec3.create(1, 1, 0)
  v4 ??= vec3.create(-1, 1, 0)

  const vertices = [
    vec4.create(v1[0], v1[1], v1[2], 1), // bottom-left
    vec4.create(v2[0], v2[1], v2[2], 1), // bottom-right
    vec4.create(v3[0], v3[1], v3[2], 1), // top-right
    vec4.create(v4[0], v4[1], v4[2], 1), // top-left
  ]
  const uvs = [vec2.create(0,1), vec2.create(1,1), vec2.create(1,0), vec2.create(0,0)]
  const colors = Math.random() < 0.1 ? [
    vec4.create(0.1, 0.1, 0.1, 1.0),
    vec4.create(0.3, 0.6, 0.9, 1.0),
    vec4.create(0.6, 0.9, 0.3, 1.0),
    vec4.create(0.9, 0.3, 0.6, 1.0)
  ] : [
    vec4.create(1.0, 1.0, 1.0, 1.0),
    vec4.create(1.0, 1.0, 1.0, 1.0),
    vec4.create(1.0, 1.0, 1.0, 1.0),
    vec4.create(1.0, 1.0, 1.0, 1.0)
  ]
  const indices = [0,1,2, 0,2,3]

  // recalc normals
  // from here: https://iquilezles.org/articles/normals/
  const n = vec3.create(0, 0, 0)
  const normalsPre = [n, n, n, n]
  for (let i = 0; i < indices.length / 3; i++) {
    const ii = i * 3

    // backwards because of how i import?
    const i3 = indices[ii]
    const i2 = indices[ii + 1]
    const i1 = indices[ii + 2]

    const v1 = vertices[i1]
    const v2 = vertices[i2]
    const v3 = vertices[i3]

    const e1 = vec3.sub(v1, v2)
    const e2 = vec3.sub(v3, v2)

    const normal = vec3.cross(e1, e2)

    normalsPre[i1] = vec3.add(normalsPre[i1], normal)
    normalsPre[i2] = vec3.add(normalsPre[i2], normal)
    normalsPre[i3] = vec3.add(normalsPre[i3], normal)
  }
  const normals = normalsPre.map(n => vec3.normalize(n))
    .map(n => vec4.fromValues(n[0], n[1], n[2], 1))

  return { vertices, normals, uvs, colors, indices }
}

export const meshFromObj = (objStr:String):MeshProps => {
  const pos:Vec4[] = [];
  const vcol:(Vec4 | null)[] = [];  // per-position vertex colors (unofficial extension)
  const nrm:Vec4[] = [];
  const tuv:Vec2[] = [];
  const vertices:Vec4[] = [];
  const normals:Vec4[] = [];
  const uvs:Vec2[] = [];
  const colors:Vec4[] = [];
  const indices:number[] = [];

  const cache = new Map<string, number>();

  // const vLines = lines.filter(line -> line.substr(0, 2) == 'v ');
  // const fLines = lines.filter(line -> line.substr(0, 2) == 'f ');
  // trace('parsed ${vLines.length} vertices and ${fLines.length} faces');

  objStr.split('\n').forEach(l => {
    const line = l.split(' ').filter(item => item != '')

    switch (line[0]) {
      case 'v':
        pos.push(vec4.create(parseFloat(line[1]), parseFloat(line[2]), parseFloat(line[3]), 1));
        // Unofficial extension: v x y z r g b (colors as floats 0-1)
        if (line.length >= 7) {
            vcol.push(vec4.create(parseFloat(line[4]), parseFloat(line[5]), parseFloat(line[6]), 1))
        } else {
            vcol.push(null);
        }
        break
      case 'vn':
        nrm.push(vec4.create(parseFloat(line[1]), parseFloat(line[2]), parseFloat(line[3]), 1));
        break
      case 'vt':
        tuv.push(vec2.create(parseFloat(line[1]), parseFloat(line[2])));
        break
      case 'f':
        // Parse face vertex indices and fan-triangulate
        const fi = [];
        for (let i = 1; i < line.length; i++) {
          const s = line[i].split('/')

          // key for vertex index, uv index, normal index
          const vi = parseInt(s[0]) - 1
          const ti = parseInt(s[1]) - 1
          const ni = parseInt(s[2]) - 1
          const key = `${vi}/${ti}/${ni}`

          if (cache.get(key) != null) {
            fi.push(cache.get(key))
          } else {
            const id = vertices.length
            vertices.push(pos[vi])// ?? new Vec3())
            normals.push(nrm[ni])
            // normals.push(ni >= 0 && nrm[ni] != null ? nrm[ni] : vec4.create(0, 1, 0, 1))
            if (ti >= 0 && tuv[ti]) {
              uvs.push(tuv[ti])
            } else {
              uvs.push(vec2.create(0, 0))
            }
            // Use vertex color from OBJ if present, otherwise default white
            colors.push(vcol[vi] ?? vec4.create(1, 1, 1, 1))
            cache.set(key, id)
            fi.push(id)
          }
        }
        // Fan triangulation: [0,1,2], [0,2,3], [0,3,4], ...
        for (let i = 2; i < fi.length; i++) {
            // these items are reversed to do ccw instead of cw
            indices.push(fi[0]!)
            indices.push(fi[i - 1]!)
            indices.push(fi[i]!)
        }
        break
    }
  })

  return { vertices, normals, uvs, colors, indices }
}

// from here: https://github.com/garykac/3d-cubes/blob/master/cube.obj with added vts
export const cubeObj = `v -1.0 -1.0 -1.0 0.8 0.2 0.2
v -1.0 1.0 -1.0 0.2 0.8 0.2
v 1.0 1.0 -1.0 0.2 0.2 0.8
v 1.0 -1.0 -1.0 0.2 0.2 0.8
v -1.0 -1.0 1.0 0.8 0.8 0.2
v -1.0 1.0 1.0 0.8 0.2 0.8
v 1.0 1.0 1.0 0.9 0.9 0.9
v 1.0 -1.0 1.0 0.5 0.3 0.8

# Normal vectors
# One for each face. Shared by all vertices in that face.
vn  1.0  0.0  0.0  # 1 cghd
vn -1.0  0.0  0.0  # 2 aefb
vn  0.0  1.0  0.0  # 3 gcbf
vn  0.0 -1.0  0.0  # 4 dhea
vn  0.0  0.0  1.0  # 5 hgfe
vn  0.0  0.0 -1.0  # 6 cdab

vt 0 0
vt 0 1
vt 1 1
vt 1 0

# Faces v/vt/vn
#   3-------2
#   | -     |
#   |   #   |  Each face = 2 triangles (ccw)
#   |     - |            = 1-2-3 + 1-3-4
#   4-------1

# Face 1: cghd = cgh + chd
f 3/1/1 7/2/1 8/3/1
f 3/1/1 8/3/1 4/4/1

# Face 2: aefb = aef + afb
f 1/1/2 5/2/2 6/3/2
f 1/1/2 6/3/2 2/4/2

# Face 3: gcbf = gcb + gbf
f 7/1/3 3/2/3 2/3/3
f 7/1/3 2/3/3 6/4/3

# Face 4: dhea = dhe + dea
f 4/1/4 8/2/4 5/3/4
f 4/1/4 5/3/4 1/4/4

# Face 5: hgfe = hgf + hfe
f 8/1/5 7/2/5 6/3/5
f 8/1/5 6/3/5 5/4/5

# Face 6: cdab = cda + cab
f 3/1/6 4/2/6 1/3/6
f 3/1/6 1/3/6 2/4/6`;
