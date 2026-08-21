import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  PACK_FORMATS,
  packArchive,
  extensionForFormat,
  downloadBytes,
  type PackFormat,
  type PackFile,
} from '../lib/archive/pack';
import { formatBytes } from '../lib/format';

interface ListedItem {
  id: string;
  file: File;
  path: string;
}

interface PackZoneProps {
  onBack: () => void;
}

export default function PackZone({ onBack }: PackZoneProps) {
  const [items, setItems] = useState<ListedItem[]>([]);
  const [format, setFormat] = useState<PackFormat>('zip');
  const [archiveName, setArchiveName] = useState('archive');
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((list: FileList | File[]) => {
    const next: ListedItem[] = [];
    for (const file of Array.from(list)) {
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        path: file.name,
      });
    }
    if (next.length) {
      setItems((prev) => [...prev, ...next]);
      setError(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const updatePath = (id: string, path: string) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, path } : x)));
  };

  const totalSize = items.reduce((n, x) => n + x.file.size, 0);

  const handleCreate = async () => {
    if (items.length === 0) {
      setError('Add at least one file.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgressMsg('Reading files¦');
    try {
      const packed: PackFile[] = [];
      for (const item of items) {
        const buf = new Uint8Array(await item.file.arrayBuffer());
        const path = item.path.trim().replace(/^\/+/, '').replace(/\\/g, '/') || item.file.name;
        packed.push({ path, data: buf });
      }
      const data = await packArchive(format, packed, (p) => {
        const pct = p.fraction != null ? ` ${Math.round(p.fraction * 100)}%` : '';
        setProgressMsg(`${p.message ?? p.phase}${pct}`);
      });
      const base = archiveName.trim() || 'archive';
      const ext = extensionForFormat(format);
      const filename = base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
      downloadBytes(data, filename);
      setProgressMsg(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create archive.');
      setProgressMsg(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl animate-rise">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="rounded-full border border-[var(--vault-line)] px-4 py-2 text-xs font-medium text-[var(--vault-ink-dim)] transition-colors hover:border-[var(--vault-copper-dim)] hover:text-[var(--vault-copper-bright)] disabled:opacity-50"
          >
            Back
          </button>
          <h1 className="font-display text-xl font-bold tracking-tight text-[var(--vault-ink)] sm:text-2xl">
            Create archive
          </h1>
          <div className="w-[72px]" aria-hidden="true" />
        </div>

        <p className="mb-5 text-center text-sm text-[var(--vault-ink-dim)]">
          Drop any files, pick a format, download the archive. Everything stays in your browser.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !busy && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          className={`mb-5 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 sm:p-10 ${
            isDragging
              ? 'border-[var(--vault-copper-bright)] bg-[var(--vault-panel-raised)]'
              : 'border-[var(--vault-line)] bg-[var(--vault-panel)] hover:border-[var(--vault-copper-dim)]'
          }`}
        >
          <p className="font-display text-base font-semibold text-[var(--vault-ink)]">
            Drop files here
          </p>
          <p className="mt-1 text-xs text-[var(--vault-ink-faint)]">or click to choose - multiple allowed</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--vault-line)] bg-[var(--vault-panel)]">
            <div className="flex items-center justify-between border-b border-[var(--vault-line-soft)] px-4 py-2.5 text-xs text-[var(--vault-ink-faint)]">
              <span>
                {items.length} file{items.length === 1 ? '' : 's'}
              </span>
              <span>{formatBytes(totalSize)}</span>
            </div>
            <ul className="max-h-[40dvh] overflow-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 border-b border-[var(--vault-line-soft)] px-3 py-2 last:border-b-0"
                >
                  <input
                    type="text"
                    value={item.path}
                    onChange={(e) => updatePath(item.id, e.target.value)}
                    disabled={busy}
                    className="min-w-0 flex-1 rounded-md border border-[var(--vault-line)] bg-[var(--vault-black)] px-2.5 py-1.5 text-xs text-[var(--vault-ink)] outline-none focus:border-[var(--vault-copper-dim)]"
                    aria-label="Path inside archive"
                  />
                  <span className="shrink-0 text-[10px] text-[var(--vault-ink-faint)]">
                    {formatBytes(item.file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={busy}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--vault-ink-dim)] hover:text-[var(--vault-danger)] disabled:opacity-50"
                    aria-label="Remove"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-[var(--vault-line)] bg-[var(--vault-panel)] p-4 sm:p-5">
          <label className="mb-2 block text-xs font-medium text-[var(--vault-ink-dim)]">
            Archive name
          </label>
          <input
            type="text"
            value={archiveName}
            onChange={(e) => setArchiveName(e.target.value)}
            disabled={busy}
            className="mb-4 w-full rounded-lg border border-[var(--vault-line)] bg-[var(--vault-black)] px-3 py-2.5 text-sm text-[var(--vault-ink)] outline-none focus:border-[var(--vault-copper-dim)]"
            placeholder="archive"
          />

          <p className="mb-2 text-xs font-medium text-[var(--vault-ink-dim)]">Format</p>
          <div className="flex flex-wrap gap-2">
            {PACK_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => setFormat(f.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                  format === f.id
                    ? 'bg-gradient-to-r from-[var(--vault-copper-dim)] to-[var(--vault-copper-bright)] text-[var(--vault-void)]'
                    : 'border border-[var(--vault-line)] text-[var(--vault-ink-dim)] hover:border-[var(--vault-copper-dim)] hover:text-[var(--vault-copper-bright)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--vault-ink-faint)]">
            RAR cannot be created in the browser (proprietary format). Use ZIP, TAR, TAR.GZ, or 7Z.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-[var(--vault-danger)]/40 bg-[var(--vault-danger)]/10 px-4 py-3 text-center text-sm text-[var(--vault-danger)]">
            {error}
          </p>
        )}

        {progressMsg && (
          <p className="mb-4 text-center text-xs text-[var(--vault-copper-bright)]">{progressMsg}</p>
        )}

        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || items.length === 0}
          className="w-full rounded-full border border-[var(--vault-copper-dim)] bg-[var(--vault-void)] py-3.5 text-sm font-semibold tracking-wide text-[var(--vault-copper-bright)] transition-colors hover:bg-[var(--vault-copper-dim)] hover:text-[var(--vault-void)] disabled:opacity-50"
        >
          {busy ? 'Creating¦' : `Create .${extensionForFormat(format)}`}
        </button>
      </div>
    </div>
  );
}
