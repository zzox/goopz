import { mat4, Mat4, vec3 } from 'wgpu-matrix'
import { Mesh, meshFromObj, obj2, planeMesh } from './core/mesh'
import { makeTexture } from './core/texture'
import { defaultVert, defaultFrag } from './core/shaders'

export class Game {
  canvas:HTMLCanvasElement
  context!:GPUCanvasContext
  device!:GPUDevice
  pipeline!:GPURenderPipeline
  renderPassDescriptor!:GPURenderPassDescriptor
  uniformBindGroup!:GPUBindGroup

  passEncoder?:GPURenderPassEncoder
  commandEncoder?:GPUCommandEncoder

  constructor (canvas:HTMLCanvasElement, debugDiv?:HTMLDivElement) {
    this.canvas = canvas

    this.establishVars()
      .then(() => {
        // called once game is established
        this.init()
        // kick off update loop
        this.next(0)
      })
      .catch(e => console.error(e))
  }

  async establishVars () {
    const adapter = await navigator.gpu.requestAdapter({
      featureLevel: 'compatibility',
    })
    const device = await adapter?.requestDevice()

    if (!device || !adapter) {
      throw 'No WebGPU!'
    }

    this.device = device

    this.context = this.canvas.getContext('webgpu')!

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

    this.context.configure({
      device,
      format: presentationFormat,
    })

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({
          code: defaultVert,
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
          code: defaultFrag,
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
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const sampler = device.createSampler({
      magFilter: 'nearest', // linear for smooth
      minFilter: 'nearest', // linear for smooth
    });

    const texture = makeTexture(device)

    this.uniformBindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
      ],
    })

