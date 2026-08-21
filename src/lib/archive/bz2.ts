import Bunzip from 'seek-bzip';
import type { ArchiveEntry, ArchiveHandler, ArchiveReader } from './types';
import { readerFromTarBuffer, looksLikeTarBuffer } from './tar';

function looksLikeBzip2(headerBytes: Uint8Array): boolean {
  // "BZh" followed by a block-size digit 1-9
  return (
    headerBytes.length >= 4 &&
    headerBytes[0] === 0x42 &&
    headerBytes[1] === 0x5a &&
    headerBytes[2] === 0x68
  );
}

class SingleFileReader implements ArchiveReader {
  private entry: ArchiveEntry;
  private data: Uint8Array;
  constructor(entry: ArchiveEntry, data: Uint8Array) {
    this.entry = entry;
    this.data = data;
  }
  getFormat() {
    return 'bz2';
  }
  list() {
    return [this.entry];
  }
  async readFile() {
    return this.data;
  }
}

export const bz2Handler: ArchiveHandler = {
  id: 'bz2',
  label: 'BZ2',
  extensions: ['bz2', 'tbz2'],
  detect(file, headerBytes) {
    return looksLikeBzip2(headerBytes) || /\.(bz2|tbz2)$/i.test(file.name);
  },
  async open(file, onProgress) {
    onProgress?.({ phase: 'reading', message: 'Reading bzip2 file…' });
    const compressed = new Uint8Array(await file.arrayBuffer());
    onProgress?.({ phase: 'decompressing', message: 'Decompressing (bzip2 requires the full file to be read once)…' });
    const decompressed = Bunzip.decode(compressed);
    if (looksLikeTarBuffer(decompressed)) {
      onProgress?.({ phase: 'indexing', message: 'Walking tar headers…' });
      const arrayBuffer = decompressed.slice().buffer;
      return readerFromTarBuffer(arrayBuffer, 'bz2', onProgress);
    }
    const name = file.name.replace(/\.(bz2|tbz2)$/i, '') || `${file.name}.out`;
    const entry: ArchiveEntry = { path: name, name, isDirectory: false, size: decompressed.length };
    return new SingleFileReader(entry, decompressed);
  },
};
