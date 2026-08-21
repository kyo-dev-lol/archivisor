import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import type { ArchiveEntry, ArchiveReader } from '../lib/archive/types';
import { formatBytes, formatNumber, joinPath } from '../lib/format';
import Breadcrumb from './Breadcrumb';
import SearchBar from './SearchBar';
import FileList from './FileList';
import PreviewModal from './PreviewModal';

interface ArchiveViewerProps {
  archiveName: string;
  archiveSize: number;
  reader: ArchiveReader;
  onClose: () => void;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ArchiveViewer({ archiveName, archiveSize, reader, onClose }: ArchiveViewerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [search, setSearch] = useState('');
  const [previewEntry, setPreviewEntry] = useState<ArchiveEntry | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allEntries = useMemo(() => reader.list(), [reader]);

  const stats = useMemo(() => {
    let files = 0;
    let folders = 0;
    for (const e of allEntries) {
      if (e.isDirectory) folders++;
      else files++;
    }
    return { files, folders };
  }, [allEntries]);

  const searchMode = search.trim().length > 0;

  const visibleEntries = useMemo(() => {
    if (searchMode) {
      const q = search.trim().toLowerCase();
      return allEntries.filter((e) => e.name.toLowerCase().includes(q));
    }
    const prefix = currentPath ? `${currentPath}/` : '';
    const directChildren = new Map<string, ArchiveEntry>();
    for (const e of allEntries) {
      if (prefix && !e.path.startsWith(prefix)) continue;
      if (!prefix && e.path.includes('/')) {
        const folderName = e.path.slice(0, e.path.indexOf('/'));
        if (!directChildren.has(folderName)) {
          directChildren.set(folderName, { path: folderName, name: folderName, isDirectory: true, size: 0 });
        }
        continue;
      }
      const rest = prefix ? e.path.slice(prefix.length) : e.path;
      if (!rest) continue;
      const slashIdx = rest.indexOf('/');
      if (slashIdx === -1) {
        directChildren.set(e.path, e);
      } else {
        const folderName = rest.slice(0, slashIdx);
        const folderPath = joinPath(prefix, folderName);
        if (!directChildren.has(folderPath)) {
          directChildren.set(folderPath, {
            path: folderPath,
            name: folderName,
            isDirectory: true,
            size: 0,
          });
        }
      }
    }
    return Array.from(directChildren.values());
  }, [allEntries, currentPath, search, searchMode]);

  async function collectFolderEntries(folderPath: string): Promise<ArchiveEntry[]> {
    const prefix = `${folderPath}/`;
    return allEntries.filter((e) => e.path.startsWith(prefix) && !e.isDirectory);
  }

  async function handleDownloadFile(entry: ArchiveEntry) {
    try {
      setDownloadingPath(entry.path);
      setError(null);
      const bytes = await reader.readFile(entry);
      triggerDownload(new Blob([new Uint8Array(bytes)]), entry.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file from archive.');
    } finally {
      setDownloadingPath(null);
    }
  }

  async function handleDownloadFolder(entry: ArchiveEntry) {
    try {
      setDownloadingPath(entry.path);
      setError(null);
      const members = await collectFolderEntries(entry.path);
      const zip = new JSZip();
      const prefix = `${entry.path}/`;
      for (const member of members) {
        const bytes = await reader.readFile(member);
        const relative = member.path.slice(prefix.length);
        zip.file(relative, bytes);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, `${entry.name}.zip`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to package folder.');
    } finally {
      setDownloadingPath(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-3 py-4 sm:px-6 sm:py-8">
      <header className="mb-4 flex flex-col gap-3 border-b border-[var(--vault-line)] pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold text-[var(--vault-ink)] sm:text-xl">{archiveName}</h1>
          <p className="mt-0.5 text-xs text-[var(--vault-ink-dim)] sm:text-sm">
            {formatBytes(archiveSize)} • {formatNumber(stats.files)} files • {formatNumber(stats.folders)} folders
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-md border border-[var(--vault-line)] px-3.5 py-2 text-xs font-medium text-[var(--vault-ink-dim)] transition-colors hover:border-[var(--vault-copper-dim)] hover:text-[var(--vault-copper-bright)] sm:self-auto"
        >
          Close
        </button>
      </header>

      <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb
          archiveName={archiveName}
          path={currentPath}
          onNavigate={(p) => {
            setCurrentPath(p);
            setSearch('');
          }}
        />
      </div>

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-[var(--vault-danger)]/40 bg-[var(--vault-danger)]/10 px-4 py-2.5 text-xs text-[var(--vault-danger)]">
          {error}
        </p>
      )}

      {searchMode && (
        <p className="mb-2 text-xs text-[var(--vault-ink-faint)]">
          {formatNumber(visibleEntries.length)} match{visibleEntries.length === 1 ? '' : 'es'} across the whole archive
        </p>
      )}

      <div className="flex-1 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-panel)] p-1.5 rivet sm:p-2">
        <FileList
          entries={visibleEntries}
          searchMode={searchMode}
          onOpenFolder={(path) => {
            setCurrentPath(path);
            setSearch('');
          }}
          onDownloadFile={handleDownloadFile}
          onDownloadFolder={handleDownloadFolder}
          onPreview={setPreviewEntry}
          downloadingPath={downloadingPath}
        />
      </div>

      {previewEntry && (
        <PreviewModal
          entry={previewEntry}
          onClose={() => setPreviewEntry(null)}
          onDownload={handleDownloadFile}
          readFile={(e) => reader.readFile(e)}
        />
      )}
    </div>
  );
}
