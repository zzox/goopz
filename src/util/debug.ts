export class Debug {
  static on:boolean = false
  static drawFrames:number[] = [] // how many frames happened in the last second
  static drawTimes:number[] // list of all times it took to draw (in seconds) (stays the same length)

  static updateFrames:number[] = [] // how many update calls happened in the last second
  static updateTimes:number[] // list of all times it took to update (in seconds) (stays the same length)
}
