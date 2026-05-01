/// <reference types="@webgpu/types" />

import { mat4 } from 'wgpu-matrix';
import { vert } from './shaders/basic.vert.wgsl'
import { frag } from './shaders/vertexPositionColor.frag.wgsl'
import { makeTexture } from './objects/texture';
import { parseObj, sampleObj } from './objects/mesh';
// import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement
const fixed = document.getElementsByClassName('fixed')[0] as HTMLDivElement

const adapter = await navigator.gpu?.requestAdapter({
  featureLevel: 'compatibility',
});
const device = await adapter?.requestDevice()!
// const device = await adapter?.requestDevice({ requiredLimits: { maxStorageBuffersInVertexStage: 10 } })!;
// quitIfWebGPUNotAvailableOrMissingFeatures(adapter, device);

const texture = makeTexture(device)

const context = canvas.getContext('webgpu')!

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device,
  format: presentationFormat,
});

const mesh = parseObj(sampleObj)

const vertexBuffer = device.createBuffer({
  size: mesh.vertexBuffer.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});
new Float32Array(vertexBuffer.getMappedRange()).set(mesh.vertexBuffer);
vertexBuffer.unmap();

const indexBuffer = device.createBuffer({
  size: mesh.indexBuffer.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  // mappedAtCreation: true,
});
new Float32Array(mesh.indexBuffer)
// indexBuffer.unmap();

console.log(indexBuffer)

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: device.createShaderModule({
      code: vert,
    }),
    buffers: [
      {
        arrayStride: mesh.structureLength * 4,
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

    // Backface culling since the cube is solid piece of geometry.
    // Faces pointing away from the camera will be occluded by faces
    // pointing toward the camera.
    cullMode: 'none',
    // cullMode: 'back',
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

const uniformBufferSize = 4 * 16; // 4x4 matrix
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const sampler = device.createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
});

const uniformBindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: uniformBuffer },
    { binding: 1, resource: sampler },
    { binding: 2, resource: texture.createView() },
  ],
});

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: texture.createView(), // Assigned later

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
};

const aspect = canvas.width / canvas.height;
const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 0.1, 100.0);
const modelViewProjectionMatrix = mat4.create();

function getTransformationMatrix() {
  const viewMatrix = mat4.identity();
  mat4.translate(viewMatrix, [0, 0, -4], viewMatrix);
  const now = Date.now() / 1000;
  mat4.rotate(viewMatrix, [Math.sin(now), Math.cos(now), 0], 1, viewMatrix);

  mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);

  return modelViewProjectionMatrix;
}

const next = () => {
    const transformationMatrix = getTransformationMatrix();
  device.queue.writeBuffer(
    uniformBuffer,
    0,
    transformationMatrix.buffer,
    transformationMatrix.byteOffset,
    transformationMatrix.byteLength
  );
  renderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, uniformBindGroup);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.setIndexBuffer(indexBuffer, 'uint16')
  passEncoder.drawIndexed(mesh.indexBuffer.length);
  // passEncoder.draw(mesh.vertexBuffer.length / mesh.structureLength);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(next)
  console.log('drawing', mesh.indexBuffer.length)
}

const run = async () => {
  next()
    console.log(adapter, device)
}

run()
