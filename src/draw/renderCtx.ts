import type Two from 'two.js'
import type { Group } from 'two.js/src/group'

export type Layers = {
  map: Group
  agents: Group
  goals: Group
  paths: Group
  vectors: Group
}

export type RenderCtx = {
  two: Two
  layers: Layers
}
