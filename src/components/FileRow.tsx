import type { ReactElement } from 'react';
import { formatBytes, getExtension, categorize, isDangerousExtension, type FileCategory } from '../lib/format';
import type { ArchiveEntry } from '../lib/archive/types';

interface FileRowProps {
  entry: ArchiveEntry;
  displayPath?: string;
  onOpenFolder?: (path: string) => void;
  onDownloadFile: (entry: ArchiveEntry) => void;
  onDownloadFolder?: (entry: ArchiveEntry) => void;
  onPreview?: (entry: ArchiveEntry) => void;
  downloadingPath?: string | null;
}

const ICONS: Record<FileCategory, ReactElement> = {
  folder: (
    <path d="M3 6a1 1 0 0 1 1-1h4.5l2 2H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
  ),
  image: <path d="M4 4h16v16H4V4Zm3 12 4-5 3 3 3-4 3 6" />,
  text: <path d="M6 3h9l5 5v13H6V3Zm8 0v5h5M9 12h6M9 16h6M9 8h2" />,
  pdf: <path d="M6 3h9l5 5v13H6V3Zm8 0v5h5M9 12h1.5a1.5 1.5 0 1 1 0 3H9v3m6-6v6m3-6v6m0-3h2" />,
  code: <path d="m8 9-4 3 4 3m8-6 4 3-4 3M13 6l-2 12" />,
  archive: <path d="M3 7h18M6 7v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M10 11h4M9 3h6l1 4H8l1-4Z" />,
  audio: <path d="M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
  video: <path d="M4 5h12v14H4V5Zm12 4 5-3v12l-5-3" />,
  dangerous: <path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6l-9-4Zm0 6v4m0 4h.01" />,
  generic: <path d="M6 3h9l5 5v13H6V3Zm8 0v5h5" />,
};

function FileTypeIcon({ category }: { category: FileCategory }) {
  const color =
    category === 'dangerous'
      ? 'var(--vault-danger)'
      : category === 'folder'
        ? 'var(--vault-copper-bright)'
        : 'var(--vault-ink-dim)';
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[category]}
    </svg>
  );
}

export default function FileRow({
  entry,
  displayPath,
  onOpenFolder,
  onDownloadFile,
  onDownloadFolder,
  onPreview,
  downloadingPath,
}: FileRowProps) {
  const category = categorize(entry.name, entry.isDirectory);
  const dangerous = !entry.isDirectory && isDangerousExtension(entry.name);
  const ext = getExtension(entry.name);
  const isDownloading = downloadingPath === entry.path;

  if (entry.isDirectory) {
    return (
      <div className="group flex min-h-[52px] items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--vault-panel-raised)]">
        <button
          type="button"
          onClick={() => onOpenFolder?.(entry.path)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <FileTypeIcon category="folder" />
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--vault-ink)]">
            {displayPath ?? entry.name}
          </span>
          <span className="text-[var(--vault-ink-faint)] transition-transform group-hover:translate-x-0.5">
            ›
          </span>
        </button>
        {onDownloadFolder && (
          <button
            type="button"
            onClick={() => onDownloadFolder(entry)}
            title="Download folder as zip"
            className="shrink-0 rounded-md border border-[var(--vault-line)] bg-[var(--vault-black)] px-2.5 py-2 text-xs font-medium text-[var(--vault-ink-dim)] opacity-100 transition-colors hover:border-[var(--vault-copper-dim)] hover:text-[var(--vault-copper-bright)] sm:opacity-0 sm:group-hover:opacity-100"
          >
            {isDownloading ? '…' : '⇩ folder'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[52px] items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--vault-panel-raised)]">
      <FileTypeIcon category={category} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-[var(--vault-ink)]">{displayPath ?? entry.name}</span>
          {dangerous && (
            <span
              title="Potentially executable file — never auto-run archive contents"
              className="shrink-0 rounded border border-[var(--vault-danger)]/50 bg-[var(--vault-danger)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--vault-danger)]"
            >
              risky
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--vault-ink-faint)]">
          <span>{formatBytes(entry.size)}</span>
          {ext && <span className="uppercase">{ext}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onPreview && !dangerous && (
          <button
            type="button"
            onClick={() => onPreview(entry)}
            className="rounded-md px-2.5 py-2 text-xs font-medium text-[var(--vault-ink-dim)] transition-colors hover:bg-[var(--vault-black)] hover:text-[var(--vault-ink)]"
          >
            Preview
          </button>
        )}
        <button
          type="button"
          onClick={() => onDownloadFile(entry)}
          disabled={isDownloading}
          className="rounded-md border border-[var(--vault-copper-dim)] px-3 py-2 text-xs font-medium text-[var(--vault-copper-bright)] transition-colors hover:bg-[var(--vault-copper-dim)] hover:text-[var(--vault-void)] disabled:opacity-50"
        >
          {isDownloading ? '…' : 'Download'}
        </button>
      </div>
    </div>
  );
}
