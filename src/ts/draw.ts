import Two from "two.js"

export function drawIntersection(two: Two, x: number, y: number, size: number) {
  const intersection = two.makeRectangle(x, y, size, size)
  intersection.noFill()
  intersection.stroke = "purple"
  intersection.linewidth = 4
  intersection.dashes = [10, 10]
  return intersection
}

export function drawRobot(two: Two, x: number, y: number, size: number, color: string, labelText: string | number) {
  const group = two.makeGroup()
  const rect = two.makeRectangle(0, 0, size, size).noStroke()
  rect.fill = color
  const label = two.makeText(String(labelText), 0, 0)
  label.alignment = "center"
  label.size = 28
  label.fill = "white"
  group.add(rect, label)
  group.translation.set(x, y)
  return group
}
