from __future__ import annotations
import math
import random
from collections import deque
from dataclasses import dataclass, field
from typing import Literal, Optional, TypeAlias

import numpy as np

Grid: TypeAlias = np.ndarray
Coord: TypeAlias = tuple[int, int]
Config: TypeAlias = list[Coord]
Configs: TypeAlias = list[Config]

@dataclass
class DistTable:
    grid: Grid
    source: Coord
    dist: np.ndarray = field(init=False)

    def __post_init__(self):
        h, w = self.grid.shape
        d = np.full((h, w), np.iinfo(np.int32).max, dtype=np.int32)
        sy, sx = self.source
        if not self.grid[sy, sx]:
            self.dist = d
            return
        qy = deque([sy])
        qx = deque([sx])
        d[sy, sx] = 0
        while qy:
            y = qy.popleft()
            x = qx.popleft()
            v = d[y, x] + 1
            if y > 0 and self.grid[y - 1, x] and v < d[y - 1, x]:
                d[y - 1, x] = v; qy.append(y - 1); qx.append(x)
            if y + 1 < h and self.grid[y + 1, x] and v < d[y + 1, x]:
                d[y + 1, x] = v; qy.append(y + 1); qx.append(x)
            if x > 0 and self.grid[y, x - 1] and v < d[y, x - 1]:
                d[y, x - 1] = v; qy.append(y); qx.append(x - 1)
            if x + 1 < w and self.grid[y, x + 1] and v < d[y, x + 1]:
                d[y, x + 1] = v; qy.append(y); qx.append(x + 1)
        self.dist = d

    def get(self, u: Coord) -> int:
        return int(self.dist[u])

def get_neighbors(grid: Grid, u: Coord) -> list[Coord]:
    y, x = u
    h, w = grid.shape
    out: list[Coord] = []
    if y > 0 and grid[y - 1, x]: out.append((y - 1, x))
    if y + 1 < h and grid[y + 1, x]: out.append((y + 1, x))
    if x > 0 and grid[y, x - 1]: out.append((y, x - 1))
    if x + 1 < w and grid[y, x + 1]: out.append((y, x + 1))
    return out

class PIBT:
    def __init__(self, grid: Grid, starts: Config, goals: Config, seed: int = 0):
        self.grid = grid
        self.starts = starts
        self.goals = goals
        self.N = len(self.starts)
        self.dist_tables = [DistTable(grid, goal) for goal in goals]
        self.NIL = self.N
        self.NIL_COORD: Coord = self.grid.shape
        self.occupied_now = np.full(grid.shape, self.NIL, dtype=int)
        self.occupied_nxt = np.full(grid.shape, self.NIL, dtype=int)
        self.rng = np.random.default_rng(seed)

    def funcPIBT(self, Q_from: Config, Q_to: Config, i: int) -> bool:
        C = [Q_from[i]] + get_neighbors(self.grid, Q_from[i])
        self.rng.shuffle(C)
        C = sorted(C, key=lambda u: self.dist_tables[i].get(u))
        for v in C:
            if self.occupied_nxt[v] != self.NIL:
                continue
            j = self.occupied_now[v]
            if j != self.NIL and Q_to[j] == Q_from[i]:
                continue
            Q_to[i] = v
            self.occupied_nxt[v] = i
            if j != self.NIL and (Q_to[j] == self.NIL_COORD) and (not self.funcPIBT(Q_from, Q_to, j)):
                continue
            return True
        Q_to[i] = Q_from[i]
        self.occupied_nxt[Q_from[i]] = i
        return False

    def step(self, Q_from: Config, priorities: list[float]) -> Config:
        N = len(Q_from)
        Q_to: Config = []
        for i, v in enumerate(Q_from):
            Q_to.append(self.NIL_COORD)
            self.occupied_now[v] = i
        A = sorted(list(range(N)), key=lambda i: priorities[i], reverse=True)
        for i in A:
            if Q_to[i] == self.NIL_COORD:
                self.funcPIBT(Q_from, Q_to, i)
        for q_from, q_to in zip(Q_from, Q_to):
            self.occupied_now[q_from] = self.NIL
            self.occupied_nxt[q_to] = self.NIL
        return Q_to

