import type { ProgressEvent } from '../lib/archive/types';

interface ProgressBarProps {
  progress: ProgressEvent | null;
  fileName: string;
}

const PHASE_LABEL: Record<string, string> = {
  reading: 'Reading archive',
  decompressing: 'Decompressing',
  indexing: 'Indexing entries',
  extracting: 'Extracting',
};

export default function ProgressBar({ progress, fileName }: ProgressBarProps) {
  const fraction = progress?.fraction;
  const pct = fraction !== undefined ? Math.round(fraction * 100) : null;
  const label = progress ? PHASE_LABEL[progress.phase] ?? progress.phase : 'Reading archive';

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <div className="w-full max-w-md animate-rise text-center">
        <div className="mx-auto mb-6 h-12 w-12 animate-dial">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--vault-copper)" strokeWidth="1.4">
            <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
            <circle cx="12" cy="12" r="2.2" fill="var(--vault-copper)" />
          </svg>
        </div>
        <p className="truncate font-display text-base font-semibold text-[var(--vault-ink)]">{fileName}</p>
        <p className="mt-1 text-sm text-[var(--vault-ink-dim)]">
          {label}
          {pct !== null ? `… ${pct}%` : '…'}
        </p>
        {progress?.message && (
          <p className="mt-1 text-xs text-[var(--vault-ink-faint)]">{progress.message}</p>
        )}
        <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full border border-[var(--vault-line)] bg-[var(--vault-black)]">
          {pct !== null ? (
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--vault-copper-dim)] to-[var(--vault-copper-bright)] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(pct, 3)}%` }}
            />
          ) : (
            <div className="gauge-stripes h-full w-full opacity-80" />
          )}
        </div>
      </div>
    </div>
  );
}
