import { Mat4, mat4, vec3, Vec3 } from 'wgpu-matrix'
import { transRot } from '../util/util'

export class Camera {
  // cameras position
  pos:Vec3
  // cameras rotation, doesn't matter when looking at something
  rot:Vec3
  // projection matrix
  proj:Mat4
  // cameras target, doesn't matter when free looking
  target:Vec3

  constructor (aspect:number) {
    this.pos = vec3.create(0, 0, 5)
    this.rot = vec3.create(0, Math.PI / 2, 0)
    this.target = vec3.create(0, 0, 0)
    this.proj = mat4.perspective((2 * Math.PI) / 5, aspect, 0.1, 100.0)
  }

  getView ():Mat4 {
    return transRot(this.pos, this.rot)
  }

  getViewAt ():Mat4 {
    return mat4.lookAt(this.pos, this.target, vec3.create(0, 1, 0))
  }
}
