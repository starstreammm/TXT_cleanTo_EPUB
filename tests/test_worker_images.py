import asyncio
import logging
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from zipfile import ZipFile

import pypandoc
from PIL import Image

from models import MetaData, TranConfig
from core.worker import TranWorker


class ImageOutputTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.source = self.root / "source"
        self.source.mkdir()
        self.output = self.root / "output"
        self.output.mkdir()
        self.worker = TranWorker.__new__(TranWorker)
        self.worker.file = SimpleNamespace(path=self.source / "book.md")
        self.worker.config = TranConfig(output=self.output, move_images=True)
        self.worker.image_paths = {}
        self.worker.image_counts = {}

    def test_numbered_relative_links_and_duplicate_references(self):
        first = self.source / "photo one.JPG"
        second = self.source / "diagram.png"
        first.write_bytes(b"first image")
        second.write_bytes(b"second image")
        result = self.worker._fix_image_path(
            '![Photo](<photo one.JPG> "Caption") '
            "![](photo%20one.JPG) ![Diagram](diagram.png)",
            self.output,
        )
        self.assertEqual(
            result,
            '![Photo](./P1.jpg "Caption") '
            "![photo one.JPG](./P1.jpg) ![Diagram](./P2.png)",
        )
        self.assertEqual((self.output / "P1.jpg").read_bytes(), first.read_bytes())
        self.assertEqual((self.output / "P2.png").read_bytes(), second.read_bytes())
        self.assertEqual(len(list(self.output.iterdir())), 2)
        self.assertTrue(first.is_file())
        self.assertTrue(second.is_file())

    def test_each_output_folder_gets_its_own_copy(self):
        image = self.source / "photo.png"
        image.write_bytes(b"image")
        for name in ("v01", "v02"):
            folder = self.output / name
            folder.mkdir()
            result = self.worker._fix_image_path(f"![Photo]({image})", folder)
            self.assertEqual(result, "![Photo](./P1.png)")
            self.assertEqual((folder / "P1.png").read_bytes(), b"image")

    def test_same_basenames_and_existing_files_are_not_overwritten(self):
        (self.output / "P1.png").write_bytes(b"existing")
        for name in ("a", "b"):
            folder = self.source / name
            folder.mkdir()
            (folder / "photo.png").write_bytes(name.encode())
        result = self.worker._fix_image_path(
            "![A](a/photo.png) ![B](b/photo.png)", self.output
        )
        self.assertEqual(result, "![A](./P2.png) ![B](./P3.png)")
        self.assertEqual((self.output / "P1.png").read_bytes(), b"existing")
        self.assertEqual((self.output / "P2.png").read_bytes(), b"a")
        self.assertEqual((self.output / "P3.png").read_bytes(), b"b")

    def test_remote_images_are_unchanged(self):
        line = '![Remote](https://example.com/photo.jpg "Title") ![](data:image/png;base64,AAAA)'
        self.assertEqual(self.worker._fix_image_path(line, self.output), line)
        self.assertEqual(list(self.output.iterdir()), [])

    def test_missing_image_has_a_clear_error(self):
        with self.assertRaisesRegex(FileNotFoundError, "Image not found"):
            self.worker._fix_image_path("![](missing.png)", self.output)

    def test_metadata_no_longer_accepts_series_index(self):
        metadata = MetaData(title="Book", series_index=42)
        self.assertNotIn("series_index", metadata.model_dump())
        self.assertNotIn("series_index", MetaData.model_json_schema()["properties"])


class TrackingWorker(TranWorker):
    """Track background conversions so tests wait for every generated EPUB."""

    def __init__(self, *args):
        self.conversions = set()
        super().__init__(*args)

    async def _callback_generate_md(self, input_path):
        self.conversions.add(asyncio.current_task())
        await super()._callback_generate_md(input_path)


class EpubImageIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_images_embed_and_links_stay_local_in_all_split_modes(self):
        try:
            pypandoc.get_pandoc_path()
        except OSError:
            self.skipTest("Pandoc is required for EPUB integration tests")

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            source.mkdir()
            photo = source / "photo with spaces.png"
            Image.new("RGB", (10, 10), "red").save(photo)
            cover = source / "cover.jpg"
            Image.new("RGB", (10, 10), "blue").save(cover)
            book = source / "Book.md"
            book.write_text(
                "## Volume One\n\n# Chapter One\n\n![Photo](<photo with spaces.png>)\n"
                "\n# Chapter Two\n\n![Photo](photo%20with%20spaces.png)\n"
                "\n## Volume Two\n\n# Chapter Three\n\n![Photo](<photo with spaces.png>)",
                encoding="utf-8",
            )
            file = SimpleNamespace(
                path=book,
                temp_file=book,
                uid="test",
                type="md",
                metadata=MetaData(title="Book", cover=cover),
                get_filename=lambda: "Book",
            )
            for chapters, volumes, save_text in (
                (False, False, True),
                (True, False, True),
                (False, True, True),
                (True, True, True),
                (False, False, False),
            ):
                with self.subTest(
                    chapters=chapters, volumes=volumes, save_text=save_text
                ):
                    output = root / f"output {chapters} {volumes} {save_text}"
                    config = TranConfig(
                        output=output,
                        move_images=True,
                        chapter_separatly=chapters,
                        volume_separatly=volumes,
                        save_text=save_text,
                    )
                    with patch("src.worker.lg", logging.getLogger(__name__)):
                        worker = TrackingWorker(file, config)
                        await worker.worker
                        await asyncio.gather(*worker.conversions)
                    self.assertIsNone(worker.progress.error)
                    self.assertTrue(worker.done)
                    epubs = list(output.rglob("*.epub"))
                    self.assertTrue(epubs)
                    embedded_images = 0
                    for epub in epubs:
                        with ZipFile(epub) as archive:
                            opf = next(
                                n for n in archive.namelist() if n.endswith(".opf")
                            )
                            self.assertNotIn(b"calibre:series", archive.read(opf))
                            if any(
                                archive.read(n) == photo.read_bytes()
                                for n in archive.namelist()
                                if n.endswith(".png")
                            ):
                                embedded_images += 1
                                self.assertEqual(
                                    (epub.parent / "P1.png").read_bytes(),
                                    photo.read_bytes(),
                                )
                    self.assertEqual(
                        embedded_images, 3 if chapters else 2 if volumes else 1
                    )
                    markdown_files = list(output.rglob("*.md"))
                    self.assertEqual(bool(markdown_files), save_text)
                    for markdown in markdown_files:
                        text = markdown.read_text(encoding="utf-8")
                        self.assertNotIn(str(source), text)
                        if "![Photo]" in text:
                            self.assertIn("![Photo](./P1.png)", text)
                            self.assertTrue((markdown.parent / "P1.png").is_file())
                    self.assertTrue(book.is_file())
                    self.assertTrue(photo.is_file())


if __name__ == "__main__":
    unittest.main()
