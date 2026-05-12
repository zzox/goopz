
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

export const wireframeShader = `
// struct Uniforms {
// 	world           : mat4x4<f32>,
// 	view            : mat4x4<f32>,
// 	proj            : mat4x4<f32>,
// 	screen_width    : f32,
// 	screen_height   : f32,
// };

struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
  modelMatrix : mat4x4f
}

struct VertexOutput {
  @builtin(position) Position : vec4f,
  // @location(0) fragUV : vec2f,
  // @location(1) fragColor : vec4f,
  // @location(2) normal : vec3f
}

struct U32s {
	values : array<u32>,
};

struct F32s {
	values : array<f32>,
};

struct VertexInput {
	@builtin(instance_index) instanceID : u32,
	@builtin(vertex_index) vertexID : u32,
};

// struct VertexOutput {
// 	@builtin(position) position : vec4<f32>,
// 	@location(0) color : vec4<f32>,
// };

// @binding(0) @group(0) var<uniform> uniforms        : Uniforms;
@binding(0) @group(0) var<uniform> uniforms        : Uniforms;
@binding(1) @group(0) var<storage, read> positions : F32s;
@binding(2) @group(0) var<storage, read> indices   : U32s;
// @binding(3) @group(0) var<storage, read> indices   : U32s;

@vertex
fn main_vertex(vertex : VertexInput) -> VertexOutput {
	var localToElement = array<u32, 6>(0u, 1u, 1u, 2u, 2u, 0u);

	var triangleIndex = vertex.vertexID / 6u;
	var localVertexIndex = vertex.vertexID % 6u;

	var elementIndexIndex = 3u * triangleIndex + localToElement[localVertexIndex];
	var elementIndex = indices.values[elementIndexIndex];

	var position = vec4<f32>(
		positions.values[3u * elementIndex + 0u],
		positions.values[3u * elementIndex + 1u],
		positions.values[3u * elementIndex + 2u],
		1.0
	);

	// position = uniforms.proj * uniforms.view * uniforms.world * position;

	// var color_u32 = colors.values[elementIndex];
	// var color = vec4<f32>(
	// 	f32((color_u32 >>  0u) & 0xFFu) / 255.0,
	// 	f32((color_u32 >>  8u) & 0xFFu) / 255.0,
	// 	f32((color_u32 >> 16u) & 0xFFu) / 255.0,
	// 	f32((color_u32 >> 24u) & 0xFFu) / 255.0,
	// );

	var output : VertexOutput;
	// output.position = position;
  output.Position = uniforms.modelViewProjectionMatrix * position;
	// output.color = color;

	return output;
}

// struct FragmentInput {
// 	@location(0) color : vec4<f32>,
// };

struct FragmentOutput {
	@location(0) color : vec4<f32>,
};

const ccolor = vec4f(1.0, 0.0, 1.0, 1.0);

@fragment
fn main_fragment() -> FragmentOutput {

	var output : FragmentOutput;
	output.color = ccolor;

	return output;
}
`