from pathlib import Path
from pypinyin import lazy_pinyin
from natsort import natsorted

from models import MetaData, TranConfig
from src.file import FileBase
from src.parse import ParseBase as pa
from src.worker import TranWorker


class FilesQueue:
    """
    A queue to manage files for processing.
    """

    files: list[FileBase] = []
    workers: list[TranWorker] = []
    work_dir: Path = Path.home()

    @classmethod
    def set_work_dir(cls, path: Path):
        """
        Set the working directory for the queue.
        """
        if not Path(path).is_dir():
            raise ValueError(f"Path {path} is not a valid directory.")

        cls.work_dir = Path(path)
        cls.files = [
            FileBase(file_path)
            for file_path in cls.work_dir.iterdir()
            if file_path.is_file() and file_path.suffix.lower() in [".txt", ".md"]
        ]
        cls.files = natsorted(cls.files, key=lambda x: lazy_pinyin(x.get_filename()))

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
        cls.workers = [TranWorker(file, args) for file in cls.files]

    @staticmethod
    def preview(text: str) -> str:
        lines = text.splitlines()
        result = []

        last_line_empty = True
        for line in lines:
            sline, last_line_empty = pa.match_line(line, last_line_empty)
            result.append(sline)

        return "".join(result)
