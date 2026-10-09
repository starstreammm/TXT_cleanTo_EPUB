from fastapi import APIRouter, Response, Query, Body
from fastapi.responses import StreamingResponse, FileResponse
from pathlib import Path

from models import FileInfo, MetaData
from src.queue import FilesQueue

file_router = APIRouter(prefix="/file", tags=["File"])


@file_router.get("/work_dir", response_model=str)
async def get_work_dir():
    """
    Get the current working directory.
    """
    return str(FilesQueue.work_dir.resolve())


@file_router.post("/work_dir", response_model=list[FileInfo])
async def set_work_dir(path: Path = Query(..., description="Path to open")):
    """
    Open a directory and return a list of files and directories.
    """
    FilesQueue.set_work_dir(path)
    return [file.get_file_info() for file in FilesQueue.files]


@file_router.get("/list", response_model=list[FileInfo])
async def list_files():
    """
    List all files in the current working directory.
    """
    return [file.get_file_info() for file in FilesQueue.files]


@file_router.get("/open", response_class=StreamingResponse)
async def open_file(uid: str = Query(description="UID of the file to open")):
    """
    Open a file by its UID and stream its content line by line.
    """
    return StreamingResponse(
        FilesQueue.get_file_instance(uid).open(),
        media_type="text/plain",
    )


@file_router.post("/update/content", response_model=None)
async def update_file(
    updates: dict[int, str],
    uid: str = Query(description="UID of the file to update"),
):
    await FilesQueue.get_file_instance(uid).update(updates)


@file_router.post("/update/metadata", response_model=None)
async def update_file_metadata(
    metadata: MetaData,
    uid: str = Query(description="UID of the file to update"),
):
    FilesQueue.update_metadata(uid, metadata)


@file_router.post("/preview", response_model=str)
async def preview_file(
    text: str = Body(embed=True, description="Text content to preview")
):
    """
    Render a preview of a content.
    """
    return FilesQueue.preview(text)


@file_router.get("/image", response_class=FileResponse)
async def get_image(
    response: Response,
    uid: str = Query(description="UID of the file."),
    src: str = Query(
        description="Source path of the image. (Maybe relative to the file's directory)"
    ),
):
    """
    Get an image by its source path from a file.
    """
    path = FilesQueue.get_file_instance(uid).get_image_path(src)
    if not path.is_file():
        raise FileNotFoundError(f"Get image: File {path} not found.")

    response.headers["Cache-Control"] = "public, max-age=31536000"
    response.headers["X-File-Type"] = "image"

    return FileResponse(path, media_type="image/*", filename=path.name)
