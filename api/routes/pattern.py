from fastapi import APIRouter
from models import Pattern, PatternType
from src.parse import ParseBase as pa

pattern_router = APIRouter(prefix="/pattern", tags=["Pattern"])


@pattern_router.get("/{type}", response_model=list[Pattern])
async def get_pattern(type: PatternType):
    return pa.get(type)


@pattern_router.post("/{type}/update", response_model=None)
async def update_pattern(patterns: list[Pattern], type: PatternType):
    await pa.update(type, patterns)


@pattern_router.post("/{type}/reset", response_model=list[Pattern])
async def reset_default_pattern(type: PatternType):
    await pa.reset_default(type)
    return pa.get(type)
