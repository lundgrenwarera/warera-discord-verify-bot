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
  /** Role assigned to everyone who verifies, regardless of country. */
  verifiedRoleId?: string;
  /** Per-country role assignments. When this map is non-empty, the country
   * filter is active: only members from listed countries may verify. Each
   * country can map to multiple roles. */
  countryRoles?: Record<string, string[]>;
}
