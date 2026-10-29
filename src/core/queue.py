import asyncio
from pathlib import Path
from pypinyin import lazy_pinyin
from natsort import natsorted

from fastapi import HTTPException

from models import MetaData, TranConfig, TEXT_TYPE, TEXT_SUFFIXES
from core.file import FileBase
from core.parse import ParseBase as pa
from core.worker import TranWorker


class FilesQueue:
    """
    A queue to manage files for processing.
    """

    files: list[FileBase] = []
    selected_uids: set[str] = set()
    workers: list[TranWorker] = []
    completion_task: asyncio.Task | None = None
    work_dir: Path = Path.home()

    @classmethod
    def set_work_dir(cls, path: Path):
        """
        Set the working directory for the queue.
        """
        cls.ensure_idle()
        path = Path(path)
        if path.is_dir():
            candidates = [
                candidate
                for candidate in path.iterdir()
                if candidate.is_file() and candidate.suffix.lower() in TEXT_SUFFIXES
            ]
        elif path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
            candidates = [path]
        else:
            raise HTTPException(400, "Choose a directory, .txt file, or .md file.")

        files = [FileBase(candidate) for candidate in candidates]
        cls.work_dir = path if path.is_dir() else path.parent
        cls.files = natsorted(files, key=lambda file: lazy_pinyin(file.path.name))
        cls.selected_uids = {file.uid for file in cls.files}

    @classmethod
    def ensure_idle(cls):
        if cls.completion_task is not None and not cls.completion_task.done():
            raise HTTPException(409, "A conversion batch is still running.")

    @classmethod
    def select_files(cls, uids: list[str]):
        cls.ensure_idle()
        selected = set(uids)
        if not selected or not selected.issubset({file.uid for file in cls.files}):
            raise HTTPException(400, "Select at least one file from the current list.")
        cls.selected_uids = selected

    @classmethod
    def update_metadata(cls, uid: str, metadata: MetaData):
        """
        Update the metadata of a file in the queue by its UID.
        """
        for file in cls.files:
            if file.uid == uid:
                file.metadata = file.metadata.copy(update=metadata.model_dump())
                return
        raise ValueError(f"No file found with UID {uid}.")

    @classmethod
    def get_file_instance(cls, uid: str) -> FileBase:
        """
        Get a file from the queue by its UID.
        """
        for file in cls.files:
            if file.uid == uid:
                return file
        raise ValueError(f"No file found with UID {uid}.")

    @classmethod
    def spawn_worker_instance(cls, args: TranConfig):
        """
        Spawn a worker instance for each file in the queue.
        """
        cls.ensure_idle()
        if not cls.selected_uids:
            raise HTTPException(400, "Select at least one file before converting.")
        cls.workers = [
            TranWorker(file, args)
            for file in cls.files
            if file.uid in cls.selected_uids
        ]
        cls.completion_task = asyncio.create_task(cls._finish_batch(cls.workers))

    @classmethod
    def retry_failed(cls):
        cls.ensure_idle()
        if not any(worker.progress.error for worker in cls.workers):
            raise HTTPException(400, "There are no failed files to retry.")
        for index, worker in enumerate(cls.workers):
            if not worker.progress.error:
                continue
            if worker.done:
                # Conversion succeeded; only image cleanup needs another attempt.
                worker.progress.error = None
                continue
            retry = TranWorker(worker.file, worker.config)
            retry.image_paths = worker.image_paths.copy()
            retry.image_counts = worker.image_counts.copy()
            retry.cover_path = worker.cover_path
            cls.workers[index] = retry
        cls.completion_task = asyncio.create_task(cls._finish_batch(cls.workers))

    @staticmethod
    async def _finish_batch(workers: list[TranWorker]):
        # Wait for all books, since images may be shared across files.
        await asyncio.gather(*(worker.worker for worker in workers))
        if any(worker.progress.error or not worker.done for worker in workers):
            return
        destinations = {
            destination.resolve()
            for worker in workers
            for destination in worker.image_paths.values()
        }
        for worker in workers:
            if not worker.config.move_images:
                continue
            try:
                for _, source in worker.image_paths:
                    if source not in destinations:
                        source.unlink(missing_ok=True)
            except OSError as error:
                worker.progress.error = f"Could not remove source image: {error}"

    @staticmethod
    def preview(text: str, type: TEXT_TYPE) -> str:
        lines = text.splitlines()
        result = []

        prev_blank = True
        for line in lines:
            sline, prev_blank = pa.match_line(line, prev_blank, type)
            result.append(sline)

        return "".join(result)
