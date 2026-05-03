/// <reference types="@webgpu/types" />

import { Game, TestGame } from './game';
// import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement
const fixed = document.getElementsByClassName('fixed')[0] as HTMLDivElement

new TestGame(
  canvas,
  fixed
)
