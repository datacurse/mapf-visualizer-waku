# game.py

import asyncio
import time
import math
from robot import Robot
from map import Map

SPEED = 100.0
FPS = 60
FIXED_DT = 1 / FPS
NETWORK_HZ = FPS
GRID_SIZE = 50.0

class Game:
    def __init__(self):
        self.robots: dict[str, Robot] = {}
        self.mode = "free"
        self._prev_time = time.perf_counter()
        self._accum = 0.0
        self._snapshot = 0
        self._dirty = True
        self.sio = None
        self._timer_tick = 0
        self.map: Map | None = None

    def load_map(self, filename: str):
        self.map = Map(f"../public/maps/{filename}")
        self._dirty = True

    def set_server(self, sio):
        self.sio = sio

    def set_mode(self, mode: str):
        if mode in ("free", "grid"):
            self.mode = mode
            self._dirty = True

    def add_robot(self, robot_id: str, x: float = 0.0, y: float = 0.0):
        if robot_id not in self.robots:
            self.robots[robot_id] = Robot(robot_id, x, y)

    def move_robot(self, robot_id: str, x: float, y: float):
        if self.map:
            x = max(0, min(x, self.map.width * GRID_SIZE))
            y = max(0, min(y, self.map.height * GRID_SIZE))

        robot = self.robots.get(robot_id)
        if not robot or not self.map:
            return

        if self.mode == "grid":
            gx = math.floor(x / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2
            gy = math.floor(y / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2
        else:
            gx, gy = x, y

        if robot.pathways:
            start_x, start_y = robot.pathways[-1]
        else:
            start_x, start_y = robot.x, robot.y

        path = self.map.find_path(start_x, start_y, gx, gy)
        if path:
            robot.queue_path(path)
            robot.set_target(gx, gy)
            self._dirty = True



    def _step(self):
        now = time.perf_counter()
        self._accum += now - self._prev_time
        self._prev_time = now

        while self._accum >= FIXED_DT:
            for r in self.robots.values():
                if r.update(FIXED_DT, SPEED, self.mode, self.map):
                    self._dirty = True
            self._accum -= FIXED_DT
            self._snapshot += 1
            self._timer_tick += 1

            if self.sio and self._snapshot >= (60 // NETWORK_HZ) and self._dirty:
                self.sio.start_background_task(
                    self.sio.emit, "game_state", self.get_state()
                )
                self._snapshot = 0
                self._dirty = False

            if self.sio and self._timer_tick >= FPS:
                self.sio.start_background_task(
                    self.sio.emit, "timer_tick", {"t": time.perf_counter()}
                )
                self._timer_tick = 0

    def get_state(self):
        return {
            "mode": self.mode,
            "robots": [r.to_dict() for r in self.robots.values()],
        }

    async def start_loop(self):
        while True:
            self._step()
            await asyncio.sleep(0)

game = Game()
# Spawn in centers of grid cells (0,0) and (1,0)
game.add_robot("1", GRID_SIZE / 2, GRID_SIZE / 2)
game.add_robot("2", GRID_SIZE * 1.5, GRID_SIZE / 2)
