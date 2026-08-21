# Vaultkeep

Vaultkeep is a client-side archive viewer and selective extractor. Drop in a
ZIP, 7Z, TAR, TAR.GZ, GZ, BZ2, or XZ file and browse its contents as a file
tree — no upload, no server round trip. Download exactly the file or folder
you need; the rest of the archive is never fully extracted.

## Why

Most "unzip online" tools upload your file to a server. Vaultkeep parses
everything in the browser using WebAssembly and pure-JS decompression
libraries, so archive contents never leave your machine.

## Tech

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** (via `@tailwindcss/vite`) for styling
- **JSZip** — ZIP central-directory parsing and per-entry lazy decompression
- **fflate** — gzip decompression (`gunzipSync`) for `.gz` / `.tar.gz`
- **seek-bzip** — bzip2 decompression for `.bz2` / `.tar.bz2`
- **xz-decompress** — streaming XZ decompression for `.xz` / `.tar.xz`
- **7z-wasm** — a WASM build of the real 7-Zip CLI, used for `.7z` listing
  and extraction against an in-memory emulated filesystem
- Hand-rolled TAR header parser (512-byte block walker, ustar + GNU
  long-name support)

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL. Building for production: `npm run build`.

## Architecture

See `AGENTS.md` for a deeper description of the archive-handler plugin
architecture in `src/lib/archive/`.

## Security notes

- Archive contents are treated strictly as inert bytes: nothing is ever
  `eval`'d, executed, or rendered as HTML.
- Files with commonly-dangerous extensions (`.exe`, `.sh`, `.ps1`, etc.) are
  flagged with a "risky" badge for visibility, but downloading them is never
  blocked — only preview/auto-render is suppressed.
- Text/JSON/CSV previews are rendered as plain text/table cells, never via
  `dangerouslySetInnerHTML` on raw file content.
