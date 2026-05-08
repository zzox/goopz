import { mat4, Mat4, vec3 } from 'wgpu-matrix'
import { Mesh, meshFromObj, obj2, planeMesh } from './core/mesh'
import { makeTexture } from './core/texture'
import { defaultVert, defaultFrag } from './core/shaders'
import { justPressed, keys } from './core/keys'
import { Debug } from './util/debug'
import { average, transRot } from './util/util'
import { Camera } from './core/camera'

export class Game {
  canvas:HTMLCanvasElement
  debugDiv?:HTMLDivElement
  context!:GPUCanvasContext
  device!:GPUDevice
  pipeline!:GPURenderPipeline
  renderPassDescriptor!:GPURenderPassDescriptor
  uniformBindGroup!:GPUBindGroup

  passEncoder?:GPURenderPassEncoder
  commandEncoder?:GPUCommandEncoder

  acc:number = 0
  prev:number = 0

  // TODO: move to scene
  paused:boolean = false
  cam:Camera

  fps:number = 60
  frameTime:number = 1000 / this.fps

  constructor (canvas:HTMLCanvasElement, debugDiv?:HTMLDivElement) {
    this.canvas = canvas

    this.cam = new Camera(this.canvas.width / this.canvas.height)

    this.establishVars()
      .then(() => {
        // called once game is established
        this.init()
        // kick off update loop
        this.next(0)
      })
      .catch(e => console.error(e))

    document.onkeydown = (event:KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Space':
          event.preventDefault()
          break
        case 'd':
          Debug.on = !Debug.on
          break
        case 'p':
          console.log(
            `FPS: ${Debug.renderFrames.length}, avg: ${Math.round(average(Debug.renderTimes) * 1000)}us\n` +
            `UPS: ${Debug.updateFrames.length}, avg: ${Math.round(average(Debug.updateTimes) * 1000)}us`
          )
          this.paused = !this.paused
          break
      }
      if (event.repeat) return
      keys.set(event.key, true)
      justPressed.set(event.key, true)
    }
    document.onkeyup = (event:KeyboardEvent) => {
      // event.preventDefault()
      keys.set(event.key, false)
    }

// #start debug
    Debug.renderTimes = [...new Array(300)].map(_ => 0) // 5 seconds on 60fps monitors
    Debug.updateTimes = [...new Array(300)].map(_ => 0) // ~5 seconds

    this.debugDiv = debugDiv
// #end debug
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
        // cullMode: 'back',
        cullMode: 'none',
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
    if (!this.paused) {
      const delta = time - this.prev
      this.acc += Math.min(delta, this.frameTime + 2.0)

      if (this.acc > this.frameTime) {
        this.update()
        this.draw()
        this.acc -= this.frameTime
      }
    }

    this.prev = time
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
    const camTarget = vec3.create(0, 0, 0)
    // final proj = Mat4.perspectiveProjection(Math.PI / 4, this.width / this.height, 0.1, 100);

    const view = this.cam.getView()

    // mesh.rot[0] += 0.1
    // xRot = xRot % Math.PI

    // mesh.pos[2] += 0.01

    const model = transRot(mesh.pos, mesh.rot)

    const modelView = mat4.multiply(view, model)

    const finalModelView = mesh.billboard
      ? mat4.create(1, 0, 0, modelView[3],
        0, 1, 0, modelView[7],
        0, 0, 1, modelView[11],
        modelView[12], modelView[13], modelView[14], modelView[15]
      ) : modelView

    // console.log(mat4.multiply(projectionMatrix, mat4.multiply(view, modelZ)))

