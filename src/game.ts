import { Mat4, mat4, Vec3, vec3, vec4 } from 'wgpu-matrix'
import { Mesh } from './core/mesh'
import { makeTexture } from './core/texture'
import { defaultVert, defaultFrag, wireframeShader, shadowShader } from './core/shaders'
import { justPressed, keys } from './core/keys'
import { Debug } from './util/debug'
import { average, displayVec3, transRot } from './util/util'
import { Camera } from './core/camera'
import { Scene } from './core/scene'

export class Game {
  canvas:HTMLCanvasElement
  debugDiv?:HTMLDivElement
  context!:GPUCanvasContext
  device!:GPUDevice
  pipeline!:GPURenderPipeline
  wireframePipeline!:GPURenderPipeline
  renderPassDescriptor!:GPURenderPassDescriptor
  uniformBindGroup!:GPUBindGroup
  textures:Map<string, GPUTexture> = new Map()
  objs:Map<string, string> = new Map()

  shadowBindGroup!:GPUBindGroup
  shadowDepthView!:GPUTextureView
  shadowDepthSampler!:GPUSampler
  shadowPassDescriptor!:GPURenderPassDescriptor
  shadowPipeline!:GPURenderPipeline
  shadowPass?:GPURenderPassEncoder
  shadowBindGroupLayout!:GPUBindGroupLayout

  orthoLight!:Mat4
  lightPos!:Mat4

  passEncoder?:GPURenderPassEncoder
  commandEncoder?:GPUCommandEncoder

  acc:number = 0
  prev:number = 0

  paused:boolean = false

  fps:number = 60
  frameTime:number = 1000 / this.fps

  currentScene!:Scene

  lightDir:Vec3 = vec3.create(1, 1, 1)

