import { vec2, vec3 } from 'wgpu-matrix'
import { Mesh } from '../core/mesh'
import { makeWall, meshFromObj, cubeObj, planeMesh, makeFloor } from '../util/mesh-util'
import { makeTexture } from '../core/texture'
import { clearJustPressed, justPressed, keys } from '../core/keys'
import { Debug } from '../util/debug'
import { WasdCamera, StadiumCamera } from '../core/camera'
import { getAnim } from '../data/anim-data'
import { Scene } from '../core/scene'
import { Game } from '../game'

export class TestScene1 extends Scene {
  meshes:Mesh[] = []
  diablo:Mesh
  planeMesh:Mesh
  animGuy:Mesh
  animGuyFrames:number = 0
  wasdCam:boolean = true

  constructor (game:Game) {
    super(game)
    this.cam = new WasdCamera()

    for (let i = 0; i < 3; i++) {
      const mesh = this.makeMesh(meshFromObj(cubeObj))
      mesh.pos[0] = -2 + Math.random() * 4
      mesh.pos[1] = -2 + Math.random() * 4
      mesh.pos[2] = -2 + Math.random() * 4

      mesh.rot[0] = Math.random() * Math.PI
      mesh.rot[1] = Math.random() * Math.PI
      mesh.rot[2] = Math.random() * Math.PI

      this.meshes.push(mesh)
    }

    this.meshes[2].scale[1] = 3
    // this.meshes[2].anchor[0] = 6
    this.meshes[2].anchor[1] = 1
    // this.meshes[2].anchor[2] = 6
    this.meshes[1].anchor[1] = 1

    const wall1 = this.makeMesh(makeWall(vec2.create(-4, 4), vec2.create(-4, -4), 4))
    wall1.texture = this.game.textures.get('mario_fill')
    const wall2 = this.makeMesh(makeWall(vec2.create(-4, -4), vec2.create(0, -12), 4))
    wall2.texture = makeTexture(this.game.device)
    const wall3 = this.makeMesh(makeWall(vec2.create(0, -12), vec2.create(4, -4), 4))
    const wall4 = this.makeMesh(makeWall(vec2.create(4, -4), vec2.create(4, 4), 4))
    const wall5 = this.makeMesh(makeWall(vec2.create(4, 4), vec2.create(-4, 4), 4))
    wall5.texture = this.game.textures.get('mario_fill_2')
    const floor = this.makeMesh(makeFloor(-12, -12, 16, 16, 0))
    floor.texture = this.game.textures.get('horror-metal-14')

    this.meshes.push(wall1)
    this.meshes.push(wall2)
    this.meshes.push(wall3)
    this.meshes.push(wall4)
    this.meshes.push(wall5)
    this.meshes.push(floor)

    this.planeMesh = this.makeMesh(planeMesh())
    this.planeMesh.pos[0] = -1
    this.planeMesh.pos[1] = 2
    this.planeMesh.pos[2] = 1

    // mesh.rot[0] = Math.random() * Math.PI
    // mesh.rot[1] = Math.random() * Math.PI
    // mesh.rot[2] = Math.random() * Math.PI

    this.diablo = this.makeMesh(meshFromObj(this.game.objs.get('diablo-3-pose')!))
    this.diablo.anchor[1] = 1
    this.diablo.scale.set([5, 5, 5])

    this.meshes.push(this.diablo)

    this.animGuy = this.makeMesh(planeMesh())
    this.animGuy.pos.set([0, 1, 1])
    this.animGuy.texture = this.game.textures.get('2dtiles')
    this.animGuy.billboard = true
    // this.animGuy.texture = makeTexture(this.game.device)
    this.meshes.push(this.planeMesh)
    this.meshes.push(this.animGuy)
    this.planeMesh.billboard = true
  }

  update() {
    // move to parent?
    // ugly
    this.cam.update()

    if (this.wasdCam) {
      const cam = this.cam as WasdCamera
      if (keys.get('w')) {
        // cam.pos[2] -= 0.1
        cam.moveForward(true)
      }

      if (keys.get('s')) {
        cam.moveForward(false)
      }

      if (keys.get('d')) {
        cam.moveRight(true)
      }

      if (keys.get('a')) {
        cam.moveRight(false)
      }

      if (keys.get('q')) {
        cam.yaw += 0.03
      }

      if (keys.get('e')) {
        cam.yaw -= 0.03
      }

      if (keys.get('z')) {
        cam.pos[1] += 0.1
      }

      if (keys.get('c')) {
        cam.pos[1] -= 0.1
      }
    } else {
      const cam = this.cam as StadiumCamera
      if (keys.get('a')) {
        // cam.pos[2] -= 0.1
        cam.angle--
      }

      if (keys.get('d')) {
        cam.angle++
      }

      if (keys.get('w')) {
        // cam.pos[2] -= 0.1
        cam.distance -= 0.1
      }

      if (keys.get('s')) {
        cam.distance += 0.1
      }

      cam.at = vec3.copy(this.animGuy.pos)
    }

    if (justPressed.get('x')) {
      this.wasdCam = !this.wasdCam
      if (this.wasdCam) {
        this.cam = new WasdCamera()
      } else {
        this.cam = new StadiumCamera()
      }
    }

    if (keys.get('j')) {
      this.animGuy.pos[0] -= 0.1
    }

    if (keys.get('l')) {
      this.animGuy.pos[0] += 0.1
    }

    if (keys.get('i')) {
      this.animGuy.pos[2] -= 0.1
    }

    if (keys.get('k')) {
      this.animGuy.pos[2] += 0.1
    }

    if (justPressed.get('m')) {
      this.meshes[4].setUv(Math.floor(Math.random() * 16), 16, 16, this.game.device)
      // this.meshes[this.meshes.length - 1].vertexBuffer.mapAsync(GPUBufferUsage.MAP_READ).then(v => console.log(v))
    }

    // works if the x or y light values arent 0. z doesn't matter?
    if (justPressed.get('u')) {
      this.animGuy.setNormals(this.game.lightDir, this.game.device)
      this.meshes.find(m => m.billboard)!.setNormals(this.game.lightDir, this.game.device)
    }

    // this.meshes[2].rot[1] += 0.03
    // this.meshes[2].rot[0] += 0.03

    // this.meshes[1].scale[1] *= 1.001

    this.diablo.scale[0] *= 1.0000001
    this.diablo.scale[1] *= 1.0000001
    this.diablo.scale[2] *= 1.0000001
    // this.diablo.rot[1] += 0.03

    // console.log(this.meshes.indexOf(this.animGuy), this.meshes.indexOf(this.planeMesh), vec3.dist(this.planeMesh.pos, this.cam.pos), vec3.dist(this.animGuy.pos, this.cam.pos))

    this.animGuyFrames++
    this.animGuy.setUv(64 + getAnim('moving', this.animGuyFrames), 16, 16, this.game.device)

    clearJustPressed()
  }

  draw() {
    this.game.begin()

    // sort meshes by distance and render the billboards second so they cannot overlap on the alphas
    this.meshes.sort((a, b) => {
      return vec3.dist(b.pos, this.cam.pos) - vec3.dist(a.pos, this.cam.pos)
    })
    this.meshes.filter(m => !m.billboard).forEach((m) => this.game.renderMesh(m, this.cam))
    this.meshes.filter(m => m.billboard).forEach((m) => this.game.renderMesh(m, this.cam))
    if (Debug.on) {
      this.meshes.forEach(m => this.game.renderMeshWireframe(m, this.cam))
    }
    // this.renderBB(this.meshes[this.meshes.length - 1])
    this.game.end()
  }
}
