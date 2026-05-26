import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="tactical-panel rounded-sm p-4 sm:p-5">
      {title && (
        <header className="mb-3">
          <h2 className="bracket-heading text-sm text-text">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-text-faint">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
