CREATE TABLE IF NOT EXISTS pattern_history (
    kind TEXT NOT NULL,
    entry_key TEXT NOT NULL,
    payload TEXT,
    last_used INTEGER NOT NULL,
    PRIMARY KEY (kind, entry_key)
);
