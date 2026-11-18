import asyncio
from io import StringIO
from pathlib import Path
from pypinyin import lazy_pinyin
from natsort import natsorted

from fastapi import HTTPException

from models import MetaData, TranConfig, TEXT_TYPE, TEXT_SUFFIXES
from utils import database
from utils.file import FileBase
from utils.parse import ParseBase as pa
from utils.worker import TranWorker


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

        used_patterns = []
        files = [FileBase(candidate, used_patterns) for candidate in candidates]
        with database.connect() as connection:
            database.record_filename_history(connection, used_patterns)
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
            cls.workers[index] = TranWorker(worker.file, worker.config)
        cls.completion_task = asyncio.create_task(cls._finish_batch(cls.workers))

    @staticmethod
    async def _finish_batch(workers: list[TranWorker]):
        # Wait for all books, since images may be shared across files.
        await asyncio.gather(*(worker.worker for worker in workers))
        if any(worker.progress.error or not worker.done for worker in workers):
            return
        for worker in workers:
            try:
                for source in worker.images_delete:
                    if not source.exists() or any(
                        source.is_relative_to(other.output_dir.resolve())
                        for other in workers
                    ):
                        continue
                    digest = worker.image_digest(source)
                    destination = worker.copied_image(digest)
                    if (
                        destination is None
                        or destination == source
                        or worker.digest(destination) != digest
                        or worker.digest(source) != digest
                    ):
                        raise OSError(f"Image changed since copying: {source}")
                    source.unlink()
            except OSError as error:
                worker.progress.error = f"Could not remove source image: {error}"

    @staticmethod
    def preview(
        text: str, type: TEXT_TYPE, uid: str | None = None, start_line: int = 1
    ) -> str:
        settings = {}
        if uid:
            source = str(FilesQueue.get_file_instance(uid).path.resolve())
            settings = database.get_heading_settings(source)
        parser = pa(settings)
        lines = StringIO(text, newline=None)
        result = []

        prev_blank = True
        for number, line in enumerate(lines, 1):
            sline, prev_blank = parser.match_line(line, prev_blank, type)
            if number >= start_line:
                result.append(sline)

        return "".join(result)
