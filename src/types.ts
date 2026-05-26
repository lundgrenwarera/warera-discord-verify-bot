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

export type GovernmentPosition =
  | "president"
  | "vicePresident"
  | "defense"
  | "economy"
  | "foreignAffairs";

export type GovernmentBucket = GovernmentPosition | "any";

export const GOVERNMENT_POSITIONS: readonly GovernmentPosition[] = [
  "president", "vicePresident", "defense", "economy", "foreignAffairs",
] as const;

export const GOVERNMENT_BUCKETS: readonly GovernmentBucket[] = [
  "any", ...GOVERNMENT_POSITIONS,
] as const;

export const GOVERNMENT_BUCKET_LABELS: Record<GovernmentBucket, string> = {
  any: "Anyone in government",
  president: "President",
  vicePresident: "Vice President",
  defense: "Minister of Defense",
  economy: "Minister of Economy",
  foreignAffairs: "Minister of Foreign Affairs",
};

export interface GuildConfig {
  verifiedRoleId?: string;
  allowedCountries?: string[];
  countryRoles?: Record<string, string[]>;
  governmentRoles?: Partial<Record<GovernmentBucket, string[]>>;
  allowForeignGovernment?: boolean;
  foreignCountryRoles?: Record<string, string[]>;
}

export interface Government {
  president?: string;
  vicePresident?: string;
  minOfDefense?: string;
  minOfEconomy?: string;
  minOfForeignAffairs?: string;
  congressMembers?: string[];
}
