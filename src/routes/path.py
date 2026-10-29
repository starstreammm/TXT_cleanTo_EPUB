from fastapi import APIRouter, Query
from pathlib import Path
from pypinyin import lazy_pinyin
from natsort import natsorted

from core.logger import LoggerBase as lg
from models import PathEntry, TEXT_SUFFIXES

path_router = APIRouter(prefix="/path", tags=["Path"])


@path_router.get("/home", response_model=str)
async def get_home_path():
    """
    Get the home directory path.
    """
    return str(Path.home().resolve())


@path_router.get("/ls", response_model=list[PathEntry])
async def list_directory(path: str, include_files: bool = False):
    path_t = Path(path)
    if not path_t.exists():
        raise ValueError(f"Path '{path}' does not exist.")
    if not path_t.is_dir():
        raise ValueError(f"Path '{path}' is not a directory.")

    entries: list[PathEntry] = []
    for p in path_t.iterdir():
        if p.name.startswith("."):
            continue
        if p.is_dir() or (
            include_files and p.is_file() and p.suffix.lower() in TEXT_SUFFIXES
        ):
            entries.append(PathEntry(name=p.name, is_file=p.is_file()))
    return natsorted(entries, key=lambda entry: lazy_pinyin(entry.name))


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
