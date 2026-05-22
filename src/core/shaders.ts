
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
// struct VertexOutput {
//   @builtin(position) Position : vec4f,
//   @location(0) fragUV : vec2f,
//   @location(1) fragColor : vec4f,
//   @location(2) normal : vec3f,
// }

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> light : Lighting;
@group(0) @binding(3) var shadowTextureView: texture_depth_2d;
@group(0) @binding(4) var shadowTextureSampler: sampler;

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

// fn shadow(in: VertexOutput) -> f32 {
//   let u = (in.light_pos.x + 1) * 0.5;
//   let v = (-1 * in.light_pos.y + 1) * 0.5;
//   let lightDepth = textureSample(shadowTextureView, shadowTextureSampler, vec2f(u, v));

//   if (u < 0.0 || v < 0.0 || u >= 1.0 || v >= 1.0) {
//     // Set this to zero to debug the orthographic frustum
//     return 1.0;
//   }

//   let bias = 0.0005;
//   if (in.light_pos.z < lightDepth + bias) {
//     return 1.0;
//   }

//   return 0.0;
// }

@fragment
fn main(
  @builtin(position) Position : vec4f,
  @location(0) fragUV: vec2f,
  @location(1) fragColor: vec4f,
  @location(2) normal: vec3f
) -> @location(0) vec4f {
  // let lightDepth = textureSample(shadowTextureView, shadowTextureSampler, fragUV);
  let atlas_dimensions = textureDimensions(shadowTextureView);
  let texel_coords = vec2u(fragUV * vec2f(atlas_dimensions));
  let lightDepth = textureLoad(shadowTextureView, texel_coords, 0); 

  let texColor = textureSample(myTexture, mySampler, fragUV) * fragColor;
  let lightColor = saturate(light.ambientColor + max(dot(normalize(normal), light.lightDir), 0.0) * light.dirColor);
  let color = vec4f(texColor.rgb * lightColor * texColor.a, texColor.a);
  return mix(color, light.fogColor * texColor.a, fog(light.fogDensity, Position));
}`

export const wireframeShader = `
struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
  modelMatrix : mat4x4f,
  lightProj : mat4x4f,
}

struct VSOut {
  @builtin(position) Position : vec4f,
}

@binding(0) @group(0) var<uniform> uniforms        : Uniforms;
@group(0) @binding(1) var<storage, read> positions: array<f32>;
@group(0) @binding(2) var<storage, read> indices: array<u32>;

const stride = 14u;

@vertex
fn main_vertex(@builtin(vertex_index) vNdx: u32) -> VSOut {
  let triNdx = vNdx / 6;
  // 0 1 0 1 0 1  0 1 0 1 0 1  vNdx % 2
  // 0 0 1 1 2 2  3 3 4 4 5 5  vNdx / 2
  // 0 1 1 2 2 3  3 4 4 5 5 6  vNdx % 2 + vNdx / 2
  // 0 1 1 2 2 0  0 1 1 2 2 0  (vNdx % 2 + vNdx / 2) % 3
  let vertNdx = (vNdx % 2 + vNdx / 2) % 3;
  let index = indices[triNdx * 3 + vertNdx];

  // note:
  //
  // * if your indices are U16 you could use this
  //
  //  let indexNdx = triNdx * 3 + vertNdx;
  //  let twoIndices = indices[indexNdx / 2];  // indices is u32 but we want u16
  //  let index = (twoIndices >> ((indexNdx & 1) * 16)) & 0xFFFF;
  //
  // * if you're not using indices you could use this
  //
  //  let index = triNdx * 3 + vertNdx;

  let pNdx = index * stride;
  let position = vec4f(positions[pNdx], positions[pNdx + 1], positions[pNdx + 2], 1);

  var vOut: VSOut;
  vOut.Position = uniforms.modelViewProjectionMatrix * position;
  return vOut;
}

struct FragmentOutput {
	@location(0) color : vec4<f32>,
};

const ccolor = vec4f(1.0, 0.0, 1.0, 1.0);

@fragment
fn main_fragment() -> FragmentOutput {

	var output : FragmentOutput;
	output.color = ccolor;

	return output;
}`

export const shadowShader = `
struct VertexInput {
  @location(0) pos: vec3f,
  @location(1) color: vec3f,
  @location(2) uv: vec2f,
  @location(3) normal: vec3f,
};
  
// struct InstanceInput {
//   @location(3) model_matrix_0: vec4<f32>,
//   @location(4) model_matrix_1: vec4<f32>,
//   @location(5) model_matrix_2: vec4<f32>,
//   @location(6) model_matrix_3: vec4<f32>,
// }

struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
  modelMatrix : mat4x4f,
  lightProj : mat4x4f,
}

// struct Uniforms {
//   modelViewProjectionMatrix : mat4x4f,
//   modelMatrix : mat4x4f
// }
// @group(1) @binding(2) var<uniform> uniforms : Uniforms;

struct VertexOutput {
  @builtin(position) clip_pos: vec4f,
  @location(0) uv: vec2f,
};

// struct Uniforms {
//   viewProj: mat4x4f,
// };

@group(0) @binding(0) var textureView: texture_2d<f32>;
@group(0) @binding(1) var textureSampler: sampler;
@group(1) @binding(2) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(in: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // let model = mat4x4f(
  //   instance.model_matrix_0,
  //   instance.model_matrix_1,
  //   instance.model_matrix_2,
  //   instance.model_matrix_3,
  // );
  output.clip_pos = uniforms.lightProj * uniforms.modelMatrix * vec4f(in.pos.xyz, 1);
  // output.clip_pos = uniforms.modelMatrix * vec4f(in.pos.xyz, 1);
  output.uv = in.uv;
  return output;
}

@fragment
fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(textureView, textureSampler, in.uv);
  if (color.a == 0) {
    discard;
  }
  return vec4(1);
}
`