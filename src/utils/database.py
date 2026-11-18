import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable, get_args

from pydantic import TypeAdapter

from models import (
    DATA_PATH,
    HeadingConfiguration,
    HeadingHistoryEntry,
    HeadingSettings,
    HeadingType,
    Pattern,
    Replacement,
)

DATABASE_PATH = DATA_PATH / "data.sqlite"
SQL_PATH = Path(__file__).with_name("sql")
CONFIGURATION = TypeAdapter(HeadingConfiguration)
INSERT_FILENAME = "INSERT INTO pattern_filename VALUES (?, ?, ?, ?)"
UPSERT_HISTORY = """
    INSERT INTO pattern_history (kind, entry_key, payload, last_used) VALUES (?, ?, ?, ?)
    ON CONFLICT(kind, entry_key) DO UPDATE SET
        payload = excluded.payload, last_used = excluded.last_used
"""


@contextmanager
def connect():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize(defaults: list[Pattern]) -> None:
    DATA_PATH.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        connection.execute("BEGIN IMMEDIATE")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version not in (0, 4, 5):
            raise RuntimeError(
                f"Unsupported SQLite schema version {version}. Move {DATABASE_PATH} aside "
                "to initialize a new database."
            )

        for table in ("pattern_filename", "pattern_history", "replacements"):
            connection.execute((SQL_PATH / f"{table}.sql").read_text(encoding="utf-8"))

        if version == 0:
            connection.executemany(
                INSERT_FILENAME,
                [
                    (index, rule.enable, rule.alias, rule.pattern)
                    for index, rule in enumerate(defaults)
                ],
            )
        if version == 4:
            # Older rule pairs have no type. Recover it from saved configurations.
            connection.execute("""
                WITH configurations(settings) AS (
                    SELECT entry_key FROM pattern_history WHERE kind = 'heading_configuration'
                    UNION ALL
                    SELECT payload FROM pattern_history WHERE kind = 'heading_settings'
                )
                INSERT OR IGNORE INTO pattern_history (kind, entry_key, last_used)
                SELECT DISTINCT heading.key, old.entry_key, old.last_used
                FROM configurations, json_each(settings) AS heading,
                    json_each(heading.value, '$.patterns') AS rule
                JOIN pattern_history AS old ON old.kind = 'heading_rule'
                    AND json_extract(old.entry_key, '$[0]') = json_extract(rule.value, '$.pattern')
                    AND json_extract(old.entry_key, '$[1]') = json_extract(rule.value, '$.replacement')
                WHERE json_extract(rule.value, '$.enable') = 1
            """)
        if version != 5:
            connection.execute("PRAGMA user_version = 5")


def get_filename_patterns() -> list[Pattern]:
    with connect() as connection:
        return [
            Pattern.model_validate(dict(row))
            for row in connection.execute(
                "SELECT enable, alias, pattern FROM pattern_filename ORDER BY position"
            )
        ]


def save_filename_patterns(patterns: list[Pattern]) -> None:
    with connect() as connection:
        connection.execute("DELETE FROM pattern_filename")
        connection.executemany(
            INSERT_FILENAME,
            [
                (index, rule.enable, rule.alias, rule.pattern)
                for index, rule in enumerate(patterns)
            ],
        )
        record_filename_history(
            connection, (rule.pattern for rule in patterns if rule.enable)
        )


def record_filename_history(connection, patterns: Iterable[str]) -> None:
    connection.executemany(
        UPSERT_HISTORY,
        [("filename", pattern, None, time.time_ns()) for pattern in patterns],
    )


