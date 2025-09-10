from fastapi import FastAPI
from contextlib import asynccontextmanager
import socketio
import asyncio

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["http://localhost:3000"],
)
socket_app = socketio.ASGIApp(sio)

grid_width = 14
grid_height = 20
_obstacles = {(1, 1), (1, 2), (3, 5), (6, 10), (10, 7), (12, 3)}
robots = {"r1": {"id": "r1", "x": 2, "y": 2}}

def current_state():
    return {
        "grid": {
            "width": grid_width,
            "height": grid_height,
            "obstacles": [[x, y] for (y, x) in sorted({(y, x) for (y, x) in _obstacles})],
        },
        "robots": list(robots.values()),
    }

def is_blocked(nx: int, ny: int) -> bool:
    if nx < 0 or ny < 0 or nx >= grid_width or ny >= grid_height:
        return True
    return (ny, nx) in _obstacles

async def state_loop():
    interval = 1 / 60
    while True:
        await sio.emit("game_state", current_state())
        await asyncio.sleep(interval)

@sio.event
async def connect(sid, environ, auth):
    await sio.emit("game_state", current_state(), to=sid)

@sio.event
async def move(sid, data):
    rid = data.get("id", "r1")
    d = data.get("dir")
    if rid not in robots or d not in ("left", "right", "up", "down"):
        return
    dx = -1 if d == "left" else 1 if d == "right" else 0
    dy = -1 if d == "up" else 1 if d == "down" else 0
    x, y = robots[rid]["x"], robots[rid]["y"]
    nx, ny = x + dx, y + dy
    if not is_blocked(nx, ny):
        robots[rid]["x"], robots[rid]["y"] = nx, ny

@asynccontextmanager
async def lifespan(app: FastAPI):
    sio.start_background_task(state_loop)
    yield

app = FastAPI(lifespan=lifespan)
app.mount("/", socket_app)
