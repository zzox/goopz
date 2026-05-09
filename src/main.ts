/// <reference types="@webgpu/types" />

import { Game, TestGame } from './game'
import { $id } from './js/ui'
// import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const canvas:HTMLCanvasElement = $id('main-canvas') as HTMLCanvasElement
const fixed:HTMLDivElement = $id('canvas-debug') as HTMLDivElement

const game = new TestGame(
  canvas,
  fixed
)

// listeners, TODO: start with intialization
$id('light-x').onchange = (event) => {
  console.log(event)
}

$id('light-y').onchange = () => {}

$id('light-z').onchange = () => {}
