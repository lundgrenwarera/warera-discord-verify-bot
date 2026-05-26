import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Panel } from "../components/Panel";
import { api, type GuildSummary } from "../lib/api";
import { beginLogin, getSession } from "../lib/auth";
import { DISCORD_CLIENT_ID } from "../lib/config";

export function Servers() {
  const navigate = useNavigate();
  const [guilds, setGuilds] = useState<GuildSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = getSession();

  useEffect(() => {
    if (!session) { navigate("/", { replace: true }); return; }
    api.guilds()
      .then((r) => setGuilds(r.guilds))
      .catch((e) => {
        if (e?.status === 401) { beginLogin(); return; }
        setError(String(e?.message ?? e));
      });
  }, [navigate, session]);

  const installUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=268437504&scope=bot`;

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <div className="label">Section II</div>
        <h1 className="mt-2 bracket-heading text-xl sm:text-2xl text-text">Your servers</h1>
        <p className="mt-3 text-sm text-text-muted">
          Where you're an administrator or have a configured manager role. Servers without the bot installed appear too.
        </p>
        {session && (
          <div className="mt-3 label">signed in as {session.payload.username}</div>
        )}
      </div>

      {error && (
        <div className="mt-6">
          <Panel>
            <div className="label text-loss">Couldn't load servers</div>
            <p className="mt-2 text-sm text-text">{error}</p>
          </Panel>
        </div>
      )}

      {guilds === null && !error && (
        <div className="mt-8 label">Loading…</div>
      )}

      {guilds && guilds.length === 0 && (
        <div className="mt-6">
          <Panel title="No qualifying servers">
            <p className="text-sm text-text-muted">
              You need the Administrator permission in a Discord server (or a manager role granted by an admin), and the bot must be installed.
            </p>
            <a
              href={installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded border border-accent bg-accent/10 px-4 py-2 font-mono text-sm uppercase tracking-wider text-accent hover:bg-accent/20"
            >
              Install the bot
            </a>
          </Panel>
        </div>
      )}

      {guilds && guilds.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {guilds.map((g) => (
            <ServerCard key={g.id} guild={g} installUrl={installUrl} />
          ))}
        </div>
      )}
    </section>
  );
}

function ServerCard({ guild, installUrl }: { guild: GuildSummary; installUrl: string }) {
  const iconUrl = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null;
  const guildInstallUrl = `${installUrl}&guild_id=${guild.id}&disable_guild_select=true`;
  return (
    <Panel>
      <div className="flex items-start gap-3">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-10 w-10 rounded border border-border" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-bg text-accent font-semibold">
            {guild.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-text">{guild.name}</div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-text-faint">{guild.id}</div>
        </div>
      </div>
      <div className="mt-4">
        {guild.botInstalled ? (
          <Link
            to={`/servers/${guild.id}`}
            className="font-mono text-[11px] uppercase tracking-wider text-accent hover:underline"
          >
            Configure →
          </Link>
        ) : (
          <a
            href={guildInstallUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] uppercase tracking-wider text-accent hover:underline"
          >
            Install bot →
          </a>
        )}
      </div>
    </Panel>
  );
}
