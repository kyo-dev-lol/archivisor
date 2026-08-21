interface BreadcrumbProps {
  archiveName: string;
  path: string;
  onNavigate: (path: string) => void;
}

export default function Breadcrumb({ archiveName, path, onNavigate }: BreadcrumbProps) {
  const segments = path ? path.split('/') : [];

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm" aria-label="Breadcrumb">
      <button
        type="button"
        onClick={() => onNavigate('')}
        className="rounded px-1.5 py-1 font-medium text-[var(--vault-copper-bright)] transition-colors hover:bg-[var(--vault-panel-raised)]"
      >
        {archiveName}
      </button>
      {segments.map((segment, i) => {
        const target = segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        return (
          <span key={target} className="flex items-center gap-1">
            <span className="text-[var(--vault-ink-faint)]">/</span>
            <button
              type="button"
              onClick={() => onNavigate(target)}
              disabled={isLast}
              className={`rounded px-1.5 py-1 transition-colors ${
                isLast
                  ? 'text-[var(--vault-ink)]'
                  : 'text-[var(--vault-ink-dim)] hover:bg-[var(--vault-panel-raised)] hover:text-[var(--vault-ink)]'
              }`}
            >
              {segment}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
