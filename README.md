<div align="center">
  <img src="./public/Icon-square.svg" alt="structure" width="288" />
  <br />
  <br />
  <img alt="Node Current" src="https://img.shields.io/node/v/%40rolldown%2Fplugin-babel">
  <img alt="Python Version" src="https://img.shields.io/badge/python-3.10%2B-blue">
  <img alt="GitHub License" src="https://img.shields.io/github/license/StarStreammm/TXT_cleanTo_EPUB">
  <img alt="GitHub Release" src="https://img.shields.io/github/v/release/StarStreammm/TXT_cleanTo_EPUB">
  <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/StarStreammm/TXT_cleanTo_EPUB/publish.yml?label=Build">
  <br />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/StarStreammm/TXT_cleanTo_EPUB">
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/StarStreammm/TXT_cleanTo_EPUB">
  <img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/StarStreammm/TXT_cleanTo_EPUB">
</div>

TXT CleanTo EPUB is a self-hosted web application for preparing TXT or Markdown novels and exporting EPUB 3 books. Choose a folder, review the detected files, edit content and metadata, then convert selected files from the browser.

## Quick Start with Docker Compose

Docker Compose is the recommended way to start the app.

1. With Docker running, save the Compose file in a directory of your choice. [compose.yaml](./compose.yaml)

2. In the Compose file, replace `/path/to/data` under `volumes.tran.driver_opts.device` with the absolute path to an existing, writable folder containing your books.

3. Run this command from the directory containing the Compose file.

   ```bash
   docker compose up -d
   ```

