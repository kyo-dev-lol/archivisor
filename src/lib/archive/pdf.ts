import * as pdfjs from 'pdfjs-dist';
import type { ArchiveEntry, ArchiveHandler, ArchiveReader, ProgressCallback } from './types';

// Use CDN worker matching pdfjs-dist 4.10.38.
// Local ?url worker often 404s on SPA hosts (Cloudflare returns index.html → MIME error).
const PDFJS_VERSION = '4.10.38';
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

function isPdfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

function pagePath(index: number, total: number): string {
  const width = Math.max(3, String(total).length);
  const n = String(index + 1).padStart(width, '0');
  return `page-${n}.png`;
}

class PdfReader implements ArchiveReader {
  private pdf: pdfjs.PDFDocumentProxy;
  private entries: ArchiveEntry[];
  private pageCache = new Map<number, Uint8Array>();

  constructor(pdf: pdfjs.PDFDocumentProxy, entries: ArchiveEntry[]) {
    this.pdf = pdf;
    this.entries = entries;
  }

  getFormat(): string {
    return 'pdf';
  }

  list(): ArchiveEntry[] {
    return this.entries;
  }

  async readFile(entry: ArchiveEntry, onProgress?: ProgressCallback): Promise<Uint8Array> {
    const match = /^page-(\d+)\.png$/i.exec(entry.name);
    if (!match) throw new Error(`Unknown PDF entry: ${entry.path}`);
    const pageNumber = parseInt(match[1], 10);
    if (pageNumber < 1 || pageNumber > this.pdf.numPages) {
      throw new Error(`Page out of range: ${pageNumber}`);
    }

    const cached = this.pageCache.get(pageNumber);
    if (cached) return cached;

    onProgress?.({ phase: 'extracting', fraction: 0.15, message: `Rendering page ${pageNumber}...` });
    const page = await this.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas not available');

    const task = page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]);
    await task.promise;

    onProgress?.({ phase: 'extracting', fraction: 0.85, message: 'Encoding PNG...' });
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
    });
    const buf = new Uint8Array(await blob.arrayBuffer());
    this.pageCache.set(pageNumber, buf);

    const listed = this.entries.find((e) => e.path === entry.path);
    if (listed) listed.size = buf.byteLength;

    onProgress?.({ phase: 'extracting', fraction: 1 });
    return buf;
  }

  dispose(): void {
    this.pageCache.clear();
    void this.pdf.destroy();
  }
}

export const pdfHandler: ArchiveHandler = {
  id: 'pdf',
  label: 'PDF',
  extensions: ['pdf'],
  detect(file, headerBytes) {
    return isPdfHeader(headerBytes) || /\.pdf$/i.test(file.name);
  },
  async open(file, onProgress) {
    onProgress?.({ phase: 'reading', message: 'Loading PDF...' });
    const data = new Uint8Array(await file.arrayBuffer());
    onProgress?.({ phase: 'indexing', message: 'Reading pages...', fraction: 0.3 });

    const pdf = await pdfjs.getDocument({
      data,
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    const total = pdf.numPages;
    const entries: ArchiveEntry[] = [];
    for (let i = 0; i < total; i++) {
      entries.push({
        path: pagePath(i, total),
        name: pagePath(i, total),
        isDirectory: false,
        size: 0,
      });
    }
    onProgress?.({
      phase: 'indexing',
      fraction: 1,
      message: `${total} page${total === 1 ? '' : 's'}`,
    });
    return new PdfReader(pdf, entries);
  },
};
