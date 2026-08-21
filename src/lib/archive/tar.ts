import type { ArchiveEntry, ArchiveHandler, ArchiveReader, ProgressCallback } from './types';

const BLOCK_SIZE = 512;

interface TarHeaderInfo {
  name: string;
  size: number;
  typeflag: string;
  dataOffset: number;
}

function readCString(view: DataView, offset: number, length: number): string {
  let end = offset;
  const max = offset + length;
  while (end < max && view.getUint8(end) !== 0) end++;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, end - offset);
  return new TextDecoder().decode(bytes);
}

function readOctal(view: DataView, offset: number, length: number): number {
  const str = readCString(view, offset, length).trim();
  if (!str) return 0;
  // GNU tar base-256 encoding: high bit of first byte set.
  if (view.getUint8(offset) & 0x80) {
    let value = 0;
    for (let i = 1; i < length; i++) {
      value = value * 256 + view.getUint8(offset + i);
    }
    return value;
  }
  return parseInt(str, 8) || 0;
}

function isEmptyBlock(bytes: Uint8Array, offset: number): boolean {
  for (let i = 0; i < BLOCK_SIZE; i++) {
    if (bytes[offset + i] !== 0) return false;
  }
  return true;
}

/** Walk 512-byte header blocks across the whole buffer to build a listing. */
export function parseTarHeaders(buffer: ArrayBuffer, onProgress?: ProgressCallback): TarHeaderInfo[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const headers: TarHeaderInfo[] = [];
  let offset = 0;
  let longName: string | null = null;

  while (offset + BLOCK_SIZE <= bytes.length) {
    if (isEmptyBlock(bytes, offset)) {
      offset += BLOCK_SIZE;
      continue;
    }
    const magic = readCString(view, offset + 257, 6);
    const isUstar = magic.startsWith('ustar');

    let name = readCString(view, offset, 100);
    const size = readOctal(view, offset + 124, 12);
    const typeflag = readCString(view, offset + 156, 1) || '0';
    const prefix = isUstar ? readCString(view, offset + 345, 155) : '';
    if (prefix) name = `${prefix}/${name}`;

    const dataOffset = offset + BLOCK_SIZE;

    if (typeflag === 'L') {
      // GNU long-name entry: the following data block(s) contain the real name.
      const nameBytes = bytes.subarray(dataOffset, dataOffset + size);
      longName = new TextDecoder().decode(nameBytes).replace(/\0+$/, '');
      offset = dataOffset + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
      continue;
    }

    if (longName) {
      name = longName;
      longName = null;
    }

    if (name) {
      headers.push({ name, size, typeflag, dataOffset });
      onProgress?.({ phase: 'indexing', message: `Indexed ${headers.length} entries…` });
    }

    offset = dataOffset + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
  }

  return headers;
}

export function headersToEntries(headers: TarHeaderInfo[]): ArchiveEntry[] {
  return headers
    .map((h) => {
      const path = h.name.replace(/\/+$/, '');
      const isDirectory = h.typeflag === '5' || h.name.endsWith('/');
      if (!path) return null;
      const segments = path.split('/');
      const entryName = segments[segments.length - 1];
      return {
        path,
        name: entryName,
        isDirectory,
        size: isDirectory ? 0 : h.size,
      } satisfies ArchiveEntry;
    })
    .filter((e): e is ArchiveEntry => e !== null);
}

class TarReader implements ArchiveReader {
  private file: File;
  private headers: TarHeaderInfo[];
  private entries: ArchiveEntry[];
  constructor(file: File, headers: TarHeaderInfo[], entries: ArchiveEntry[]) {
    this.file = file;
    this.headers = headers;
    this.entries = entries;
  }

  getFormat(): string {
    return 'tar';
  }

  list(): ArchiveEntry[] {
    return this.entries;
  }

  async readFile(entry: ArchiveEntry): Promise<Uint8Array> {
    const header = this.headers.find((h) => h.name.replace(/\/+$/, '') === entry.path);
    if (!header) throw new Error(`Entry not found in tar: ${entry.path}`);
    // Lazy: only this entry's byte range is read from disk, not the whole file.
    const slice = this.file.slice(header.dataOffset, header.dataOffset + header.size);
    const buf = await slice.arrayBuffer();
    return new Uint8Array(buf);
  }
}

function looksLikeTar(headerBytes: Uint8Array): boolean {
  // ustar magic sits at offset 257 within the first 512-byte header block.
  if (headerBytes.length < 263) return false;
  const magic = new TextDecoder().decode(headerBytes.subarray(257, 263));
  return magic.startsWith('ustar');
}

export const tarHandler: ArchiveHandler = {
  id: 'tar',
  label: 'TAR',
  extensions: ['tar'],
  detect(file, headerBytes) {
    return looksLikeTar(headerBytes) || /\.tar$/i.test(file.name);
  },
  async open(file, onProgress) {
    onProgress?.({ phase: 'reading', message: 'Reading tar headers…' });
    const buffer = await file.arrayBuffer();
    const headers = parseTarHeaders(buffer, onProgress);
    const entries = headersToEntries(headers);
    return new TarReader(file, headers, entries);
  },
};

/** Build a reader directly from an in-memory decompressed tar buffer (used by targz/bz2/xz). */
export function readerFromTarBuffer(buffer: ArrayBuffer, format: string, onProgress?: ProgressCallback): ArchiveReader {
  const headers = parseTarHeaders(buffer, onProgress);
  const entries = headersToEntries(headers);
  const bytes = new Uint8Array(buffer);
  return {
    getFormat: () => format,
    list: () => entries,
    readFile: async (entry: ArchiveEntry) => {
      const header = headers.find((h) => h.name.replace(/\/+$/, '') === entry.path);
      if (!header) throw new Error(`Entry not found: ${entry.path}`);
      return bytes.subarray(header.dataOffset, header.dataOffset + header.size);
    },
  };
}

export function looksLikeTarBuffer(bytes: Uint8Array): boolean {
  return looksLikeTar(bytes);
}
