import { Mat4, mat4, vec3, Vec3 } from 'wgpu-matrix'
import { clamp, mod, transRot } from '../util/util'

// lots from https://webgpu.github.io/webgpu-samples/?sample=cameras#camera.ts

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
  target:Vec3

  constructor (aspect:number) {
    this.pos = vec3.create(0, 0, 5)
    // this.rot = vec3.create(0, 0, 0)
    this.target = vec3.create(0, 0, 0)
    this.proj = mat4.perspective((2 * Math.PI) / 5, aspect, 0.1, 100.0)
    const back = vec3.normalize(vec3.sub(this.pos, this.target))
    this.recalculateAngles(back)
  }

  getView ():Mat4 {
    const it = mat4.translation(this.pos)
    const matrix = mat4.rotateX(mat4.rotateY(it, this.yaw), this.pitch)
    return mat4.invert(matrix)
  }

  getViewAt ():Mat4 {
    return mat4.lookAt(this.pos, this.target, vec3.create(0, 1, 0))
  }

  update () {
    // Wrap yaw between [0° .. 360°], just to prevent large accumulation.
    this.yaw = mod(this.yaw, Math.PI * 2)
    // Clamp pitch between [-90° .. +90°] to prevent somersaults.
    this.pitch = clamp(this.pitch, -Math.PI / 2, Math.PI / 2)
  }

  // Recalculates the yaw and pitch values from a directional vector
  recalculateAngles(dir: Vec3) {
    this.yaw = Math.atan2(dir[0], dir[2]);
    this.pitch = -Math.asin(dir[1]);
  }
}
