/// <reference types="@webgpu/types" />

import { Mat4, mat4, vec3 } from 'wgpu-matrix';
import { vert } from './shaders/basic.vert.wgsl'
import { frag } from './shaders/vertexPositionColor.frag.wgsl'
import { makeTexture } from './objects/texture';
import { meshFromObj, sampleObj, obj2, Mesh, planeMesh } from './objects/mesh';
// import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement
const fixed = document.getElementsByClassName('fixed')[0] as HTMLDivElement

const adapter = await navigator.gpu?.requestAdapter({
  featureLevel: 'compatibility',
});
const device = await adapter?.requestDevice()!
// const device = await adapter?.requestDevice({ requiredLimits: { maxStorageBuffersInVertexStage: 10 } })!;
// quitIfWebGPUNotAvailableOrMissingFeatures(adapter, device);

const context = canvas.getContext('webgpu')!

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device,
  format: presentationFormat,
});

// const mesh = new Mesh(meshFromObj(obj2), device)

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: device.createShaderModule({
      code: vert,
    }),
    buffers: [
      {
        arrayStride: Mesh.structureLength * 4,
        // stepMode: 'vertex', //default?
        attributes: [
          {
            // position
            shaderLocation: 0,
            offset: 0,
            format: 'float32x4',
          },
          {
            // colors
            shaderLocation: 1,
            offset: 4 * 4,
            format: 'float32x4',
          },
          {
            // uv
            shaderLocation: 2,
            offset: 8 * 4,
            format: 'float32x2',
          },
          {
            // normal
            shaderLocation: 3,
            offset: 10 * 4,
            format: 'float32x2',
          },
        ],
      },
      // {
      //   attributes: [
      //     {
      //       shaderLocation: 0, offset: 0, format: 'uint32'
      //     }
      //   ]
      // }
    ],
  },
  fragment: {
    module: device.createShaderModule({
      code: frag,
    }),
    targets: [
      {
        format: presentationFormat,
      },
    ],
  },
  primitive: {
    topology: 'triangle-list',

    // frontFace: 'cw',
    frontFace: 'ccw', // default

    // Backface culling since the cube is solid piece of geometry.
    // Faces pointing away from the camera will be occluded by faces
    // pointing toward the camera.
    cullMode: 'back',
    // cullMode: 'none',
  },

  // Enable depth testing so that the fragment closest to the camera
  // is rendered in front.
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus',
  },
});

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

const sampler = device.createSampler({
  magFilter: 'nearest', // linear for smooth
  minFilter: 'nearest', // linear for smooth
});

const texture = makeTexture(device)

const uniformBindGroup1 = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(1),
  entries: [
    { binding: 1, resource: sampler },
    { binding: 2, resource: texture.createView() },
  ],
});

const renderPassDescriptor:GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: undefined, // Assigned later
      // view: texture, texture.createView(),

      clearValue: [0.3, 0.3, 0.3, 1.0],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
  depthStencilAttachment: {
    view: depthTexture.createView(),

    depthClearValue: 1.0,
    depthLoadOp: 'clear',
    depthStoreOp: 'store',
  },
} as GPURenderPassDescriptor;

function getTransformationMatrix(mesh:Mesh) {

  const aspect = canvas.width / canvas.height
const projectionMatrix:Mat4 = mat4.perspective((2 * Math.PI) / 5, aspect, 0.1, 100.0)
const modelViewProjectionMatrix = mat4.create()
  // const viewMatrix = mat4.identity()
  // mat4.translate(viewMatrix, [0, 0, -4], viewMatrix)
  // const now = Date.now() / 1000
  // mat4.rotate(viewMatrix, [Math.sin(now), Math.cos(now), 0], 1, viewMatrix);

  // mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);

  // return modelViewProjectionMatrix;

  const camTarget = vec3.create(0, 0, 0)
  // final proj = Mat4.perspectiveProjection(Math.PI / 4, this.width / this.height, 0.1, 100);
  const view = mat4.lookAt(vec3.create(2.5, 2.5, 5), camTarget, vec3.create(0, 1, 0))
  mesh.rot[0] += 0.01
  // xRot = xRot % Math.PI

  mesh.pos[0] += 0.001

  // const model = mat4.rotate(mat4.translation(mesh.pos), [Math.sin(xRot), Math.cos(xRot), 0], 1)
  const modelX = mat4.rotateX(mat4.translation(mesh.pos), mesh.pos[0])
  const modelY = mat4.rotateY(modelX, mesh.rot[1])
  const modelZ = mat4.rotateZ(modelY, mesh.rot[2])

  // console.log(mat4.multiply(projectionMatrix, mat4.multiply(view, modelZ)))

  return mat4.multiply(projectionMatrix, mat4.multiply(view, modelZ))
}

let passEncoder: GPURenderPassEncoder, commandEncoder: GPUCommandEncoder

const begin = () => {
  commandEncoder = device.createCommandEncoder();

  renderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();

  passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
}

const renderMesh = (mesh:Mesh, i:number) => {
  const transformationMatrix = getTransformationMatrix(mesh);
  device.queue.writeBuffer(
    mesh.uniformBuffer,
    0,
    transformationMatrix.buffer,
    transformationMatrix.byteOffset,
    transformationMatrix.byteLength
  );

  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, mesh.uniformBindGroup);
  passEncoder.setBindGroup(1, uniformBindGroup1)
  passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
  passEncoder.setIndexBuffer(mesh.indexBuffer, 'uint32')
  passEncoder.drawIndexed(mesh.indexBuffer.size / 4); // byte size of 4
  // passEncoder.draw(36);
}

const end = () => {
  passEncoder.end()
  device.queue.submit([commandEncoder.finish()]);
}

const meshes:Mesh[] = []

for (let i = 0; i < 1; i++) {
  const mesh = new Mesh(meshFromObj(obj2), device, pipeline)
  mesh.pos[0] = -2 + Math.random() * 4
  mesh.pos[1] = -2 + Math.random() * 4
  mesh.pos[2] = -2 + Math.random() * 4

  mesh.rot[0] = Math.random() * Math.PI
  mesh.rot[1] = Math.random() * Math.PI
  mesh.rot[2] = Math.random() * Math.PI

  meshes.push(mesh)
}

const mesh = new Mesh(planeMesh(), device, pipeline)
mesh.pos[0] = -2 + Math.random() * 4
mesh.pos[1] = -2 + Math.random() * 4
mesh.pos[2] = -2 + Math.random() * 4

mesh.rot[0] = Math.random() * Math.PI
mesh.rot[1] = Math.random() * Math.PI
mesh.rot[2] = Math.random() * Math.PI

meshes.push(mesh)

const next = () => {
  begin();
  meshes.forEach(renderMesh);
  end();
  requestAnimationFrame(next);
}

const run = async () => {
  next()
  console.log(adapter, device)
}

run()
