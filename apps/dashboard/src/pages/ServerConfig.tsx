import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { RolePicker } from "../components/RolePicker";
import { CountryPicker } from "../components/CountryPicker";
import { api, type BotConfig, type GuildRole } from "../lib/api";

const GOV_BUCKETS = [
  { key: "any", label: "Anyone in government" },
  { key: "president", label: "President" },
  { key: "vicePresident", label: "Vice President" },
  { key: "defense", label: "Minister of Defense" },
  { key: "economy", label: "Minister of Economy" },
  { key: "foreignAffairs", label: "Minister of Foreign Affairs" },
] as const;

export function ServerConfig() {
  const { guildId = "" } = useParams();
  const [cfg, setCfg] = useState<BotConfig | null>(null);
  const [original, setOriginal] = useState<BotConfig | null>(null);
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [welcomeChannel, setWelcomeChannel] = useState("");
  const [manualUser, setManualUser] = useState("");
  const [manualUsername, setManualUsername] = useState("");
  const [manualResult, setManualResult] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.guildConfig(guildId),
      api.guildRoles(guildId),
      api.countries(),
      api.guildChannels(guildId),
    ])
      .then(([c, r, ct, ch]) => {
        setCfg(c); setOriginal(c);
        setRoles(r.roles);
        setCountries(ct.countries);
        setChannels(ch.channels);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [guildId]);

  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(original), [cfg, original]);

  const patch = useCallback((next: Partial<BotConfig>) => {
    setCfg((c) => ({ ...(c ?? {}), ...next }));
    setSaved(false);
  }, []);

  const save = async () => {
    if (!cfg || saving) return;
    setSaving(true); setError(null);
    try {
      const result = await api.saveGuildConfig(guildId, cfg);
      setCfg(result); setOriginal(result); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(String((e as { message?: string })?.message ?? e));
    } finally { setSaving(false); }
  };

  const postWelcome = async () => {
    if (!welcomeChannel) return;
    try {
      await api.postWelcome(guildId, welcomeChannel);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(String((e as { message?: string })?.message ?? e));
    }
  };

  const runManual = async () => {
    if (!manualUser || !manualUsername) return;
    setManualResult(null);
    try {
      const r = await api.manualVerify(guildId, manualUser, manualUsername);
      setManualResult(`Linked. ${r.assigned}/${r.total} roles assigned.`);
      setManualUser(""); setManualUsername("");
    } catch (e) {
      setManualResult(String((e as { message?: string })?.message ?? e));
    }
  };

  if (error && !cfg) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 py-12 sm:py-20">
        <div className="text-center">
          <div className="label text-loss">Access denied</div>
          <h1 className="mt-2 bracket-heading text-2xl sm:text-3xl text-text">Couldn't load this server</h1>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <Link to="/servers" className="mt-6 inline-block font-mono text-[11px] uppercase tracking-wider text-text-faint hover:text-accent">
            ← Back to servers
          </Link>
        </div>
      </section>
    );
  }

  if (!cfg) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 py-12 sm:py-20">
        <div className="label">Loading…</div>
      </section>
    );
  }

  const textChannels = channels.filter((c) => c.type === 0);

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <div className="flex items-center gap-3">
          <Link to="/servers" className="label hover:text-text">← Servers</Link>
          <span className="font-mono text-[10px] text-text-faint">{guildId}</span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="label">Configuration</div>
            <h1 className="mt-2 bracket-heading text-xl sm:text-2xl text-text">Server configuration</h1>
            <p className="mt-3 text-sm text-text-muted">
              Changes save together. Use the save button at the bottom.
            </p>
          </div>
          <Link
            to={`/servers/${guildId}/members`}
            className="rounded border border-border bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-text-muted hover:border-accent hover:text-accent"
          >
            Members →
          </Link>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <Panel title="01 — Verified role" subtitle="Assigned to every member that completes verification. Required.">
          <RolePicker
            roles={roles}
            value={cfg.verifiedRoleId ? [cfg.verifiedRoleId] : []}
            onChange={(ids) => patch({ verifiedRoleId: ids[0] })}
            multiple={false}
            placeholder={cfg.verifiedRoleId ? "Change the verified role" : "Pick the verified role"}
          />
        </Panel>

        <Panel title="02 — Who can verify" subtitle="Leave empty to allow anyone with a War Era account. Add countries to restrict.">
          <CountryPicker
            options={countries}
            value={cfg.allowedCountries ?? []}
            onChange={(c) => patch({ allowedCountries: c.length ? c : undefined })}
            placeholder="Add a country to the allow-list"
          />
        </Panel>

        <Panel title="03 — Roles per country" subtitle="Extra roles for verified citizens of specific countries. Stacks with the verified role.">
          <PerKeyRoleMap
            keys={Array.from(new Set([...(cfg.allowedCountries ?? []), ...Object.keys(cfg.countryRoles ?? {})])).sort()}
            value={cfg.countryRoles ?? {}}
            onChange={(map) => patch({ countryRoles: Object.keys(map).length ? map : undefined })}
            roles={roles}
            allowAdd
            availableKeys={countries}
            keyKind="country"
          />
        </Panel>

        <Panel title="04 — Government roles" subtitle="Assigned when a verified citizen holds a cabinet position. 'Anyone in government' applies to all five positions.">
          <PerKeyRoleMap
            keys={GOV_BUCKETS.map((b) => b.key)}
            keyLabels={Object.fromEntries(GOV_BUCKETS.map((b) => [b.key, b.label]))}
            value={(cfg.governmentRoles ?? {}) as Record<string, string[]>}
            onChange={(map) => patch({ governmentRoles: Object.keys(map).length ? map : undefined })}
            roles={roles}
            keyKind="position"
          />
        </Panel>

        <Panel title="05 — Foreign government bypass" subtitle="Allow cabinet members from other countries to verify, with country-named roles. Useful for embassy servers.">
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={!!cfg.allowForeignGovernment}
              onChange={(e) => patch({ allowForeignGovernment: e.target.checked || undefined })}
            />
            <span>
              Bypass is{" "}
              <strong className={cfg.allowForeignGovernment ? "text-accent" : "text-text-faint"}>
                {cfg.allowForeignGovernment ? "enabled" : "disabled"}
              </strong>
            </span>
          </label>
          {cfg.allowForeignGovernment && (
            <PerKeyRoleMap
              keys={Object.keys(cfg.foreignCountryRoles ?? {}).sort()}
              value={cfg.foreignCountryRoles ?? {}}
              onChange={(map) => patch({ foreignCountryRoles: Object.keys(map).length ? map : undefined })}
              roles={roles}
              allowAdd
              availableKeys={countries}
              keyKind="country"
            />
          )}
        </Panel>

        <Panel title="06 — Anti-multi level gate" subtitle="Withhold country roles below this War Era level. Verified role and government roles always go through.">
          <div className="flex items-center gap-3">
            <input
              type="number" min="0" max="200"
              className="w-32 rounded border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-accent"
              placeholder="off"
              value={cfg.minLevel ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") return patch({ minLevel: undefined });
                const n = Number(v);
                if (Number.isFinite(n) && n >= 0) patch({ minLevel: n > 0 ? n : undefined });
              }}
            />
            <span className="text-xs text-text-faint">Leave blank or 0 to disable. Recommended: 10.</span>
          </div>
        </Panel>

        <Panel title="07 — Dashboard access" subtitle="Members with one of these roles can access this server's config without server-Administrator. Only Administrators can edit this list.">
          <RolePicker
            roles={roles}
            value={cfg.dashboardManagerRoleIds ?? []}
            onChange={(ids) => patch({ dashboardManagerRoleIds: ids.length ? ids : undefined })}
            placeholder="Grant dashboard access to a role"
          />
        </Panel>

        <Panel title="08 — Post the verify message" subtitle="Drops a Discord message with the Verify button into a channel.">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={welcomeChannel}
              onChange={(e) => setWelcomeChannel(e.target.value)}
              className="w-64 rounded border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-accent"
            >
              <option value="">Pick a channel…</option>
              {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
            <Button onClick={postWelcome} disabled={!welcomeChannel || !cfg.verifiedRoleId}>
              Post welcome
            </Button>
            {!cfg.verifiedRoleId && <span className="text-xs text-text-faint">Set a verified role first.</span>}
          </div>
        </Panel>

        <Panel title="09 — Manual verify" subtitle="For permamuted accounts that can't rename companies. Skips the rename, applies all server rules.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={manualUser}
              onChange={(e) => setManualUser(e.target.value)}
              placeholder="Discord user ID"
              className="rounded border border-border bg-surface px-4 py-2.5 text-sm font-mono text-text outline-none focus:border-accent"
            />
            <input
              value={manualUsername}
              onChange={(e) => setManualUsername(e.target.value)}
              placeholder="War Era username"
              className="rounded border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-accent"
            />
            <Button onClick={runManual} disabled={!manualUser || !manualUsername}>Verify</Button>
          </div>
          {manualResult && <div className="mt-3 font-mono text-xs text-text-muted">{manualResult}</div>}
        </Panel>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-border bg-bg/95 backdrop-blur px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs">
            {error && <span className="font-mono text-loss">{error}</span>}
            {saved && <span className="text-ok">✓ saved</span>}
            {dirty && !saved && <span className="text-text-faint">unsaved changes</span>}
          </div>
          <div className="flex items-center gap-2">
            {dirty && <Button variant="ghost" onClick={() => setCfg(original)}>Revert</Button>}
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PerKeyRoleMap({
  keys, value, onChange, roles, allowAdd, availableKeys, keyKind, keyLabels,
}: {
  keys: string[];
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  roles: GuildRole[];
  allowAdd?: boolean;
  availableKeys?: string[];
  keyKind: "country" | "position";
  keyLabels?: Record<string, string>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const orderedKeys = useMemo(() => Array.from(new Set(keys)), [keys]);
  const availableForAdd = useMemo(() => {
    if (!availableKeys) return [];
    const used = new Set(orderedKeys);
    return availableKeys.filter((k) => !used.has(k));
  }, [orderedKeys, availableKeys]);

  if (orderedKeys.length === 0 && !allowAdd) {
    return <div className="text-xs text-text-faint">No options available.</div>;
  }

  return (
    <div className="space-y-3">
      {orderedKeys.length === 0 && (
        <div className="text-xs text-text-faint">Add a {keyKind} below to start assigning roles.</div>
      )}
      {orderedKeys.map((key) => (
        <div key={key} className="rounded border border-border bg-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-text">{keyLabels?.[key] ?? key}</div>
            {allowAdd && (
              <button
                type="button"
                onClick={() => { const { [key]: _, ...rest } = value; onChange(rest); }}
                className="font-mono text-[10px] uppercase tracking-wider text-text-faint hover:text-loss"
              >
                Remove
              </button>
            )}
          </div>
          <RolePicker
            roles={roles}
            value={value[key] ?? []}
            onChange={(ids) => {
              if (ids.length === 0) {
                const { [key]: _, ...rest } = value;
                onChange(rest);
              } else {
                onChange({ ...value, [key]: ids });
              }
            }}
            placeholder={`Add a role for ${keyLabels?.[key] ?? key}`}
          />
        </div>
      ))}
      {allowAdd && availableForAdd.length > 0 && (
        <div>
          {!addOpen ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded border border-border bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-text-muted hover:border-accent hover:text-accent"
            >
              + Add another {keyKind}
            </button>
          ) : (
            <div className="rounded border border-border bg-bg p-3">
              <CountryPicker
                options={availableForAdd}
                value={[]}
                onChange={(picked) => {
                  if (picked[0]) onChange({ ...value, [picked[0]]: [] });
                  setAddOpen(false);
                }}
                placeholder={`Pick a ${keyKind} to manage`}
                multiple={false}
              />
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="mt-2 font-mono text-[10px] uppercase tracking-wider text-text-faint hover:text-text"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
