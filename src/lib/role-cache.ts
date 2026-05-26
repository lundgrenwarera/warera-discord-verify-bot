import type { Env } from "../types";
import { fetchGuildRoles } from "./discord";

const CACHE_TTL_SEC = 60;

export type RoleMap = Map<string, string>;

export async function getGuildRoleMap(env: Env, guildId: string): Promise<RoleMap> {
  const key = `roles:${guildId}`;
  const cached = await env.GUILDS.get(key, "json") as Array<[string, string]> | null;
  if (cached) return new Map(cached);
  const roles = await fetchGuildRoles(env.DISCORD_BOT_TOKEN, guildId);
  const entries: Array<[string, string]> = roles.map((r) => [r.id, r.name]);
  if (entries.length > 0) {
    await env.GUILDS.put(key, JSON.stringify(entries), { expirationTtl: CACHE_TTL_SEC });
  }
  return new Map(entries);
}

export function roleLabel(id: string, roleNames: RoleMap): string {
  const name = roleNames.get(id);
  if (name) return `@${name}`;
  return `<role ${id.slice(-6)}>`;
}
