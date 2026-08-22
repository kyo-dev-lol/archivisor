import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  errorMessage?: string | null;
  onCreateArchive?: () => void;
}

const FORMAT_BADGES = ['ZIP', '7Z', 'TAR', 'TAR.GZ', 'GZ', 'BZ2', 'XZ'];

export default function DropZone({ onFileSelected, errorMessage, onCreateArchive }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-2xl animate-rise">
        <div className="mb-8 text-center sm:mb-10">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[var(--vault-line)] bg-[var(--vault-panel)] sm:h-16 sm:w-16"
            aria-hidden="true"
          >
            <img
              src="/Background Eraser.png"
              alt=""
              className="h-9 w-9 object-contain sm:h-10 sm:w-10"
            />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--vault-ink)] sm:text-4xl">
            Archivisor
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--vault-ink-dim)] sm:text-base">
                        Open archives in the browser, extract only what you need - or pack files into ZIP, TAR, 7Z.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ease-out sm:p-16 ${
            isDragging
              ? 'scale-[1.01] border-[var(--vault-copper-bright)] bg-[var(--vault-panel-raised)]'
              : 'border-[var(--vault-line)] bg-[var(--vault-panel)] hover:border-[var(--vault-copper-dim)] hover:bg-[var(--vault-panel-raised)]'
          }`}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(circle at 50% 30%, rgba(217,138,61,0.10), transparent 65%)',
            }}
          />
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
              e.target.value = '';
            }}
          />
          <div className="relative flex flex-col items-center gap-4">
            <ArchiveGlyph active={isDragging} />
            <p className="font-display text-lg font-semibold text-[var(--vault-ink)] sm:text-xl">
              Drop your archive here
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="rounded-full border border-[var(--vault-copper-dim)] bg-[var(--vault-void)] px-6 py-3 text-sm font-medium tracking-wide text-[var(--vault-copper-bright)] transition-colors hover:bg-[var(--vault-copper-dim)] hover:text-[var(--vault-void)]"
            >
              Choose Archive
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-4 rounded-lg border border-[var(--vault-danger)]/40 bg-[var(--vault-danger)]/10 px-4 py-3 text-center text-sm text-[var(--vault-danger)]">
            {errorMessage}
          </p>
        )}

        {onCreateArchive && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateArchive();
              }}
              className="rounded-full border border-[var(--vault-copper-dim)] px-6 py-2.5 text-sm font-medium text-[var(--vault-copper-bright)] transition-colors hover:bg-[var(--vault-copper-dim)] hover:text-[var(--vault-void)]"
            >
              Create archive from files
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {FORMAT_BADGES.map((badge) => (
            <span
              key={badge}
              className="rounded-md border border-[var(--vault-line)] bg-[var(--vault-black)] px-2.5 py-1 text-[11px] font-medium tracking-wider text-[var(--vault-ink-faint)]"
            >
              {badge}
            </span>
          ))}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--vault-ink-faint)]">
          <LockIcon />
          Your files are processed locally in your browser whenever possible.
        </p>
      </div>
    </div>
  );
}


function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ArchiveGlyph({ active }: { active: boolean }) {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--vault-copper-bright)' : 'var(--vault-copper-dim)'}
      strokeWidth="1.4"
      className="transition-transform duration-300"
      style={{ transform: active ? 'translateY(-4px) scale(1.05)' : undefined }}
    >
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 13h4" />
    </svg>
  );
}
