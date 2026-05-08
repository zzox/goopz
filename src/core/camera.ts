import { Mat4, mat4, vec3, Vec3 } from 'wgpu-matrix'
import { clamp, mod, transRot } from '../util/util'

// lots from https://webgpu.github.io/webgpu-samples/?sample=cameras#camera.ts

// wasd camera
export class Camera {
  yaw:number = 0

  pitch:number = 0

  // cameras position
  pos:Vec3
  // cameras rotation, doesn't matter when looking at something
  // rot:Vec3
  // projection matrix
  proj:Mat4
  // cameras target, doesn't matter when free looking
  // target:Vec3

  back:Vec3

  aspect:number

  constructor (aspect:number) {
    this.pos = vec3.create(0, 0, 5)
    // this.rot = vec3.create(0, 0, 0)
    const target = vec3.create(0, 0, 0)
    this.proj = mat4.perspective((2 * Math.PI) / 5, aspect, 0.1, 100.0)
    this.back = vec3.normalize(vec3.sub(this.pos, target))
    this.recalculateAngles(this.back)
    this.aspect = aspect
  }

  getView ():Mat4 {
    const matrix = this.getMatrix()
    return mat4.invert(matrix)
  }

  // getViewAt ():Mat4 {
  //   return mat4.lookAt(this.pos, this.target, vec3.create(0, 1, 0))
  // }

  update () {
    // Wrap yaw between [0° .. 360°], just to prevent large accumulation.
    this.yaw = mod(this.yaw, Math.PI * 2)
    // Clamp pitch between [-90° .. +90°] to prevent somersaults.
    this.pitch = clamp(this.pitch, -Math.PI / 2, Math.PI / 2)
  }

  // get the matrix from translation and position
  getMatrix ():Mat4 {
    const it = mat4.translation(this.pos)
    return mat4.rotateX(mat4.rotateY(it, this.yaw), this.pitch)
  }

  moveForward (forward:boolean) {
    const matrix = this.getMatrix()

    const vel = vec3.create()
    // 8/9/10 is the "back" vec3 of the view matrix
    const vel1 = vec3.addScaled(vel, vec3.create(matrix[8], matrix[9], matrix[10]), forward ? -1 : 1)
    const norm = vec3.normalize(vel1)
    this.pos = vec3.addScaled(this.pos, norm, 60 / 1000)
  }

  moveRight (right:boolean) {
    const matrix = this.getMatrix()

    const vel = vec3.create()
    // 0/1/2 is the "right" vec3 of the view matrix
    const vel1 = vec3.addScaled(vel, vec3.create(matrix[0], matrix[1], matrix[2]), right ? 1 : -1)
    const norm = vec3.normalize(vel1)
    this.pos = vec3.addScaled(this.pos, norm, 60 / 1000)
  }

  // Recalculates the yaw and pitch values from a directional vector
  recalculateAngles(dir:Vec3) {
    this.yaw = Math.atan2(dir[0], dir[2]);
    this.pitch = -Math.asin(dir[1]);
  }
}
