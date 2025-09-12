from fastapi import FastAPI
from contextlib import asynccontextmanager
import socketio
import asyncio
from robot import Robot, Orientation, GridPose, Position

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=["http://localhost:3000"])
socket_app = socketio.ASGIApp(sio)

CELL_SIZE_M = Robot.config.cell_size_m

grid_width = 14
grid_height = 20
_obstacles = {(1, 1), (1, 2), (3, 5), (6, 10), (10, 7), (12, 3)}

robots: dict[str, Robot] = {}
robots["r1"] = Robot(Position.from_grid(GridPose(2, 2, Orientation.X_RIGHT), CELL_SIZE_M))

def current_state():
    return {
        "grid": {
            "width": grid_width,
            "height": grid_height,
            "obstacles": [[x, y] for (y, x) in sorted(_obstacles)],
        },
        "cellSizeM": CELL_SIZE_M,
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
            }
            for rid, r in robots.items()
        ],
    }

def blocked(nx: int, ny: int) -> bool:
    if nx < 0 or ny < 0 or nx >= grid_width or ny >= grid_height:
        return True
    return (ny, nx) in _obstacles

async def state_loop():
    dt = 0.01
    while True:
        for r in robots.values():
            r.update(dt)
        await sio.emit("game_state", current_state())
        await asyncio.sleep(dt)

@sio.event
async def connect(sid, environ, auth):
    await sio.emit("game_state", current_state(), to=sid)

@sio.event
async def move_to(sid, data):
    rid = data.get("id", "r1")
    tx = int(data.get("x"))
    ty = int(data.get("y"))
    r = robots.get(rid)
    if not r:
        return
    r.move_to(tx, ty, grid_width, grid_height, blocked)

@asynccontextmanager
async def lifespan(app: FastAPI):
    sio.start_background_task(state_loop)
    yield

app = FastAPI(lifespan=lifespan)
app.mount("/", socket_app)