    this.renderPassDescriptor = {
      colorAttachments: [
        {
          view: undefined, // Assigned later
          // view: texture, texture.createView(),

          clearValue: [0.1, 0.1, 0.1, 1.0],
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
  }

  next = (time:number) => {
    this.update()
    this.draw()
    requestAnimationFrame(this.next)
  }

  init () {
    throw 'Game::init not implemented'
  }

  update () {
    throw 'Game::update not implemented'
  }

  draw () {
    throw 'Game::draw not implemented'
  }

  getTransformationMatrices(mesh:Mesh) {
    const aspect = this.canvas.width / this.canvas.height
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
    const view = mat4.lookAt(vec3.create(0, 0, 5), camTarget, vec3.create(0, 1, 0))
    mesh.rot[0] += 0.01
    // xRot = xRot % Math.PI

    mesh.pos[2] += 0.01

    // const model = mat4.rotate(mat4.translation(mesh.pos), [Math.sin(xRot), Math.cos(xRot), 0], 1)
    const modelX = mat4.translation(mesh.pos)
    const modelY = mat4.rotateX(modelX, mesh.pos[0])
    const modelZ = mat4.rotateY(modelY, mesh.rot[1])
    const model = mat4.rotateZ(modelZ, mesh.rot[2])

    // console.log(mat4.multiply(projectionMatrix, mat4.multiply(view, modelZ)))

    return {
      mvp: mat4.multiply(projectionMatrix, mat4.multiply(view, model)),
      model
    }
  }

  getBillboardTransformationMatrices(mesh:Mesh) {
    const aspect = this.canvas.width / this.canvas.height
    const projectionMatrix:Mat4 = mat4.perspective((2 * Math.PI) / 5, aspect, 0.1, 100.0)

    const camTarget = vec3.create(0, 0, 0)
    // final proj = Mat4.perspectiveProjection(Math.PI / 4, this.width / this.height, 0.1, 100);
    const view = mat4.lookAt(vec3.create(2.5, 2.5, 5), camTarget, vec3.create(0, 1, 0))
    mesh.rot[0] += 0.01
    // xRot = xRot % Math.PI

    mesh.pos[0] += 0.01

    // const model = mat4.rotate(mat4.translation(mesh.pos), [Math.sin(xRot), Math.cos(xRot), 0], 1)
    const modelX = mat4.translation(mesh.pos)
    const modelY = mat4.rotateX(modelX, mesh.pos[0])
    const modelZ = mat4.rotateY(modelY, mesh.rot[1])
    const model = mat4.rotateZ(modelZ, mesh.rot[2])

    const modelView = mat4.multiply(view, model)

    const bbModelView = mat4.create(1, 0, 0, modelView[3],
    0, 1, 0, modelView[7],
    0, 0, 1, modelView[11],
    modelView[12], modelView[13], modelView[14], modelView[15]);

    // console.log(mat4.multiply(projectionMatrix, mat4.multiply(view, modelZ)))

    return {
      mvp: mat4.multiply(projectionMatrix, bbModelView),
      model
    }
  }

  renderMesh (mesh:Mesh)  {
    if (!this.passEncoder || !this.commandEncoder) {
      throw 'In Game::renderMesh there missing intialized encoders'
    }
    const { mvp: transformationMatrix, model } = this.getTransformationMatrices(mesh)
    this.device.queue.writeBuffer(
      mesh.uniformBuffer,
      0,
      transformationMatrix.buffer,
      transformationMatrix.byteOffset,
      transformationMatrix.byteLength
    )

    this.device.queue.writeBuffer(
      mesh.uniformBuffer,
      64,
      model.buffer,
      model.byteOffset,
      model.byteLength
    )

    this.passEncoder.setPipeline(this.pipeline);
    this.passEncoder.setBindGroup(0, this.uniformBindGroup)
    this.passEncoder.setBindGroup(1, mesh.uniformBindGroup);
    this.passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
    this.passEncoder.setIndexBuffer(mesh.indexBuffer, 'uint32')
    this.passEncoder.drawIndexed(mesh.indexBuffer.size / 4); // byte size of 4
    // passEncoder.draw(36);
  }

  renderBB (mesh:Mesh)  {
    if (!this.passEncoder || !this.commandEncoder) {
      throw 'In Game::renderMesh there missing intialized encoders'
    }
    const { mvp: transformationMatrix, model } = this.getBillboardTransformationMatrices(mesh)
    this.device.queue.writeBuffer(
      mesh.uniformBuffer,
      0,
      transformationMatrix.buffer,
      transformationMatrix.byteOffset,
      transformationMatrix.byteLength
    )

    this.device.queue.writeBuffer(
      mesh.uniformBuffer,
      64,
      model.buffer,
      model.byteOffset,
      model.byteLength
    )

    this.passEncoder.setPipeline(this.pipeline);
    this.passEncoder.setBindGroup(0, this.uniformBindGroup)
    this.passEncoder.setBindGroup(1, mesh.uniformBindGroup);
    this.passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
    this.passEncoder.setIndexBuffer(mesh.indexBuffer, 'uint32')
    this.passEncoder.drawIndexed(mesh.indexBuffer.size / 4); // byte size of 4
    // passEncoder.draw(36);
  }

  begin () {
    this.commandEncoder = this.device.createCommandEncoder();

    // get the contexts current texture to render to
    (this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = this.context
      .getCurrentTexture()
      .createView();

    this.passEncoder = this.commandEncoder.beginRenderPass(this.renderPassDescriptor)
  }

  end () {
    if (!this.passEncoder || !this.commandEncoder) {
      throw 'In Game::end missing intialized encoders'
    }
    this.passEncoder.end()
    this.device.queue.submit([this.commandEncoder.finish()]);
  }
}

// const device = await adapter?.requestDevice({ requiredLimits: { maxStorageBuffersInVertexStage: 10 } })!;
// quitIfWebGPUNotAvailableOrMissingFeatures(adapter, device);

export class TestGame extends Game {
  meshes:Mesh[] = []

  init () {
    for (let i = 0; i < 1; i++) {
      const mesh = new Mesh(meshFromObj(obj2), this.device, this.pipeline)
      mesh.pos[0] = -2 + Math.random() * 4
      mesh.pos[1] = -2 + Math.random() * 4
      mesh.pos[2] = -2 + Math.random() * 4

      mesh.rot[0] = Math.random() * Math.PI
      mesh.rot[1] = Math.random() * Math.PI
      mesh.rot[2] = Math.random() * Math.PI

      this.meshes.push(mesh)
    }

    const mesh = new Mesh(planeMesh(), this.device, this.pipeline)
    mesh.pos[0] = -2 + Math.random() * 4
    mesh.pos[1] = -2 + Math.random() * 4
    mesh.pos[2] = -2 + Math.random() * 4

    mesh.rot[0] = Math.random() * Math.PI
    mesh.rot[1] = Math.random() * Math.PI
    mesh.rot[2] = Math.random() * Math.PI

    this.meshes.push(mesh)
  }

  update() {
    
  }

  draw() {
    this.begin()
    this.meshes.forEach((m, i) => this.renderMesh(m))
    this.renderBB(this.meshes[this.meshes.length - 1])
    this.end()
  }
}

