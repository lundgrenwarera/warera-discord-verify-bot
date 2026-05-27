import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./components/ThemeToggle";
import { clearSession, getSession } from "./lib/auth";
import { LUNDGREN_PROFILE_URL, TIP_ARTICLE_URL } from "./lib/config";

export function App({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex-1">{children}</main>
      <footer className="mt-auto border-t border-border px-4 py-5 text-center text-[11px] text-text-faint">
        provided to you by{" "}
        <a href={LUNDGREN_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
          Lundgrens Technology AB
        </a>
        {" · "}
        <a href={TIP_ARTICLE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
          tip
        </a>
        {" · "}
        <a href="https://github.com/lundgrenwarera/warera-discord-verify-bot" target="_blank" rel="noopener noreferrer" className="hover:text-accent">
          source
        </a>
      </footer>
    </div>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const session = getSession();
  const logout = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/">
          <div className="label text-accent">War Era</div>
          <div className="bracket-heading text-sm text-text">Discord Verify</div>
        </Link>
        <div className="flex items-center gap-3">
          {session && (
            <>
              <Link to="/servers" className="label hover:text-text">Servers</Link>
              <button type="button" onClick={logout} className="label hover:text-loss">Sign out</button>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
