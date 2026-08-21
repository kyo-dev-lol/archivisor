import { gunzipSync } from 'fflate';
import type { ArchiveHandler } from './types';
import { readerFromTarBuffer } from './tar';

export function looksLikeGzip(headerBytes: Uint8Array): boolean {
  return headerBytes.length >= 2 && headerBytes[0] === 0x1f && headerBytes[1] === 0x8b;
}

export const targzHandler: ArchiveHandler = {
  id: 'targz',
  label: 'TAR.GZ',
  extensions: ['tar.gz', 'tgz'],
  detect(file) {
    return /\.(tar\.gz|tgz)$/i.test(file.name);
  },
  async open(file, onProgress) {
    onProgress?.({ phase: 'reading', message: 'Reading gzip stream…' });
    const compressed = new Uint8Array(await file.arrayBuffer());
    onProgress?.({ phase: 'decompressing', message: 'Decompressing (gzip is not seekable, this reads the whole file once)…' });
    const decompressed = gunzipSync(compressed);
    onProgress?.({ phase: 'indexing', message: 'Walking tar headers…' });
    const arrayBuffer = decompressed.buffer.slice(
      decompressed.byteOffset,
      decompressed.byteOffset + decompressed.byteLength,
    );
    return readerFromTarBuffer(arrayBuffer, 'targz', onProgress);
  },
};
