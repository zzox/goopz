import { Mesh, MeshProps } from '../core/mesh'
import { Camera } from '../core/camera'
import { Game } from '../game'

export class Scene {
  game!:Game
  paused:boolean = false
  cam!:Camera

  create () {
    this.cam = new Camera()
  }

  // init () {
  //   throw 'Scene::init not implemented'
  // }

  update () {
    throw 'Scene::update not implemented'
  }

  draw () {
    throw 'Scene::draw not implemented'
  }

  makeMesh (meshProps:MeshProps):Mesh {
    return new Mesh(meshProps, this.game.device, this.game.pipeline, this.game.wireframePipeline)
  }
}
