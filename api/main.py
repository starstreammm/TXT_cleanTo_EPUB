import shutil
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
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
    root_path="/api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: Exception):
    try:
        lg.exception(f"Validation Error: {exc}")
    except Exception:
        traceback.print_exc()
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "detail": str(exc),
        },
    )


@app.exception_handler(Exception)
async def all_exception_handler(request: Request, exc: Exception):
    try:
        lg.exception(exc)
    except Exception:
        traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "detail": str(exc),
        },
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
