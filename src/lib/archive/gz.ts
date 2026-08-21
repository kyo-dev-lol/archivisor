import { gunzipSync } from 'fflate';
import type { ArchiveEntry, ArchiveHandler, ArchiveReader } from './types';
import { looksLikeGzip } from './targz';

/** A bare .gz file: no archive structure, just one compressed file. */
class SingleFileReader implements ArchiveReader {
  private cache: Uint8Array | null = null;
  private format: string;
  private entry: ArchiveEntry;
  private decompress: () => Uint8Array;
  constructor(format: string, entry: ArchiveEntry, decompress: () => Uint8Array) {
    this.format = format;
    this.entry = entry;
    this.decompress = decompress;
  }

  getFormat(): string {
    return this.format;
  }

  list(): ArchiveEntry[] {
    return [this.entry];
  }

  async readFile(): Promise<Uint8Array> {
    if (!this.cache) this.cache = this.decompress();
    return this.cache;
  }
}

function innerName(fileName: string, suffix: RegExp): string {
  const stripped = fileName.replace(suffix, '');
  return stripped || `${fileName}.out`;
}

export const gzHandler: ArchiveHandler = {
  id: 'gz',
  label: 'GZ',
  extensions: ['gz'],
  detect(file, headerBytes) {
    if (/\.(tar\.gz|tgz)$/i.test(file.name)) return false; // handled by targz
    return looksLikeGzip(headerBytes) || /\.gz$/i.test(file.name);
  },
  async open(file, onProgress) {
    onProgress?.({ phase: 'reading', message: 'Reading gzip file…' });
    const compressed = new Uint8Array(await file.arrayBuffer());
    const name = innerName(file.name, /\.gz$/i);
    const entry: ArchiveEntry = { path: name, name, isDirectory: false, size: 0, compressedSize: compressed.length };
    return new SingleFileReader('gz', entry, () => {
      onProgress?.({ phase: 'decompressing', message: 'Decompressing…' });
      return gunzipSync(compressed);
    });
  },
};
