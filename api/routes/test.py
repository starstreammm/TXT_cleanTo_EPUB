from fastapi import APIRouter, HTTPException, Query
from src.parse import ParseBase as pa

test_router = APIRouter(prefix="/test", tags=["Test"])


@test_router.get("/chinese_to_int", response_model=int)
async def test_chinese_to_int(
    s: str = Query(..., description="Chinese number to convert")
):
    try:
        return pa._chinese_to_int(s)
    except Exception as e:
        print(str(e))
        raise HTTPException(status_code=400, detail=str(e))


@test_router.get("/int_to_chinese", response_model=str)
async def test_int_to_chinese(num: int = Query(..., description="Integer to convert")):
    try:
        return pa._int_to_chinese(num)
    except Exception as e:
        print(str(e))
        raise HTTPException(status_code=400, detail=str(e))