  constructor (canvas:HTMLCanvasElement, InitialScene:typeof Scene, debugDiv?:HTMLDivElement) {
    this.canvas = canvas

    this.establishVars()
    .then(this.loadAssets.bind(this))
      .then(() => {
        // called once game is established
        // this.init()

        const scene = new InitialScene(this)
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
        case 'f':
          Debug.on = !Debug.on
          break
        case 'p':
          console.log(
            `FPS: ${Debug.drawFrames.length}, avg: ${Math.round(average(Debug.drawTimes) * 1000)}us\n` +
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
    Debug.drawTimes = [...new Array(300)].map(_ => 0) // 5 seconds on 60fps monitors
    Debug.updateTimes = [...new Array(300)].map(_ => 0) // ~5 seconds

    this.debugDiv = debugDiv
// #end debug
  }

  async establishVars () {
    const adapter = await navigator.gpu.requestAdapter({
      featureLevel: 'compatibility',
    })
    const device = await adapter?.requestDevice({
      requiredLimits: { maxStorageBuffersInVertexStage: 2 }
    })

    if (!device || !adapter) {
      throw 'No WebGPU!'
    }

    this.device = device

    this.context = this.canvas.getContext('webgpu')!

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

    this.context.configure({
      device,
      format: presentationFormat,
      alphaMode: 'premultiplied',
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
            blend: {
              // needed for alpha value from textures
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha'
              },
            },
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
        depthBias: 1,
      },
    });

    const shadowDepthTexture = this.device.createTexture({
      label: 'shadow depth texture',
      size: [1024, 1024],
      // format: 'depth24plus',
      format: 'depth32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // const shadowDepthTexture = await createDepthTexture(device, DEPTH_TEXTURE_SIZE, DEPTH_TEXTURE_SIZE);
    this.shadowDepthView = shadowDepthTexture.createView({
      // format: "depth32float"
    });
    this.shadowDepthSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    const shadowShaderModule = device.createShaderModule({
      label: "shadow shader module",
      code: shadowShader,
    });

    this.orthoLight = mat4.ortho(-20, 20, -20, 20, 0.1, 500)

    // this.shadowBindGroupLayout = device.createBindGroupLayout({
    //   label: "bind group layout",
    //   entries: [
    //     // Texture atlas
    //     {
    //       binding: 0,
    //       visibility: GPUShaderStage.FRAGMENT,
    //       texture: {},
    //     },
    //     {
    //       binding: 1,
    //       visibility: GPUShaderStage.FRAGMENT,
    //       sampler: {},
    //     },
    //     // {
    //     //   binding: 2,
    //     //   visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    //     //   buffer: {
    //     //     type: "uniform"
    //     //   },
    //     // },
    //   ]
    // });

    // const shadowPipelineLayout = device.createPipelineLayout({
    //   label: "shadow pipeline layout",
    //   bindGroupLayouts: [this.shadowBindGroupLayout],
    // });

    this.shadowPipeline = device.createRenderPipeline({
      vertex: {
        module: shadowShaderModule,
        entryPoint: "vertexMain",
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
        module: shadowShaderModule,
        entryPoint: "fragmentMain",
        targets: [],
      },
      // layout: shadowPipelineLayout,
      layout: 'auto',
      depthStencil: {
        depthCompare: "less",
        depthWriteEnabled: true,
        format: "depth32float",
      },
      primitive: {
        topology: "triangle-list",
        frontFace: "ccw",
        cullMode: "none",
      },
    });

    let module = device.createShaderModule({ code: wireframeShader });

		const layout = device.createBindGroupLayout({
			label: "wireframe layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'uniform'},
				}, {
					binding: 1,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				}, {
					binding: 2,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				// },{
				// 	binding: 3,
				// 	visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				// 	buffer: {type: 'read-only-storage'},
				}
			],
		});

		this.wireframePipeline = device.createRenderPipeline({
			// layout: device.createPipelineLayout({
			// 	bindGroupLayouts: [layout]
			// }),
      layout: 'auto',
      label: 'wf',
			vertex: {
				module,
				entryPoint: "main_vertex",
				buffers: []
			},
			fragment: {
				module,
				entryPoint: "main_fragment",
				targets: [{ format: presentationFormat }],
			},
			primitive: {
				topology: 'line-list',
				// cullMode: 'none',
			},
			depthStencil: {
				depthWriteEnabled: false,
				depthCompare: 'less-equal',
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

    this.shadowPassDescriptor = {
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowDepthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    }  as GPURenderPassDescriptor
  }

  async loadAssets () {
    const assets = [
      'assets/images/mario_fill.png',
      'assets/images/mario_fill_2.png',
      'assets/images/2dtiles.png',
      'assets/obj/diablo-3-pose.obj',
      'assets/images/horror-metal-14.png'
    ]

    const images = assets.filter(asset => asset.slice(-4) === '.png').map(asset => this.loadImage(asset))
    const blobs = assets.filter(asset => asset.slice(-4) === '.obj').map(asset => this.loadBlob(asset))

    await Promise.all([...blobs, ...images])
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
      { source: imageBitmap/*, flipY: false */ },
      { texture: texture },
      [imageBitmap.width, imageBitmap.height]
    )

    const splt = str.split('/')
    const name = splt[splt.length - 1].split('.')[0]

    if (this.textures.get(name)) {
      throw `texture already named ${name}`
    }

    this.textures.set(name, texture)
  }

  async loadBlob (str:string) {
    const response = await fetch(str)
    const res = await response.text()

    const splt = str.split('/')
    const name = splt[splt.length - 1].split('.')[0]

    this.objs.set(name, res)
  }

  next = (time:number) => {
    if (!this.paused) {
      const delta = time - this.prev
      this.acc += Math.min(delta, this.frameTime + 2.0)

      if (this.acc > this.frameTime) {
// #start debug
        const updateStart = performance.now()
// #end

        this.currentScene.update()

        const time = performance.now()
        const updateTime = time - updateStart
        Debug.updateTimes.push(updateTime)
        Debug.updateTimes.shift()

        Debug.updateFrames.push(time)
        while (true) {
          if (Debug.updateFrames[0] != null && Debug.updateFrames[0] < time - 999.0) {
            Debug.updateFrames.shift()
          } else {
            break;
          }
        }

// #start debug
        const drawStart = performance.now()
// #end

        this.currentScene.draw()

// #start debug
        const rtime = performance.now()
        const drawTime = rtime - drawStart
        Debug.drawTimes.push(drawTime)
        Debug.drawTimes.shift()

        Debug.drawFrames.push(time)
        while (true) {
          if (Debug.drawFrames[0] != null && Debug.drawFrames[0] < time - 999.0) {
            Debug.drawFrames.shift()
          } else {
            break;
          }
        }
        this.acc -= this.frameTime
// #end

// #start debug
        if (this.debugDiv && Debug.on) {
          this.debugDiv.style.left = '0px'
          this.debugDiv.style.top = '0px'
          const pItems = Array.from(this.debugDiv.querySelectorAll('p'))
          pItems[0].textContent = `FPS: ${Debug.drawFrames.length}, avg: ${Math.round(average(Debug.drawTimes) * 1000)}us`
          pItems[1].textContent = `UPS: ${Debug.updateFrames.length}, avg: ${Math.round(average(Debug.updateTimes) * 1000)}us`
          pItems[2].textContent = `camera: ${displayVec3(this.currentScene.cam.pos)}, ${this.currentScene.cam.pitch.toFixed(2)},${this.currentScene.cam.yaw.toFixed(2)}`
          // pItems[2].textContent = `things: ${scene.things.length} checks: ${scene.checks}`
          // pItems[3].textContent = `scale: ${debugScale}`
          this.debugDiv.classList.remove('none')
        } else if (this.debugDiv) {
          this.debugDiv.classList.add('none')
        }
// #end
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

    const model = transRot(mesh.pos, mesh.rot, mesh.anchor, mesh.scale)

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

    const lightMat = mat4.mul(this.orthoLight, mat4.translation(vec3.create(0, 5, 5)))

    this.device.queue.writeBuffer(
      mesh.uniformBuffer,
      128,
      lightMat.buffer,
      lightMat.byteOffset,
      lightMat.byteLength
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
    const dirColor = vec3.create(0.8, 0.8, 0.8)
    const ambientColor = vec3.create(0.7, 0.7, 0.7)

    const fogColor = vec4.create(0.3, 0.3, 0.3, 1.0)
    const fogDensity = new Float32Array([0.0])

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
        { binding: 2, resource: lightUniformBuffer },
        {
          binding: 3,
          resource: this.shadowDepthView,
        },
        {
          binding: 4,
          resource: this.shadowDepthSampler,
        },
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

  startDraw () {
    this.commandEncoder = this.device.createCommandEncoder()
  }

  finishDraw () {
    this.device.queue.submit([this.commandEncoder!.finish()])
  }

  renderShadow (mesh:Mesh, cam:Camera)  {
    if (!this.shadowPass || !this.commandEncoder) {
      throw 'In Game::renderShadow there are missing intialized encoders'
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

    const lightMat = mat4.mul(this.orthoLight, mat4.translation(vec3.create(0, 5, 5)))

    this.device.queue.writeBuffer(
      mesh.uniformBuffer,
      128,
      lightMat.buffer,
      lightMat.byteOffset,
      lightMat.byteLength
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
    const dirColor = vec3.create(0.8, 0.8, 0.8)
    const ambientColor = vec3.create(0.7, 0.7, 0.7)

    const fogColor = vec4.create(0.3, 0.3, 0.3, 1.0)
    const fogDensity = new Float32Array([0.0])

    

    // this.uniformBindGroup = this.device.createBindGroup({
    //   layout: this.pipeline.getBindGroupLayout(0),
    //   entries: [
    //     { binding: 0, resource: sampler },
    //     { binding: 1, resource: texture.createView() },
    //     { binding: 2, resource: lightUniformBuffer }
    //   ],
    // })

    this.shadowBindGroup = this.device.createBindGroup({
      label: "bind group",
      layout: this.shadowPipeline.getBindGroupLayout(0),
      // layout: this.shadowBindGroupLayout,
      entries: [
        // Texture atlas
        {
          binding: 0,
          resource: texture,
        },
        {
          binding: 1,
          resource: sampler,
        },
        // {
        //   binding: 2,
        //   resource: {buffer: mesh.uniformBuffer},
        // },
      ],
    });

    const meshUniformGroup = this.device.createBindGroup({
      layout: this.shadowPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 2, resource: mesh.uniformBuffer }
      ]
    })

    this.shadowPass.setPipeline(this.shadowPipeline);
    this.shadowPass.setBindGroup(0, this.shadowBindGroup)
    this.shadowPass.setBindGroup(1, meshUniformGroup)
    // this.shadowPass.setBindGroup(2, lightUniformBuffer)
    this.shadowPass.setVertexBuffer(0, mesh.vertexBuffer)
    this.shadowPass.setIndexBuffer(mesh.indexBuffer, 'uint32')
    this.shadowPass.drawIndexed(mesh.indexBuffer.size / 4); // byte size of 4
    // passEncoder.draw(36);
  }

  renderMeshWireframe (mesh:Mesh, cam:Camera)  {
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

    this.passEncoder.setPipeline(this.wireframePipeline)
    this.passEncoder.setBindGroup(0, mesh.wireframeBindGroup)
    this.passEncoder.setVertexBuffer(0, mesh.vertexBuffer)
    this.passEncoder.setIndexBuffer(mesh.indexBuffer, 'uint32')
    this.passEncoder.draw(mesh.indexBuffer.size)
  }

  begin () {
    // get the contexts current texture to render to
    ;(this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = this.context
      .getCurrentTexture()
      .createView()

    this.passEncoder = this.commandEncoder!.beginRenderPass(this.renderPassDescriptor)
  }

  end () {
    if (!this.passEncoder || !this.commandEncoder) {
      throw 'In Game::end missing intialized encoders'
    }
    this.passEncoder.end()
  }

  beginShadow () {
    // // get the contexts current texture to render to
    // ;(this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = this.context
    //   .getCurrentTexture()
    //   .createView()

    this.shadowPass = this.commandEncoder!.beginRenderPass(this.shadowPassDescriptor)
  }

  endShadow () {
    if (!this.shadowPass || !this.commandEncoder) {
      throw 'In Game::end missing intialized encoders'
    }
    this.shadowPass.end()
    // this.device.queue.submit([this.commandEncoder.finish()])
  }
}

// const device = await adapter?.requestDevice({ requiredLimits: { maxStorageBuffersInVertexStage: 10 } })!;
// quitIfWebGPUNotAvailableOrMissingFeatures(adapter, device);

