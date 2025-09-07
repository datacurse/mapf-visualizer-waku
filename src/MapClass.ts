import Two from 'two.js'
import { Group } from 'two.js/src/group'
import { getDefaultStore } from 'jotai'
import { Layers, RenderCtx } from './draw/renderCtx'
import { ZoomPan } from './ZoomPan'
import { drawMap } from './draw/drawMap'
import { Map_ } from './Components/Map'

import { Line } from 'two.js/src/shapes/line'
import { Text } from 'two.js/src/text'
import { Anchor } from 'two.js/src/anchor'
import { Orientation, orientationToRotation, Pose, Solution } from './Components/Solution'
import { Path } from 'two.js/src/path'

const CELL_SIZE = 100
const CELL_STROKE_WIDTH = 10
const CELL_STROKE_COLOR = '#000000'
const TEXT_SIZE = CELL_SIZE / 4
const GRID_COLOR = '#000000'
const BACKGROUND_COLOR = '#FFFFFF'
const TEXT_COLOR = '#000000'
export const AGENT_COLORS: string[] = [
  '#E91E63',
  '#2196F3',
  '#4CAF50',
  '#FF9800',
  '#00BCD4',
  '#9C27B0',
  '#795548',
  '#FFBB3B',
  '#F44336',
  '#607D8B',
  '#009688',
  '#3F51B5'
];
const FONT_SUPER_RESOLUTION_SCALE = 3

export class MapClass {
  private two: Two | null = null
  private root: Group | null = null
  private host: HTMLElement | null = null
  private layers: Layers | null = null
  private ctx: RenderCtx | null = null
  private store = getDefaultStore()
  private zoomer: ZoomPan | null = null
  private solution: Solution | null = null
  private cellGroups: Group[] = []
  private agentsGroup: Group | null = null
  private pathsFull: Group | null = null
  private pathsPartial: Group | null = null
  private goalMarkers: Group | null = null
  private goalVectorsGroup: Group | null = null
  private goalVectorLines: Line[] = []
  private timestep: number = 0.0
  private playAnimation: boolean = true
  private stepSize: number = 1.0
  private loopAnimation: boolean = true
  private timestepText: Text | null = null
  private orientationAware: boolean = false

  private visibilityHandler = () => { if (!this.two) return; if (document.hidden) this.two.pause(); else this.two.play() }

