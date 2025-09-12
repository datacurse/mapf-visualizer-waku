from __future__ import annotations
from dataclasses import dataclass
from enum import IntEnum
from typing import Tuple, Optional, Callable
from collections import deque
import heapq
import math

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

class RobotConfig:
    cell_size_m: float = 0.5
    lin_acc_mps2: float = 1
    lin_dec_mps2: float = 1.5
    lin_max_mps: float = 2.5
    rot_acc_dps2: float = math.degrees(3.0)
    rot_dec_dps2: float = math.degrees(3.0)
    rot_max_dps: float = math.degrees(3.0)

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

def is_clear_line(x1: int, y1: int, x2: int, y2: int, blocked: Callable[[int, int], bool]) -> bool:
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return True
    stepx = 0 if dx == 0 else (1 if dx > 0 else -1)
    stepy = 0 if dy == 0 else (1 if dy > 0 else -1)
    steps = max(abs(dx), abs(dy))
    for i in range(1, steps + 1):
        nx = x1 + i * stepx
        ny = y1 + i * stepy
        if blocked(nx, ny):
            return False
    return True

def plan_l_path(sx: int, sy: int, gx: int, gy: int, blocked: Callable[[int, int], bool]) -> Optional[deque[Tuple[int, int]]]:
    if sx == gx or sy == gy:
        if is_clear_line(sx, sy, gx, gy, blocked):
            return deque([(gx, gy)])
    a = (gx, sy)
    if is_clear_line(sx, sy, *a, blocked) and is_clear_line(*a, gx, gy, blocked):
        return deque([a, (gx, gy)])
    b = (sx, gy)
    if is_clear_line(sx, sy, *b, blocked) and is_clear_line(*b, gx, gy, blocked):
        return deque([b, (gx, gy)])
    return None

def compress_straight_segments(cells: list[Tuple[int, int]]) -> deque[Tuple[int, int]]:
    out: deque[Tuple[int, int]] = deque()
    if len(cells) <= 1:
        return out
    prev_dx = cells[1][0] - cells[0][0]
    prev_dy = cells[1][1] - cells[0][1]
    for j in range(1, len(cells) - 1):
        ndx = cells[j + 1][0] - cells[j][0]
        ndy = cells[j + 1][1] - cells[j][1]
        if (ndx, ndy) != (prev_dx, prev_dy):
            out.append(cells[j])
            prev_dx, prev_dy = ndx, ndy
    out.append(cells[-1])
    return out

