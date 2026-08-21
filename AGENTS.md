# AGENTS.md

Architecture notes for anyone (human or agent) extending Vaultkeep.

## Directory layout

```
src/
  lib/
    format.ts             shared formatting + file-type helpers (sizes, icons, dangerous-ext check)
    archive/
      types.ts            ArchiveEntry, ArchiveReader, ArchiveHandler, ProgressEvent — the whole contract
      registry.ts          list of handlers + detectFormat(file); add new formats here
      zip.ts               JSZip-backed handler
      tar.ts                hand-rolled tar header parser + reader, reused by targz/bz2/xz
      targz.ts              gzip (fflate) -> tar.ts parser
      gz.ts                 bare .gz single-file handler
      bz2.ts                seek-bzip -> tar.ts parser (or single-file fallback)
      xz.ts                 xz-decompress -> tar.ts parser (or single-file fallback)
      sevenzip.ts           7z-wasm (real 7-Zip CLI compiled to WASM)
  components/
    DropZone.tsx           landing view: drag/drop + file picker
    ProgressBar.tsx        loading state with phase label + progress bar
    ArchiveViewer.tsx       top-level viewer: header/stats, breadcrumb, search, folder download, error state
    Breadcrumb.tsx          clickable path segments
    SearchBar.tsx           flat-search input
    FileList.tsx            sorts + renders rows (folders first, then A-Z)
    FileRow.tsx              single row: icon, name, size badge, download/preview buttons
    PreviewModal.tsx        image/pdf/text/json/csv preview, size-capped
  App.tsx                  orchestrates idle -> loading -> loaded/unsupported state machine
```

## Adding a new archive format

1. Write `src/lib/archive/<format>.ts` exporting an `ArchiveHandler`:
   - `detect(file, headerBytes)` — check magic bytes first, fall back to
     extension matching. `headerBytes` is the first 512 bytes of the file
     (see `readHeaderBytes` in `registry.ts`).
   - `open(file, onProgress)` — return a Promise<ArchiveReader>. `list()`
     must be synchronous once `open()` resolves (all metadata is expected to
     already be parsed); `readFile(entry)` can be async and lazy.
2. Add one line to the `archiveHandlers` array in `registry.ts`. Order matters:
   put handlers with narrower/compound-extension matches (e.g. `.tar.gz`)
   before broader ones (`.gz`) so the first match wins correctly.
3. If the format can't realistically be parsed in-browser at all, don't write
   a handler — instead add its extension to `unsupportedKnownExtensions` in
   `registry.ts` so the UI shows a clear "can't preview this" message instead
   of silently failing.

## Non-obvious decisions / tradeoffs

- **ZIP** is genuinely lazy: JSZip's `loadAsync` only parses the central
  directory (metadata), and `zipObject.async('uint8array')` decompresses one
  entry at a time. The whole archive is never fully re-serialized
  (`generateAsync` on the whole zip is never called for browsing/downloading
  single files — it's only used when the user asks to download a *folder*,
  where we necessarily have to build a new sub-zip from the selected
  members).
- **TAR** has no compression, so listing only requires walking 512-byte
  header blocks (name/size/typeflag), not reading file contents. Header
  walking is sequential (tar has no index), but once the byte offset of an
  entry's data is known, `readFile` uses `File.slice(offset, offset+size)` so
  only that entry's bytes are actually read off disk.
- **GZIP / BZIP2 / XZ are not seekable formats.** There's no random access
  into a gzip/bzip2/xz stream, so `targz.ts`, `bz2.ts`, and `xz.ts` all
  decompress the *entire* compressed stream once, up front, into an in-memory
  buffer, then either parse it as a tar (walking headers as above) or treat it
  as a single decompressed file. This is a real, unavoidable byte cost for
  these formats specifically — it's still 100% client-side, just not
  "lazy" the way ZIP/TAR entry reads are.
- **7z-wasm** wraps the actual 7-Zip CLI compiled to WebAssembly, running
  against an Emscripten in-memory filesystem (`zip.FS`). There is no
  random-access API into a `.7z` container, so:
  - Listing uses `7zz l -slt <archive>` (machine-readable "show technical
    information" listing) with stdout captured via the `print` callback and
    parsed into entries.
  - Reading a single file invokes `7zz x <archive> -o<tmp> -y <path>`,
    extracting *only* the requested member into a fresh temp directory in the
    virtual FS, then reading it back out. This keeps things reasonably lazy
    per-file in the common case. For solid 7z archives, 7-Zip may still need
    to decode a larger solid block internally to reach one file — that's an
    internal 7-Zip behavior we don't control, not something Vaultkeep does
    itself. Either way, nothing ever leaves the browser: the "extraction"
    target is the WASM module's in-memory filesystem, not a server.
- **Dangerous extensions** (`.exe`, `.sh`, `.ps1`, `.dll`, etc., see
  `format.ts`) are flagged for *display only* — a small "risky" badge, and
  preview is suppressed for them. Downloading is never blocked; Vaultkeep
  never executes or renders archive contents as code/HTML regardless of
  extension.
- **Search** operates in two distinct modes (see `ArchiveViewer.tsx`): normal
  browsing builds a "current folder's direct children" view (synthesizing
  folder rows from nested paths when an archive lacks explicit directory
  entries, e.g. some tars), while a non-empty search query switches to a flat
  filtered list across every entry in the archive, matched case-insensitively
  by substring against file/folder names.
- **Folder download** collects every non-directory entry whose path starts
  with `<folder>/`, reads each one's bytes from the underlying reader, and
  packs them into a *new* JSZip archive with paths relativized to the
  folder — this is the one place we do build a full zip client-side, and it's
  scoped to only the selected subtree, not the whole original archive.
