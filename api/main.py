import shutil
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import asynccontextmanager

from models import DATA_PATH, VERSION
from src.logger import LoggerBase as lg
from src.parse import ParseBase as pa

from routes import *


@asynccontextmanager
async def lifespan(app: FastAPI):
    lg.init()
    await pa.init()
    yield
    await pa.close()
    shutil.rmtree(DATA_PATH / "temp", ignore_errors=True)


app = FastAPI(
    lifespan=lifespan,
    version=VERSION,
    title="TXT CleanTo EPUB API",
    description="The API for TXT CleanTo EPUB, a tool to clean and convert TXT files to EPUB format.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(path_router)
app.include_router(file_router)
app.include_router(pattern_router)
app.include_router(task_router)
app.include_router(test_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


import uvicorn

uvicorn.run(
    app,
    host="0.0.0.0",
    port=38888,
    loop="asyncio",
)
