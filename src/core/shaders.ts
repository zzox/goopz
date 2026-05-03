
export const defaultVert = `
struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
}
@binding(2) @group(1) var<uniform> uniforms : Uniforms;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) fragColor : vec4f,
}

@vertex
fn main(
  @location(0) position : vec4f,
  @location(1) color : vec4f,
  @location(2) uv : vec2f,
  @location(3) normal : vec4f
) -> VertexOutput {
  var output : VertexOutput;
  output.Position = uniforms.modelViewProjectionMatrix * position;
  output.fragUV = uv;
  output.fragColor = color;
  return output;
}`

export const defaultFrag = `
@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;

@fragment
fn main(
  @location(0) fragUV: vec2f,
  @location(1) fragColor: vec4f
) -> @location(0) vec4f {
  return textureSample(myTexture, mySampler, fragUV) * fragColor;
}`
