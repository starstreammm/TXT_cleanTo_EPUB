import asyncio
import filecmp
import os
import re
import shutil
import yaml
import aiofiles
from urllib.parse import quote, unquote
from pathlib import Path
from pypandoc import convert_file as pd_convert

from models import (
    ApiExecuteResponse,
    CSS_PATH,
    MetaData,
    TranConfig,
)
from core.file import FileBase
from core.logger import LoggerBase as lg
from core.parse import ParseBase as pa
from core.image import generate_cover, COVER_PATH

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

        self.image_paths: dict[tuple[Path, Path], Path] = {}
        self.image_counts: dict[Path, int] = {}
        self.cover_path: Path | None = None
        self.worker = asyncio.create_task(self._worker())
        self.done = False

    async def _worker(self):
        output_path = self.output_dir / f"{self.file.get_filename()}.md"
        try:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            prev_blank = True
            size = self.file.temp_file.stat().st_size
            async with (
                aiofiles.open(self.file.temp_file, "r", encoding="utf-8") as fin,
                aiofiles.open(output_path, "w", encoding="utf-8") as fout,
            ):
                await fout.write(self._metadata(output_path.parent))
                async for line in fin:
                    self.progress.progress = int((await fin.tell()) / size * 88)
                    sline, prev_blank = pa.match_line(line, prev_blank, self.file.type)
                    if sline:
                        await fout.write(
                            self._fix_image_path(sline, output_path.parent)
                        )

            await self._transformer(output_path)
            if not self.config.save_text:
                output_path.unlink(missing_ok=True)
            if self.config.del_origin:
                self.file.path.unlink(missing_ok=True)
            self.progress.progress = 100
            self.done = True
            lg.info(
                f"Successfully converted {self.file.get_filename()} to {self.config.output.resolve()}"
            )
        except Exception as error:
            self.progress.error = str(error)
            lg.exception(
                f"Error occurred while processing {self.file.get_filename()}: {error}"
            )
            output_path.with_suffix(".epub").unlink(missing_ok=True)

    def _fix_image_path(self, line: str, output_dir: Path) -> str:
        """
        Resolve image links, optionally staging images for a successful batch move.
        """
        output_dir = output_dir.resolve()

        def _replace(match: re.Match) -> str:
            alt = match.group("alt")
            raw_src = match.group("src")
            title = match.group("title") or ""

            src = raw_src[1:-1] if raw_src.startswith("<") else raw_src

            # Leave remote / data URIs alone.
            if _SCHEME_PATTERN.match(src):
                return match.group(0)

            img_path = Path(unquote(src))
            if not img_path.is_absolute():
                img_path = self.file.path.parent / img_path
            img_path = img_path.resolve()

            if not alt.strip():
                alt = img_path.name

            if not self.config.move_images:
                relative = self._relative_path(img_path, output_dir)
                return f"![{alt}]({relative}{title})"

            key = (output_dir, img_path)
            if key not in self.image_paths:
                if not img_path.is_file():
                    raise FileNotFoundError(f"Image not found: {img_path}")
                index = self.image_counts.get(output_dir, 0) + 1
                destination = output_dir / f"P{index}{img_path.suffix.lower()}"
                while destination.exists() and destination.resolve() != img_path:
                    index += 1
                    destination = output_dir / f"P{index}{img_path.suffix.lower()}"
                if destination.resolve() != img_path:
                    shutil.copy2(img_path, destination)
                self.image_counts[output_dir] = index
                self.image_paths[key] = destination

            return f"![{alt}](./{self.image_paths[key].name}{title})"

        return _IMAGE_PATTERN.sub(_replace, line)

    @staticmethod
    def _relative_path(path: Path, output_dir: Path) -> str:
        return "./" + quote(
            Path(os.path.relpath(path.resolve(), output_dir.resolve())).as_posix(),
            safe="/.-_",
        )

    def _cover_path(self, output_dir: Path) -> Path:
        if self.cover_path is not None:
            return self.cover_path

        source = self.file.metadata.cover
        if source is None or not source.is_file():
            generate_cover(
                self.file.uid,
                self.file.metadata.title,
                self.file.metadata.creator,
            )
            source = COVER_PATH / f"{self.file.uid}.jpg"

        elif not source.is_absolute():
            source = self.file.path.parent / source

        destination = source.resolve()
        if self.config.move_images:
            destination = output_dir / f"cover{source.suffix.lower()}"
            if destination != source:
                if destination.exists():
                    if not filecmp.cmp(source, destination, shallow=False):
                        raise FileExistsError(f"Cover already exists: {destination}")
                else:
                    shutil.copy2(source, destination)
            self.image_paths[(output_dir, source)] = destination

        self.cover_path = destination
        return destination

    async def _transformer(self, input: Path):
        await asyncio.to_thread(
            pd_convert,
            input,
            "epub3",
            format="markdown",
            outputfile=input.with_suffix(".epub"),
            extra_args=[
                f"--resource-path={input.parent.resolve()}",
                f"--css={str(CSS_PATH.resolve())}",
                "--split-level=2",
                "--epub-title-page=false",
                "--toc",
                "--toc-depth=2",
                f"--epub-cover-image={self._cover_path(input.parent)}",
            ],
        )

    def _metadata(self, output_dir: Path | None = None):
        metadata = MetaData.model_validate(self.file.metadata.model_dump())

        data = metadata.model_dump(
            exclude_unset=True,
            exclude_none=True,
            exclude={"cover"},
            mode="json",  # dates, enums, etc. become plain YAML-safe types
        )
        if output_dir is not None:
            data["cover"] = self._relative_path(
                self._cover_path(output_dir), output_dir
            )
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
