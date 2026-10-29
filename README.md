<div align="center">
  <img src="./public/Icon-square.svg" alt="structure" width="288" />
  <br />
  <br />
  <img alt="Node Current" src="https://img.shields.io/node/v/%40rolldown%2Fplugin-babel">
  <img alt="Python Version" src="https://img.shields.io/badge/python-3.10%2B-blue">
  <img alt="GitHub License" src="https://img.shields.io/github/license/Xu-Xihe/TXT_cleanTo_EPUB">
  <img alt="GitHub Release" src="https://img.shields.io/github/v/release/Xu-Xihe/TXT_cleanTo_EPUB">
  <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/Xu-Xihe/TXT_cleanTo_EPUB/release.yml?label=Release">
  <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/Xu-Xihe/TXT_cleanTo_EPUB/docker.yml?label=Docker">
  <br />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/Xu-Xihe/TXT_cleanTo_EPUB">
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/Xu-Xihe/TXT_cleanTo_EPUB">
  <img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/Xu-Xihe/TXT_cleanTo_EPUB">
</div>

TXT CleanTo EPUB is a self-hosted web application for preparing TXT or Markdown novels and exporting EPUB 3 books. Choose a folder, review the detected files, edit content and metadata, then convert selected files from the browser.

## Features

- Supports `.txt` and `.md` input files. TXT files may be UTF-8, UTF-8 with BOM, or GB18030 encoded.
- Extracts titles and authors from filenames, and reads YAML front matter from Markdown files.
- Lets you edit source text, preview TXT cleanup results, change EPUB metadata, and choose a cover for each file before conversion.
- Detects chapter and volume headings with simple, editable patterns; Arabic and Chinese numerals are supported.
- Removes matching advertisement text, collapses repeated blank lines, and converts divider lines to styled separators.
- Preserves local Markdown images, including image paths with spaces, and leaves remote/data URLs untouched.
- Generates EPUB 3 files with Pandoc, embedded styling, a cover image, and optional table of contents.
- Writes one EPUB per input file, optionally keeps generated Markdown, and can delete the original input after a successful conversion.
- Shows per-file preparation, processing, success, and error states, with a retry action for failed files only.
- Stores reusable original/replacement text pairs locally, with edit, delete, and run actions in the source editor.
- Renders formatted Markdown with react-markdown and the same `public/epub.css` used by EPUB exports, while retaining the app theme.

## Workflow

1. Select a folder or a single `.txt`/`.md` file, preview the detected files, and choose which files to process.
2. Optionally adjust filename rules, then review each file in the editor. A single selected file opens without the file sidebar. Update text, metadata, cover, or chapter/advertisement/volume rules as needed.
3. Choose an output folder and conversion options.
4. Start the conversion and monitor each file’s progress. EPUB files are written into a subfolder named after the book (and author, when available).

> [!WARNING]
> **Delete Original File** is enabled by default. Disable it before starting if you want to retain the source files.

## Installation and Running

### Docker (Recommended)

Mount the folder that contains the books at a path visible inside the container, and use that container path (for example, `/books`) in the web UI. The named `data` volume retains matching-rule settings between container recreations.

```bash
docker run -d --name txt-cleanto-epub \
  -p 8888:80 \
  -v /absolute/path/to/books:/books \
  -v txt-cleanto-epub-data:/app/data \
  starstreammm/txt_cleanto_epub:latest
```

The GitHub Container Registry image is also available:

```bash
docker run -d --name txt-cleanto-epub \
  -p 8888:80 \
  -v /absolute/path/to/books:/books \
  -v txt-cleanto-epub-data:/app/data \
  ghcr.io/xu-xihe/txt_cleanto_epub:latest
```

Open [http://127.0.0.1:8888](http://127.0.0.1:8888), then select `/books` as the work path. Any output path must likewise be under a mounted writable directory.

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

The Vite development server proxies `/api` requests to the API automatically. Conversion rules and temporary working files are stored in `data/`; temporary files are removed when the API stops.

## Matching Rules

Rules are literal patterns with placeholders, so regular expressions are not required. Rules can be enabled, reordered, edited, reset, or removed in the UI. The longest enabled rule is tested first.

| Rule type     | Purpose                              | Supported placeholders                       |
| ------------- | ------------------------------------ | -------------------------------------------- |
| File          | Derive book metadata from a filename | `{title}`, `{creator}`                   |
| Chapter       | Recognize TXT chapter headings       | `{title}`, `{chapter}`, `{extchapter}` |
| Volume        | Recognize TXT volume headings        | `{title}`, `{volume}`                    |
| Advertisement | Remove matching text from TXT lines  | `{s}`                                      |

`{volume}`, `{chapter}`, and `{extchapter}` accept Arabic numerals as well as Chinese numerals. For example, `第{chapter}章 {title}` recognizes `第12章 开始` and `第十二章 开始`.

Volume rules such as `第{volume}卷 {title}` produce `#` headings. Chapter rules produce `##` headings. Existing volume rules using `{chapter}` remain supported.

## Output Options

| Option                | Result                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Save Text Files       | Keeps the generated Markdown alongside the EPUB output.                                        |
| Move Images           | Moves the cover and local inline images beside the output as `cover.ext`, `P1.ext`, `P2.ext`, etc. Disabled by default. |
| Delete Original File  | Deletes each original source file only after its conversion succeeds.                          |

Each selected source produces one book; volume and chapter headings define its table of contents. After a batch finishes, **Retry Failed Files** retries only failed files with the same configuration and preserves successful results.

## Markdown and metadata

Markdown input may start with YAML front matter. Supported metadata includes `title`, `creator`, `contributor`, `publisher`, `date`, `language`, `description`, `source`, and `cover` (also accepted as `cover-image`). Cover paths are resolved relative to the Markdown file when opened. Multiple creators, contributors, and publishers are written as separate EPUB metadata entries; enter multiple values in the UI separated with semicolons.

For Markdown images, use normal Markdown syntax such as `![Cover](images/cover.jpg)`. Relative paths are resolved from the source file’s directory. You can set a dedicated cover path in the metadata editor; otherwise, the application generates a cover.

With **Move Images** enabled, local inline images and the cover (including an automatically generated cover) are placed beside each output Markdown/EPUB pair, preserving their formats. Markdown uses links such as `./P1.jpg` and YAML `cover: ./cover.jpg`. Repeated references share one image per output folder. Existing inline filenames are skipped; a conflicting cover reports an error instead of overwriting it. Source images are removed only after every conversion in the batch succeeds. With the switch off, images remain at their original locations and Markdown uses relative paths back to them. Remote and data URLs remain unchanged.

Markdown input retains its heading levels, lists, whitespace, and fenced code without applying TXT matching or advertisement removal.

## Architecture

```text
React Router + Material UI frontend
        │
        ├── folder selection, rule configuration, editor, metadata, progress UI
        │
FastAPI API (/api)
        │
        ├── file queue and temporary UTF-8 copies
        ├── pattern parsing and TXT cleanup
        └── asynchronous Pandoc EPUB workers
                │
                └── Markdown + EPUB 3 output
```

The production image runs FastAPI and Nginx under Supervisor. Nginx serves the frontend and proxies `/api/` to the API; HTTPS is enabled automatically when `cert.crt` and `cert.key` are supplied under `/etc/nginx/certs/`.

## License

See [LICENSE](./LICENSE).
