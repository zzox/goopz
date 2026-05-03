/// <reference types="@webgpu/types" />

import { Mat4, mat4, vec3 } from 'wgpu-matrix';
import { vert } from './shaders/basic.vert.wgsl'
import { frag } from './shaders/vertexPositionColor.frag.wgsl'
import { makeTexture } from './objects/texture';
import { meshFromObj, sampleObj, obj2, Mesh, planeMesh } from './objects/mesh';
import { Game, TestGame } from './game';
// import { quitIfWebGPUNotAvailableOrMissingFeatures } from '../util';

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement
const fixed = document.getElementsByClassName('fixed')[0] as HTMLDivElement

new TestGame(
  canvas,
  fixed
)
