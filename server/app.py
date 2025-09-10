from fastapi import FastAPI
from contextlib import asynccontextmanager
import socketio
import asyncio

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["http://localhost:3000"],
)

socket_app = socketio.ASGIApp(sio)


async def ping_loop():
    while True:
        await sio.emit("ping", {"msg": "ping"})
        await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    sio.start_background_task(ping_loop)
    yield


app = FastAPI(lifespan=lifespan)
app.mount("/", socket_app)
