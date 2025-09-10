from __future__ import annotations
from dataclasses import dataclass
from enum import IntEnum
from typing import Tuple, Optional
import math
import time
import tkinter as tk

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

@dataclass(frozen=True)
class RobotConfig:
    cell_size_m: float = 0.5
    speed_mps: float = 0.4
    rot_speed_dps: float = 180.0

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
            x, y = self.position.absolute.x, self.position.absolute.y
            d = self.linear_speed * dt
            hx = deg_to_orientation(self.heading_deg())
            if hx is Orientation.X_RIGHT:
                nx = min(x + d, tx); ny = y
            elif hx is Orientation.X_LEFT:
                nx = max(x - d, tx); ny = y
            elif hx is Orientation.Y_DOWN:
                nx = x; ny = min(y + d, ty)
            else:
                nx = x; ny = max(y - d, ty)
            self.position.set_absolute(AbsolutePose(nx, ny, self.heading_deg()))
            if abs(nx - tx) < 1e-9 and abs(ny - ty) < 1e-9:
                self.position.set_grid(GridPose(self._target_grid[0], self._target_grid[1], deg_to_orientation(self.heading_deg())))
                self.linear_speed = 0.0
                self._target_abs = None
                self._target_grid = None
                self._target_heading = None
                self.state = RobotState.IDLE

    def idle(self) -> bool:
        return self.state is RobotState.IDLE

class App:
    def __init__(self, size: int = 3, cell_px: int = 120) -> None:
        self.size = size
        self.cell_px = cell_px
        Robot.config = RobotConfig(cell_size_m=0.5, speed_mps=0.4, rot_speed_dps=180.0)
        self.robot = Robot()
        self.root = tk.Tk()
        self.root.title("Robot Grid")
        w = size * cell_px
        h = size * cell_px
        self.canvas = tk.Canvas(self.root, width=w, height=h, bg="#ffffff", highlightthickness=0)
        self.canvas.pack()
        for i in range(size + 1):
            x = i * cell_px
            self.canvas.create_line(x, 0, x, h)
            y = i * cell_px
            self.canvas.create_line(0, y, w, y)
        r = int(cell_px * 0.28)
        cx, cy = self._center_px()
        self.body = self.canvas.create_oval(cx - r, cy - r, cx + r, cy + r, fill="#2b82ff", outline="")
        self.head = self.canvas.create_polygon(self._triangle_points(cx, cy, r), fill="#ffffff", outline="")
        self.last = time.perf_counter()
        self.lag = 0.0
        self.step = 1.0 / 60.0
        self.root.bind("<Up>", lambda e: self.robot.move(Orientation.Y_UP, 1))
        self.root.bind("<Down>", lambda e: self.robot.move(Orientation.Y_DOWN, 1))
        self.root.bind("<Left>", lambda e: self.robot.move(Orientation.X_LEFT, 1))
        self.root.bind("<Right>", lambda e: self.robot.move(Orientation.X_RIGHT, 1))
        self.root.bind("w", lambda e: self.robot.move(Orientation.Y_UP, 1))
        self.root.bind("s", lambda e: self.robot.move(Orientation.Y_DOWN, 1))
        self.root.bind("a", lambda e: self.robot.move(Orientation.X_LEFT, 1))
        self.root.bind("d", lambda e: self.robot.move(Orientation.X_RIGHT, 1))
        self.tick()

    def _cells_from_m(self, v: float) -> float:
        return v / self.robot.config.cell_size_m

    def _center_px(self) -> Tuple[float, float]:
        x_cells = self._cells_from_m(self.robot.position.absolute.x)
        y_cells = self._cells_from_m(self.robot.position.absolute.y)
        px = x_cells * self.cell_px + 0.5 * self.cell_px
        py = y_cells * self.cell_px + 0.5 * self.cell_px
        return px, py

    def _triangle_points(self, cx: float, cy: float, r: float):
        a = math.radians(self.robot.position.absolute.rotation_deg - 90)
        tip = (cx + r * math.cos(a), cy + r * math.sin(a))
        b = a + math.radians(140)
        c = a - math.radians(140)
        base1 = (cx + r * 0.6 * math.cos(b), cy + r * 0.6 * math.sin(b))
        base2 = (cx + r * 0.6 * math.cos(c), cy + r * 0.6 * math.sin(c))
        return (*tip, *base1, *base2)

    def tick(self) -> None:
        now = time.perf_counter()
        dt = now - self.last
        self.last = now
        self.lag += dt
        while self.lag >= self.step:
            self.robot.update(self.step)
            self.lag -= self.step
        cx, cy = self._center_px()
        r = int(self.cell_px * 0.28)
        self.canvas.coords(self.body, cx - r, cy - r, cx + r, cy + r)
        self.canvas.coords(self.head, self._triangle_points(cx, cy, r))
        self.root.after(8, self.tick)

    def run(self) -> None:
        self.root.mainloop()

if __name__ == "__main__":
    App(size=3, cell_px=120).run()
