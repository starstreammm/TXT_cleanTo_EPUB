from fastapi import APIRouter

from models import Replacement
from utils import database

replacement_router = APIRouter(prefix="/replacement", tags=["Saved Replacements"])


@replacement_router.get("", response_model=list[Replacement])
def get_replacements():
    return database.get_replacements()


@replacement_router.post("", response_model=list[Replacement])
def save_replacement(pair: Replacement):
    database.save_replacements([pair])
    return database.get_replacements()


@replacement_router.post("/import", response_model=None)
def import_replacements(pairs: list[Replacement]):
    database.save_replacements(pairs, importing=True)


@replacement_router.delete("/{id}", response_model=list[Replacement])
def delete_replacement(id: str):
    database.delete_replacement(id)
    return database.get_replacements()
