import { mat4, Mat4, Vec3 } from 'wgpu-matrix'

export const average = (arr:number[]):number => {
  if (arr.length === 0) return 0
  return arr.reduce((res:number, item:number) => item + res, 0) / arr.length
}

// translate and rotate a point and a rotation
export const transRot = (pos:Vec3, rot:Vec3):Mat4 => {
  const viewX = mat4.translation(pos)
  const viewY = mat4.rotateX(viewX, rot[0])
  const viewZ = mat4.rotateY(viewY, rot[1])
  return mat4.rotateZ(viewZ, rot[2])
}
