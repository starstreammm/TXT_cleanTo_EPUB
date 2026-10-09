from pydantic import BaseModel, Field, field_serializer
from pathlib import Path
from typing import Literal, Optional
from datetime import datetime, timezone

# const
VERSION = "1.0.0"
TEXT_SUFFIXES = [".txt", ".md"]
TEXT_TYPE = Literal["txt", "md"]
PIC_SUFFIXES = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"]
SUPPORTED_SUFFIXES = TEXT_SUFFIXES + PIC_SUFFIXES

DATA_PATH = Path(__file__).resolve().parent.parent / "data"
CSS_PATH = Path(__file__).resolve().parent / "epub.css"

PatternType = Literal["file", "chapter", "adv", "volume"]


# Models
class TranConfig(BaseModel):
    output: Path

    chapter_separatly: bool = False
    volume_separatly: bool = False

    save_text: bool = False
    del_origin: bool = False


class ApiExecuteResponse(BaseModel):
    filename: str
    progress: int = 0
    error: str | None = None


class MetaData(BaseModel):
    title: str
    creator: Optional[str] = None
    contributor: Optional[str] = None
    publisher: Optional[str] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    language: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    series_index: int | None = None
    cover: Optional[Path] = None

    @field_serializer("date", when_used="json")
    def serialize_date(self, date: datetime) -> str:
        return date.strftime("%Y-%m-%d")


class ApiUpdateFileInfo(MetaData):
    uid: str
    filename: str


class FileInfo(ApiUpdateFileInfo):
    type: TEXT_TYPE


class Pattern(BaseModel):
    enable: bool = True
    alias: str
    pattern: str
