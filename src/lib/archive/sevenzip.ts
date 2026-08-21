import SevenZipFactory from '7z-wasm';
import wasmUrl from '7z-wasm/7zz.wasm?url';
import type { ArchiveEntry, ArchiveHandler, ArchiveReader } from './types';

// 7z-wasm is a WASM build of the real 7-Zip CLI running against an in-memory
// Emscripten filesystem. There is no random-access API — every operation goes
// through `callMain(["x"|"l", ...])` against files written into that FS.
//
// Tradeoff (documented per spec): listing uses `7zz l -slt` (machine-readable
// technical listing) parsed from captured stdout. For reading a single file we
// invoke `7zz x` scoped to just that one path each time, which 7-Zip supports
// natively (it only extracts the requested member) — so this stays reasonably
// lazy in practice, without ever writing anything to a server. If a future
// format needs full extract-all instead (e.g. solid archives where 7-Zip must
// decode the whole solid block anyway), extracting once into the in-memory FS
// and serving files back out of it is still "local only" and an acceptable
// fallback — it just loses the on-demand-per-file laziness.

interface ListedEntry {
  path: string;
  isDirectory: boolean;
  size: number;
}

function parseSlt(output: string): ListedEntry[] {
  const entries: ListedEntry[] = [];
  const blocks = output.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    if (!/^Path = /m.test(block)) continue;
    const lines = block.split(/\r?\n/);
    let path = '';
    let size = 0;
    let isDir = false;
    let isFirstPathLine = true;
    for (const line of lines) {
      const eq = line.indexOf(' = ');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 3).trim();
      if (key === 'Path' && isFirstPathLine) {
        path = value;
        isFirstPathLine = false;
      } else if (key === 'Size') {
        size = parseInt(value, 10) || 0;
      } else if (key === 'Folder') {
        isDir = value === '+' || value === '1';
      } else if (key === 'Attributes') {
        if (value.includes('D')) isDir = true;
      }
    }
    if (path) entries.push({ path: path.replace(/\\/g, '/'), isDirectory: isDir, size });
  }
  return entries;
}

let counter = 0;

class SevenZipReader implements ArchiveReader {
  private zip: Awaited<ReturnType<typeof SevenZipFactory>>;
  private archivePath: string;
  private entries: ArchiveEntry[];
  constructor(
    zip: Awaited<ReturnType<typeof SevenZipFactory>>,
    archivePath: string,
    entries: ArchiveEntry[],
  ) {
    this.zip = zip;
    this.archivePath = archivePath;
    this.entries = entries;
  }

  getFormat(): string {
    return '7z';
  }

  list(): ArchiveEntry[] {
    return this.entries;
  }

  async readFile(entry: ArchiveEntry): Promise<Uint8Array> {
    const outDir = `/out${counter++}`;
    this.zip.FS.mkdir(outDir);
    this.zip.callMain(['x', this.archivePath, `-o${outDir}`, '-y', entry.path]);
    const outPath = `${outDir}/${entry.path}`;
    return this.zip.FS.readFile(outPath, { encoding: 'binary' });
  }

  dispose() {
    try {
      this.zip.FS.unlink(this.archivePath);
    } catch {
      // best-effort cleanup of the emulated filesystem
    }
  }
}

function looksLike7z(headerBytes: Uint8Array): boolean {
  // 7z magic: 37 7A BC AF 27 1C
  return (
    headerBytes.length >= 6 &&
    headerBytes[0] === 0x37 &&
    headerBytes[1] === 0x7a &&
    headerBytes[2] === 0xbc &&
    headerBytes[3] === 0xaf &&
    headerBytes[4] === 0x27 &&
    headerBytes[5] === 0x1c
  );
}

export const sevenZipHandler: ArchiveHandler = {
  id: '7z',
  label: '7Z',
  extensions: ['7z'],
  detect(file, headerBytes) {
    return looksLike7z(headerBytes) || /\.7z$/i.test(file.name);
  },
  async open(file, onProgress) {
    onProgress?.({ phase: 'reading', message: 'Booting 7-Zip (WASM)…' });
    let capturedOut = '';
    const zip = await SevenZipFactory({
      locateFile: () => wasmUrl,
      print: (line: string) => {
        capturedOut += line + '\n';
      },
      printErr: () => {},
    });

    const archivePath = `/${file.name.replace(/[^\w.\-]/g, '_')}`;
    onProgress?.({ phase: 'reading', message: 'Loading archive into memory…' });
    const bytes = new Uint8Array(await file.arrayBuffer());
    zip.FS.writeFile(archivePath, bytes);

    onProgress?.({ phase: 'indexing', message: 'Listing archive contents…' });
    capturedOut = '';
    zip.callMain(['l', '-slt', archivePath]);
    const listed = parseSlt(capturedOut);

    const entries: ArchiveEntry[] = listed
      .filter((e) => e.path)
      .map((e) => ({
        path: e.path,
        name: e.path.split('/').pop() ?? e.path,
        isDirectory: e.isDirectory,
        size: e.size,
      }));

    return new SevenZipReader(zip, archivePath, entries);
  },
};
