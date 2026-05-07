import { vec3, Vec3 } from "wgpu-matrix";

export class Camera {
  pos:Vec3

  constructor () {
    this.pos = vec3.create(0, 0, 5)
  }

  identity () {

  }
}
