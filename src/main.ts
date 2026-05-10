/// <reference types="@webgpu/types" />

import { Game, TestScene } from './game'
import { $id } from './js/ui'
// import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const canvas:HTMLCanvasElement = $id('main-canvas') as HTMLCanvasElement
const fixed:HTMLDivElement = $id('canvas-debug') as HTMLDivElement

const game = new Game(canvas, TestScene, fixed)

// listeners, TODO: start with intialization
$id('light-x').onchange = (event) => {
  const val = event.target!.value
  game.lightDir[0] = val
}

$id('light-y').onchange = (event) => {
  const val = event.target!.value
  game.lightDir[1] = val
}

$id('light-z').onchange = (event) => {
  const val = event.target!.value
  game.lightDir[2] = val
}
