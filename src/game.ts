import { mat4, Mat4, vec2, Vec3, vec3, vec4 } from 'wgpu-matrix'
import { makeWall, Mesh, meshFromObj, MeshProps, obj2, planeMesh } from './core/mesh'
import { makeTexture } from './core/texture'
import { defaultVert, defaultFrag } from './core/shaders'
import { justPressed, keys } from './core/keys'
import { Debug } from './util/debug'
import { average, displayVec3, transRot } from './util/util'
import { Camera } from './core/camera'

export class Game {
  canvas:HTMLCanvasElement
  debugDiv?:HTMLDivElement
  context!:GPUCanvasContext
  device!:GPUDevice
  pipeline!:GPURenderPipeline
  renderPassDescriptor!:GPURenderPassDescriptor
  uniformBindGroup!:GPUBindGroup
  textures:Map<string, GPUTexture> = new Map()

  passEncoder?:GPURenderPassEncoder
  commandEncoder?:GPUCommandEncoder

  acc:number = 0
  prev:number = 0

  paused:boolean = false

  fps:number = 60
  frameTime:number = 1000 / this.fps

  currentScene!:Scene

  lightDir:Vec3 = vec3.create(0, 0, 1)

  constructor (canvas:HTMLCanvasElement, InitialScene:typeof Scene, debugDiv?:HTMLDivElement) {
    this.canvas = canvas

    this.establishVars()
    .then(this.loadAssets.bind(this))
      .then(() => {
        // called once game is established
        // this.init()

        const scene = new InitialScene()
        scene.game = this
        scene.create()
        this.currentScene = scene

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

  async loadAssets () {
    const assets = ['assets/images/mario_fill.png']
    await Promise.all(assets.map(asset => this.loadImage(asset)))
  }

  async loadImage (str:string) {
    const response = await fetch(str)
    const imageBitmap = await createImageBitmap(await response.blob())

    const texture = this.device.createTexture({
      size: [imageBitmap.width, imageBitmap.height, 1],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: texture },
      [imageBitmap.width, imageBitmap.height]
    )

    const splt = str.split('/')
    const name = splt[splt.length - 1].split('.')[0]

    if (this.textures.get(name)) {
      throw 'Cant have named texture'
    }

    this.textures.set(name, texture)
  }

  next = (time:number) => {
    if (!this.paused) {
      const delta = time - this.prev
      this.acc += Math.min(delta, this.frameTime + 2.0)

      if (this.acc > this.frameTime) {
        this.currentScene.update()
        this.currentScene.draw()
        this.acc -= this.frameTime
      }
    }

    this.prev = time
    requestAnimationFrame(this.next)
  }

  getTransformationMatrices(mesh:Mesh, cam:Camera) {
    const camTarget = vec3.create(0, 0, 0)
    // final proj = Mat4.perspectiveProjection(Math.PI / 4, this.width / this.height, 0.1, 100);

    const view = cam.getView()

    // mesh.rot[0] += 0.1
    // xRot = xRot % Math.PI

    // mesh.pos[2] += 0.01

    const projection = mat4.perspective((2 * Math.PI) / 6, this.canvas.width / this.canvas.height, 0.1, 100.0)

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
      mvp: mat4.multiply(projection, finalModelView),
      model
    }
  }

  renderMesh (mesh:Mesh, cam:Camera)  {
    if (!this.passEncoder || !this.commandEncoder) {
      throw 'In Game::renderMesh there missing intialized encoders'
    }
    const { mvp: transformationMatrix, model } = this.getTransformationMatrices(mesh, cam)
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

    const texture = mesh.texture || makeTexture(this.device)

    const sampler = this.device.createSampler({
      magFilter: 'nearest', // linear for smooth
      minFilter: 'nearest', // linear for smooth
    });

    const lightBufferSize = 4 * 32;
    const lightUniformBuffer = this.device.createBuffer({
      size: lightBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const light = vec3.normalize(this.lightDir)
    const dirColor = vec3.create(0.5, 0.5, 0.5)
    const ambientColor = vec3.create(0.7, 0.7, 0.7)

    const fogColor = vec4.create(0.47, 0.5, 0.67, 0.0)
    const fogDensity = new Float32Array([0.5])

    this.device.queue.writeBuffer(
      lightUniformBuffer,
      0,
      light.buffer,
      light.byteOffset,
      light.byteLength
    )

    this.device.queue.writeBuffer(
      lightUniformBuffer,
      16,
      dirColor.buffer,
      dirColor.byteOffset,
      dirColor.byteLength
    )

    this.device.queue.writeBuffer(
      lightUniformBuffer,
      32,
      ambientColor.buffer,
      ambientColor.byteOffset,
      ambientColor.byteLength
    )

    this.device.queue.writeBuffer(
      lightUniformBuffer,
      48,
      fogColor.buffer,
      fogColor.byteOffset,
      fogColor.byteLength
    )

    this.device.queue.writeBuffer(
      lightUniformBuffer,
      64,
      fogDensity.buffer,
      fogDensity.byteOffset,
      fogDensity.byteLength
    )

    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
        { binding: 2, resource: lightUniformBuffer }
      ],
    })

    this.passEncoder.setPipeline(this.pipeline);
    this.passEncoder.setBindGroup(0, this.uniformBindGroup)
    this.passEncoder.setBindGroup(1, mesh.uniformBindGroup)
    // this.passEncoder.setBindGroup(2, lightUniformBuffer)
    this.passEncoder.setVertexBuffer(0, mesh.vertexBuffer)
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

class Scene {
  game!:Game
  paused:boolean = false
  cam!:Camera

  create () {
    this.cam = new Camera()
  }

  // init () {
  //   throw 'Scene::init not implemented'
  // }

  update () {
    throw 'Scene::update not implemented'
  }

  draw () {
    throw 'Scene::draw not implemented'
  }

  makeMesh (meshProps:MeshProps):Mesh {
    return new Mesh(meshProps, this.game.device, this.game.pipeline)
  }
}

export class TestScene extends Scene {
  meshes:Mesh[] = []

  create () {
    super.create()

    for (let i = 0; i < 3; i++) {
      const mesh = this.makeMesh(meshFromObj(obj2))
      mesh.pos[0] = -2 + Math.random() * 4
      mesh.pos[1] = -2 + Math.random() * 4
      mesh.pos[2] = -2 + Math.random() * 4

      mesh.rot[0] = Math.random() * Math.PI
      mesh.rot[1] = Math.random() * Math.PI
      mesh.rot[2] = Math.random() * Math.PI

      this.meshes.push(mesh)
    }

    const wall1 = this.makeMesh(makeWall(vec2.create(-4, 4), vec2.create(-4, -4), 4))
    wall1.texture = this.game.textures.get('mario_fill')

    const wall2 = this.makeMesh(makeWall(vec2.create(-4, -4), vec2.create(0, -12), 4))

    const wall3 = this.makeMesh(makeWall(vec2.create(0, -12), vec2.create(4, -4), 4))

    const wall4 = this.makeMesh(makeWall(vec2.create(4, -4), vec2.create(4, 4), 4))

    const wall5 = this.makeMesh(makeWall(vec2.create(4, 4), vec2.create(-4, 4), 4))

    this.meshes.push(wall1)
    this.meshes.push(wall2)
    this.meshes.push(wall3)
    this.meshes.push(wall4)
    this.meshes.push(wall5)

    const mesh = this.makeMesh(planeMesh())
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
      this.cam.yaw += 0.03
    }

    if (keys.get('e')) {
      this.cam.yaw -= 0.03
    }

    if (keys.get('z')) {
      this.cam.pos[1] += 0.1
    }

    if (keys.get('c')) {
      this.cam.pos[1] -= 0.1
    }
  }

  draw() {
    this.game.begin()
    this.meshes.forEach((m) => this.game.renderMesh(m, this.cam))
    // this.renderBB(this.meshes[this.meshes.length - 1])
    this.game.end()

// #start debug
    if (!this.game.debugDiv) {
      return
    }

    if (Debug.on) {
      this.game.debugDiv.style.left = '0px'
      this.game.debugDiv.style.top = '0px'
      const pItems = Array.from(this.game.debugDiv.querySelectorAll('p'))
      pItems[0].textContent = `FPS: ${Debug.renderFrames.length}, avg: ${Math.round(average(Debug.renderTimes) * 1000)}us`
      pItems[1].textContent = `UPS: ${Debug.updateFrames.length}, avg: ${Math.round(average(Debug.updateTimes) * 1000)}us`
      pItems[2].textContent = `camera: ${displayVec3(this.cam.pos)}, ${this.cam.pitch.toFixed(2)},${this.cam.yaw.toFixed(2)}`
      // pItems[2].textContent = `things: ${scene.things.length} checks: ${scene.checks}`
      // pItems[3].textContent = `scale: ${debugScale}`
      this.game.debugDiv.classList.remove('none')
    } else {
      this.game.debugDiv.classList.add('none')
    }
// #end
  }
}

