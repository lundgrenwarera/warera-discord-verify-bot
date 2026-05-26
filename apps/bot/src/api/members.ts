import type { Env, GuildConfig, Link } from "../types";
import { fetchGovernment, fetchUserById, getCountryName } from "../lib/warera-api";
import { positionsHeldBy } from "../lib/government";

const TRACKED_ROLE_FIELDS = ["verifiedRoleId"] as const;

interface DiscordMember {
  user?: { id: string; username: string; avatar: string | null; global_name?: string | null };
  nick?: string | null;
  roles: string[];
}

export interface MemberRow {
  discordUserId: string;
  username: string;
  avatar: string | null;
  discordRoles: string[];
  linked: boolean;
  wareraUserId?: string;
  wareraUsername?: string;
  storedCountry?: string;
  currentCountry?: string;
  level?: number;
  positions?: string[];
  flags: {
    hasVerifiedRole: boolean;
    hasAnyTrackedRole: boolean;
    countryChanged: boolean;
    belowMinLevel: boolean;
    govRoleStale: boolean;
    usernameMismatch: boolean;
  };
}

async function fetchAllGuildMembers(env: Env, guildId: string): Promise<DiscordMember[]> {
  const all: DiscordMember[] = [];
  let after = "0";
  for (let i = 0; i < 50; i++) {
    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`, {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    });
    if (!r.ok) break;
    const batch = await r.json() as DiscordMember[];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 1000) break;
    const last = batch[batch.length - 1];
    if (!last.user) break;
    after = last.user.id;
  }
  return all;
}

function gatherTrackedRoles(cfg: GuildConfig): Set<string> {
  const out = new Set<string>();
  for (const k of TRACKED_ROLE_FIELDS) {
    const v = cfg[k];
    if (typeof v === "string") out.add(v);
  }
  for (const r of Object.values(cfg.countryRoles ?? {})) for (const id of r) out.add(id);
  for (const r of Object.values(cfg.governmentRoles ?? {})) for (const id of r ?? []) out.add(id);
  for (const r of Object.values(cfg.foreignCountryRoles ?? {})) for (const id of r) out.add(id);
  return out;
}

function inferExpectedPositions(cfg: GuildConfig, roles: string[]): string[] {
  const out = new Set<string>();
  for (const [bucket, roleIds] of Object.entries(cfg.governmentRoles ?? {})) {
    if (!roleIds) continue;
    if (roleIds.some((id) => roles.includes(id))) out.add(bucket);
  }
  return Array.from(out);
}

export async function buildMembersView(env: Env, guildId: string): Promise<MemberRow[]> {
  const cfg = (await env.GUILDS.get(`g:${guildId}`, "json") as GuildConfig | null) ?? {};
  const trackedRoles = gatherTrackedRoles(cfg);
  const verifiedRoleId = cfg.verifiedRoleId;

  const members = await fetchAllGuildMembers(env, guildId);

  const links = new Map<string, Link>();
  await Promise.all(members.map(async (m) => {
    if (!m.user) return;
    const link = await env.LINKS.get(`d:${m.user.id}`, "json") as Link | null;
    if (link) links.set(m.user.id, link);
  }));

  const wareraFetches: Array<Promise<void>> = [];
  const wareraState = new Map<string, { country?: string; level?: number; positions: string[] }>();
  const govCache = new Map<string, Awaited<ReturnType<typeof fetchGovernment>>>();

  for (const [discordId, link] of links.entries()) {
    wareraFetches.push((async () => {
      try {
        const fresh = await fetchUserById(link.wareraUserId);
        const countryId = fresh.country;
        const countryName = await getCountryName(env.LINKS, countryId);
        let positions: string[] = [];
        if (countryId) {
          if (!govCache.has(countryId)) govCache.set(countryId, await fetchGovernment(countryId));
          positions = positionsHeldBy(govCache.get(countryId) ?? null, link.wareraUserId);
        }
        wareraState.set(discordId, {
          country: countryName ?? undefined,
          level: fresh.leveling?.level,
          positions,
        });
      } catch {
        wareraState.set(discordId, { positions: [] });
      }
    })());
  }
  await Promise.all(wareraFetches);

  const rows: MemberRow[] = [];
  for (const m of members) {
    if (!m.user) continue;
    const hasVerifiedRole = !!verifiedRoleId && m.roles.includes(verifiedRoleId);
    const hasAnyTrackedRole = m.roles.some((id) => trackedRoles.has(id));
    if (!hasAnyTrackedRole && !links.has(m.user.id)) continue;

    const link = links.get(m.user.id);
    const state = wareraState.get(m.user.id);
    const expectedPositions = inferExpectedPositions(cfg, m.roles);
    const actualPositions = state?.positions ?? [];
    const govRoleStale = expectedPositions.some((p) => p !== "any" && !actualPositions.includes(p));

    const candidates = [m.user.username, m.user.global_name, m.nick]
      .filter((s): s is string => !!s)
      .map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const wareraNormalized = link?.wareraUsername?.toLowerCase().replace(/[^a-z0-9]/g, "");
    const usernameMismatch = !!link && !!wareraNormalized && !candidates.some(
      (c) => c === wareraNormalized || c.includes(wareraNormalized) || wareraNormalized.includes(c),
    );

    rows.push({
      discordUserId: m.user.id,
      username: m.nick || m.user.global_name || m.user.username,
      avatar: m.user.avatar,
      discordRoles: m.roles,
      linked: !!link,
      wareraUserId: link?.wareraUserId,
      wareraUsername: link?.wareraUsername,
      storedCountry: link?.country,
      currentCountry: state?.country,
      level: state?.level,
      positions: actualPositions,
      flags: {
        hasVerifiedRole,
        hasAnyTrackedRole,
        countryChanged: !!link?.country && !!state?.country && link.country !== state.country,
        belowMinLevel: !!cfg.minLevel && typeof state?.level === "number" && state.level < cfg.minLevel,
        govRoleStale,
        usernameMismatch,
      },
    });
  }
  return rows;
}
