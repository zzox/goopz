import { Vec2, vec2, vec3, Vec3, vec4, Vec4 } from "wgpu-matrix";

// class Mesh {
//     vertexBuffer:GPUBuffer;

//     constructor () {
//         // Create a vertex buffer from the cube data.
//         this.vertexBuffer = device.createBuffer({
//             size: cubeVertexArray.byteLength,
//             usage: GPUBufferUsage.VERTEX,
//             mappedAtCreation: true,
//         })

//         new Float32Array(this.vertexBuffer.getMappedRange()).set(cubeVertexArray)
//         this.vertexBuffer.unmap()

//     }
// }

type MeshProps = {
  vertices:Vec4[]
  normals:Vec4[]
  uvs:Vec2[]
  colors:Vec4[]
  indices:number[]
}

export class Mesh {
  static structureLength = 14

  vertexBuffer:GPUBuffer // Float32Array
  indexBuffer:GPUBuffer // Uint32Array

  uniformBindGroup:GPUBindGroup
  uniformBuffer:GPUBuffer

  // vertices:Vec4[];
  // normals:Vec4[];
  // uvs:Vec2[];
  // colors:Vec4[];
  // indices:number[];

  pos:Vec3 = vec3.create(0, 0, 0);
  rot:Vec3 = vec3.create(0, 0, 0);

  constructor ({ vertices, normals, uvs, colors, indices }:MeshProps, device:GPUDevice, pipeline:GPURenderPipeline) {
    const numVerts = vertices.length

    const vb = new Float32Array(Mesh.structureLength * indices.length)
    const ib = new Uint32Array(indices)

    // this sets the vertices in order we want without using the index buffer
    // indices.forEach((item, i) => {
    //   vb.set(vertices[item], (i * Mesh.structureLength) + 0)
    //   vb.set(colors[item], (i * Mesh.structureLength) + 4)
    //   vb.set(uvs[item], (i * Mesh.structureLength) + 8)
    //   vb.set(normals[item], (i * Mesh.structureLength) + 10)
    // })

    // this works with the index buffer
    for (let i = 0; i < numVerts; i++) {
      vb.set(vertices[i], (i * Mesh.structureLength) + 0)
      vb.set(colors[i], (i * Mesh.structureLength) + 4)
      vb.set(uvs[i], (i * Mesh.structureLength) + 8)
      vb.set(normals[i], (i * Mesh.structureLength) + 10)
    }

    this.vertexBuffer = device.createBuffer({
      size: vb.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vb)
    this.vertexBuffer.unmap();

    this.indexBuffer = device.createBuffer({
      size: ib.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint32Array(this.indexBuffer.getMappedRange()).set(ib)
    this.indexBuffer.unmap();

    const uniformBufferSize = 4 * 16; // 4x4 matrix
    this.uniformBuffer = device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.uniformBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [
        { binding: 2, resource: this.uniformBuffer }
      ]
    })
  }
}

export const planeMesh = ():MeshProps => {
  const vertices = [
    vec4.create(-1, -1, 0, 1), // bottom-left
    vec4.create(1, -1, 0, 1), // bottom-right
    vec4.create(1, 1, 0, 1), // top-right
    vec4.create(-1, 1, 0, 1), // top-left
  ]
  const n = vec4.create(0, 0, 1, 1)
  const normals = [n, n, n, n]
  const uvs = [vec2.create(0,0), vec2.create(1,0), vec2.create(1,1), vec2.create(0,1)]
  const colors = [
    vec4.create(1.0, 1.0, 1.0, 1.0),
    vec4.create(1.0, 1.0, 1.0, 1.0),
    vec4.create(1.0, 1.0, 1.0, 1.0),
    vec4.create(1.0, 1.0, 1.0, 1.0)
  ]
  const indices = [0,1,2, 0,2,3]
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
            indices.push(fi[i]!)
            indices.push(fi[i - 1]!)
            indices.push(fi[0]!)
        }
        break
    }
  })

  return { vertices, normals, uvs, colors, indices }
}

export const sampleObj = `v -1 -1 -1
v  1 -1 -1
v  1  1 -1
v -1  1 -1
v -1 -1  1
v  1 -1  1
v  1  1  1
v -1  1  1
vn  0  0 -1
vn  0  0  1
vn  0 -1  0
vn  0  1  0
vn -1  0  0
vn  1  0  0
vt 0 0
vt 0 1
vt 1 1
vt 1 0
f 1/1/1 2/2/1 3/3/1 4/4/1
f 5/1/2 8/2/2 7/3/2 6/4/2
f 1/1/3 5/2/3 6/3/3 2/4/3
f 3/1/4 7/2/4 8/3/4 4/4/4
f 5/1/5 1/2/5 4/3/5 8/4/5
f 2/1/6 6/2/6 7/3/6 3/4/6`;

