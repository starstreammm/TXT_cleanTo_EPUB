from pydantic import BaseModel, Field, field_serializer, field_validator
from pathlib import Path
from typing import Literal, Optional
from datetime import datetime, timezone

# const
VERSION = "1.2.0"
TEXT_SUFFIXES = [".txt", ".md"]
TEXT_TYPE = Literal["txt", "md"]

DATA_PATH = Path(__file__).resolve().parent.parent / "cache"
CSS_PATH = Path(__file__).resolve().parent.parent / "public" / "epub.css"

HeadingType = Literal["volume", "chapter", "section"]


# Models
class TranConfig(BaseModel):
    output: Path

    save_text: bool = False
    move_images: bool = False
    del_origin: bool = False


class ApiExecuteResponse(BaseModel):
    uid: str
    filename: str
    progress: int = 0
    error: str | None = None
    warning: str | None = None


class MetaData(BaseModel):
    title: str
    creator: Optional[str] = None
    contributor: Optional[str] = None
    publisher: Optional[str] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    language: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    cover: Optional[Path] = None

    @field_validator("cover", mode="before")
    @classmethod
    def normalize_cover(cls, value: str | Path | None) -> str | Path | None:
        return None if value == "" else value

    @field_serializer("date", when_used="json")
    def serialize_date(self, date: datetime) -> str:
        return date.strftime("%Y-%m-%d")


class ApiUpdateFileInfo(MetaData):
    uid: str
    filename: str


class FileInfo(ApiUpdateFileInfo):
    type: TEXT_TYPE
    source_name: str
    size: int
    modified_at: datetime


class PathEntry(BaseModel):
    name: str
    is_file: bool


class Pattern(BaseModel):
    enable: bool = True
    alias: str = ""
    pattern: str
    replacement: str | None = None


class HeadingSettings(BaseModel):
    patterns: list[Pattern]
    restart: bool = True


HeadingConfiguration = dict[HeadingType, HeadingSettings]


class HeadingHistoryEntry(BaseModel):
    source_name: str
    last_used: int
    settings: HeadingConfiguration


class Replacement(BaseModel):
    id: str = Field(min_length=1)
    original: str = Field(min_length=1)
    replacement: str
    matchCase: bool = True
    wholeWord: bool = False
    isRegex: bool = False
