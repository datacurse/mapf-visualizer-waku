# server/hivemind.py
from __future__ import annotations
import random
from typing import Callable
from .destination_bin import DestinationBin
from .robot import Robot

class Hivemind:
    def __init__(
        self,
        robots: dict[str, Robot],
        grid,
        blocked_fn: Callable[[int, int], bool],
        base_xy: tuple[int, int],
        bins: list[DestinationBin],
        seed: int = 0,
    ):
        self.robots = robots
        self.grid = grid
        self.blocked = blocked_fn
        self.base = base_xy
        self.bins = bins
        self.rng = random.Random(seed)
        self.assignments: dict[str, dict] = {}

    def _is_at(self, r: Robot, target: tuple[int, int]) -> bool:
        gx, gy = r.position.grid.x, r.position.grid.y
        tx, ty = target
        return gx == tx and gy == ty

    def _cmd_move(self, r: Robot, target: tuple[int, int]) -> None:
        tx, ty = target
        r.move_to(tx, ty, self.grid["width"], self.grid["height"], self.blocked)

    def _assign_to_dest(self, rid: str):
        dest = self.rng.choice(self.bins)
        target = (int(dest.x), int(dest.y))
        self.assignments[rid] = {"phase": "to_dest", "target": target, "dest": dest}
        self._cmd_move(self.robots[rid], target)

    def _assign_to_base(self, rid: str):
        self.assignments[rid] = {"phase": "to_base", "target": self.base, "dest": self.assignments[rid]["dest"]}
        self._cmd_move(self.robots[rid], self.base)

    def step(self):
        for rid, r in self.robots.items():
            state = self.assignments.get(rid)
            if state is None:
                self._assign_to_dest(rid); continue
            if not self._is_at(r, state["target"]):
                continue
            if state["phase"] == "to_dest":
                self._assign_to_base(rid)
            else:
                self._assign_to_dest(rid)
