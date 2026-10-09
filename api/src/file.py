import uuid
import aiofiles
from pathlib import Path
from typing import AsyncGenerator
from datetime import datetime

from models import TEXT_SUFFIXES, TEXT_TYPE, DATA_PATH, FileInfo, MetaData
from src.parse import ParseBase as pa
from src.logger import LoggerBase as lg

TEMP_PATH = DATA_PATH / "temp"
TEMP_PATH.mkdir(parents=True, exist_ok=True)


class FileBase:
    def __init__(self, path: Path):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            raise ValueError(
                f"Path {path} is not a valid file or in unsupported format."
            )

        # Base Info
        self.uid = uuid.uuid4().hex
        self.path = path
        self.type: TEXT_TYPE = "txt" if path.suffix.lower() == ".txt" else "md"
        self.encoding = self._encoding_detect()
        self.metadata = self._get_metadata()

        # Temp File
        self.temp_file = TEMP_PATH / f"{self.uid}.{self.type}"
        self._generate_temp_file()

    async def open(self) -> AsyncGenerator[str, None]:
        """
        Open a file by its UID and yield its content line by line.
        Generate offset for every 10 lines.
        """
        async with aiofiles.open(self.temp_file, "r", encoding="utf-8") as f:
            async for line in f:
                yield line

    def get_filename(self) -> str:
        filename = self.metadata.title

        if self.metadata.creator:
            creators = [
                x.strip() for x in self.metadata.creator.split(";") if x.strip()
            ]
            if creators:
                filename += "_" + "_".join(creators)

        return filename

    def get_file_info(self) -> FileInfo:
        """
        Get the file information as a FileInfo object.
        """
        return FileInfo(
            uid=self.uid,
            filename=self.get_filename(),
            type=self.type,
            **self.metadata.model_dump(),
        )

    async def update(self, updates: dict[int, str]):
        """
        Update a file by its UID with a dictionary of updates.
        """
        new_file = self.temp_file.with_suffix(".update")

        try:
            async with aiofiles.open(new_file, "w", encoding="utf-8") as fout:

                await fout.write(
                    updates.pop(-1, "")
                )  # Write the first line if it exists

                async with aiofiles.open(self.temp_file, "r", encoding="utf-8") as fin:
                    count = 0
                    async for line in fin:
                        await fout.write(updates.pop(count, line))
                        count += 1

            if updates:
                raise ValueError(
                    f"Patch doesn't match file. Unused keys: {sorted(updates)[:5]}"
                )

        except BaseException:
            new_file.unlink(missing_ok=True)
            raise

        else:
            # Replace the original file with the updated one
            new_file.replace(self.temp_file)

    def get_image_path(self, src: str) -> Path:
        """
        Get the absolute path of an image by its source path.
        """
        img_path = Path(src)
        if not img_path.is_absolute():
            img_path = self.path.parent / img_path
        return img_path.resolve()

    def _encoding_detect(self) -> str:
        """
        Detect the encoding of a text file.
        Returns the detected encoding as a string.
        """
        with open(self.path, "rb") as f:
            while True:
                line = f.readline()

                if not line:
                    # 整个文件都是空的
                    return "utf-8"

                if line.strip():
                    break

        # UTF-8 BOM
        if line.startswith(b"\xef\xbb\xbf"):
            lg.info(f"Successfully read {self.path} with UTF-8 BOM.")
            return "utf-8-sig"

        # 优先判断 UTF-8
        try:
            line.decode("utf-8")
            lg.info(f"Successfully read {self.path} with UTF-8.")
            return "utf-8"
        except UnicodeDecodeError:
            pass

        # 再尝试 GB18030
        try:
            line.decode("gb18030")
            lg.info(f"Successfully read {self.path} with GB18030.")
            return "gb18030"
        except UnicodeDecodeError:
            pass

        raise UnicodeError(
            f"Unable to determine encoding for {self.path}. "
            f"Supported encodings: utf-8, gb18030"
        )

    def _generate_temp_file(self):
        with open(
            self.path, "r", encoding=self._encoding_detect(), errors="replace"
        ) as fin:
            if fin.readline().strip() == "---":
                # Skip YAML front matter
                while True:
                    line = fin.readline()
                    if not line or line.strip() == "---":
                        break
            else:
                # Reset file pointer
                fin.seek(0)

            with open(self.temp_file, "w", encoding="utf-8") as fout:
                while True:
                    chunk = fin.read(3 * 1024 * 1024)  # 3 MB
                    if not chunk:
                        break

                    fout.write(chunk)

    def _get_metadata(self) -> MetaData:
        """
        Get metadata from YAML front matter for Markdown files,
        otherwise parse metadata from filename.
        """
        fields = pa.match("file", self.path.stem)
        stat = self.path.stat()

        res = MetaData(
            title=fields.get("title", self.path.stem),
            creator=fields.get("creator"),
            date=datetime.fromtimestamp(getattr(stat, "st_birthtime", stat.st_mtime)),
        )

        # Markdown YAML front matter
        if self.type == "md":
            with open(self.path, "r", encoding=self.encoding) as f:
                if f.readline().strip() == "---":
                    import yaml

                    yaml_lines = []

                    for line in f:
                        if line.strip() == "---":
                            break
                        yaml_lines.append(line)

                    metadata = yaml.safe_load("".join(yaml_lines)) or {}

                    res.title = metadata.get("title", res.title)
                    res.creator = "; ".join(metadata.get("creator", [res.creator]))
                    res.date = metadata.get("date", res.date)

                    res.contributor = "; ".join(metadata.get("contributor", []))
                    res.publisher = "; ".join(metadata.get("publisher", []))
                    res.language = metadata.get("language")
                    res.description = metadata.get("description")
                    res.source = metadata.get("source")

        return res
