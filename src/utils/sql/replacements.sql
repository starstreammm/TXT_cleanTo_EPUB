CREATE TABLE IF NOT EXISTS replacements (
    id TEXT PRIMARY KEY NOT NULL,
    original TEXT NOT NULL,
    replacement TEXT NOT NULL,
    match_case INTEGER NOT NULL,
    whole_word INTEGER NOT NULL,
    is_regex INTEGER NOT NULL
);