class StationSet:
    def __init__(self, cells: list[Coord]):
        self.cells = list(cells)
        self.index = {c: i for i, c in enumerate(self.cells)}
        self.holder: list[Optional[int]] = [None] * len(self.cells)
        self.queue: list[deque[int]] = [deque() for _ in self.cells]
        self.in_queue: list[set[int]] = [set() for _ in self.cells]

    def is_taken(self, k: int) -> bool:
        return self.holder[k] is not None

    def taken_by_other(self, k: int, agent: int) -> bool:
        h = self.holder[k]
        return h is not None and h != agent

    def claim_if_free(self, k: int, agent: int) -> bool:
        if self.holder[k] is None:
            self.holder[k] = agent
            return True
        return False

    def enqueue(self, k: int, agent: int):
        if agent not in self.in_queue[k] and self.holder[k] != agent:
            self.queue[k].append(agent)
            self.in_queue[k].add(agent)

    def pop_next(self, k: int) -> Optional[int]:
        if self.queue[k]:
            a = self.queue[k].popleft()
            self.in_queue[k].discard(a)
            self.holder[k] = a
            return a
        return None

    def release_if_holder(self, k: int, agent: int):
        if self.holder[k] == agent:
            self.holder[k] = None

    def holder_of(self, k: int) -> Optional[int]:
        return self.holder[k]

@dataclass
class AgentState:
    goal_kind: Literal['load', 'dump', 'charge', 'staging', 'stay']
    goal: Coord
    battery: int
    dwell_steps: int = 0
    staging: Optional[Coord] = None
    claim: Optional[tuple[Literal['L', 'D', 'C'], int]] = None
    queued: Optional[tuple[Literal['L', 'D', 'C'], int]] = None
    mode: Literal['to_load', 'at_load_wait', 'to_dump', 'to_charge', 'charging', 'staging', 'stay'] = 'to_load'

