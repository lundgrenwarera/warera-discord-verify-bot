import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { api, type MemberRow } from "../lib/api";

type Filter = "all" | "linked" | "unlinked" | "issues";

const POSITION_LABEL: Record<string, string> = {
  president: "President",
  vicePresident: "Vice President",
  defense: "Min. Defense",
  economy: "Min. Economy",
  foreignAffairs: "Min. Foreign Affairs",
};

export function Members() {
  const { guildId = "" } = useParams();
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [claimOpen, setClaimOpen] = useState<string | null>(null);
  const [claimName, setClaimName] = useState("");
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [unlinkOpen, setUnlinkOpen] = useState<string | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState(false);

  const load = () => {
    setRefreshing(true);
    api.guildMembers(guildId)
      .then((r) => setRows(r.members))
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setRefreshing(false));
  };

  useEffect(load, [guildId]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "linked" && !r.linked) return false;
      if (filter === "unlinked" && r.linked) return false;
      if (filter === "issues" && !hasIssue(r)) return false;
      if (q && !r.username.toLowerCase().includes(q) && !(r.wareraUsername ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    if (!rows) return { all: 0, linked: 0, unlinked: 0, issues: 0 };
    return {
      all: rows.length,
      linked: rows.filter((r) => r.linked).length,
      unlinked: rows.filter((r) => !r.linked).length,
      issues: rows.filter(hasIssue).length,
    };
  }, [rows]);

  const claim = async (discordUserId: string) => {
    if (!claimName.trim()) return;
    setClaimMessage(null);
    try {
      const r = await api.manualVerify(guildId, discordUserId, claimName.trim());
      setClaimMessage(`Linked. ${r.assigned}/${r.total} roles assigned.`);
      setClaimOpen(null); setClaimName("");
      load();
    } catch (e) {
      setClaimMessage(String((e as { message?: string })?.message ?? e));
    }
  };

  const unlink = async (discordUserId: string) => {
    setUnlinkBusy(true);
    setClaimMessage(null);
    try {
      const r = await api.unlinkMember(guildId, discordUserId);
      const suffix = r.failed > 0 ? ` (${r.failed} could not be removed — check bot role hierarchy)` : "";
      setClaimMessage(`Verification removed. ${r.removed} role(s) removed${suffix}.`);
      setUnlinkOpen(null);
      load();
    } catch (e) {
      setClaimMessage(String((e as { message?: string })?.message ?? e));
    } finally {
      setUnlinkBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <div className="flex items-center gap-3">
          <Link to={`/servers/${guildId}`} className="label hover:text-text">← Server config</Link>
          <span className="font-mono text-[10px] text-text-faint">{guildId}</span>
        </div>
        <div className="mt-4 label">Section III</div>
        <h1 className="mt-2 bracket-heading text-xl sm:text-2xl text-text">Members</h1>
        <p className="mt-3 text-sm text-text-muted">
          Everyone with a tracked role, or already linked to a War Era account. Flagged rows have drift between their stored state and current War Era state.
        </p>
      </div>

      {error && (
        <div className="mt-6">
          <Panel><div className="label text-loss">Error</div><p className="mt-2 text-sm text-text">{error}</p></Panel>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["all", "linked", "unlinked", "issues"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              f === filter
                ? "rounded border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-accent"
                : "rounded border border-border bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-text-muted hover:border-accent hover:text-accent"
            }
          >
            {f} ({counts[f]})
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or War Era username…"
          className="ml-auto w-64 rounded border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
        />
        <Button variant="ghost" onClick={load} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {claimMessage && (
        <div className="mt-4 font-mono text-xs text-text-muted">{claimMessage}</div>
      )}

      {rows === null && !error && (
        <div className="mt-8 label">Loading members…</div>
      )}

      {rows && (
        <div className="mt-6">
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-faint">
                    <th className="pb-2 pr-3 font-medium">Discord</th>
                    <th className="pb-2 pr-3 font-medium">War Era</th>
                    <th className="pb-2 pr-3 font-medium">Country</th>
                    <th className="pb-2 pr-3 font-medium">Lvl</th>
                    <th className="pb-2 pr-3 font-medium">Position</th>
                    <th className="pb-2 pr-3 font-medium">Flags</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-xs text-text-faint">No members match.</td></tr>
                  )}
                  {filtered.map((r) => (
                    <Row
                      key={r.discordUserId}
                      row={r}
                      claimOpen={claimOpen === r.discordUserId}
                      onOpenClaim={() => { setClaimOpen(r.discordUserId); setClaimName(""); setClaimMessage(null); }}
                      onCancelClaim={() => setClaimOpen(null)}
                      claimName={claimName}
                      setClaimName={setClaimName}
                      onConfirmClaim={() => claim(r.discordUserId)}
                      unlinkOpen={unlinkOpen === r.discordUserId}
                      onOpenUnlink={() => { setUnlinkOpen(r.discordUserId); setClaimMessage(null); }}
                      onCancelUnlink={() => setUnlinkOpen(null)}
                      onConfirmUnlink={() => unlink(r.discordUserId)}
                      unlinkBusy={unlinkBusy}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </section>
  );
}

function Row({
  row, claimOpen, onOpenClaim, onCancelClaim, claimName, setClaimName, onConfirmClaim,
  unlinkOpen, onOpenUnlink, onCancelUnlink, onConfirmUnlink, unlinkBusy,
}: {
  row: MemberRow;
  claimOpen: boolean;
  onOpenClaim: () => void;
  onCancelClaim: () => void;
  claimName: string;
  setClaimName: (v: string) => void;
  onConfirmClaim: () => void;
  unlinkOpen: boolean;
  onOpenUnlink: () => void;
  onCancelUnlink: () => void;
  onConfirmUnlink: () => void;
  unlinkBusy: boolean;
}) {
  const avatar = row.avatar
    ? `https://cdn.discordapp.com/avatars/${row.discordUserId}/${row.avatar}.png?size=64`
    : null;

  return (
    <>
      <tr className="border-b border-border last:border-b-0 align-top">
        <td className="py-3 pr-3">
          <div className="flex items-center gap-2">
            {avatar ? (
              <img src={avatar} alt="" className="h-6 w-6 rounded border border-border" />
            ) : (
              <div className="h-6 w-6 rounded border border-border bg-bg" />
            )}
            <div>
              <div className="text-sm text-text">{row.username}</div>
              <div className="font-mono text-[10px] text-text-faint">{row.discordUserId}</div>
            </div>
          </div>
        </td>
        <td className="py-3 pr-3">
          {row.linked ? (
            <div>
              <a
                href={`https://app.warera.io/user/${row.wareraUserId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline"
              >
                {row.wareraUsername} ↗
              </a>
              <div className="font-mono text-[10px] text-text-faint">linked</div>
            </div>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">not linked</span>
          )}
        </td>
        <td className="py-3 pr-3">
          {row.linked ? (
            <div>
              <div className="text-sm text-text">{row.currentCountry ?? "—"}</div>
              {row.flags.countryChanged && (
                <div className="font-mono text-[10px] text-warn">was {row.storedCountry}</div>
              )}
            </div>
          ) : "—"}
        </td>
        <td className="py-3 pr-3 text-sm">
          {row.level ?? "—"}
          {row.flags.belowMinLevel && <div className="font-mono text-[10px] text-warn">below gate</div>}
        </td>
        <td className="py-3 pr-3 text-sm">
          {(row.positions ?? []).length > 0
            ? (row.positions ?? []).map((p) => POSITION_LABEL[p] ?? p).join(", ")
            : <span className="text-text-faint">—</span>}
          {row.flags.govRoleStale && <div className="font-mono text-[10px] text-warn">stale gov role</div>}
        </td>
        <td className="py-3 pr-3">
          <div className="flex flex-wrap gap-1">
            {row.flags.hasVerifiedRole && <Tag color="ok">verified</Tag>}
            {row.flags.countryChanged && <Tag color="warn">country</Tag>}
            {row.flags.govRoleStale && <Tag color="warn">gov stale</Tag>}
            {row.flags.belowMinLevel && <Tag color="warn">level</Tag>}
            {row.flags.usernameMismatch && <Tag color="warn">name?</Tag>}
            {!row.linked && row.flags.hasAnyTrackedRole && <Tag color="loss">orphan</Tag>}
          </div>
        </td>
        <td className="py-3">
          {!row.linked && row.flags.hasAnyTrackedRole && !claimOpen && (
            <button
              type="button"
              onClick={onOpenClaim}
              className="font-mono text-[11px] uppercase tracking-wider text-accent hover:underline"
            >
              Link →
            </button>
          )}
          {row.linked && !unlinkOpen && (
            <button
              type="button"
              onClick={onOpenUnlink}
              className="font-mono text-[11px] uppercase tracking-wider text-loss hover:underline"
            >
              Unlink →
            </button>
          )}
        </td>
      </tr>
      {unlinkOpen && (
        <tr className="border-b border-border">
          <td colSpan={7} className="py-3">
            <div className="rounded border border-loss/40 bg-bg p-3">
              <div className="label text-loss">Remove verification</div>
              <p className="mt-1 text-xs text-text-muted">
                Removes all tracked roles ({row.wareraUsername ?? "this member"}) from the server and deletes the link to their War Era account. They stay in the server and can re-verify.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={onConfirmUnlink} disabled={unlinkBusy}>
                  {unlinkBusy ? "Removing…" : "Remove verification"}
                </Button>
                <Button variant="ghost" onClick={onCancelUnlink} disabled={unlinkBusy}>Cancel</Button>
              </div>
            </div>
          </td>
        </tr>
      )}
      {claimOpen && (
        <tr className="border-b border-border">
          <td colSpan={7} className="py-3">
            <div className="rounded border border-border bg-bg p-3">
              <div className="label">Manual link</div>
              <p className="mt-1 text-xs text-text-muted">
                Type their War Era username. The bot will verify the account exists and assign all roles per the server's rules. Skips the company-rename step (admin attests).
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  autoFocus
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  placeholder="War Era username"
                  className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
                />
                <Button onClick={onConfirmClaim} disabled={!claimName.trim()}>Link</Button>
                <Button variant="ghost" onClick={onCancelClaim}>Cancel</Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Tag({ color, children }: { color: "ok" | "warn" | "loss" | "accent"; children: React.ReactNode }) {
  const cls = {
    ok: "border-ok/40 bg-ok/10 text-ok",
    warn: "border-warn/40 bg-warn/10 text-warn",
    loss: "border-loss/40 bg-loss/10 text-loss",
    accent: "border-accent/40 bg-accent/10 text-accent",
  }[color];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

function hasIssue(r: MemberRow): boolean {
  return r.flags.countryChanged
    || r.flags.belowMinLevel
    || r.flags.govRoleStale
    || r.flags.usernameMismatch
    || (!r.linked && r.flags.hasAnyTrackedRole);
}
