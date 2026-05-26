import { SignJWT, jwtVerify } from "jose";
import type { Env } from "../types";

const ADMINISTRATOR = 0x8n;

export interface SessionPayload {
  userId: string;
  username: string;
  avatar?: string;
  adminGuildIds: string[];
  managerGuildIds: string[];
}

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

interface DiscordPartialGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
}

export async function exchangeOAuthCode(env: Env, code: string, redirectUri: string): Promise<DiscordTokenResponse> {
  const params = new URLSearchParams({
    client_id: env.DISCORD_APP_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const r = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!r.ok) throw new Error(`discord token exchange failed: ${r.status} ${await r.text()}`);
  return r.json() as Promise<DiscordTokenResponse>;
}

export async function fetchOAuthUser(accessToken: string): Promise<DiscordUser> {
  const r = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`discord user fetch failed: ${r.status}`);
  return r.json() as Promise<DiscordUser>;
}

export async function fetchOAuthGuilds(accessToken: string): Promise<DiscordPartialGuild[]> {
  const r = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`discord guilds fetch failed: ${r.status}`);
  return r.json() as Promise<DiscordPartialGuild[]>;
}

export function pickAdminGuildIds(guilds: DiscordPartialGuild[]): string[] {
  return guilds
    .filter((g) => (BigInt(g.permissions) & ADMINISTRATOR) !== 0n)
    .map((g) => g.id);
}

export async function fetchMemberRoles(env: Env, guildId: string, userId: string): Promise<string[] | null> {
  const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  if (!r.ok) return null;
  const m = await r.json() as { roles?: string[] };
  return m.roles ?? [];
}

export async function computeManagerGuildIds(
  env: Env,
  userId: string,
  adminGuildIds: Set<string>,
  guilds: DiscordPartialGuild[],
): Promise<string[]> {
  const out: string[] = [];
  const checks = guilds
    .filter((g) => !adminGuildIds.has(g.id))
    .map(async (g) => {
      const cfgRaw = await env.GUILDS.get(`g:${g.id}`, "json") as { dashboardManagerRoleIds?: string[] } | null;
      const managers = cfgRaw?.dashboardManagerRoleIds ?? [];
      if (managers.length === 0) return;
      const memberRoles = await fetchMemberRoles(env, g.id, userId);
      if (!memberRoles) return;
      if (managers.some((id) => memberRoles.includes(id))) out.push(g.id);
    });
  await Promise.all(checks);
  return out;
}

const SESSION_TTL_SEC = 60 * 60;

export async function issueSession(env: Env, payload: SessionPayload): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secret);
}

export async function verifySession(env: Env, token: string): Promise<SessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      username: String(payload.username ?? ""),
      avatar: typeof payload.avatar === "string" ? payload.avatar : undefined,
      adminGuildIds: Array.isArray(payload.adminGuildIds) ? payload.adminGuildIds as string[] : [],
      managerGuildIds: Array.isArray(payload.managerGuildIds) ? payload.managerGuildIds as string[] : [],
    };
  } catch {
    return null;
  }
}