  mount(host: HTMLElement) {
    if (this.two) this.destroy()
    this.two = new Two({ type: Two.Types.svg, fitted: true, autostart: true }).appendTo(host)
    const root = new Group()
    const layers: Layers = { map: new Group(), agents: new Group(), goals: new Group(), paths: new Group(), goal_vectors: new Group() }
    root.add(layers.map, layers.agents, layers.goals, layers.paths, layers.goal_vectors)
    this.two.add(root)
    this.root = root
    this.layers = layers
    this.ctx = { two: this.two, layers }
    this.host = host
    this.zoomer = new ZoomPan(root, host, { minScale: 0.05, maxScale: 20, wheelSpeed: 1 / 1000, panButton: ['left', 'middle'] })

    this.timestepText = this.two.makeText('0.0 / 0.0', 10, 10)
    this.timestepText.size = 24
    this.timestepText.fill = TEXT_COLOR
    root.add(this.timestepText)

    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  async draw(map: Map_, solution: Solution) {
    this.solution = solution
    if (!this.two || !this.layers || !this.ctx) return
    drawMap(this.ctx, map)
    this.animateSolution()
    this.two.update()
  }

  private animateSolution() {
    if (!this.two || !this.layers || !this.solution) return

    this.clearGroup(this.layers.agents)
    this.clearGroup(this.layers.paths)
    this.clearGroup(this.layers.goals)
    this.clearGroup(this.layers.goal_vectors)
    this.two.unbind('update')
    this.goalVectorLines = []
    this.timestep = 0.0

    const solution = this.solution
    this.orientationAware = solution[0][0].orientation !== Orientation.NONE

    // Goal Markers
    this.goalMarkers = new Group()
    this.layers.goals.add(this.goalMarkers)
    solution[solution.length - 1].forEach((pose: Pose, agentId: number) => {
      const width = CELL_SIZE / 4
      const marker = this.two!.makeRectangle(
        this.scalePosition(pose.position.x) - width / 2,
        this.scalePosition(pose.position.y) - width / 2,
        width, width
      )
      marker.fill = AGENT_COLORS[agentId % AGENT_COLORS.length]
      marker.noStroke()
      this.goalMarkers!.add(marker)
    })
    this.goalMarkers.visible = true

    this.pathsFull = new Group()
    this.pathsPartial = new Group()
    this.layers.paths.add(this.pathsFull, this.pathsPartial)
    solution[0].forEach(() => {
      this.pathsFull!.add(new Group())
      this.pathsPartial!.add(new Group())
    })
    this.pathsFull.visible = true
    this.pathsPartial.visible = true

    this.goalVectorsGroup = new Group()
    this.layers.goal_vectors.add(this.goalVectorsGroup)
    solution[solution.length - 1].forEach(() => {
      const line = this.two!.makeLine(0, 0, 0, 0) as Line
      line.stroke = 'black'
      line.linewidth = Math.max(1, CELL_SIZE / 25)
      line.cap = 'round'
      this.goalVectorsGroup!.add(line)
      this.goalVectorLines.push(line)
    })
    this.goalVectorsGroup.visible = true

    this.agentsGroup = new Group()
    this.layers.agents.add(this.agentsGroup)
    solution[0].forEach((_pose: Pose, agentId: number) => {
      const agentGroup = new Group()
      const circleGroup = new Group()
      const radius = CELL_SIZE / 3
      const circle = this.two!.makeCircle(0, 0, radius)
      const agentColor = AGENT_COLORS[agentId % AGENT_COLORS.length]
      circle.fill = agentColor
      circle.noStroke()
      circleGroup.add(circle)
      if (this.orientationAware) {
        const trianglePoints = [
          new Anchor(0, radius),
          new Anchor(0, -radius),
          new Anchor(radius, 0)
        ]
        const triangle = new Path(trianglePoints, true)
        triangle.fill = BACKGROUND_COLOR
        triangle.noStroke()
        circleGroup.add(triangle)
      }
      agentGroup.add(circleGroup)
      const idText = this.two!.makeText(`${agentId} `, 0, 0)
      idText.size = (CELL_SIZE / 3) * FONT_SUPER_RESOLUTION_SCALE
      idText.scale = 1 / FONT_SUPER_RESOLUTION_SCALE
      idText.fill = TEXT_COLOR
      idText.translation.x = -idText.getBoundingClientRect().width / 2
      idText.translation.y = -idText.getBoundingClientRect().height / 2
      idText.visible = true
      agentGroup.add(idText)
      this.agentsGroup!.add(agentGroup)
    })

    this.two.bind('update', (_frameCount, _timeDelta) => {
      if (this.timestepText) {
        this.timestepText.value = `${this.timestep.toFixed(1)} / ${(solution.length - 1).toFixed(1)}`
      }

      if (this.playAnimation) {
        if (this.timestep < solution.length - 1) {
          this.timestep += this.stepSize / 60
        } else if (this.loopAnimation) {
          this.timestep = 0.0
        }
      }

      this.moveAndRotateAgents(this.timestep)
      this.updatePaths(this.timestep)
      this.updateGoalVectors()
    })
  }

  private scalePosition(position: number): number {
    return position * CELL_SIZE + CELL_SIZE / 2
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t
  }

  private moveAndRotateAgents(currentTime: number) {
    if (!this.solution || !this.agentsGroup) return

    const solution = this.solution
    const currentTimestep = Math.floor(currentTime)
    const progress = currentTime - currentTimestep
    const currentState = solution[currentTimestep]
    const nextState = solution[Math.min(currentTimestep + 1, solution.length - 1)]

    this.agentsGroup.children.forEach((agentGroup: Group, index: number) => {
      const startPose = currentState[index]
      const endPose = nextState[index]

      const x = this.lerp(startPose.position.x, endPose.position.x, progress)
      const y = this.lerp(startPose.position.y, endPose.position.y, progress)
      agentGroup.translation.set(this.scalePosition(x), this.scalePosition(y))

      if (this.orientationAware) {
        const circleGroup = agentGroup.children[0] as Group
        const startRot = orientationToRotation(startPose.orientation)
        const endRot = orientationToRotation(endPose.orientation)
        circleGroup.rotation = this.lerp(startRot, endRot, progress)
      }
    })
  }

  private updatePaths(currentTime: number) {
    if (!this.solution || !this.pathsFull || !this.pathsPartial || !this.agentsGroup) return

    const solution = this.solution
    const currentTimestep = Math.floor(currentTime)
    const progress = currentTime - currentTimestep

    this.agentsGroup.children.forEach((_agent, index: number) => {
      const agentColor = AGENT_COLORS[index % AGENT_COLORS.length]
      const lineStyle = { stroke: agentColor, linewidth: CELL_SIZE / 10, cap: 'round' }

      const fullSub = this.pathsFull!.children[index] as Group
      const partialSub = this.pathsPartial!.children[index] as Group

      while (fullSub.children.length > currentTimestep) {
        const child = fullSub.children.pop()
        if (child) {
          fullSub.remove(child)
          this.two!.release(child)
        }
      }

      while (fullSub.children.length < currentTimestep) {
        const segIndex = fullSub.children.length
        const line = this.two!.makeLine(
          this.scalePosition(solution[segIndex][index].position.x),
          this.scalePosition(solution[segIndex][index].position.y),
          this.scalePosition(solution[segIndex + 1][index].position.x),
          this.scalePosition(solution[segIndex + 1][index].position.y)
        )
        line.stroke = lineStyle.stroke
        line.linewidth = lineStyle.linewidth
        line.cap = lineStyle.cap
        fullSub.add(line)
      }

      this.clearGroup(partialSub)

      if (progress > 0 && currentTimestep < solution.length - 1) {
        const startX = this.scalePosition(solution[currentTimestep][index].position.x)
        const startY = this.scalePosition(solution[currentTimestep][index].position.y)
        const interpX = this.lerp(
          solution[currentTimestep][index].position.x,
          solution[currentTimestep + 1][index].position.x,
          progress
        )
        const interpY = this.lerp(
          solution[currentTimestep][index].position.y,
          solution[currentTimestep + 1][index].position.y,
          progress
        )
        const line = this.two!.makeLine(startX, startY, this.scalePosition(interpX), this.scalePosition(interpY))
        line.stroke = lineStyle.stroke
        line.linewidth = lineStyle.linewidth
        line.cap = lineStyle.cap
        partialSub.add(line)
      }
    })
  }

  private updateGoalVectors() {
    if (!this.solution || !this.agentsGroup || !this.goalVectorLines.length) return

    const solution = this.solution
    this.agentsGroup.children.forEach((agentGroup: Group, index: number) => {
      const line = this.goalVectorLines[index]
      const goal = solution[solution.length - 1][index]
      const goalX = this.scalePosition(goal.position.x)
      const goalY = this.scalePosition(goal.position.y)
      const agentPos = agentGroup.translation
      line.vertices[0].x = agentPos.x
      line.vertices[0].y = agentPos.y
      line.vertices[1].x = goalX
      line.vertices[1].y = goalY
      line.stroke = AGENT_COLORS[index % AGENT_COLORS.length]
    })
  }

  private clearGroup(group: Group) {
    const toRelease = group.children.slice()
    if (toRelease.length) group.remove(...toRelease)
    if (!this.two) return
    for (const child of toRelease) this.two.release(child)
  }

  destroy() {
    if (!this.two) return
    document.removeEventListener('visibilitychange', this.visibilityHandler)
    if (this.layers) {
      this.clearGroup(this.layers.map)
      this.clearGroup(this.layers.agents)
      this.clearGroup(this.layers.goals)
      this.clearGroup(this.layers.paths)
      this.clearGroup(this.layers.goal_vectors)
    }
    this.zoomer?.destroy()
    this.zoomer = null
    this.two.pause()
    this.two.clear()
    const el = (this.two.renderer as any)?.domElement as HTMLElement | null
    el?.parentElement?.removeChild(el)
    this.root = null
    this.layers = null
    this.ctx = null
    this.two = null
    this.host = null
    this.solution = null
    this.cellGroups = []
    this.agentsGroup = null
    this.pathsFull = null
    this.pathsPartial = null
    this.goalMarkers = null
    this.goalVectorsGroup = null
    this.goalVectorLines = []
    this.timestepText = null
  }
}
