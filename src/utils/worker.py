import asyncio
import hashlib
import os
import re
import shutil
import yaml
import aiofiles
from urllib.parse import quote
from pathlib import Path
from pypandoc import convert_file as pd_convert

from models import (
    ApiExecuteResponse,
    CSS_PATH,
    MetaData,
    TranConfig,
)
from utils import database
from utils.file import FileBase
from utils.logger import LoggerBase as lg
from utils.parse import ParseBase as pa
from utils.image import generate_cover, COVER_PATH

# ![alt](src "optional title")  /  ![alt](<src with spaces> 'title')
_IMAGE_PATTERN = re.compile(
    r"!\[(?P<alt>[^\]]*)\]"
    r'\(\s*(?P<src><[^>]*>|[^\s)]+)(?P<title>\s+(?:"[^"]*"|\'[^\']*\'))?\s*\)'
)
# Remote or special sources (http://, https://, data:, ftp:, ...). A single letter is a Windows drive.
_SCHEME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.\-]+:")


class TranWorker:
    def __init__(self, file: FileBase, config: TranConfig):
        self.file = file
        self.config = config
        self.progress = ApiExecuteResponse(uid=file.uid, filename=file.path.name)
        self.output_dir = self.config.output / self.file.get_filename()

        self.images: list[tuple[Path, bytes]] = []
        self.images_delete: list[Path] = []
        self.cover_path: Path
        self.done = False

        if self.output_dir.exists():
            raise FileExistsError(f"Output directory already exists: {self.output_dir}")
        self.output_dir.mkdir(parents=True)
        self.worker = asyncio.create_task(self._worker())

    async def _worker(self):
        output_md = self.output_dir / f"{self.file.get_filename()}.md"
        try:
            size = self.file.temp_file.stat().st_size
            cover = self.file.metadata.cover
            if cover is not None:
                cover = (self.file.path.parent / cover).resolve()
                if not cover.is_file():
                    self.progress.warning = (
                        f"Cover not found: {cover}. Using a generated cover."
                    )
                    lg.warning(self.progress.warning)
                    cover = None
            if cover is None:
                generate_cover(
                    self.file.uid,
                    self.file.metadata.title,
                    self.file.metadata.creator,
                )
                cover = COVER_PATH / f"{self.file.uid}.jpg"

            cover = cover.resolve()
            self.cover_path = (
                self._copy_image(cover) if self.config.move_images else cover
            )

            source = str(self.file.path.resolve())
            settings = database.get_heading_settings(source)
            parser = pa(settings)
            prev_blank = True
            async with (
                aiofiles.open(self.file.temp_file, "r", encoding="utf-8") as fin,
                aiofiles.open(output_md, "w", encoding="utf-8") as fout,
            ):
                await fout.write(self._metadata())
                async for line in fin:
                    self.progress.progress = int((await fin.tell()) / size * 88)
                    sline, prev_blank = parser.match_line(
                        line, prev_blank, self.file.type
                    )
                    if sline:
                        await fout.write(self._fix_image_path(sline))

            await self._transformer(output_md)

            if parser.used:
                with database.connect() as connection:
                    database.record_heading_rules(connection, parser.used)
                    database.record_heading_history(connection, source, settings)
            self.progress.progress = 98
            lg.info(
                f"Successfully converted {self.file.get_filename()} to {self.config.output.resolve()}"
            )

        except Exception as error:
            self.progress.error = str(error)
            lg.exception(
                f"Error occurred while processing {self.file.get_filename()}: {error}"
            )
            shutil.rmtree(self.output_dir, ignore_errors=True)

        else:
            try:
                if not self.config.save_text:
                    output_md.unlink(missing_ok=True)
                if self.config.del_origin:
                    self.file.path.unlink(missing_ok=True)
            except Exception as error:
                lg.warning(
                    f"Error occurred while cleaning up files for {self.file.get_filename()}: {error}"
                )
            finally:
                self.progress.progress = 100
                self.done = True

    def _fix_image_path(self, line: str) -> str:
        """
        Resolve image links, optionally staging images for a successful batch move.
        """

        def _replace(match: re.Match) -> str:
            alt = match.group("alt")
            raw_src = match.group("src")
            title = match.group("title") or ""

            src = raw_src[1:-1] if raw_src.startswith("<") else raw_src

            # Leave remote / data URIs alone.
            if src.startswith("//") or _SCHEME_PATTERN.match(src):
                return match.group(0)

            img_path = self.file.get_image_path(src)

            if not alt.strip():
                alt = img_path.name

            if not self.config.move_images:
                relative = self._relative_path(img_path, self.output_dir)
                return f"![{alt}]({relative}{title})"

            destination = self._copy_image(img_path)
            return (
                f"![{alt}]({self._relative_path(destination, self.output_dir)}{title})"
            )

        return _IMAGE_PATTERN.sub(_replace, line)

    @staticmethod
    def _relative_path(path: Path, output_dir: Path) -> str:
        return "./" + quote(
            Path(os.path.relpath(path.resolve(), output_dir.resolve())).as_posix(),
            safe="/.-_",
        )

    @staticmethod
    def digest(path: Path) -> bytes:
        result = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                result.update(chunk)
        return result.digest()

    def _image_destination(self, index: int, source: Path) -> Path:
        suffix = source.suffix.lower()
        # The cover is staged before any inline images, so it occupies index 1.
        if index == 1:
            return (self.output_dir / f"cover{suffix}").resolve()
        return (self.output_dir / "pics" / f"P{index}{suffix}").resolve()

    def image_digest(self, source: Path) -> bytes | None:
        return next((digest for path, digest in self.images if path == source), None)

    def copied_image(self, digest: bytes | None) -> Path | None:
        for index, (source, image_hash) in enumerate(self.images, 1):
            if image_hash == digest:
                return self._image_destination(index, source)
        return None

    def _copy_image(self, source: Path) -> Path:
        known_hash = self.image_digest(source)
        digest = known_hash if known_hash is not None else self.digest(source)
        destination = self.copied_image(digest)
        if destination is None:
            destination = self._image_destination(len(self.images) + 1, source)
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination != source:
                with source.open("rb") as original, destination.open("xb") as target:
                    shutil.copyfileobj(original, target)
            if self.digest(destination) != digest:
                raise OSError(f"Image changed while copying: {source}")

        if known_hash is None:
            self.images.append((source, digest))
            self.images_delete.append(source)
        return destination

    async def _transformer(self, input: Path):
        await asyncio.to_thread(
            pd_convert,
            input,
            "epub3",
            format="markdown",
            outputfile=input.with_suffix(".epub"),
            extra_args=[
                f"--lua-filter={Path(__file__).with_name('epub_headings.lua').resolve()}",
                f"--resource-path={input.parent.resolve()}",
                f"--css={str(CSS_PATH.resolve())}",
                "--split-level=2",
                "--epub-title-page=false",
                "--toc=false",
                "--toc-depth=3",
                f"--epub-cover-image={self.cover_path}",
            ],
        )

    def _metadata(self):
        metadata = MetaData.model_validate(self.file.metadata.model_dump())

        data = metadata.model_dump(
            exclude_unset=True,
            exclude_none=True,
            exclude={"cover"},
            mode="json",  # dates, enums, etc. become plain YAML-safe types
        )
        data["cover"] = self._relative_path(self.cover_path, self.output_dir)
        if not data:
            return ""
        for key in ["creator", "contributor", "publisher"]:
            if data.get(key):
                data[key] = [x.strip() for x in data[key].split(";") if x.strip()]

        front = yaml.safe_dump(
            data,
            allow_unicode=True,  # keep non-ASCII text (e.g. Chinese) readable
            sort_keys=False,  # keep the model's field order
            default_flow_style=False,  # block style, lists as "- item"
            width=float("inf"),  # don't wrap long titles or descriptions
        )
        return f"---\n{front}---\n\n"
