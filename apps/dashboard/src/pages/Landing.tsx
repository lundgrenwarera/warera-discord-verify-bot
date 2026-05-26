import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { beginLogin, getSession } from "../lib/auth";
import { DISCORD_CLIENT_ID } from "../lib/config";

export function Landing() {
  const session = getSession();
  const installUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=268437504&scope=bot`;

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-12 sm:py-20">
      <div className="text-center">
        <div className="label">War Era / Discord Verify</div>
        <h1 className="mt-2 bracket-heading text-2xl sm:text-3xl text-text">Dashboard</h1>
        <p className="mt-3 text-sm sm:text-base text-text-muted">
          Sign in with Discord to manage allowed countries, role assignments, government roles, and the foreign-government bypass for servers you administrate.
        </p>
      </div>

      <div className="mt-8 sm:mt-10 flex flex-col gap-3">
        {session ? (
          <Link
            to="/servers"
            className="w-full rounded border border-accent bg-accent/10 px-4 py-3 text-center font-mono text-sm uppercase tracking-wider text-accent hover:bg-accent/20"
          >
            Open dashboard →
          </Link>
        ) : (
          <Button onClick={beginLogin} className="!w-full !py-3 text-center justify-center">
            Sign in with Discord →
          </Button>
        )}
        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded border border-border bg-surface px-4 py-3 text-center font-mono text-sm uppercase tracking-wider text-text-muted hover:border-accent hover:text-accent"
        >
          Install to a server
        </a>
      </div>
    </section>
  );
}
