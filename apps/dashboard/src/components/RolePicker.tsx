import { useEffect, useRef, useState } from "react";
import type { GuildRole } from "../lib/api";

interface Props {
  roles: GuildRole[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

export function RolePicker({ roles, value, onChange, placeholder = "Add a role…", multiple = true }: Props) {
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

  const idToRole = new Map(roles.map((r) => [r.id, r]));
  const sorted = [...roles].sort((a, b) => b.position - a.position);
  const filtered = sorted.filter((r) => {
    if (r.managed || r.name === "@everyone") return false;
    return r.name.toLowerCase().includes(filter.toLowerCase());
  });

  const remove = (id: string) => onChange(value.filter((v) => v !== id));
  const add = (id: string) => {
    if (multiple) onChange(Array.from(new Set([...value, id])));
    else onChange([id]);
    setOpen(false); setFilter("");
  };

  return (
    <div className="relative" ref={rootRef}>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => {
            const r = idToRole.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent"
              >
                <span style={{ color: r ? `#${r.color.toString(16).padStart(6, "0")}` : undefined }}>●</span>
                @{r?.name ?? id.slice(-6)}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="ml-0.5 text-text-faint hover:text-loss"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            );
          })}
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
            placeholder="Filter roles…"
            className="block w-full border-b border-border bg-bg px-4 py-2 text-sm text-text outline-none focus:border-accent"
          />
          {filtered.length === 0 && <div className="px-4 py-3 text-xs text-text-faint">No matches.</div>}
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => add(r.id)}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-left text-sm text-text last:border-b-0 hover:bg-bg"
            >
              <span style={{ color: `#${r.color.toString(16).padStart(6, "0")}` }}>●</span>
              <span>@{r.name}</span>
              <span className="ml-auto font-mono text-[10px] text-text-faint">{r.id.slice(-6)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
