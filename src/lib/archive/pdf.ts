import * as pdfjs from 'pdfjs-dist';
import type { ArchiveEntry, ArchiveHandler, ArchiveReader, ProgressCallback } from './types';

// PDF.js worker (Vite resolves the URL at build time).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function isPdfHeader(bytes: Uint8Array): boolean {
  // %PDF
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

    onProgress?.({ phase: 'extracting', fraction: 0.1, message: `Rendering page ${pageNumber}...` });
    const page = await this.pdf.getPage(pageNumber);
    // Scale for readable preview / download ( ~150 DPI-ish )
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    onProgress?.({ phase: 'extracting', fraction: 0.8, message: 'Encoding PNG...' });

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
    });
    const buf = new Uint8Array(await blob.arrayBuffer());
    this.pageCache.set(pageNumber, buf);
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

    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const total = pdf.numPages;
    const entries: ArchiveEntry[] = [];
    for (let i = 0; i < total; i++) {
      entries.push({
        path: pagePath(i, total),
        name: pagePath(i, total),
        isDirectory: false,
        // Unknown until rendered; placeholder keeps UI happy
        size: 0,
      });
    }
    onProgress?.({ phase: 'indexing', fraction: 1, message: `${total} page${total === 1 ? '' : 's'}` });
    return new PdfReader(pdf, entries);
  },
};
