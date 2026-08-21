// Shared types for the archive-reading subsystem.
// Every format handler (zip, tar, targz, gz, bz2, xz, sevenzip) implements
// `ArchiveHandler` and produces an `ArchiveReader`. The UI only ever talks to
// these two interfaces, so adding a new format is "write one handler file +
// register it in registry.ts".

export interface ArchiveEntry {
  /** Full path inside the archive, forward-slash separated, no leading slash. */
  path: string;
  /** Final path segment (file or folder name). */
  name: string;
  isDirectory: boolean;
  /** Uncompressed size in bytes (0 for directories, or when unknown). */
  size: number;
  /** Compressed/on-disk size, when the format exposes it. */
  compressedSize?: number;
}

export type ProgressPhase = 'reading' | 'decompressing' | 'indexing' | 'extracting';

export interface ProgressEvent {
  phase: ProgressPhase;
  /** 0..1 when known, undefined when indeterminate. */
  fraction?: number;
  message?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * A live handle onto an opened archive. Listing the directory structure is
 * assumed to already be resolved (see ArchiveHandler.open); this interface is
 * about lazily pulling bytes for one entry at a time.
 */
export interface ArchiveReader {
  getFormat(): string;
  list(): ArchiveEntry[];
  /** Read the full decompressed bytes of a single entry, on demand. */
  readFile(entry: ArchiveEntry, onProgress?: ProgressCallback): Promise<Uint8Array>;
  /** Free any in-memory resources (emulated filesystems, etc). Optional. */
  dispose?(): void;
}

export interface ArchiveHandler {
  /** Unique id, e.g. "zip", "tar", "targz". */
  id: string;
  label: string;
  extensions: string[];
  /** Cheap detection by magic bytes and/or file extension. */
  detect(file: File, headerBytes: Uint8Array): boolean;
  open(file: File, onProgress?: ProgressCallback): Promise<ArchiveReader>;
}
