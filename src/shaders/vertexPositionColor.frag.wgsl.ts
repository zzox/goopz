
export const frag = `
@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;

@fragment
fn main(
  @location(0) fragUV: vec2f,
  @location(1) fragColor: vec4f
) -> @location(0) vec4f {
  return textureSample(myTexture, mySampler, fragUV) * fragColor;
}
`