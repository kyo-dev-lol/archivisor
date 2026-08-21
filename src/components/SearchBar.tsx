interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vault-ink-faint)]">
        <SearchIcon />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search files…"
        className="w-full rounded-lg border border-[var(--vault-line)] bg-[var(--vault-black)] py-2.5 pl-9 pr-9 text-sm text-[var(--vault-ink)] placeholder:text-[var(--vault-ink-faint)] outline-none transition-colors focus:border-[var(--vault-copper)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--vault-ink-faint)] hover:text-[var(--vault-ink)]"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
