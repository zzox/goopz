/// <reference types="@webgpu/types" />

import { Game, TestScene } from './game'
import { $id } from './js/ui'
// import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const canvas:HTMLCanvasElement = $id('main-canvas') as HTMLCanvasElement
const fixed:HTMLDivElement = $id('canvas-debug') as HTMLDivElement

const game = new Game(canvas, TestScene, fixed)

// listeners, TODO: start with intialization
$id('light-x').onchange = (event) => {
  console.log(event.target!.value)
}

$id('light-y').onchange = () => {}

$id('light-z').onchange = () => {}
