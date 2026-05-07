export class Debug {
  static on:boolean = false
  static renderFrames:number[] = [] // how many frames happened in the last second
  static renderTimes:number[] // list of all times it took to render (in seconds) (stays the same length)

  static updateFrames:number[] = [] // how many update calls happened in the last second
  static updateTimes:number[] // list of all times it took to update (in seconds) (stays the same length)
}