    return {
      mvp: mat4.multiply(this.cam.proj, finalModelView),
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

  begin () {
    this.commandEncoder = this.device.createCommandEncoder()

    // get the contexts current texture to render to
    ;(this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = this.context
      .getCurrentTexture()
      .createView()

    this.passEncoder = this.commandEncoder.beginRenderPass(this.renderPassDescriptor)
  }

  end () {
    if (!this.passEncoder || !this.commandEncoder) {
      throw 'In Game::end missing intialized encoders'
    }
    this.passEncoder.end()
    this.device.queue.submit([this.commandEncoder.finish()])
  }
}

// const device = await adapter?.requestDevice({ requiredLimits: { maxStorageBuffersInVertexStage: 10 } })!;
// quitIfWebGPUNotAvailableOrMissingFeatures(adapter, device);

export class TestGame extends Game {
  meshes:Mesh[] = []

  init () {
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(meshFromObj(obj2), this.device, this.pipeline)
      mesh.pos[0] = -2 + Math.random() * 4
      mesh.pos[1] = -2 + Math.random() * 4
      mesh.pos[2] = -2 + Math.random() * 4

      mesh.rot[0] = Math.random() * Math.PI
      mesh.rot[1] = Math.random() * Math.PI
      mesh.rot[2] = Math.random() * Math.PI

      this.meshes.push(mesh)
    }

    const wall1 = new Mesh(
      planeMesh(
        vec3.create(0, 0, 4),
        vec3.create(0, 0, -4),
        vec3.create(0, 4, -4),
        vec3.create(0, 4, 4)
      ),
      this.device,
      this.pipeline
    )

    this.meshes.push(wall1)
    // this.meshes.push(wall2)
    // this.meshes.push(wall3)
    // this.meshes.push(wall4)

    const mesh = new Mesh(planeMesh(), this.device, this.pipeline)
    mesh.pos[0] = -2 + Math.random() * 4
    mesh.pos[1] = -2 + Math.random() * 4
    mesh.pos[2] = -2 + Math.random() * 4

    mesh.rot[0] = Math.random() * Math.PI
    mesh.rot[1] = Math.random() * Math.PI
    mesh.rot[2] = Math.random() * Math.PI

    this.meshes.push(mesh)
    mesh.billboard = true
  }

  update() {
    // move to parent?
    this.cam.update()

    if (keys.get('w')) {
      // this.cam.pos[2] -= 0.1
      this.cam.moveForward(true)
    }

    if (keys.get('s')) {
      this.cam.moveForward(false)
    }

    if (keys.get('d')) {
      this.cam.moveRight(true)
    }

    if (keys.get('a')) {
      this.cam.moveRight(false)
    }

    if (keys.get('q')) {
      this.cam.yaw -= 0.1
    }

    if (keys.get('e')) {
      this.cam.yaw += 0.1
    }

    if (keys.get('z')) {
      this.cam.pos[1] += 0.1
    }

    if (keys.get('c')) {
      this.cam.pos[1] -= 0.1
    }
  }

  draw() {
    this.begin()
    this.meshes.forEach((m) => this.renderMesh(m))
    // this.renderBB(this.meshes[this.meshes.length - 1])
    this.end()

// #start debug
    if (!this.debugDiv) {
      return
    }

    if (Debug.on) {
      this.debugDiv.style.left = '0px'
      this.debugDiv.style.top = '0px'
      const pItems = Array.from(this.debugDiv.querySelectorAll('p'))
      pItems[0].textContent = `FPS: ${Debug.renderFrames.length}, avg: ${Math.round(average(Debug.renderTimes) * 1000)}us`
      pItems[1].textContent = `UPS: ${Debug.updateFrames.length}, avg: ${Math.round(average(Debug.updateTimes) * 1000)}us`
      pItems[2].textContent = `camera: ${this.cam.pos}, ${this.cam.pitch},${this.cam.yaw}`
      // pItems[2].textContent = `things: ${scene.things.length} checks: ${scene.checks}`
      // pItems[3].textContent = `scale: ${debugScale}`
      this.debugDiv.classList.remove('none')
    } else {
      this.debugDiv.classList.add('none')
    }
// #end
  }
}

