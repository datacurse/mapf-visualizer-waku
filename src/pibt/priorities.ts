// priorities.ts
import { Robot, Mode } from "./robot";

export function priority(robot: Robot) {
  const tier =
    robot.mode === Mode.Carrying ? 3 :
      robot.mode === Mode.ToPickup ? 2 :
        robot.mode === Mode.Free ? 1 : 0;
  return { tier, tie: robot.id };
}

export function comparePriority(a: Robot, b: Robot) {
  const pa = priority(a);
  const pb = priority(b);
  if (pa.tier !== pb.tier) return pb.tier - pa.tier;
  return pa.tie - pb.tie;
}
