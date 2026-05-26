import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

export function CountryPicker({ options, value, onChange, placeholder = "Search countries…", multiple = true }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(
    () => options.filter((c) => c.toLowerCase().includes(filter.toLowerCase())).slice(0, 50),
    [options, filter],
  );

  const remove = (c: string) => onChange(value.filter((v) => v !== c));
  const add = (c: string) => {
    if (multiple) onChange(Array.from(new Set([...value, c])).sort());
    else { onChange([c]); setOpen(false); }
    setFilter("");
  };

  return (
    <div className="relative" ref={rootRef}>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent"
            >
              {c}
              <button
                type="button"
                onClick={() => remove(c)}
                className="ml-0.5 text-text-faint hover:text-loss"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded border border-border bg-surface px-4 py-2.5 text-left text-sm text-text hover:border-accent focus:border-accent focus:outline-none"
      >
        <span className="text-text-muted">{placeholder}</span>
        <span className="font-mono text-text-faint">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded border border-border bg-surface shadow-lg">
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Type to search…"
            className="block w-full border-b border-border bg-bg px-4 py-2 text-sm text-text outline-none focus:border-accent"
          />
          {filtered.length === 0 && <div className="px-4 py-3 text-xs text-text-faint">No matches.</div>}
          {filtered.map((c) => {
            const already = value.includes(c);
            return (
              <button
                key={c}
                type="button"
                disabled={already}
                onClick={() => !already && add(c)}
                className="flex w-full items-center border-b border-border px-4 py-2 text-left text-sm text-text last:border-b-0 hover:bg-bg disabled:opacity-40"
              >
                <span>{c}</span>
                {already && <span className="ml-auto font-mono text-[10px] text-accent">selected</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
