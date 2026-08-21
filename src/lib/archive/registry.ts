import type { ArchiveHandler } from './types';
import { zipHandler } from './zip';
import { tarHandler } from './tar';
import { targzHandler } from './targz';
import { gzHandler } from './gz';
import { bz2Handler } from './bz2';
import { xzHandler } from './xz';
import { sevenZipHandler } from './sevenzip';

// Registered in a deliberate order: formats with distinctive magic bytes and
// compound extensions (tar.gz) are checked before their looser single-file
// cousins (gz), so e.g. "archive.tar.gz" is claimed by targzHandler, not gz.
export const archiveHandlers: ArchiveHandler[] = [
  zipHandler,
  sevenZipHandler,
  targzHandler,
  tarHandler,
  bz2Handler,
  xzHandler,
  gzHandler,
];

export const supportedExtensions = Array.from(
  new Set(archiveHandlers.flatMap((h) => h.extensions)),
);

export async function readHeaderBytes(file: File, length = 512): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function detectFormat(file: File): Promise<ArchiveHandler | null> {
  const headerBytes = await readHeaderBytes(file);
  for (const handler of archiveHandlers) {
    if (handler.detect(file, headerBytes)) return handler;
  }
  return null;
}

/** Extensions we recognize by name but cannot safely parse in-browser. */
export const unsupportedKnownExtensions = ['rar', 'zst', 'lz4', 'lzma', 'cab', 'arj'];

export function isKnownUnsupported(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  for (const ext of unsupportedKnownExtensions) {
    if (lower.endsWith(`.${ext}`)) return ext;
  }
  return null;
}
