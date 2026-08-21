import { useCallback, useRef, useState } from 'react';
import DropZone from './components/DropZone';
import ProgressBar from './components/ProgressBar';
import ArchiveViewer from './components/ArchiveViewer';
import { detectFormat, isKnownUnsupported } from './lib/archive/registry';
import type { ArchiveReader, ProgressEvent } from './lib/archive/types';

type AppState =
  | { phase: 'idle'; error: string | null }
  | { phase: 'loading'; fileName: string; progress: ProgressEvent | null }
  | { phase: 'loaded'; fileName: string; fileSize: number; reader: ArchiveReader }
  | { phase: 'unsupported'; fileName: string; extension: string };

export default function App() {
  const [state, setState] = useState<AppState>({ phase: 'idle', error: null });
  const readerRef = useRef<ArchiveReader | null>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    const unsupportedExt = isKnownUnsupported(file.name);
    if (unsupportedExt) {
      setState({ phase: 'unsupported', fileName: file.name, extension: unsupportedExt });
      return;
    }

    setState({ phase: 'loading', fileName: file.name, progress: null });

    try {
      const handler = await detectFormat(file);
      if (!handler) {
        setState({
          phase: 'idle',
          error: `"${file.name}" doesn't look like a supported archive (ZIP, 7Z, TAR, TAR.GZ, GZ, BZ2, XZ).`,
        });
        return;
      }
      const reader = await handler.open(file, (progress) => {
        setState({ phase: 'loading', fileName: file.name, progress });
      });
      readerRef.current = reader;
      setState({ phase: 'loaded', fileName: file.name, fileSize: file.size, reader });
    } catch (err) {
      setState({
        phase: 'idle',
        error: err instanceof Error ? `Couldn't open "${file.name}": ${err.message}` : 'Failed to open archive.',
      });
    }
  }, []);

  const handleClose = useCallback(() => {
    readerRef.current?.dispose?.();
    readerRef.current = null;
    setState({ phase: 'idle', error: null });
  }, []);

  return (
    <>
      <div className="grain-overlay" />
      {state.phase === 'idle' && <DropZone onFileSelected={handleFileSelected} errorMessage={state.error} />}
      {state.phase === 'loading' && <ProgressBar progress={state.progress} fileName={state.fileName} />}
      {state.phase === 'unsupported' && (
        <UnsupportedFormat fileName={state.fileName} extension={state.extension} onBack={handleClose} />
      )}
      {state.phase === 'loaded' && (
        <ArchiveViewer
          archiveName={state.fileName}
          archiveSize={state.fileSize}
          reader={state.reader}
          onClose={handleClose}
        />
      )}
    </>
  );
}

function UnsupportedFormat({ fileName, extension, onBack }: { fileName: string; extension: string; onBack: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md animate-rise">
        <p className="font-display text-lg font-semibold text-[var(--vault-ink)]">
          .{extension.toUpperCase()} can't be previewed in your browser
        </p>
        <p className="mt-2 truncate text-sm text-[var(--vault-ink-dim)]">{fileName}</p>
        <p className="mt-3 text-xs text-[var(--vault-ink-faint)]">
          This format isn't supported for in-browser parsing yet. Try ZIP, 7Z, TAR, TAR.GZ, GZ, BZ2 or XZ.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 rounded-full border border-[var(--vault-copper-dim)] px-6 py-2.5 text-sm font-medium text-[var(--vault-copper-bright)] transition-colors hover:bg-[var(--vault-copper-dim)] hover:text-[var(--vault-void)]"
        >
          Try another file
        </button>
      </div>
    </div>
  );
}
