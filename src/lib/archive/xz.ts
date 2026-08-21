import { XzReadableStream } from 'xz-decompress';
import type { ArchiveEntry, ArchiveHandler, ArchiveReader } from './types';
import { readerFromTarBuffer, looksLikeTarBuffer } from './tar';

function looksLikeXz(headerBytes: Uint8Array): boolean {
  // XZ magic: FD 37 7A 58 5A 00
  return (
    headerBytes.length >= 6 &&
    headerBytes[0] === 0xfd &&
    headerBytes[1] === 0x37 &&
    headerBytes[2] === 0x7a &&
    headerBytes[3] === 0x58 &&
    headerBytes[4] === 0x5a &&
    headerBytes[5] === 0x00
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
    return 'xz';
  }
  list() {
    return [this.entry];
  }
  async readFile() {
    return this.data;
  }
}

async function readStreamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export const xzHandler: ArchiveHandler = {
  id: 'xz',
  label: 'XZ',
  extensions: ['xz', 'txz'],
  detect(file, headerBytes) {
    return looksLikeXz(headerBytes) || /\.(xz|txz)$/i.test(file.name);
  },
  async open(file, onProgress) {
    onProgress?.({ phase: 'reading', message: 'Streaming xz decompression…' });
    // xz-decompress decodes via a ReadableStream; xz is not seekable so we
    // still have to consume the whole stream once to build a listing.
    const xzStream = new XzReadableStream(file.stream());
    const decompressed = await readStreamToBytes(xzStream);
    if (looksLikeTarBuffer(decompressed)) {
      onProgress?.({ phase: 'indexing', message: 'Walking tar headers…' });
      const arrayBuffer = decompressed.slice().buffer;
      return readerFromTarBuffer(arrayBuffer, 'xz', onProgress);
    }
    const name = file.name.replace(/\.(xz|txz)$/i, '') || `${file.name}.out`;
    const entry: ArchiveEntry = { path: name, name, isDirectory: false, size: decompressed.length };
    return new SingleFileReader(entry, decompressed);
  },
};
