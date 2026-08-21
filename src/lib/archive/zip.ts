import JSZip from 'jszip';
import type { ArchiveEntry, ArchiveHandler, ArchiveReader, ProgressCallback } from './types';

// JSZip parses the central directory (metadata only) up front via loadAsync,
// which is cheap even for huge archives. Individual file bytes are only
// decompressed on demand via `zipObject.async('uint8array')` — we deliberately
// never call `zip.generateAsync()` on the whole archive here.
class ZipReader implements ArchiveReader {
  private zip: JSZip;
  private entries: ArchiveEntry[];
  constructor(zip: JSZip, entries: ArchiveEntry[]) {
    this.zip = zip;
    this.entries = entries;
  }

  getFormat(): string {
    return 'zip';
  }

  list(): ArchiveEntry[] {
    return this.entries;
  }

  async readFile(entry: ArchiveEntry, onProgress?: ProgressCallback): Promise<Uint8Array> {
    const zipObject = this.zip.file(entry.path);
    if (!zipObject) throw new Error(`Entry not found in zip: ${entry.path}`);
    const data = await zipObject.async('uint8array', (meta) => {
      onProgress?.({ phase: 'extracting', fraction: meta.percent / 100 });
    });
    return data;
  }
}

function looksLikeZip(headerBytes: Uint8Array): boolean {
  // PK\x03\x04 (local file header) or PK\x05\x06 (empty archive / EOCD)
  return (
    headerBytes.length >= 4 &&
    headerBytes[0] === 0x50 &&
    headerBytes[1] === 0x4b &&
    (headerBytes[2] === 0x03 || headerBytes[2] === 0x05 || headerBytes[2] === 0x07)
  );
}

export const zipHandler: ArchiveHandler = {
  id: 'zip',
  label: 'ZIP',
  extensions: ['zip'],
  detect(file, headerBytes) {
    return looksLikeZip(headerBytes) || /\.zip$/i.test(file.name);
  },
  async open(file, onProgress) {
    onProgress?.({ phase: 'reading', message: 'Reading zip central directory…' });
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    onProgress?.({ phase: 'indexing', message: 'Indexing entries…' });
    const entries: ArchiveEntry[] = [];
    zip.forEach((relativePath, zipEntry) => {
      const path = relativePath.replace(/\/+$/, '');
      if (!path) return;
      const name = path.split('/').pop() ?? path;
      const internal = zipEntry as unknown as {
        _data?: { uncompressedSize?: number; compressedSize?: number };
      };
      entries.push({
        path,
        name,
        isDirectory: zipEntry.dir,
        size: internal._data?.uncompressedSize ?? 0,
        compressedSize: internal._data?.compressedSize,
      });
    });
    return new ZipReader(zip, entries);
  },
};