4. Open [http://127.0.0.1:8887](http://127.0.0.1:8887). Select `/tran` as the work path and use `/tran` or a writable subfolder for output.

The named `cache` volume stores rule settings, history, and saved replacements between container recreations.

## Features

- Supports `.txt` and `.md` input files. TXT files may be UTF-8, UTF-8 with BOM, or GB18030 encoded.
- Extracts titles and authors from filenames, and reads YAML front matter from Markdown files.
- Lets you edit source text, preview TXT and Markdown cleanup results, change EPUB metadata, and choose a cover for each file before conversion.
- Detects volume, chapter, and section headings with simple, editable patterns; Arabic and Chinese numerals are supported.
- Trims each line, separates body lines into paragraphs, and normalizes dividers to `***` with a blank line on each side.
- Preserves local Markdown images, including image paths with spaces, and leaves remote/data URLs untouched.
- Generates EPUB 3 files with Pandoc, embedded styling, a cover image, and optional table of contents.
- Writes one EPUB per input file, optionally keeps generated Markdown, and can delete the original input after a successful conversion.
- Shows per-file preparation, processing, success, and error states, with a retry action for failed files only.
- Stores matching rules and reusable find-and-replace pairs in SQLite, shared across browsers, with edit, delete, and run actions in the source editor.
- Shows each source file's detected title, author, size, and last-modified time in the file preview list.
- Renders formatted Markdown with react-markdown and the same `public/epub.css` used by EPUB exports, while retaining the app theme.

## Workflow

1. Select a folder or a single `.txt`/`.md` file, preview the detected files, and choose which files to process.
2. Optionally adjust filename rules, then review each file in the editor. A single selected file opens without the file sidebar. Update text, metadata, cover, or heading rules as needed.
3. Choose an output folder and conversion options.
4. Start the conversion and monitor each file’s progress. EPUB files are written into a subfolder named after the book (and author, when available).

> [!WARNING]
> **Delete Original File** is enabled by default. Disable it before starting if you want to retain the source files.

## Other Ways to Run

### Docker Run

Replace `/path/to/data` with the absolute path to your writable books folder. The named `cache` volume retains rule settings, history, and saved replacements between container recreations.

```bash
docker run -d --name txt-cleanto-epub \
    -p 8887:80 \
    -v "/path/to/data:/tran" \
    -v cache:/app/cache \
    starstreammm/txt_cleanto_epub:latest
```

The GitHub Container Registry image is also available:

```bash
docker run -d --name txt-cleanto-epub \
    -p 8887:80 \
    -v "/path/to/data:/tran" \
    -v cache:/app/cache \
    ghcr.io/starstreammm/txt_cleanto_epub:latest
```

Open [http://127.0.0.1:8887](http://127.0.0.1:8887). Select `/tran` as the work path and use `/tran` or a writable subfolder for output.

To build the image locally, first create the frontend build artifacts, then build the image:

```bash
npm install
npm run build
docker build -t txt-cleanto-epub .
```

### Local Development

Requirements:

- Node.js and npm
- Python 3.10 or later
- [uv](https://docs.astral.sh/uv/)
- Pandoc (required for EPUB generation)

Install the frontend and Python dependencies:

```bash
npm install
uv sync
```

Run the frontend and API in separate terminals:

```bash
# Terminal 1 — frontend at http://127.0.0.1:8887
npm run dev
```

```bash
# Terminal 2 — API at http://127.0.0.1:38888
cd src
../.venv/bin/python main.py
```

The Vite development server proxies `/api` requests to the API automatically. The `/api/pattern` routes manage filename rules, heading settings, and history in the `pattern_filename` and `pattern_history` tables. Monaco’s saved find-and-replace pairs use `/api/replacement` and the `replacements` table. All three tables are in `cache/data.sqlite`. If you have an older incompatible database, move it aside before starting the API to create a fresh one. The Saved Replacements panel still imports browser-saved pairs and removes them from browser storage after a successful import. Temporary working files are stored in `cache/temp/` and removed when the API stops.

## Matching Rules

Filename rules are shared. Use `{title}` and `{creator}` to extract book metadata. In **Filename Patterns**, select **Restore Defaults** to load the built-in rules into the draft, then select **Save** to apply them. TXT and Markdown files both start with empty volume, chapter, and section rules. Reopening the same source path restores that file’s saved settings. In **Pattern Settings**, each heading tab has its own **History** of match and replacement pairs used during successful transformations. Click either value to fill that field, or **Use pair** to fill both. Focus the **Match** field to see its placeholders below the input. Select **Save** to apply the draft.

Match a heading with `{index}` (Arabic or Chinese numerals) and `{title}`. Use `{s}` for one whitespace character and `{S}` for one non-whitespace character. For example, `第{index}章{s}{title}` matches `第十二章 开始`. A replacement of `Chapter {index} · {title}` produces **Chapter 12 · 开始**. Use `{index-zh}` to display the captured number in Chinese. A replacement can use a title or index only if the match captures it.

Use `{reorder}` to number each matched heading of that level from 1, or `{reorder-zh}` for the same sequence in Chinese numerals (一, 二, 三, …). Chapters can restart at each volume and sections at each chapter. Turn off the corresponding switch to continue numbering. The formatter adds the Markdown heading level automatically.

## Output Options

| Option               | Result                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Save Text Files      | Keeps the generated Markdown alongside the EPUB output.                                                                                 |
| Move Images          | Moves the cover to `cover.ext` and inline images to `pics/P<number>.ext`. The cover occupies the first list entry. Disabled by default. |
| Delete Original File | Deletes each original source file only after its conversion succeeds.                                                                   |

Each selected source produces one book; volume and chapter headings define its table of contents. After a batch finishes, **Retry Failed Files** retries only failed files with the same configuration and preserves successful results.

## Markdown and metadata

Markdown input may start with YAML front matter. Supported metadata includes `title`, `creator`, `contributor`, `publisher`, `date`, `language`, `description`, `source`, and `cover` (also accepted as `cover-image`). Cover paths are resolved relative to the Markdown file when opened. Multiple creators, contributors, and publishers are written as separate EPUB metadata entries; enter multiple values in the UI separated with semicolons.

For Markdown images, use normal Markdown syntax such as `![Cover](images/cover.jpg)`. Relative paths are resolved from the source file’s directory. You can set a dedicated cover path in the metadata editor, also relative to the source file’s directory. The application generates a cover when none is set or the selected file is missing. A missing selected cover produces a warning in the conversion results.

With **Move Images** enabled, SHA-256 identifies identical local images within each book, including the cover. References share the same output copy. After every conversion succeeds, cleanup verifies that the source and destination still match the copied digest before deleting the source. With the switch off, images stay in place and Markdown uses relative paths. Remote and data URLs are preserved.

TXT and Markdown body text use the same heading and paragraph rules. Three or more matching `-`, `_`, or `*` marks on a line form a divider, with whitespace allowed between the marks. Line trimming and paragraph spacing can change the layout of multiline Markdown constructs.

When all headings are level 2 (`##`), EPUB chapters keep their `h2` styling and appear at the top level of the table of contents, without an automatically inserted level-1 book heading. Text before the first heading is preserved without a visible title or an extra TOC entry.

## Architecture

```text
React Router + Material UI frontend
        │
        ├── folder selection, rule configuration, editor, metadata, progress UI
        │
FastAPI API (/api)
        │
        ├── file queue and temporary UTF-8 copies
        ├── pattern parsing and text cleanup
        └── asynchronous Pandoc EPUB workers
                │
                └── Markdown + EPUB 3 output
```

The production image runs FastAPI and Nginx under Supervisor. Nginx serves the frontend and proxies `/api/` to the API; HTTPS is enabled automatically when `cert.crt` and `cert.key` are supplied under `/etc/nginx/certs/`.

## License

See [LICENSE](./LICENSE).
