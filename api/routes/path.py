from fastapi import APIRouter, Query
from pathlib import Path
from pypinyin import lazy_pinyin
from natsort import natsorted

from src.logger import LoggerBase as lg

path_router = APIRouter(prefix="/path", tags=["Path"])


@path_router.get("/home", response_model=str)
async def get_home_path():
    """
    Get the home directory path.
    """
    return str(Path.home().resolve())


@path_router.get("/ls", response_model=list[str])
async def list_directory(path: str):
    path_t = Path(path)
    if not path_t.exists():
        raise ValueError(f"Path '{path}' does not exist.")
    if not path_t.is_dir():
        raise ValueError(f"Path '{path}' is not a directory.")

    dir: list[str] = []
    for p in path_t.iterdir():
        if p.name.startswith("."):
            continue
        elif p.is_dir():
            dir.append(p.name)
    return natsorted(dir, key=lambda x: lazy_pinyin(x))


@path_router.get("/mkdir", response_model=None)
async def mkdir_path(path: str = Query(..., description="Directory path to create")):
    path_t = Path(path)
    path_t.mkdir(parents=True, exist_ok=True)
    lg.info(f"Created directory: {path_t.resolve()}")


@path_router.get("/is_file", response_model=bool)
async def is_file_path(path_str: str = Query(..., description="Path to check")):
    path = Path(path_str)
    if not path.exists():
        raise ValueError(f"Path '{path_str}' does not exist.")
    else:
        return path.is_file()