def plan_min_turn_path(
    sx: int,
    sy: int,
    start_dir: int,
    gx: int,
    gy: int,
    grid_w: int,
    grid_h: int,
    blocked: Callable[[int, int], bool],
) -> Optional[deque[Tuple[int, int]]]:
    dirs = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    pq: list[tuple[int, int, int, int, int, int, int]] = []
    dist: dict[tuple[int, int, int], tuple[int, int]] = {}
    parent: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    start_key = (sx, sy, start_dir)
    dist[start_key] = (0, 0)
    heapq.heappush(pq, (0, 0, 0, sx, sy, start_dir, 0))
    end_key: Optional[tuple[int, int, int]] = None
    while pq:
        turns, steps, neg_run, x, y, dcur, run = heapq.heappop(pq)
        if (x, y) == (gx, gy):
            end_key = (x, y, dcur)
            break
        if dist.get((x, y, dcur)) != (turns, steps):
            continue
        for ndir, (ddx, ddy) in enumerate(dirs):
            nx, ny = x + ddx, y + ddy
            if nx < 0 or ny < 0 or nx >= grid_w or ny >= grid_h or blocked(nx, ny):
                continue
            nturns = turns + (0 if ndir == dcur else 1)
            nsteps = steps + 1
            nrun = run + 1 if ndir == dcur else 1
            key = (nx, ny, ndir)
            cur_best = dist.get(key)
            if cur_best is None or (nturns < cur_best[0]) or (nturns == cur_best[0] and nsteps < cur_best[1]):
                dist[key] = (nturns, nsteps)
                parent[key] = (x, y, dcur)
                heapq.heappush(pq, (nturns, nsteps, -nrun, nx, ny, ndir, nrun))
    if end_key is None:
        return None
    path_cells: list[Tuple[int, int]] = []
    cur = end_key
    while cur != start_key:
        path_cells.append((cur[0], cur[1]))
        cur = parent[cur]
    path_cells.reverse()
    cells = [(sx, sy)] + path_cells
    return compress_straight_segments(cells)

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
        self._path: deque[Tuple[int, int]] = deque()

    def move_to(self, gx: int, gy: int, grid_w: int, grid_h: int, blocked: Callable[[int, int], bool]) -> bool:
        # Reject command if busy
        if not self.idle():
            return False
        # Already on this place
        sx, sy = self.position.grid.x, self.position.grid.y
        if (sx, sy) == (gx, gy):
            return True
        # Check L shaped path
        l = plan_l_path(sx, sy, gx, gy, blocked)
        if l is not None:
            self._path = l
            self._advance_path()
            return True
        # No L shaped path
        start_dir = int(deg_to_orientation(self.heading_deg()))
        segs = plan_min_turn_path(sx, sy, start_dir, gx, gy, grid_w, grid_h, blocked)
        if segs is None:
            return False
        self._path = segs
        self._advance_path()
        return True

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
        self.rot_speed = 0.0
        self.state = RobotState.ROTATING

    def _start_translation_to(self, gx: int, gy: int) -> None:
        self._target_grid = (gx, gy)
        tx = gx * self.config.cell_size_m
        ty = gy * self.config.cell_size_m
        self._target_abs = (tx, ty)
        self.linear_speed = 0.0
        self.state = RobotState.MOVING

    def _advance_path(self) -> None:
        if self.state is not RobotState.IDLE or not self._path:
            return
        cx, cy = self.position.grid.x, self.position.grid.y
        nx, ny = self._path.popleft()
        dx, dy = nx - cx, ny - cy
        if dx > 0:
            o = Orientation.X_RIGHT
        elif dx < 0:
            o = Orientation.X_LEFT
        elif dy > 0:
            o = Orientation.Y_DOWN
        else:
            o = Orientation.Y_UP
        self._target_grid = (nx, ny)
        self._target_abs = None
        self._start_rotation_to(orientation_to_deg(o))



    def update(self, dt: float) -> None:
        if self.state is RobotState.ROTATING and self._target_heading is not None:
            cur = self.heading_deg()
            if self._rot_dir == 1:
                remain = self._cw_diff(cur, self._target_heading)
            else:
                remain = 360.0 - self._cw_diff(cur, self._target_heading)
            stop = (self.rot_speed * self.rot_speed) / (2.0 * self.config.rot_dec_dps2) if self.config.rot_dec_dps2 > 0 else 0.0
            if remain > stop:
                self.rot_speed = min(self.config.rot_max_dps, self.rot_speed + self.config.rot_acc_dps2 * dt)
            else:
                self.rot_speed = max(0.0, self.rot_speed - self.config.rot_dec_dps2 * dt)
            step = min(remain, self.rot_speed * dt)
            self.set_heading_deg(cur + (step if self._rot_dir == 1 else -step))
            if step >= remain - 1e-12 or remain <= 1e-9:
                self.set_heading_deg(self._target_heading)
                if self._target_grid is not None and self._target_abs is None:
                    gx, gy = self._target_grid
                    self._start_translation_to(gx, gy)
                else:
                    self.state = RobotState.IDLE
                self.rot_speed = 0.0
        elif self.state is RobotState.MOVING and self._target_abs is not None:
            tx, ty = self._target_abs
            x, y = self.position.absolute.x, self.position.absolute.y
            dx = tx - x
            dy = ty - y
            if abs(dx) > 1e-12:
                remain = abs(dx)
                stop = (self.linear_speed * self.linear_speed) / (2.0 * self.config.lin_dec_mps2) if self.config.lin_dec_mps2 > 0 else 0.0
                if remain > stop:
                    self.linear_speed = min(self.config.lin_max_mps, self.linear_speed + self.config.lin_acc_mps2 * dt)
                else:
                    self.linear_speed = max(0.0, self.linear_speed - self.config.lin_dec_mps2 * dt)
                step = min(remain, self.linear_speed * dt)
                nx = x + (step if dx >= 0 else -step)
                ny = y
            else:
                remain = abs(dy)
                stop = (self.linear_speed * self.linear_speed) / (2.0 * self.config.lin_dec_mps2) if self.config.lin_dec_mps2 > 0 else 0.0
                if remain > stop:
                    self.linear_speed = min(self.config.lin_max_mps, self.linear_speed + self.config.lin_acc_mps2 * dt)
                else:
                    self.linear_speed = max(0.0, self.linear_speed - self.config.lin_dec_mps2 * dt)
                step = min(remain, self.linear_speed * dt)
                nx = x
                ny = y + (step if dy >= 0 else -step)
            self.position.set_absolute(AbsolutePose(nx, ny, self.heading_deg()))
            if abs(nx - tx) < 1e-9 and abs(ny - ty) < 1e-9:
                self.position.set_absolute(AbsolutePose(tx, ty, self.heading_deg()))
                self.position.set_grid(GridPose(self._target_grid[0], self._target_grid[1], deg_to_orientation(self.heading_deg())))
                self.linear_speed = 0.0
                self._target_abs = None
                self._target_grid = None
                self._target_heading = None
                self.state = RobotState.IDLE
                self._advance_path()

    def idle(self) -> bool:
        return self.state is RobotState.IDLE