def get_history(category: HeadingType | None = None):
    with connect() as connection:
        filenames = []
        rules = []
        for row in connection.execute(
            """SELECT entry_key FROM pattern_history WHERE kind = 'filename'
            ORDER BY last_used DESC, entry_key"""
        ):
            filenames.append(row["entry_key"])
        kinds = (category,) if category else ("heading_rule", *get_args(HeadingType))
        placeholders = ", ".join("?" for _ in kinds)
        for row in connection.execute(
            f"""SELECT entry_key FROM pattern_history WHERE kind IN ({placeholders})
            GROUP BY entry_key ORDER BY MAX(last_used) DESC, entry_key""",
            kinds,
        ):
            pattern, replacement = json.loads(row["entry_key"])
            rules.append({"pattern": pattern, "replacement": replacement})
        return {"file": filenames, "rules": rules}


def get_heading_settings(source: str) -> HeadingConfiguration:
    with connect() as connection:
        row = connection.execute(
            "SELECT payload FROM pattern_history WHERE kind = 'heading_settings' AND entry_key = ?",
            (source,),
        ).fetchone()
        return CONFIGURATION.validate_json(row["payload"]) if row else {}


def record_heading_rules(
    connection, rules: Iterable[tuple[HeadingType, str, str]]
) -> None:
    connection.executemany(
        UPSERT_HISTORY,
        [
            (
                category,
                json.dumps((pattern, replacement), ensure_ascii=False),
                None,
                time.time_ns(),
            )
            for category, pattern, replacement in rules
        ],
    )


def delete_heading_rule(category: HeadingType, pattern: str, replacement: str) -> None:
    with connect() as connection:
        connection.execute(
            "DELETE FROM pattern_history WHERE kind = ? AND entry_key = ?",
            (category, json.dumps((pattern, replacement), ensure_ascii=False)),
        )


def record_heading_history(
    connection, source: str, settings: HeadingConfiguration
) -> None:
    if not any(config.patterns for config in settings.values()):
        return
    snapshot = {
        category: settings.get(category, HeadingSettings(patterns=[])).model_dump(
            exclude={"patterns": {"__all__": {"alias"}}},
        )
        for category in get_args(HeadingType)
    }
    serialized = json.dumps(snapshot, sort_keys=True, ensure_ascii=False)
    connection.execute(
        UPSERT_HISTORY,
        ("heading_configuration", serialized, Path(source).name, time.time_ns()),
    )


def get_heading_history() -> list[HeadingHistoryEntry]:
    with connect() as connection:
        return [
            HeadingHistoryEntry(
                source_name=row["payload"],
                last_used=row["last_used"] // 1_000_000,
                settings=json.loads(row["entry_key"]),
            )
            for row in connection.execute(
                """SELECT entry_key, payload, last_used FROM pattern_history
                WHERE kind = 'heading_configuration' ORDER BY last_used DESC, entry_key"""
            )
        ]


def save_heading_settings(source: str, settings: HeadingConfiguration) -> None:
    with connect() as connection:
        connection.execute(
            UPSERT_HISTORY,
            (
                "heading_settings",
                source,
                CONFIGURATION.dump_json(settings).decode("utf-8"),
                time.time_ns(),
            ),
        )


def get_replacements() -> list[Replacement]:
    with connect() as connection:
        return [
            Replacement.model_validate(dict(row))
            for row in connection.execute(
                """SELECT id, original, replacement, match_case AS matchCase,
                    whole_word AS wholeWord, is_regex AS isRegex
                FROM replacements ORDER BY rowid"""
            )
        ]


def save_replacements(pairs: list[Replacement], *, importing: bool = False) -> None:
    conflict = (
        "DO NOTHING"
        if importing
        else """DO UPDATE SET original = excluded.original,
            replacement = excluded.replacement, match_case = excluded.match_case,
            whole_word = excluded.whole_word, is_regex = excluded.is_regex"""
    )
    with connect() as connection:
        connection.executemany(
            f"INSERT INTO replacements VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) {conflict}",
            [
                (
                    pair.id,
                    pair.original,
                    pair.replacement,
                    pair.matchCase,
                    pair.wholeWord,
                    pair.isRegex,
                )
                for pair in pairs
            ],
        )


def delete_replacement(id: str) -> None:
    with connect() as connection:
        connection.execute("DELETE FROM replacements WHERE id = ?", (id,))
