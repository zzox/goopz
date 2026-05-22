import { Vec2, vec2, vec3, Vec3, vec4, Vec4 } from 'wgpu-matrix'

export type MeshProps = {
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
  wireframeBindGroup:GPUBindGroup
  uniformBuffer:GPUBuffer

  numVerts:number

  texture?:GPUTexture

  // vertices:Vec4[];
  // normals:Vec4[];
  // uvs:Vec2[];
  // colors:Vec4[];
  // indices:number[];

  pos:Vec3 = vec3.create(0, 0, 0)
  rot:Vec3 = vec3.create(0, 0, 0)
  anchor:Vec3 = vec3.create(0, 0, 0)
  scale:Vec3 = vec3.create(1, 1, 1)

  billboard:boolean = false

  constructor ({ vertices, normals, uvs, colors, indices }:MeshProps, device:GPUDevice, pipeline:GPURenderPipeline, wireframePipeline:GPURenderPipeline) {
    this.numVerts = vertices.length

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
    for (let i = 0; i < this.numVerts; i++) {
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

    const uniformBufferSize = 4 * 16 * 3; // 2 4x4 matrices
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

    let vboPositions = device.createBuffer({
      size: vb.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    let vboIndices = device.createBuffer({
      size: ib.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(vboPositions, 0, vb.buffer, 0, vb.byteLength);
    // device.queue.writeBuffer(vboColors, 0, points.colors.buffer, 0, points.colors.byteLength);
    device.queue.writeBuffer(vboIndices, 0, ib.buffer, 0, ib.byteLength);

    this.wireframeBindGroup = device.createBindGroup({
      layout: wireframePipeline.getBindGroupLayout(0),
      entries: [
        {binding: 0, resource: {buffer: this.uniformBuffer}},
        {binding: 1, resource: {buffer: vboPositions}},
        {binding: 2, resource: {buffer: vboIndices}},
      ],
    })
  }

  setUv (tile:number, width:number, height:number, device:GPUDevice) {
    const tex = this.texture!

    // const tw = Math.floor(tex.width / width)
    // const th = Math.floor(tex.height / height)

    const numRows = Math.floor(tex.width / width)

    const x = (tile % numRows) * width
    const y = Math.floor(tile / numRows) * height

    const items = [
      vec2.create(x / tex.width, (y + height) / tex.height),
      vec2.create((x + width) / tex.width, (y + height) / tex.height),
      vec2.create((x + width) / tex.width, y / tex.height),
      vec2.create(x / tex.width, y / tex.height)
    ]

    for (let i = 0; i < this.numVerts; i++) {
      // write the new uvs
      device.queue.writeBuffer(
        this.vertexBuffer,
        ((i * Mesh.structureLength) + 8) * 4,
        items[i].buffer,
        items[i].byteOffset,
        items[i].byteLength
      )
    }
  }

  setNormals (vec3:Vec3, device:GPUDevice) {
    const item = vec4.fromValues(vec3[0], vec3[1], vec3[2], 1.0)

    for (let i = 0; i < this.numVerts; i++) {
      // write the new uvs
      device.queue.writeBuffer(
        this.vertexBuffer,
        ((i * Mesh.structureLength) + 10) * 4,
        item.buffer,
        item.byteOffset,
        item.byteLength
      )
    }
  }
}