class Simulator:
    def __init__(
        self,
        grid: Grid,
        starts: Config,
        loaders: list[Coord],
        dumps: list[Coord],
        chargers: list[Coord],
        seed: int = 0,
        battery_max: int = 1000,
        battery_low: int = 200,
        charge_rate: int = 100,
        dwell_min_steps: int = 10,
        dwell_max_steps: int = 30,
        resume_policy: Literal['full', 'threshold'] = 'full'
    ):
        self.grid = grid.astype(bool)
        self.N = len(starts)
        self.Q: Config = list(starts)
        self.L = StationSet(loaders)
        self.D = StationSet(dumps)
        self.C = StationSet(chargers)
        self.priorities: list[float] = [0.0] * self.N
        self.rng = np.random.default_rng(seed)
        self.py_rng = random.Random(seed)
        self.battery_max = battery_max
        self.battery_low = battery_low
        self.charge_rate = charge_rate
        self.dwell_min_steps = dwell_min_steps
        self.dwell_max_steps = dwell_max_steps
        self.resume_policy = resume_policy
        self.dist_cache: dict[Coord, DistTable] = {}
        for c in loaders + dumps + chargers:
            self.dist_cache[c] = DistTable(self.grid, c)
        self.states: list[AgentState] = []
        for i, s in enumerate(starts):
            gk, g, claim = self.choose_loader_target(i, s)
            self.states.append(AgentState(goal_kind=gk, goal=g, battery=battery_max, claim=claim, mode='to_load'))
        self.pibt = PIBT(self.grid, self.Q, [st.goal for st in self.states], seed=seed)
        for i in range(self.N):
            self.priorities[i] = self.dist_to(self.states[i].goal, self.Q[i]) / self.grid.size
        self.staging_reserved: set[Coord] = set()
        self.t = 0

    def dist_to(self, target: Coord, pos: Coord) -> int:
        dt = self.dist_cache.get(target)
        if dt is None:
            dt = DistTable(self.grid, target)
            self.dist_cache[target] = dt
        return dt.get(pos)

    def nearest_unclaimed_loader(self, i: int, pos: Coord) -> Optional[int]:
        best = None
        bestd = math.inf
        for k, c in enumerate(self.L.cells):
            if not self.L.is_taken(k):
                d = self.dist_to(c, pos)
                if d < bestd:
                    bestd = d
                    best = k
        return best

    def nearest_unclaimed_charger(self, i: int, pos: Coord) -> Optional[int]:
        best = None
        bestd = math.inf
        for k, c in enumerate(self.C.cells):
            if not self.C.is_taken(k):
                d = self.dist_to(c, pos)
                if d < bestd:
                    bestd = d
                    best = k
        return best

    def random_dump_index(self) -> int:
        return self.py_rng.randrange(len(self.D.cells))

    def choose_loader_target(self, i: int, pos: Coord) -> tuple[Literal['load', 'staging'], Coord, Optional[tuple[Literal['L'], int]]]:
        k = self.nearest_unclaimed_loader(i, pos)
        if k is not None and self.L.claim_if_free(k, i):
            return 'load', self.L.cells[k], ('L', k)
        qlens = [(len(self.L.queue[k]), k) for k in range(len(self.L.cells))]
        qlens.sort()
        k = qlens[0][1]
        self.L.enqueue(k, i)
        sc = self.find_staging_cell_near(self.L.cells[k])
        self.staging_reserved.add(sc)
        return 'staging', sc, None

    def choose_dump_target(self, i: int, pos: Coord) -> tuple[Literal['dump', 'staging'], Coord, Optional[tuple[Literal['D'], int]]]:
        idxs = list(range(len(self.D.cells)))
        self.py_rng.shuffle(idxs)
        for k in idxs:
            if not self.D.is_taken(k) and self.D.claim_if_free(k, i):
                return 'dump', self.D.cells[k], ('D', k)
        k = min(range(len(self.D.cells)), key=lambda j: len(self.D.queue[j]))
        self.D.enqueue(k, i)
        sc = self.find_staging_cell_near(self.D.cells[k])
        self.staging_reserved.add(sc)
        return 'staging', sc, None

    def choose_charger_target(self, i: int, pos: Coord) -> tuple[Literal['charge', 'staging'], Coord, Optional[tuple[Literal['C'], int]]]:
        k = self.nearest_unclaimed_charger(i, pos)
        if k is not None and self.C.claim_if_free(k, i):
            return 'charge', self.C.cells[k], ('C', k)
        k = min(range(len(self.C.cells)), key=lambda j: len(self.C.queue[j]))
        self.C.enqueue(k, i)
        sc = self.find_staging_cell_near(self.C.cells[k])
        self.staging_reserved.add(sc)
        return 'staging', sc, None

    def find_staging_cell_near(self, target: Coord) -> Coord:
        h, w = self.grid.shape
        occupied = set(self.Q)
        reserved = occupied | self.staging_reserved | set(self.L.cells) | set(self.D.cells) | set(self.C.cells)
        sy, sx = target
        if self.grid[sy, sx] and (sy, sx) not in reserved:
            return (sy, sx)
        d = np.full((h, w), -1, dtype=np.int32)
        qy = deque()
        qx = deque()
        qy.append(sy); qx.append(sx); d[sy, sx] = 0
        while qy:
            y = qy.popleft(); x = qx.popleft()
            if self.grid[y, x] and (y, x) not in reserved:
                return (y, x)
            if y > 0 and d[y - 1, x] == -1:
                d[y - 1, x] = d[y, x] + 1; qy.append(y - 1); qx.append(x)
            if y + 1 < h and d[y + 1, x] == -1:
                d[y + 1, x] = d[y, x] + 1; qy.append(y + 1); qx.append(x)
            if x > 0 and d[y, x - 1] == -1:
                d[y, x - 1] = d[y, x] + 1; qy.append(y); qx.append(x - 1)
            if x + 1 < w and d[y, x + 1] == -1:
                d[y, x + 1] = d[y, x] + 1; qy.append(y); qx.append(x + 1)
        return self.Q[0]

    def goals_for_pibt(self) -> Config:
        out: Config = []
        for i, st in enumerate(self.states):
            if st.goal_kind == 'stay':
                out.append(self.Q[i])
            else:
                out.append(st.goal)
        return out

    def update_priorities(self, Q_next: Config):
        for i, (q, g) in enumerate(zip(Q_next, [st.goal for st in self.states])):
            if q != g:
                self.priorities[i] += 1
            else:
                self.priorities[i] -= math.floor(self.priorities[i])

    def step(self) -> dict:
        events: list[dict] = []
        for i, st in enumerate(self.states):
            pos = self.Q[i]
            if st.mode == 'to_load' and st.claim and st.claim[0] == 'L':
                k = st.claim[1]
                if pos == self.L.cells[k]:
                    st.mode = 'at_load_wait'
                    st.goal_kind = 'stay'
                    st.goal = pos
                    st.dwell_steps = self.py_rng.randint(self.dwell_min_steps, self.dwell_max_steps)
                    events.append({'type': 'arrived_loader', 'agent': i, 'at': pos, 'dwell_steps': st.dwell_steps})
            if st.mode == 'to_dump' and st.claim and st.claim[0] == 'D':
                k = st.claim[1]
                if pos == self.D.cells[k]:
                    self.D.release_if_holder(k, i)
                    st.claim = None
                    events.append({'type': 'arrived_dump', 'agent': i, 'at': pos})
                    if st.battery <= self.battery_low:
                        st.mode = 'to_charge'
                        kind, g, claim = self.choose_charger_target(i, pos)
                        st.goal_kind = kind
                        st.goal = g
                        st.claim = claim
                        if kind == 'staging': st.mode = 'staging'
                        events.append({'type': 'goal_charge', 'agent': i, 'goal': st.goal})
                    else:
                        st.mode = 'to_load'
                        kind, g, claim = self.choose_loader_target(i, pos)
                        st.goal_kind = kind
                        st.goal = g
                        st.claim = claim
                        if kind == 'staging': st.mode = 'staging'
                        events.append({'type': 'goal_loader', 'agent': i, 'goal': st.goal})
            if st.mode == 'to_charge' and st.claim and st.claim[0] == 'C':
                k = st.claim[1]
                if pos == self.C.cells[k]:
                    st.mode = 'charging'
                    st.goal_kind = 'charge'
                    st.goal = self.C.cells[k]
                    events.append({'type': 'arrived_charger', 'agent': i, 'at': pos})
            if st.mode == 'staging':
                st.goal_kind = 'staging'
        for i, st in enumerate(self.states):
            if st.mode == 'at_load_wait':
                if st.dwell_steps > 0:
                    st.dwell_steps -= 1
                    if st.dwell_steps == 0:
                        if st.claim and st.claim[0] == 'L':
                            self.L.release_if_holder(st.claim[1], i)
                            st.claim = None
                        st.mode = 'to_dump'
                        kind, g, claim = self.choose_dump_target(i, self.Q[i])
                        st.goal_kind = kind
                        st.goal = g
                        st.claim = claim
                        if kind == 'staging': st.mode = 'staging'
                        events.append({'type': 'dwell_finished', 'agent': i})
                        events.append({'type': 'goal_dump', 'agent': i, 'goal': st.goal})
            if st.mode == 'charging':
                st.battery = min(self.battery_max, st.battery + self.charge_rate)
                events.append({'type': 'battery', 'agent': i, 'value': st.battery})
                resume = False
                if self.resume_policy == 'full':
                    resume = st.battery >= self.battery_max
                else:
                    resume = st.battery >= max(self.battery_low + 200, self.charge_rate * 3)
                if resume:
                    if st.claim and st.claim[0] == 'C':
                        self.C.release_if_holder(st.claim[1], i)
                        st.claim = None
                    st.mode = 'to_load'
                    kind, g, claim = self.choose_loader_target(i, self.Q[i])
                    st.goal_kind = kind
                    st.goal = g
                    st.claim = claim
                    if kind == 'staging': st.mode = 'staging'
                    events.append({'type': 'leave_charger', 'agent': i})
                    events.append({'type': 'goal_loader', 'agent': i, 'goal': st.goal})
        for k in range(len(self.L.cells)):
            if self.L.holder_of(k) is None and self.L.queue[k]:
                a = self.L.pop_next(k)
                if a is not None:
                    if self.states[a].mode == 'staging':
                        self.states[a].mode = 'to_load'
                    self.states[a].goal_kind = 'load'
                    self.states[a].goal = self.L.cells[k]
                    self.states[a].claim = ('L', k)
                    events.append({'type': 'loader_claimed', 'agent': a, 'station': self.L.cells[k]})
        for k in range(len(self.D.cells)):
            if self.D.holder_of(k) is None and self.D.queue[k]:
                a = self.D.pop_next(k)
                if a is not None:
                    if self.states[a].mode == 'staging':
                        self.states[a].mode = 'to_dump'
                    self.states[a].goal_kind = 'dump'
                    self.states[a].goal = self.D.cells[k]
                    self.states[a].claim = ('D', k)
                    events.append({'type': 'dump_claimed', 'agent': a, 'station': self.D.cells[k]})
        for k in range(len(self.C.cells)):
            if self.C.holder_of(k) is None and self.C.queue[k]:
                a = self.C.pop_next(k)
                if a is not None:
                    if self.states[a].mode == 'staging':
                        self.states[a].mode = 'to_charge'
                    self.states[a].goal_kind = 'charge'
                    self.states[a].goal = self.C.cells[k]
                    self.states[a].claim = ('C', k)
                    events.append({'type': 'charger_claimed', 'agent': a, 'station': self.C.cells[k]})
        goals = self.goals_for_pibt()
        self.pibt.goals = goals
        self.pibt.dist_tables = [DistTable(self.grid, g) for g in goals]
        Q_next = self.pibt.step(self.Q, self.priorities)
        moved = [a != b for a, b in zip(self.Q, Q_next)]
        for i, mv in enumerate(moved):
            if mv:
                self.states[i].battery = max(0, self.states[i].battery - 1)
        self.update_priorities(Q_next)
        self.Q = Q_next
        self.t += 1
        return {'t': self.t, 'Q': self.Q, 'events': events, 'goals': goals, 'battery': [st.battery for st in self.states]}

