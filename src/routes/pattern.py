import re
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException
from utils import database
from utils.queue import FilesQueue
from models import (
    HeadingConfiguration,
    HeadingHistoryEntry,
    HeadingType,
    Pattern,
)
from utils.parse import ParseBase as pa

pattern_router = APIRouter(prefix="/pattern", tags=["Pattern"])


@pattern_router.get("/history")
def history(category: HeadingType | None = None):
    return database.get_history(category)


@pattern_router.delete("/history", status_code=204)
def delete_history_entry(
    category: HeadingType,
    pattern: Annotated[str, Body()],
    replacement: Annotated[str, Body()],
) -> None:
    database.delete_heading_rule(category, pattern, replacement)


def heading_source(uid: str) -> str:
    try:
        return str(FilesQueue.get_file_instance(uid).path.resolve())
    except ValueError as error:
        raise HTTPException(404, str(error)) from error


def validate_heading_settings(settings: HeadingConfiguration) -> None:
    try:
        for category, config in settings.items():
            pa.compile_rules(category, config.patterns)
    except (ValueError, re.error) as error:
        raise HTTPException(422, str(error)) from error


@pattern_router.get("/settings/history", response_model=list[HeadingHistoryEntry])
def settings_history():
    return database.get_heading_history()


@pattern_router.get("/settings", response_model=HeadingConfiguration)
def file_settings(uid: str):
    return database.get_heading_settings(heading_source(uid))


@pattern_router.put("/settings", response_model=None)
def save_file_settings(uid: str, settings: HeadingConfiguration):
    source = heading_source(uid)
    validate_heading_settings(settings)
    database.save_heading_settings(source, settings)


@pattern_router.get("/filename", response_model=list[Pattern])
def get_filename_patterns():
    return pa.get_filename_patterns()


@pattern_router.put("/filename", response_model=None)
async def save_filename_patterns(patterns: list[Pattern]):
    try:
        await pa.update_filename_patterns(patterns)
    except (ValueError, re.error) as error:
        raise HTTPException(422, str(error)) from error


@pattern_router.post("/filename/reset", response_model=list[Pattern])
async def reset_filename_patterns():
    await pa.reset_filename_patterns()
    return pa.get_filename_patterns()
