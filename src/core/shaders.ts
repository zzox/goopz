
export const defaultVert = `
struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
  modelMatrix : mat4x4f
}
@group(1) @binding(2) var<uniform> uniforms : Uniforms;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
  @location(1) fragColor : vec4f,
  @location(2) normal : vec3f
}

@vertex
fn main(
  @location(0) position : vec4f,
  @location(1) color : vec4f,
  @location(2) uv : vec2f,
  @location(3) normal : vec3f
) -> VertexOutput {
  var output : VertexOutput;
  output.Position = uniforms.modelViewProjectionMatrix * position;
  output.fragUV = uv;
  output.fragColor = color;
  output.normal = normalize((uniforms.modelMatrix * vec4(normal, 0)).xyz);
  return output;
}`

export const defaultFrag = `
@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> light : Lighting;

struct Lighting {
  lightDir : vec3f,
  dirColor : vec3f,
  ambientColor : vec3f,

  fogColor : vec4f,
  fogDensity : f32,
}

// const lightDir = vec3f(0.0, 0.0, 1.0);
// const dirColor = vec3f(0.4);
// const ambientColor = vec3f(0.7);

// const fogColor = vec4f(0.47, 0.5, 0.67, 0.0);
// const fogDensity = f32(0.1);

fn fog(density : f32, frag_coord : vec4f) -> f32 {
  let LOG2 : f32 = -1.442695;
  let dist = frag_coord.z / frag_coord.w * 0.1;
  let d    = density * dist;
  return 1.0 - clamp(exp2(d * d * LOG2), 0.0, 1.0);
}

@fragment
fn main(
  @builtin(position) Position : vec4f,
  @location(0) fragUV: vec2f,
  @location(1) fragColor: vec4f,
  @location(2) normal: vec3f
) -> @location(0) vec4f {
  let texColor = textureSample(myTexture, mySampler, fragUV) * fragColor;
  let lightColor = saturate(light.ambientColor + max(dot(normalize(normal), light.lightDir), 0.0) * light.dirColor);
  let color = vec4f(texColor.rgb * lightColor, texColor.a);
  return mix(color, light.fogColor, fog(light.fogDensity, Position));
}`
