from __future__ import annotations
from dataclasses import dataclass
from enum import IntEnum
from typing import Tuple, Optional

class Orientation(IntEnum):
    X_RIGHT = 0
    Y_DOWN = 1
    X_LEFT = 2
    Y_UP = 3

@dataclass(frozen=True)
class GridPose:
    x: int
    y: int
    rotation: Orientation

@dataclass(frozen=True)
class AbsolutePose:
    x: float
    y: float
    rotation_deg: float

# @dataclass(frozen=True)
class RobotConfig:
    cell_size_m: float = 0.5
    speed_mps: float = 10
    rot_speed_dps: float = 360

def norm_deg(d: float) -> float:
    d = d % 360.0
    return d + 360.0 if d < 0 else d

def orientation_to_deg(o: Orientation) -> float:
    mapping = {
        Orientation.Y_UP: 0,
        Orientation.X_RIGHT: 90,
        Orientation.Y_DOWN: 180,
        Orientation.X_LEFT: 270,
    }
    return mapping[o]

def deg_to_orientation(d: float) -> Orientation:
    d = norm_deg(d)
    k = int((d + 45.0) // 90.0) % 4
    return [Orientation.Y_UP, Orientation.X_RIGHT, Orientation.Y_DOWN, Orientation.X_LEFT][k]

def grid_to_absolute(p: GridPose, cell_size_m: float) -> AbsolutePose:
    return AbsolutePose(p.x * cell_size_m, p.y * cell_size_m, orientation_to_deg(p.rotation))

@dataclass
class Position:
    grid: GridPose
    absolute: AbsolutePose

    @classmethod
    def from_grid(cls, g: GridPose, cell_size_m: float) -> Position:
        return cls(g, grid_to_absolute(g, cell_size_m))

    def set_grid(self, g: GridPose) -> None:
        self.grid = g

    def set_absolute(self, a: AbsolutePose) -> None:
        self.absolute = AbsolutePose(a.x, a.y, a.rotation_deg)

class RobotState(IntEnum):
    IDLE = 0
    ROTATING = 1
    MOVING = 2

class Robot:
    config = RobotConfig()

    def __init__(self, position: Optional[Position] = None) -> None:
        if position is None:
            g = GridPose(1, 1, Orientation.X_RIGHT)
            position = Position.from_grid(g, self.config.cell_size_m)
        self.position = position
        self.state = RobotState.IDLE
        self.linear_speed = 0.0
        self.rot_speed = 0.0
        self._target_grid: Optional[Tuple[int, int]] = None
        self._target_abs: Optional[Tuple[float, float]] = None
        self._target_heading: Optional[float] = None
        self._rot_dir = 0

    def heading_deg(self) -> float:
        return self.position.absolute.rotation_deg

    def set_heading_deg(self, d: float) -> None:
        self.position.set_absolute(AbsolutePose(self.position.absolute.x, self.position.absolute.y, norm_deg(d)))

    def _cw_diff(self, a: float, b: float) -> float:
        return norm_deg(b - a)

    def _start_rotation_to(self, target_deg: float) -> None:
        cur = self.heading_deg()
        cw = self._cw_diff(cur, target_deg)
        self._rot_dir = 1 if cw <= 180.0 else -1
        self._target_heading = norm_deg(target_deg)
        self.rot_speed = self.config.rot_speed_dps
        self.state = RobotState.ROTATING

    def _start_translation_to(self, gx: int, gy: int) -> None:
        self._target_grid = (gx, gy)
        tx = gx * self.config.cell_size_m
        ty = gy * self.config.cell_size_m
        self._target_abs = (tx, ty)
        self.linear_speed = self.config.speed_mps
        self.state = RobotState.MOVING

    def move(self, orientation: Orientation, distance: int) -> None:
        if not self.idle():
            return
        gx, gy = self.position.grid.x, self.position.grid.y
        deltas = {
            Orientation.X_RIGHT: (distance, 0),
            Orientation.X_LEFT: (-distance, 0),
            Orientation.Y_DOWN: (0, distance),
            Orientation.Y_UP: (0, -distance),
        }
        dx, dy = deltas[orientation]
        targetX, targetY = gx + dx, gy + dy
        self._target_grid = (targetX, targetY)
        self._target_abs = None
        self._start_rotation_to(orientation_to_deg(orientation))

    def update(self, dt: float) -> None:
        if self.state is RobotState.ROTATING and self._target_heading is not None:
            step = self.rot_speed * dt * self._rot_dir
            cur = self.heading_deg()
            if self._rot_dir == 1:
                remain = self._cw_diff(cur, self._target_heading)
                if step >= remain:
                    self.set_heading_deg(self._target_heading)
                    if self._target_grid is not None and self._target_abs is None:
                        gx, gy = self._target_grid
                        self._start_translation_to(gx, gy)
                else:
                    self.set_heading_deg(cur + step)
            else:
                remain = 360.0 - self._cw_diff(cur, self._target_heading)
                if -step >= remain:
                    self.set_heading_deg(self._target_heading)
                    if self._target_grid is not None and self._target_abs is None:
                        gx, gy = self._target_grid
                        self._start_translation_to(gx, gy)
                else:
                    self.set_heading_deg(cur + step)

        elif self.state is RobotState.MOVING and self._target_abs is not None:
            tx, ty = self._target_abs
            x,  y  = self.position.absolute.x, self.position.absolute.y
            step   = self.linear_speed * dt

            dx = tx - x
            dy = ty - y

            # We only ever move along one axis for a grid leg; pick the non-zero one.
            if abs(dx) > 1e-12:
                move = max(-abs(dx), min(abs(dx), step))  # clamp to remaining distance
                nx = x + (move if dx >= 0 else -move)
                ny = y
            else:
                move = max(-abs(dy), min(abs(dy), step))
                nx = x
                ny = y + (move if dy >= 0 else -move)

            # keep the current heading for drawing
            self.position.set_absolute(AbsolutePose(nx, ny, self.heading_deg()))

            # snap exactly on arrival (prevents sub-pixel linger)
            if abs(nx - tx) < 1e-9 and abs(ny - ty) < 1e-9:
                self.position.set_absolute(AbsolutePose(tx, ty, self.heading_deg()))
                self.position.set_grid(
                    GridPose(self._target_grid[0], self._target_grid[1], deg_to_orientation(self.heading_deg()))
                )
                self.linear_speed = 0.0
                self._target_abs = None
                self._target_grid = None
                self._target_heading = None
                self.state = RobotState.IDLE


    def idle(self) -> bool:
        return self.state is RobotState.IDLE
