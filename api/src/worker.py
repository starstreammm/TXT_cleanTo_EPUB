import asyncio
import re
import yaml
import aiofiles
from aiofiles.threadpool.text import AsyncTextIOWrapper
from urllib.parse import unquote
from pathlib import Path
from pypandoc import convert_file as pd_convert
from zipfile import ZipFile

from models import (
    ApiExecuteResponse,
    CSS_PATH,
    MetaData,
    TranConfig,
)
from src.file import FileBase
from src.logger import LoggerBase as lg
from src.parse import ParseBase as pa
from src.image import generate_cover, COVER_PATH

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
        self.progress = ApiExecuteResponse(filename=file.get_filename())
        self.output_dir = self.config.output / self.file.get_filename()

        self.output_pin: tuple[Path, AsyncTextIOWrapper] | None = None
        self.position = 0.0
        self.volume_index = 0
        self.chapter_index = self.file.metadata.series_index or 0
        self.worker = asyncio.create_task(self._worker())
        self.done = False

    async def _worker(self):
        try:
            last_line_empty = True
            if self.file.metadata.cover is None:
                generate_cover(
                    self.file.uid,
                    self.file.metadata.title,
                    self.file.metadata.creator,
                )
            async with aiofiles.open(self.file.temp_file, "r", encoding="utf-8") as fin:
                async for line in fin:
                    # Update progress
                    self.position = (
                        await fin.tell()
                    ) / self.file.temp_file.stat().st_size
                    self.progress.progress = int(self.position * 88)

                    # Process line based on file type
                    if self.file.type == "txt":
                        sline, last_line_empty = pa.match_line(line, last_line_empty)
                    else:
                        if last_line_empty and line.strip() == "":
                            sline = ""
                        else:
                            last_line_empty = False
                            sline = line
                    sline = self._fix_image_path(sline)

                    # Volume
                    if sline.lstrip().startswith("## "):
                        self.volume_index += 1
                        changed = await self._get_next_output_path()
                        assert self.output_pin is not None
                        if changed:
                            await self.output_pin[1].write(sline.lstrip())
                        else:
                            await self.output_pin[1].write(sline)

                    # Chapter
                    elif sline.lstrip().startswith("# "):
                        self.chapter_index += 1
                        changed = await self._get_next_output_path(sline.strip()[2:])
                        assert self.output_pin is not None
                        if changed:
                            await self.output_pin[1].write(sline.lstrip())
                        else:
                            await self.output_pin[1].write(sline)

                    else:
                        if self.output_pin is None:
                            await self._get_next_output_path()
                        assert self.output_pin is not None
                        await self.output_pin[1].write(sline)

            assert self.output_pin is not None
            await self.output_pin[1].close()
            await self._callback_generate_md(self.output_pin[0], self.chapter_index)

        except Exception as e:
            self.progress.error = str(e)
            lg.exception(
                f"Error occurred while processing {self.file.get_filename()}: {e}"
            )

        else:
            if self.config.del_origin:
                self.file.path.unlink(missing_ok=True)

            self.progress.progress = 100
            lg.info(
                f"Successfully converted {self.file.get_filename()} to {self.config.output.resolve()}"
            )
            self.done = True

    def _fix_image_path(self, line: str) -> str:
        """
        Fix the image path in a markdown line.
        """

        def _replace(match: re.Match) -> str:
            alt = match.group("alt")
            raw_src = match.group("src")
            title = match.group("title") or ""

            src = raw_src[1:-1] if raw_src.startswith("<") else raw_src

            # Leave remote / data URIs alone (only fix the label if needed)
            if _SCHEME_PATTERN.match(src):
                return match.group(0)

            img_path = Path(unquote(src))
            if not img_path.is_absolute():
                img_path = self.file.path.parent / img_path
            img_path = img_path.resolve()

            if not alt.strip():
                alt = img_path.name

            new_src = img_path.as_posix()
            if " " in new_src:
                new_src = (
                    f"<{new_src}>"  # keep the markdown valid when the path has spaces
                )

            return f"![{alt}]({new_src}{title})"

        return _IMAGE_PATTERN.sub(_replace, line)

    async def _callback_generate_md(self, input_path: Path, index: int):
        """
        The callback function of the markdown file.
        """
        if not self.output_pin:
            raise RuntimeError("Output pin is not initialized.")

        try:
            await self._transformer(input_path)

        except Exception as e:
            input_path.with_suffix(".epub").unlink(missing_ok=True)
            self.progress.error = str(e)
            lg.exception(f"Transforming {input_path.resolve()}: {e}")

        else:
            if self.config.chapter_separatly or self.file.metadata.series_index:
                await self._separate_tag(
                    input_path.with_suffix(".epub"),
                    (self.file.metadata.series_index or 1) - 1 + index,
                )

        finally:
            if not self.config.save_text:
                input_path.unlink(missing_ok=True)
            self.progress.progress = int(self.position)

    async def _get_next_output_path(self, title: str = "") -> bool:
        # Determine the next output path based on the configuration and current indices.
        if self.config.chapter_separatly and self.config.volume_separatly:
            next_path = (
                self.output_dir
                / f"v{self.volume_index:02d}"
                / f"{self.file.get_filename()}_v{self.volume_index:02d}_c{self.chapter_index:04d}.md"
            )

        elif self.config.chapter_separatly:
            next_path = (
                self.output_dir
                / f"{self.file.get_filename()}_c{self.chapter_index:04d}.md"
            )

        elif self.config.volume_separatly:
            next_path = (
                self.output_dir
                / f"{self.file.get_filename()}_v{self.volume_index:02d}.md"
            )

        else:
            next_path = self.output_dir / f"{self.file.get_filename()}.md"

        # Check if the output pin needs to be updated
        changed = False
        if self.output_pin is None:
            changed = True
        elif self.output_pin[0] != next_path:
            await self.output_pin[1].close()

            def _callback(fut: asyncio.Task):
                try:
                    fut.result()
                except Exception as e:
                    self.progress.error = str(e)
                    lg.exception(f"Error in callback for {next_path}: {e}")

            asyncio.create_task(
                self._callback_generate_md(self.output_pin[0], self.chapter_index),
            ).add_done_callback(_callback)
            changed = True

        # If needed, open a new output file and write the metadata.
        if changed:
            next_path.parent.mkdir(parents=True, exist_ok=True)
            self.output_pin = (
                next_path,
                await aiofiles.open(next_path, "w", encoding="utf-8").__aenter__(),
            )
            await self.output_pin[1].write(
                self._metadata(title if self.config.chapter_separatly else "")
            )

        return changed

    async def _transformer(self, input: Path):
        await asyncio.to_thread(
            pd_convert,
            input,
            "epub3",
            format="markdown",
            outputfile=input.with_suffix(".epub"),
            extra_args=[
                f"--css={str(CSS_PATH.resolve())}",
                "--split-level=2",
                "--epub-title-page=false",
                *(
                    [
                        "--toc",
                        "--toc-depth=1",
                    ]
                    if self.config.chapter_separatly
                    else []
                ),
                f"--epub-cover-image={
                    self.file.metadata.cover.resolve() 
                    if self.file.metadata.cover 
                    else COVER_PATH / f'{self.file.uid}.jpg'
                }",
            ],
        )

    async def _separate_tag(self, equb: Path, index: int):
        with ZipFile(equb, "r") as zin:
            opf = next(name for name in zin.namelist() if name.endswith(".opf"))
            temp = equb.with_suffix(f".temp_{index}")
            try:
                with ZipFile(temp, "w") as zout:
                    for info in zin.infolist():
                        data = zin.read(info.filename)
                        if info.filename == opf:
                            text = data.decode("utf-8")

                            insert = (
                                f'<meta name="calibre:series" '
                                f'content="{self.file.get_filename()}"/>\n'
                                f'<meta name="calibre:series_index" '
                                f'content="{index}"/>\n'
                            )

                            text = text.replace(
                                "</metadata>",
                                insert + "</metadata>",
                                1,
                            )

                            data = text.encode("utf-8")

                        zout.writestr(info, data)

                temp.replace(equb)

            except Exception as e:
                temp.unlink(missing_ok=True)
                raise Exception(
                    f"Equb generated successfully, but failed to add series index: {e}"
                )

    def _metadata(self, seperate: str = ""):
        metadata = MetaData.model_validate(self.file.metadata.model_dump())
        if seperate:
            metadata.title = seperate

        data = metadata.model_dump(
            exclude_unset=True,
            exclude_none=True,
            exclude={"series_index", "cover"},
            mode="json",  # dates, enums, etc. become plain YAML-safe types
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
