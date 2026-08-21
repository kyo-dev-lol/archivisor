import { useEffect, useState } from 'react';
import type { ArchiveEntry } from '../lib/archive/types';
import { formatBytes, isCsv, isJson, isPdf, isPreviewableImage, isPreviewableText, isDangerousExtension } from '../lib/format';

interface PreviewModalProps {
  entry: ArchiveEntry;
  onClose: () => void;
  onDownload: (entry: ArchiveEntry) => void;
  readFile: (entry: ArchiveEntry) => Promise<Uint8Array>;
}

const TEXT_PREVIEW_CAP = 4 * 1024 * 1024; // 4 MB
const IMAGE_PREVIEW_CAP = 40 * 1024 * 1024; // 40 MB
const PDF_PREVIEW_CAP = 80 * 1024 * 1024; // 80 MB
const CSV_ROW_CAP = 500;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'too-large' }
  | { status: 'ready' };

export default function PreviewModal({ entry, onClose, onDownload, readFile }: PreviewModalProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const dangerous = isDangerousExtension(entry.name);
  const image = isPreviewableImage(entry.name);
  const pdf = isPdf(entry.name);
  const csv = isCsv(entry.name);
  const json = isJson(entry.name);
  const text = isPreviewableText(entry.name) && !csv && !json;

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    async function load() {
      if (dangerous) {
        setState({ status: 'error' as const, message: 'No preview available for this file type.' });
        return;
      }
      const cap = image ? IMAGE_PREVIEW_CAP : pdf ? PDF_PREVIEW_CAP : TEXT_PREVIEW_CAP;
      if ((image || pdf || text || csv || json) && entry.size > cap) {
        setState({ status: 'too-large' });
        return;
      }
      if (!(image || pdf || text || csv || json)) {
        setState({ status: 'error', message: 'No preview available for this file type.' });
        return;
      }
      try {
        const bytes = await readFile(entry);
        if (cancelled) return;
        if (image || pdf) {
          const mime = pdf ? 'application/pdf' : mimeForImage(entry.name);
          const blob = new Blob([new Uint8Array(bytes)], { type: mime });
          url = URL.createObjectURL(blob);
          setObjectUrl(url);
        } else {
          const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
          setTextContent(decoded);
        }
        setState({ status: 'ready' });
      } catch (err) {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Failed to load preview.' });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.path]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--vault-line)] bg-[var(--vault-panel)] shadow-2xl animate-rise sm:max-w-3xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--vault-line)] px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-[var(--vault-ink)]">{entry.name}</p>
            <p className="text-xs text-[var(--vault-ink-faint)]">{formatBytes(entry.size)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload(entry)}
              className="rounded-md border border-[var(--vault-copper-dim)] px-3 py-1.5 text-xs font-medium text-[var(--vault-copper-bright)] transition-colors hover:bg-[var(--vault-copper-dim)] hover:text-[var(--vault-void)]"
            >
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-md p-1.5 text-[var(--vault-ink-dim)] transition-colors hover:bg-[var(--vault-panel-raised)] hover:text-[var(--vault-ink)]"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-[200px] flex-1 overflow-auto p-0">
          {state.status === 'loading' && (
            <div className="flex h-64 items-center justify-center text-sm text-[var(--vault-ink-dim)]">
              Loading preview…
            </div>
          )}
          {state.status === 'too-large' && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm text-[var(--vault-ink-dim)]">
                This file is too large to preview in-browser ({formatBytes(entry.size)}).
              </p>
              <p className="text-xs text-[var(--vault-ink-faint)]">You can still download it.</p>
            </div>
          )}
          {state.status === 'error' && (
            <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-[var(--vault-ink-dim)]">
              {state.message}
            </div>
          )}
          {state.status === 'ready' && image && objectUrl && (
            <div className="flex items-center justify-center bg-[var(--vault-void)] p-6">
              <img src={objectUrl} alt={entry.name} className="max-h-[65dvh] max-w-full rounded object-contain" />
            </div>
          )}
          {state.status === 'ready' && pdf && objectUrl && (
            <iframe title={entry.name} src={objectUrl} className="h-[75dvh] w-full border-0" />
          )}
          {state.status === 'ready' && json && textContent !== null && (
            <JsonPreview content={textContent} />
          )}
          {state.status === 'ready' && csv && textContent !== null && <CsvPreview content={textContent} />}
          {state.status === 'ready' && text && textContent !== null && (
            <pre className="max-h-[70dvh] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-relaxed text-[var(--vault-ink)]">
              {textContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function mimeForImage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'svg':
      return 'image/svg+xml';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

function JsonPreview({ content }: { content: string }) {
  let pretty = content;
  try {
    pretty = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // not valid JSON — fall back to raw text rather than crashing the preview
  }
  return (
    <pre className="max-h-[70dvh] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-relaxed text-[var(--vault-ink)]">
      {pretty}
    </pre>
  );
}

function CsvPreview({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  const truncated = lines.length > CSV_ROW_CAP;
  const rows = lines.slice(0, CSV_ROW_CAP).map((line) => line.split(','));
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return (
    <div className="p-4">
      {truncated && (
        <p className="mb-2 text-xs text-[var(--vault-ink-faint)]">
          Showing first {CSV_ROW_CAP.toLocaleString()} of {lines.length.toLocaleString()} rows.
        </p>
      )}
      <div className="overflow-auto rounded-lg border border-[var(--vault-line)]">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--vault-panel-raised)]">
              {header.map((cell, i) => (
                <th key={i} className="border-b border-[var(--vault-line)] px-3 py-2 text-left font-semibold text-[var(--vault-copper-bright)]">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-[var(--vault-black)]/40'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="whitespace-nowrap border-b border-[var(--vault-line-soft)] px-3 py-1.5 text-[var(--vault-ink-dim)]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
