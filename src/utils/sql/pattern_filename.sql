CREATE TABLE IF NOT EXISTS pattern_filename (
    position INTEGER PRIMARY KEY,
    enable INTEGER NOT NULL,
    alias TEXT NOT NULL,
    pattern TEXT NOT NULL
);
