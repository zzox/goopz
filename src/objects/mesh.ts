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

export class Mesh {
    structureLength = 14

    vertexBuffer:Float32Array
    indexBuffer:Uint32Array

    // verticies:Vec4[];
    // normals:Vec4[];
    // uvs:Vec2[];
    // colors:Vec4[];
    // indicies:number[];

    pos:Vec3 = vec3.create(0, 0, 0);
    rot:Vec3 = vec3.create(0, 0, 0);

    constructor (verticies:Vec4[], normals:Vec4[], uvs:Vec2[], colors:Vec4[], indicies:number[]) {
        const numVerts = verticies.length

        this.vertexBuffer = new Float32Array(this.structureLength * indicies.length)
        this.indexBuffer = new Uint32Array(indicies)

        // this.indexBuffer = this.indexBuffer.map((item, i) => 36 - i)
        
        // console.log(verticies, normals, uvs, colors, indicies)
        // console.log(this.indexBuffer, this.vertexBuffer)
        // for (let i = 0; i < numVerts; i++) {
        //     this.vertexBuffer.set(verticies[i], (i * this.structureLength) + 0)
        //     this.vertexBuffer.set(colors[i], (i * this.structureLength) + 4)
        //     this.vertexBuffer.set(uvs[i], (i * this.structureLength) + 8)
        //     this.vertexBuffer.set(normals[i], (i * this.structureLength) + 10)
        // }

        // this sets the verticies in order, but still doesn't work for using
        // the index buffer
        indicies.forEach((item, i) => {
            this.vertexBuffer.set(verticies[item], (i * this.structureLength) + 0)
            this.vertexBuffer.set(colors[item], (i * this.structureLength) + 4)
            this.vertexBuffer.set(uvs[item], (i * this.structureLength) + 8)
            this.vertexBuffer.set(normals[item], (i * this.structureLength) + 10)
        })
    }
}

export const parseObj = (objStr:String):Mesh => {
    const pos:Vec4[] = [];
    const vcol:(Vec4 | null)[] = [];  // per-position vertex colors (unofficial extension)
    const nrm:Vec4[] = [];
    const tuv:Vec2[] = [];
    const verticies:Vec4[] = [];
    const normals:Vec4[] = [];
    const uvs:Vec2[] = [];
    const colors:Vec4[] = [];
    const indicies:number[] = [];

    const cache = new Map<string, number>();

    // const vLines = lines.filter(line -> line.substr(0, 2) == 'v ');
    // const fLines = lines.filter(line -> line.substr(0, 2) == 'f ');
    // trace('parsed ${vLines.length} verticies and ${fLines.length} faces');

    objStr.split('\n').forEach(l => {
        const line = l.split(' ').filter(item => item != '')

        console.log(line)
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
                    const s = line[i].split('/');

                    // key for vertex index, uv index, normal index
                    const vi = parseInt(s[0]) - 1;
                    const ti = parseInt(s[1]) - 1;
                    const ni = parseInt(s[2]) - 1;
                    const key = `${vi}/${ti}/${ni}`

                    if (cache.get(key) != null) {
                        fi.push(cache.get(key))
                    } else {
                        const id = verticies.length;
                        verticies.push(pos[vi]);// ?? new Vec3());
                        normals.push(nrm[ni]);
                        // normals.push(ni >= 0 && nrm[ni] != null ? nrm[ni] : vec4.create(0, 1, 0, 1));
                        if (ti >= 0 && tuv[ti]) {
                            uvs.push(tuv[ti]);
                        } else {
                            uvs.push(vec2.create(0, 0));
                        }
                        // Use vertex color from OBJ if present, otherwise default white
                        colors.push(vcol[vi] ?? vec4.create(1, 1, 1, 1));
                        cache.set(key, id);
                        fi.push(id);
                    }
                }
                // Fan triangulation: [0,1,2], [0,2,3], [0,3,4], ...
                for (let i = 2; i < fi.length; i++) {
                    indicies.push(fi[0]!);
                    indicies.push(fi[i - 1]!);
                    indicies.push(fi[i]!);
                }
                break
        }
    })

    return new Mesh(verticies, normals, uvs, colors, indicies);
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

function faceParse (fv:String):number[] {
    return fv.split('/').map(item => parseInt(item));
}