def load_movingai_map(path: str) -> Grid:
    with open(path, 'r', encoding='utf-8') as f:
        lines = [ln.rstrip('\n') for ln in f]
    idx = 0
    while idx < len(lines) and not lines[idx].lower().startswith('type'):
        idx += 1
    while idx < len(lines) and not lines[idx].lower().startswith('height'):
        idx += 1
    h = int(lines[idx].split()[-1]); idx += 1
    w = int(lines[idx].split()[-1]); idx += 1
    while idx < len(lines) and not lines[idx].lower().startswith('map'):
        idx += 1
    idx += 1
    grid = np.zeros((h, w), dtype=bool)
    for y in range(h):
        row = lines[idx + y]
        for x, ch in enumerate(row):
            grid[y, x] = ch in ('.', 'G', 'S', 'T', ' ')
    return grid

if __name__ == '__main__':
    h, w = 14, 20
    grid = np.ones((h, w), dtype=bool)
    for y in range(h):
        grid[y, 0] = False; grid[y, w - 1] = False
    for x in range(w):
        grid[0, x] = False; grid[h - 1, x] = False
    loaders = [(1, 2), (1, 3), (1, 4), (1, 5)]
    dumps = [(12, x) for x in range(2, 18, 1) if grid[12, x]][:28]
    chargers = [(1, 7), (1, 8)]
    starts = [(2, 2), (2, 3), (3, 2), (3, 3), (4, 2), (4, 3), (5, 2), (5, 3)]
    sim = Simulator(grid, starts, loaders, dumps, chargers, seed=42)
    for _ in range(50):
        out = sim.step()
        _ = out