export const obj2 = `v -1 -1 -1 0.8 0.2 0.2
v  1 -1 -1 0.2 0.8 0.2
v  1  1 -1 0.2 0.2 0.8
v -1  1 -1 0.8 0.8 0.2
v -1 -1  1 0.8 0.2 0.8
v  1 -1  1 0.2 0.8 0.8
v  1  1  1 0.9 0.9 0.9
v -1  1  1 0.5 0.3 0.8
vn  0  0 -1
vn  0  0  1
vn  0 -1  0
vn  0  1  0
vn -1  0  0
vn  1  0  0
vt 0 0
vt 1 0
vt 1 1
vt 0 1
f 1/1/1 2/2/1 3/3/1 4/4/1
f 5/1/2 8/2/2 7/3/2 6/4/2
f 1/1/3 5/2/3 6/3/3 2/4/3
f 3/1/4 7/2/4 8/3/4 4/4/4
f 5/1/5 1/2/5 4/3/5 8/4/5
f 2/1/6 6/2/6 7/3/6 3/4/6`;

export const sphereLow = `v 0.000000 1.000000 0.000000
v 0.382683 0.923880 0.000000
v 0.331414 0.923880 0.191342
v 0.191342 0.923880 0.331414
v 0.000000 0.923880 0.382683
v -0.191342 0.923880 0.331414
v -0.331414 0.923880 0.191342
v -0.382683 0.923880 0.000000
v -0.331414 0.923880 -0.191342
v -0.191342 0.923880 -0.331414
v -0.000000 0.923880 -0.382683
v 0.191342 0.923880 -0.331414
v 0.331414 0.923880 -0.191342
v 0.707107 0.707107 0.000000
v 0.612372 0.707107 0.353553
v 0.353553 0.707107 0.612372
v 0.000000 0.707107 0.707107
v -0.353553 0.707107 0.612372
v -0.612372 0.707107 0.353553
v -0.707107 0.707107 0.000000
v -0.612372 0.707107 -0.353553
v -0.353553 0.707107 -0.612372
v -0.000000 0.707107 -0.707107
v 0.353553 0.707107 -0.612372
v 0.612372 0.707107 -0.353553
v 0.923880 0.382683 0.000000
v 0.800103 0.382683 0.461940
v 0.461940 0.382683 0.800103
v 0.000000 0.382683 0.923880
v -0.461940 0.382683 0.800103
v -0.800103 0.382683 0.461940
v -0.923880 0.382683 0.000000
v -0.800103 0.382683 -0.461940
v -0.461940 0.382683 -0.800103
v -0.000000 0.382683 -0.923880
v 0.461940 0.382683 -0.800103
v 0.800103 0.382683 -0.461940
v 1.000000 0.000000 0.000000
v 0.866025 0.000000 0.500000
v 0.500000 0.000000 0.866025
v 0.000000 0.000000 1.000000
v -0.500000 0.000000 0.866025
v -0.866025 0.000000 0.500000
v -1.000000 0.000000 0.000000
v -0.866025 0.000000 -0.500000
v -0.500000 0.000000 -0.866025
v -0.000000 0.000000 -1.000000
v 0.500000 0.000000 -0.866025
v 0.866025 0.000000 -0.500000
v 0.923880 -0.382683 0.000000
v 0.800103 -0.382683 0.461940
v 0.461940 -0.382683 0.800103
v 0.000000 -0.382683 0.923880
v -0.461940 -0.382683 0.800103
v -0.800103 -0.382683 0.461940
v -0.923880 -0.382683 0.000000
v -0.800103 -0.382683 -0.461940
v -0.461940 -0.382683 -0.800103
v -0.000000 -0.382683 -0.923880
v 0.461940 -0.382683 -0.800103
v 0.800103 -0.382683 -0.461940
v 0.707107 -0.707107 0.000000
v 0.612372 -0.707107 0.353553
v 0.353553 -0.707107 0.612372
v 0.000000 -0.707107 0.707107
v -0.353553 -0.707107 0.612372
v -0.612372 -0.707107 0.353553
v -0.707107 -0.707107 0.000000
v -0.612372 -0.707107 -0.353553
v -0.353553 -0.707107 -0.612372
v -0.000000 -0.707107 -0.707107
v 0.353553 -0.707107 -0.612372
v 0.612372 -0.707107 -0.353553
v 0.382683 -0.923880 0.000000
v 0.331414 -0.923880 0.191342
v 0.191342 -0.923880 0.331414
v 0.000000 -0.923880 0.382683
v -0.191342 -0.923880 0.331414
v -0.331414 -0.923880 0.191342
v -0.382683 -0.923880 0.000000
v -0.331414 -0.923880 -0.191342
v -0.191342 -0.923880 -0.331414
v -0.000000 -0.923880 -0.382683
v 0.191342 -0.923880 -0.331414
v 0.331414 -0.923880 -0.191342
v 0.000000 -1.000000 0.000000

vn 0.000000 1.000000 0.000000
vn 0.382683 0.923880 0.000000
vn 0.331414 0.923880 0.191342
vn 0.191342 0.923880 0.331414
vn 0.000000 0.923880 0.382683
vn -0.191342 0.923880 0.331414
vn -0.331414 0.923880 0.191342
vn -0.382683 0.923880 0.000000
vn -0.331414 0.923880 -0.191342
vn -0.191342 0.923880 -0.331414
vn -0.000000 0.923880 -0.382683
vn 0.191342 0.923880 -0.331414
vn 0.331414 0.923880 -0.191342
vn 0.707107 0.707107 0.000000
vn 0.612372 0.707107 0.353553
vn 0.353553 0.707107 0.612372
vn 0.000000 0.707107 0.707107
vn -0.353553 0.707107 0.612372
vn -0.612372 0.707107 0.353553
vn -0.707107 0.707107 0.000000
vn -0.612372 0.707107 -0.353553
vn -0.353553 0.707107 -0.612372
vn -0.000000 0.707107 -0.707107
vn 0.353553 0.707107 -0.612372
vn 0.612372 0.707107 -0.353553
vn 0.923880 0.382683 0.000000
vn 0.800103 0.382683 0.461940
vn 0.461940 0.382683 0.800103
vn 0.000000 0.382683 0.923880
vn -0.461940 0.382683 0.800103
vn -0.800103 0.382683 0.461940
vn -0.923880 0.382683 0.000000
vn -0.800103 0.382683 -0.461940
vn -0.461940 0.382683 -0.800103
vn -0.000000 0.382683 -0.923880
vn 0.461940 0.382683 -0.800103
vn 0.800103 0.382683 -0.461940
vn 1.000000 0.000000 0.000000
vn 0.866025 0.000000 0.500000
vn 0.500000 0.000000 0.866025
vn 0.000000 0.000000 1.000000
vn -0.500000 0.000000 0.866025
vn -0.866025 0.000000 0.500000
vn -1.000000 0.000000 0.000000
vn -0.866025 0.000000 -0.500000
vn -0.500000 0.000000 -0.866025
vn -0.000000 0.000000 -1.000000
vn 0.500000 0.000000 -0.866025
vn 0.866025 0.000000 -0.500000
vn 0.923880 -0.382683 0.000000
vn 0.800103 -0.382683 0.461940
vn 0.461940 -0.382683 0.800103
vn 0.000000 -0.382683 0.923880
vn -0.461940 -0.382683 0.800103
vn -0.800103 -0.382683 0.461940
vn -0.923880 -0.382683 0.000000
vn -0.800103 -0.382683 -0.461940
vn -0.461940 -0.382683 -0.800103
vn -0.000000 -0.382683 -0.923880
vn 0.461940 -0.382683 -0.800103
vn 0.800103 -0.382683 -0.461940
vn 0.707107 -0.707107 0.000000
vn 0.612372 -0.707107 0.353553
vn 0.353553 -0.707107 0.612372
vn 0.000000 -0.707107 0.707107
vn -0.353553 -0.707107 0.612372
vn -0.612372 -0.707107 0.353553
vn -0.707107 -0.707107 0.000000
vn -0.612372 -0.707107 -0.353553
vn -0.353553 -0.707107 -0.612372
vn -0.000000 -0.707107 -0.707107
vn 0.353553 -0.707107 -0.612372
vn 0.612372 -0.707107 -0.353553
vn 0.382683 -0.923880 0.000000
vn 0.331414 -0.923880 0.191342
vn 0.191342 -0.923880 0.331414
vn 0.000000 -0.923880 0.382683
vn -0.191342 -0.923880 0.331414
vn -0.331414 -0.923880 0.191342
vn -0.382683 -0.923880 0.000000
vn -0.331414 -0.923880 -0.191342
vn -0.191342 -0.923880 -0.331414
vn -0.000000 -0.923880 -0.382683
vn 0.191342 -0.923880 -0.331414
vn 0.331414 -0.923880 -0.191342
vn 0.000000 -1.000000 0.000000

f 1//1 2//2 3//3
f 1//1 3//3 4//4
f 1//1 4//4 5//5
f 1//1 5//5 6//6
f 1//1 6//6 7//7
f 1//1 7//7 8//8
f 1//1 8//8 9//9
f 1//1 9//9 10//10
f 1//1 10//10 11//11
f 1//1 11//11 12//12
f 1//1 12//12 13//13
f 1//1 13//13 2//2
f 2//2 3//3 15//15 14//14
f 3//3 4//4 16//16 15//15
f 4//4 5//5 17//17 16//16
f 5//5 6//6 18//18 17//17
f 6//6 7//7 19//19 18//18
f 7//7 8//8 20//20 19//19
f 8//8 9//9 21//21 20//20
f 9//9 10//10 22//22 21//21
f 10//10 11//11 23//23 22//22
f 11//11 12//12 24//24 23//23
f 12//12 13//13 25//25 24//24
f 13//13 2//2 14//14 25//25
f 14//14 15//15 27//27 26//26
f 15//15 16//16 28//28 27//27
f 16//16 17//17 29//29 28//28
f 17//17 18//18 30//30 29//29
f 18//18 19//19 31//31 30//30
f 19//19 20//20 32//32 31//31
f 20//20 21//21 33//33 32//32
f 21//21 22//22 34//34 33//33
f 22//22 23//23 35//35 34//34
f 23//23 24//24 36//36 35//35
f 24//24 25//25 37//37 36//36
f 25//25 14//14 26//26 37//37
f 26//26 27//27 39//39 38//38
f 27//27 28//28 40//40 39//39
f 28//28 29//29 41//41 40//40
f 29//29 30//30 42//42 41//41
f 30//30 31//31 43//43 42//42
f 31//31 32//32 44//44 43//43
f 32//32 33//33 45//45 44//44
f 33//33 34//34 46//46 45//45
f 34//34 35//35 47//47 46//46
f 35//35 36//36 48//48 47//47
f 36//36 37//37 49//49 48//48
f 37//37 26//26 38//38 49//49
f 38//38 39//39 51//51 50//50
f 39//39 40//40 52//52 51//51
f 40//40 41//41 53//53 52//52
f 41//41 42//42 54//54 53//53
f 42//42 43//43 55//55 54//54
f 43//43 44//44 56//56 55//55
f 44//44 45//45 57//57 56//56
f 45//45 46//46 58//58 57//57
f 46//46 47//47 59//59 58//58
f 47//47 48//48 60//60 59//59
f 48//48 49//49 61//61 60//60
f 49//49 38//38 50//50 61//61
f 50//50 51//51 63//63 62//62
f 51//51 52//52 64//64 63//63
f 52//52 53//53 65//65 64//64
f 53//53 54//54 66//66 65//65
f 54//54 55//55 67//67 66//66
f 55//55 56//56 68//68 67//67
f 56//56 57//57 69//69 68//68
f 57//57 58//58 70//70 69//69
f 58//58 59//59 71//71 70//70
f 59//59 60//60 72//72 71//71
f 60//60 61//61 73//73 72//72
f 61//61 50//50 62//62 73//73
f 62//62 63//63 75//75 74//74
f 63//63 64//64 76//76 75//75
f 64//64 65//65 77//77 76//76
f 65//65 66//66 78//78 77//77
f 66//66 67//67 79//79 78//78
f 67//67 68//68 80//80 79//79
f 68//68 69//69 81//81 80//80
f 69//69 70//70 82//82 81//81
f 70//70 71//71 83//83 82//82
f 71//71 72//72 84//84 83//83
f 72//72 73//73 85//85 84//84
f 73//73 62//62 74//74 85//85
f 74//74 86//86 75//75
f 75//75 86//86 76//76
f 76//76 86//86 77//77
f 77//77 86//86 78//78
f 78//78 86//86 79//79
f 79//79 86//86 80//80
f 80//80 86//86 81//81
f 81//81 86//86 82//82
f 82//82 86//86 83//83
f 83//83 86//86 84//84
f 84//84 86//86 85//85
f 85//85 86//86 74//74`;

function faceParse (fv:String):number[] {
  return fv.split('/').map(item => parseInt(item));
}
