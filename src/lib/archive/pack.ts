import JSZip from 'jszip';
import { gzipSync } from 'fflate';
import SevenZipFactory from '7z-wasm';
import wasmUrl from '7z-wasm/7zz.wasm?url';

export type PackFormat = 'zip' | 'tar' | 'tar.gz' | '7z';

export interface PackFile {
  /** Path inside the archive (forward slashes, no leading slash). */
  path: string;
  data: Uint8Array;
}

export interface PackProgress {
  phase: 'packing' | 'compressing';
  fraction?: number;
  message?: string;
}

/** Formats we can create in the browser. RAR is intentionally omitted (proprietary). */
export const PACK_FORMATS: { id: PackFormat; label: string; note?: string }[] = [
  { id: 'zip', label: 'ZIP' },
  { id: 'tar', label: 'TAR' },
  { id: 'tar.gz', label: 'TAR.GZ' },
  { id: '7z', label: '7Z' },
];

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Write a POSIX ustar header (512 bytes) for a regular file. */
function tarHeader(path: string, size: number, mtimeSec: number): Uint8Array {
  const block = new Uint8Array(512);
  const write = (offset: number, max: number, value: string) => {
    const bytes = encodeUtf8(value);
    block.set(bytes.subarray(0, max - 1), offset);
  };
  const writeOctal = (offset: number, max: number, num: number) => {
    const s = num.toString(8).padStart(max - 1, '0');
    write(offset, max, s);
  };

  // ustar allows 100 bytes for name; longer names use prefix (155) + name
  let name = path;
  let prefix = '';
  if (name.length > 100) {
    const slash = name.lastIndexOf('/', 155);
    if (slash > 0 && name.length - slash - 1 <= 100) {
      prefix = name.slice(0, slash);
      name = name.slice(slash + 1);
    } else {
      name = name.slice(0, 100);
    }
  }

  write(0, 100, name);
  writeOctal(100, 8, 0o644);
  writeOctal(108, 8, 0); // uid
  writeOctal(116, 8, 0); // gid
  writeOctal(124, 12, size);
  writeOctal(136, 12, Math.floor(mtimeSec));
  // checksum placeholder spaces
  for (let i = 148; i < 156; i++) block[i] = 0x20;
  block[156] = 0x30; // typeflag '0' regular file
  write(257, 6, 'ustar');
  write(263, 3, '00');
  if (prefix) write(345, 155, prefix);

  let sum = 0;
  for (let i = 0; i < 512; i++) sum += block[i];
  const chk = sum.toString(8).padStart(6, '0');
  const chkBytes = encodeUtf8(chk);
  block.set(chkBytes, 148);
  block[154] = 0;
  block[155] = 0x20;

  return block;
}

function padTo512(len: number): number {
  const rem = len % 512;
  return rem === 0 ? 0 : 512 - rem;
}

export async function buildTar(files: PackFile[]): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const now = Date.now() / 1000;
  for (const f of files) {
    const path = f.path.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!path || path.endsWith('/')) continue;
    parts.push(tarHeader(path, f.data.byteLength, now));
    parts.push(f.data);
    const pad = padTo512(f.data.byteLength);
    if (pad) parts.push(new Uint8Array(pad));
  }
  // two zero blocks end the archive
  parts.push(new Uint8Array(1024));
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

export async function buildZip(
  files: PackFile[],
  onProgress?: (p: PackProgress) => void,
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) {
    const path = f.path.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!path || path.endsWith('/')) continue;
    zip.file(path, f.data, { binary: true });
  }
  const blob = await zip.generateAsync(
    { type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress?.({ phase: 'compressing', fraction: meta.percent / 100 });
    },
  );
  return blob;
}

export async function buildTarGz(
  files: PackFile[],
  onProgress?: (p: PackProgress) => void,
): Promise<Uint8Array> {
  onProgress?.({ phase: 'packing', message: 'Building TAR¦' });
  const tar = await buildTar(files);
  onProgress?.({ phase: 'compressing', message: 'Gzip¦', fraction: 0.5 });
  const gz = gzipSync(tar, { level: 6 });
  onProgress?.({ phase: 'compressing', fraction: 1 });
  return gz;
}

export async function build7z(
  files: PackFile[],
  onProgress?: (p: PackProgress) => void,
): Promise<Uint8Array> {
  onProgress?.({ phase: 'packing', message: 'Booting 7-Zip¦' });
  const zip = await SevenZipFactory({
    locateFile: () => wasmUrl,
    print: () => {},
    printErr: () => {},
  });
  const work = `/pack${Date.now()}`;
  zip.FS.mkdir(work);
  const inDir = `${work}/in`;
  zip.FS.mkdir(inDir);

  for (const f of files) {
    const path = f.path.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!path || path.endsWith('/')) continue;
    const parts = path.split('/');
    let cur = inDir;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = `${cur}/${parts[i]}`;
      try {
        zip.FS.mkdir(cur);
      } catch {
        /* exists */
      }
    }
    zip.FS.writeFile(`${inDir}/${path}`, f.data);
  }

  const outPath = `${work}/out.7z`;
  onProgress?.({ phase: 'compressing', message: 'Compressing 7Z¦', fraction: 0.4 });
  // Archive everything under inDir (relative paths preserved by cwd-style paths we wrote)
  zip.callMain(['a', '-t7z', '-y', outPath, inDir + '/.']);
  onProgress?.({ phase: 'compressing', fraction: 1 });
  const data = zip.FS.readFile(outPath, { encoding: 'binary' }) as Uint8Array;
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export async function packArchive(
  format: PackFormat,
  files: PackFile[],
  onProgress?: (p: PackProgress) => void,
): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('No files to pack.');
  switch (format) {
    case 'zip':
      return buildZip(files, onProgress);
    case 'tar':
      onProgress?.({ phase: 'packing', message: 'Building TAR¦' });
      return buildTar(files);
    case 'tar.gz':
      return buildTarGz(files, onProgress);
    case '7z':
      return build7z(files, onProgress);
    default:
      throw new Error(`Unsupported pack format: ${format}`);
  }
}

export function extensionForFormat(format: PackFormat): string {
  switch (format) {
    case 'zip':
      return 'zip';
    case 'tar':
      return 'tar';
    case 'tar.gz':
      return 'tar.gz';
    case '7z':
      return '7z';
  }
}

export function downloadBytes(data: Uint8Array, filename: string) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const blob = new Blob([copy], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
