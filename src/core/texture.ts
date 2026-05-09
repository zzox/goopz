
export const makeTexture = (device:GPUDevice, size:number = 64):GPUTexture => {
  const tex = device.createTexture({
    size: [size, size, 1],
    format: 'rgba8unorm',
    usage: 
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  })

  device.queue.writeTexture(
    { texture: tex },
    checkerboard() as GPUAllowSharedBufferSource,
    { bytesPerRow: size * 4 },
    [size, size]
  )

  return tex
}

export const checkerboard = (size = 64, gridSize = 8):Uint8ClampedArray =>  {
    const data = new Uint8ClampedArray(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const on = ((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2) === 0
        const i = (y * size + x) * 4
        const c = on ? 220 : 60
        data[i] = c
        data[i + 1] = c
        data[i + 2] = c
        data[i + 3] = 255
      }
    }
    return data;
}
