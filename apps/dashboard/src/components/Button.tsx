import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`${cls(variant)} ${className}`}
    >
      {children}
    </button>
  );
}

function cls(v: Variant): string {
  if (v === "primary") {
    return "rounded border border-accent bg-accent/10 px-4 py-2 font-mono text-sm uppercase tracking-wider text-accent transition-colors hover:bg-accent/20 disabled:opacity-40";
  }
  if (v === "danger") {
    return "rounded border border-loss/60 bg-loss/5 px-4 py-2 font-mono text-sm uppercase tracking-wider text-loss transition-colors hover:bg-loss/15 disabled:opacity-40";
  }
  return "rounded border border-border bg-surface px-4 py-2 font-mono text-sm uppercase tracking-wider text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40";
}
