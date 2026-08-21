import type { ArchiveEntry } from '../lib/archive/types';
import FileRow from './FileRow';

interface FileListProps {
  entries: ArchiveEntry[];
  searchMode: boolean;
  onOpenFolder: (path: string) => void;
  onDownloadFile: (entry: ArchiveEntry) => void;
  onDownloadFolder: (entry: ArchiveEntry) => void;
  onPreview: (entry: ArchiveEntry) => void;
  downloadingPath: string | null;
}

export default function FileList({
  entries,
  searchMode,
  onOpenFolder,
  onDownloadFile,
  onDownloadFolder,
  onPreview,
  downloadingPath,
}: FileListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="text-3xl opacity-40">◌</span>
        <p className="text-sm text-[var(--vault-ink-dim)]">
          {searchMode ? 'No matches found.' : 'This folder is empty.'}
        </p>
      </div>
    );
  }

  // Sort: folders first, then alphabetically — stable, predictable browsing.
  const sorted = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-0.5">
      {sorted.map((entry) => (
        <FileRow
          key={entry.path}
          entry={entry}
          displayPath={searchMode ? entry.path : undefined}
          onOpenFolder={onOpenFolder}
          onDownloadFile={onDownloadFile}
          onDownloadFolder={onDownloadFolder}
          onPreview={onPreview}
          downloadingPath={downloadingPath}
        />
      ))}
    </div>
  );
}
