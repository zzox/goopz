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

// Returns `x` clamped between [`min` .. `max`]
export const clamp = (x:number, min:number, max: number):number => {
  return Math.min(Math.max(x, min), max)
}

// Returns `x` float-modulo `div`
export const mod = (x:number, div:number):number => {
  return x - Math.floor(Math.abs(x) / div) * div * Math.sign(x)
}

export const displayVec3 = (vec:Vec3, pos:number = 2) => {
  return `${vec[0].toFixed(pos)},${vec[1].toFixed(pos)},${vec[2].toFixed(pos)}`
}

// // Returns `vec` rotated `angle` radians around `axis`
// function rotate(vec: Vec3, axis: Vec3, angle:number): Vec3 {
//   return vec3.transformMat4Upper3x3(vec, mat4.rotation(axis, angle));
// }

// // Returns the linear interpolation between 'a' and 'b' using 's'
// function lerp(a: Vec3, b: Vec3, s:number): Vec3 {
//   return vec3.addScaled(a, vec3.sub(b, a), s);
// }
