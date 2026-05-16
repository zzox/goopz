const anims = new Map()
anims.set('none', { repeats: false, frames: [0], speed: 1 })
anims.set('moving', { repeats: true, frames: [0, 1, 0, 2], speed: 10 })

export const getAnim = (name:string, frames:number):number => {
  const anim = anims.get(name)!
  if (anim.repeats) {
    return anim.frames[Math.floor(frames / anim.speed) % anim.frames.length]
  } else {
    return anim.frames[Math.min(Math.floor(frames / anim.speed), anim.frames.length - 1)]
  }
}
