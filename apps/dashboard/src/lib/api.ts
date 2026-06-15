import { API_BASE } from "./config";
import { clearSession, getSession } from "./auth";

export interface ApiError {
  status: number;
  message: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const r = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (r.status === 401) {
    clearSession();
    throw { status: 401, message: "session expired" } satisfies ApiError;
  }
  if (!r.ok) {
    const body = await r.text();
    let message = body || r.statusText;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.error === "string") message = parsed.error;
    } catch { /* not JSON, keep raw body */ }
    throw { status: r.status, message } satisfies ApiError;
  }
  return r.json() as Promise<T>;
}

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
  botInstalled: boolean;
}

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface BotConfig {
  verifiedRoleId?: string;
  allowedCountries?: string[];
  countryRoles?: Record<string, string[]>;
  governmentRoles?: Partial<Record<string, string[]>>;
  allowForeignGovernment?: boolean;
  foreignCountryRoles?: Record<string, string[]>;
  minLevel?: number;
  dashboardManagerRoleIds?: string[];
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

export interface HierarchyCheck {
  ok: boolean;
  botMaxPosition: number;
  blocking: Array<{ id: string; name: string; position: number }>;
}

export const api = {
  guilds: () => request<{ guilds: GuildSummary[] }>("/api/me/guilds"),
  guildRoles: (guildId: string) => request<{ roles: GuildRole[] }>(`/api/guilds/${guildId}/roles`),
  guildConfig: (guildId: string) => request<BotConfig>(`/api/guilds/${guildId}/config`),
  guildMembers: (guildId: string) => request<{ members: MemberRow[] }>(`/api/guilds/${guildId}/members`),
  guildHierarchy: (guildId: string) => request<HierarchyCheck>(`/api/guilds/${guildId}/hierarchy`),
  saveGuildConfig: (guildId: string, cfg: BotConfig) =>
    request<BotConfig>(`/api/guilds/${guildId}/config`, {
      method: "PUT", body: JSON.stringify(cfg),
    }),
  postWelcome: (guildId: string, channelId: string) =>
    request<{ ok: true }>(`/api/guilds/${guildId}/post-welcome`, {
      method: "POST", body: JSON.stringify({ channelId }),
    }),
  guildChannels: (guildId: string) =>
    request<{ channels: Array<{ id: string; name: string; type: number }> }>(`/api/guilds/${guildId}/channels`),
  countries: () => request<{ countries: string[] }>("/api/warera/countries"),
  manualVerify: (guildId: string, discordUserId: string, input: string) => {
    const wareraUserId = extractWareraUserId(input);
    const payload: Record<string, string> = { discordUserId };
    if (wareraUserId) payload.wareraUserId = wareraUserId;
    else payload.wareraUsername = input.trim();
    return request<{ ok: true; assigned: number; total: number }>(`/api/guilds/${guildId}/manual-verify`, {
      method: "POST", body: JSON.stringify(payload),
    });
  },
  unlinkMember: (guildId: string, discordUserId: string) =>
    request<{ ok: true; removed: number; failed: number }>(
      `/api/guilds/${guildId}/members/${discordUserId}`,
      { method: "DELETE" },
    ),
};

function extractWareraUserId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/(?:app\.warera\.io\/user\/|^)([a-f0-9]{24})$/i);
  return m?.[1] ?? null;
}
