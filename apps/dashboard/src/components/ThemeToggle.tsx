import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, setStoredTheme, type ThemeChoice } from "../lib/theme";

const CHOICES: ThemeChoice[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(choice);
    setStoredTheme(choice);
  }, [choice]);

  useEffect(() => {
    if (choice !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [choice]);

  return (
    <div className="flex items-center gap-1 rounded border border-border bg-surface p-0.5">
      {CHOICES.map((c) => {
        const active = c === choice;
        return (
          <button
            key={c}
            type="button"
            onClick={() => setChoice(c)}
            className={
              active
                ? "rounded bg-accent/15 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-accent"
                : "rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-faint hover:text-text"
            }
            aria-label={`Theme: ${c}`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
