import asyncio
import logging
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from models import MetaData, TranConfig
from core.file import FileBase
from core.parse import MarkdownStandardizer
from core.queue import FilesQueue
from core.worker import TranWorker


class MarkdownTests(unittest.TestCase):
    def test_normalization_preserves_text_and_markdown_syntax(self):
        normalizer = MarkdownStandardizer()
        text = (
            "\n\n# Heading\n\n\n第1章 Keep this text\n广告 Keep this too\n"
            "\n  \nParagraph  \nnext line\n## Volume\nBody\n"
            "```md\n# Literal\n\n\n![](missing.png)\n```\n"
            "    # Indented code\n"
        )
        result = "".join(normalizer.line(line) for line in text.splitlines(True))
        self.assertEqual(
            result,
            (
                "# Heading\n\n第1章 Keep this text\n广告 Keep this too\n"
                "\nParagraph  \nnext line\n\n## Volume\n\nBody\n"
                "```md\n# Literal\n\n\n![](missing.png)\n```\n"
                "    # Indented code\n"
            ),
        )

    def test_open_markdown_reads_relative_cover_and_optional_creators(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            cover = root / "my cover.png"
            cover.write_bytes(b"cover")
            book = root / "Book.md"
            for key in ("cover", "cover-image"):
                for creator in ("", "creator: Author\n", "creator: [Alice, Bob]\n"):
                    with self.subTest(key=key, creator=creator):
                        book.write_text(
                            f"---\ntitle: Book\n{creator}{key}: ./my%20cover.png\n---\n# Body\n",
                            encoding="utf-8",
                        )
                        with (
                            patch("src.file.TEMP_PATH", root),
                            patch("src.file.lg", logging.getLogger(__name__)),
                        ):
                            file = FileBase(book)
                        self.assertEqual(file.metadata.cover, cover.resolve())
                        self.assertEqual(file.temp_file.read_text(), "# Body\n")
                        expected = (
                            "Alice; Bob"
                            if "[Alice" in creator
                            else "Author" if creator else None
                        )
                        self.assertEqual(file.metadata.creator, expected)


class ConversionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.source = self.root / "source"
        self.source.mkdir()
        self.cover = self.source / "original cover.jpg"
        self.cover.write_bytes(b"cover")
        self.photo = self.source / "photo one.png"
        self.photo.write_bytes(b"photo")
        self.output = self.root / "output"
        self.addCleanup(patch.stopall)
        patch("src.worker.lg", logging.getLogger(__name__)).start()
        patch("src.file.lg", logging.getLogger(__name__)).start()

    def file(self, title="Book", text=None, cover=True):
        book = self.source / f"{title}.md"
        book.write_text(
            (
                text
                if text is not None
                else (
                    "\n# Chapter\n\n\n![Photo](<photo one.png>)\n"
                    "\n\n第1章 Keep\n广告 Keep\n"
                )
            ),
            encoding="utf-8",
        )
        return SimpleNamespace(
            path=book,
            temp_file=book,
            uid=title,
            type="md",
            metadata=MetaData(title=title, cover=self.cover if cover else None),
            get_filename=lambda: title,
        )

    async def convert(self, input_path):
        input_path.with_suffix(".epub").write_bytes(b"epub")

    async def run_batch(self, files, move=True, **options):
        config = TranConfig(
            output=self.output, move_images=move, save_text=True, **options
        )
        workers = [TranWorker(file, config) for file in files]
        await FilesQueue._finish_batch(workers)
        return workers

    async def test_move_shared_images_and_round_trip_cover(self):
        with patch.object(TranWorker, "_transformer", self.convert):
            workers = await self.run_batch([self.file("One"), self.file("Two")])
        self.assertTrue(all(worker.done for worker in workers))
        self.assertFalse(self.cover.exists())
        self.assertFalse(self.photo.exists())
        for title in ("One", "Two"):
            folder = self.output / title
            self.assertEqual((folder / "cover.jpg").read_bytes(), b"cover")
            self.assertEqual((folder / "P1.png").read_bytes(), b"photo")
            markdown = folder / f"{title}.md"
            text = markdown.read_text()
            self.assertIn("cover: ./cover.jpg", text)
            self.assertIn("![Photo](./P1.png)", text)
            self.assertIn("第1章 Keep\n广告 Keep", text)
            self.assertNotIn("\n\n\n", text)
            with patch("src.file.TEMP_PATH", self.root):
                reopened = FileBase(markdown)
            self.assertEqual(reopened.metadata.cover, (folder / "cover.jpg").resolve())

    async def test_switch_off_keeps_sources_and_resolves_relative_links(self):
        with patch.object(TranWorker, "_transformer", self.convert):
            workers = await self.run_batch([self.file()], move=False)
        self.assertTrue(workers[0].done)
        folder = self.output / "Book"
        self.assertFalse((folder / "P1.png").exists())
        self.assertFalse((folder / "cover.jpg").exists())
        text = (folder / "Book.md").read_text()
        self.assertIn("![Photo](./../../source/photo%20one.png)", text)
        self.assertIn("cover: ./../../source/original%20cover.jpg", text)
        self.assertTrue(self.cover.exists())
        self.assertTrue(self.photo.exists())

    async def test_failed_split_preserves_sources_and_original_book(self):
        file = self.file(text="# One\n![Photo](<photo one.png>)\n# Two\nText\n")

        async def fail_first(worker, input_path):
            if "c0001" in input_path.name:
                await asyncio.sleep(0.01)
                raise RuntimeError("Conversion failed")
            await self.convert(input_path)

        with patch.object(TranWorker, "_transformer", fail_first):
            workers = await self.run_batch(
                [file], chapter_separatly=True, del_origin=True
            )
        self.assertEqual(workers[0].progress.error, "Conversion failed")
        self.assertFalse(workers[0].done)
        self.assertTrue(file.path.exists())
        self.assertTrue(self.cover.exists())
        self.assertTrue(self.photo.exists())

    async def test_fenced_headings_and_images_are_not_processed(self):
        file = self.file(
            text="# Chapter\n```md\n# Example\n![](missing.png)\n\n\n```\n"
        )
        with patch.object(TranWorker, "_transformer", self.convert):
            workers = await self.run_batch([file], chapter_separatly=True)
        self.assertTrue(workers[0].done)
        markdown = list(self.output.rglob("*.md"))
        self.assertEqual(len(markdown), 1)
        self.assertIn("# Example\n![](missing.png)\n\n\n```", markdown[0].read_text())

    async def test_generated_cover_is_saved_and_recorded(self):
        def generate(uid, title, author):
            (self.root / f"{uid}.jpg").write_bytes(b"generated")

        with (
            patch("src.worker.COVER_PATH", self.root),
            patch("src.worker.generate_cover", generate),
            patch.object(TranWorker, "_transformer", self.convert),
        ):
            workers = await self.run_batch([self.file(cover=False)])
        self.assertTrue(workers[0].done)
        self.assertEqual(
            (self.output / "Book" / "cover.jpg").read_bytes(), b"generated"
        )
        self.assertIn(
            "cover: ./cover.jpg", (self.output / "Book" / "Book.md").read_text()
        )

    async def test_conflicting_cover_is_not_overwritten(self):
        folder = self.output / "Book"
        folder.mkdir(parents=True)
        (folder / "cover.jpg").write_bytes(b"existing cover")
        with patch.object(TranWorker, "_transformer", self.convert):
            workers = await self.run_batch([self.file()])
        self.assertIn("Cover already exists", workers[0].progress.error)
        self.assertEqual((folder / "cover.jpg").read_bytes(), b"existing cover")
        self.assertTrue(self.cover.exists())
        self.assertTrue(self.photo.exists())


if __name__ == "__main__":
    unittest.main()
