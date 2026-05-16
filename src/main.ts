/// <reference types="@webgpu/types" />

import { Game, TestScene } from './game'
import { $id, setAndUpdateNum } from './js/ui'
// import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const canvas:HTMLCanvasElement = $id('main-canvas') as HTMLCanvasElement
const fixed:HTMLDivElement = $id('canvas-debug') as HTMLDivElement

const game = new Game(canvas, TestScene, fixed)

setAndUpdateNum('light-x', game.lightDir[0], (val) => game.lightDir[0] = val)
setAndUpdateNum('light-y', game.lightDir[1], (val) => game.lightDir[1] = val)
setAndUpdateNum('light-z', game.lightDir[2], (val) => game.lightDir[2] = val)
