# server/app.py
from __future__ import annotations
import contextlib
from pathlib import Path
from contextlib import asynccontextmanager
import asyncio
import socketio
from fastapi import FastAPI

from server.destination_bin import DestinationBin
from server.hivemind import Hivemind
from server.robot import Robot, Orientation, GridPose, Position
from server.map_reader import Grid, get_grid

def create_app():
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=["http://localhost:3000"])
    app = FastAPI()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        CELL_SIZE_M = Robot.config.cell_size_m
        root = Path(__file__).resolve().parents[1] / "public"
        grid: Grid = get_grid(str(root / "maps" / "sorter-20x14.map"))

        robots: dict[str, Robot] = {
            "r1": Robot(Position.from_grid(GridPose(3, 10, Orientation.X_RIGHT), CELL_SIZE_M)),
            "r2": Robot(Position.from_grid(GridPose(1, 10, Orientation.X_RIGHT), CELL_SIZE_M))
        }

        obs = set(map(tuple, grid["obstacles"]))
        def blocked(nx: int, ny: int) -> bool:
            if nx < 0 or ny < 0 or nx >= grid["width"] or ny >= grid["height"]:
                return True
            return (nx, ny) in obs

        base_xy = (robots["r1"].position.grid.x, robots["r1"].position.grid.y)

        destination_bins = [
            DestinationBin(1, 8, 10),
            DestinationBin(2, 6, 10),
        ]

        hivemind = Hivemind(robots, grid, blocked, base_xy, destination_bins, seed=0)

        def current_state():
            return {
                "grid": grid,
                "cellSizeM": CELL_SIZE_M,
                "base": {"x": base_xy[0], "y": base_xy[1]},
                "destinationBins": [
                    {"id": b.id, "x": b.x, "y": b.y, "capacity": b.capacity, "items": list(b.items)}
                    for b in destination_bins
                ],
                "robots": [
                    {
                        "id": rid,
                        "grid": {
                            "x": r.position.grid.x,
                            "y": r.position.grid.y,
                            "rotation": int(r.position.grid.rotation),
                        },
                        "absolute": {
                            "x": r.position.absolute.x,
                            "y": r.position.absolute.y,
                            "rotationDeg": r.position.absolute.rotation_deg,
                        },
                        "path": r.path,
                    }
                    for rid, r in robots.items()
                ],
            }

        async def state_loop():
            dt = 0.01
            try:
                while True:
                    for r in robots.values(): r.update(dt)
                    hivemind.step()
                    await sio.emit("game_state", current_state())
                    await asyncio.sleep(dt)
            except asyncio.CancelledError:
                pass

        @sio.event
        async def connect(sid, environ, auth):
            print("bins now:", [(b.id, b.x, b.y) for b in destination_bins])
            await sio.emit("game_state", current_state(), to=sid)

        task = sio.start_background_task(state_loop)
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(Exception):
                await task

    app.router.lifespan_context = lifespan
    return socketio.ASGIApp(sio, other_asgi_app=app)