export interface Env {
  TOKENS: KVNamespace;
  LINKS: KVNamespace;
  GUILDS: KVNamespace;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APP_ID: string;
  DISCORD_BOT_TOKEN: string;
  TOKEN_TTL_SECONDS: string;
}

export interface PendingToken {
  token: string;
  wareraUserId: string;
  wareraUsername: string;
  discordUserId: string;
  guildId: string;
  createdAt: number;
}

export interface Link {
  wareraUserId: string;
  wareraUsername: string;
  country?: string;
  verifiedAt: number;
}

export interface GuildConfig {
  /** Role assigned to everyone who passes verification. */
  verifiedRoleId?: string;
  /** If set, only these War Era countries are allowed to verify. */
  allowedCountries?: string[];
  /** Extra per-country role assignments (in addition to verifiedRoleId). */
  countryRoles?: Record<string, string[]>;
}
