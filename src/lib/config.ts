import type { GovernmentBucket, GovernmentPosition, GuildConfig } from "../types";
import { GOVERNMENT_BUCKETS, GOVERNMENT_BUCKET_LABELS } from "../types";
import { addToRoleMap, removeFromRoleMap } from "./role-map";

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.length > 0);
  if (typeof v === "string" && v.length > 0) return [v];
  return [];
}

function normalizeStringRoleMap(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const list = asStringList(v);
    if (list.length > 0) out[k] = list;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeGovernmentRoles(raw: unknown): GuildConfig["governmentRoles"] {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<GovernmentBucket, string[]>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!GOVERNMENT_BUCKETS.includes(k as GovernmentBucket)) continue;
    const list = asStringList(v);
    if (list.length > 0) out[k as GovernmentBucket] = list;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeConfig(raw: unknown): GuildConfig {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: GuildConfig = {};

  const verifiedRoleId = asString(obj.verifiedRoleId);
  if (verifiedRoleId) out.verifiedRoleId = verifiedRoleId;

  if (Array.isArray(obj.allowedCountries)) {
    const allowed = obj.allowedCountries.filter((c): c is string => typeof c === "string" && c.length > 0);
    if (allowed.length > 0) out.allowedCountries = allowed;
  }

  const countryRoles = normalizeStringRoleMap(obj.countryRoles);
  if (countryRoles) out.countryRoles = countryRoles;

  const govRoles = normalizeGovernmentRoles(obj.governmentRoles);
  if (govRoles) out.governmentRoles = govRoles;

  if (typeof obj.allowForeignGovernment === "boolean") {
    out.allowForeignGovernment = obj.allowForeignGovernment;
  }

  const foreign = normalizeStringRoleMap(obj.foreignCountryRoles);
  if (foreign) out.foreignCountryRoles = foreign;

  return out;
}

export function addAllowedCountry(cfg: GuildConfig, country: string): GuildConfig {
  const allowed = new Set(cfg.allowedCountries ?? []);
  allowed.add(country);
  return { ...cfg, allowedCountries: Array.from(allowed).sort() };
}

export function removeAllowedCountry(cfg: GuildConfig, country: string): GuildConfig {
  const allowed = (cfg.allowedCountries ?? []).filter((c) => c !== country);
  return { ...cfg, allowedCountries: allowed.length > 0 ? allowed : undefined };
}

export function addCountryRole(cfg: GuildConfig, country: string, roleId: string): GuildConfig {
  return { ...cfg, countryRoles: addToRoleMap(cfg.countryRoles, country, roleId) as Record<string, string[]> };
}

export function removeCountryRole(cfg: GuildConfig, country: string, roleId: string): GuildConfig {
  const next = removeFromRoleMap(cfg.countryRoles, country, roleId);
  return { ...cfg, countryRoles: Object.keys(next).length > 0 ? next as Record<string, string[]> : undefined };
}

export function addGovernmentRole(cfg: GuildConfig, bucket: GovernmentBucket, roleId: string): GuildConfig {
  return { ...cfg, governmentRoles: addToRoleMap(cfg.governmentRoles, bucket, roleId) };
}

export function removeGovernmentRole(cfg: GuildConfig, bucket: GovernmentBucket, roleId: string): GuildConfig {
  const next = removeFromRoleMap(cfg.governmentRoles, bucket, roleId);
  return { ...cfg, governmentRoles: Object.keys(next).length > 0 ? next : undefined };
}

export function setAllowForeignGovernment(cfg: GuildConfig, enabled: boolean): GuildConfig {
  return { ...cfg, allowForeignGovernment: enabled || undefined };
}

export function addForeignCountryRole(cfg: GuildConfig, country: string, roleId: string): GuildConfig {
  return { ...cfg, foreignCountryRoles: addToRoleMap(cfg.foreignCountryRoles, country, roleId) as Record<string, string[]> };
}

export function removeForeignCountryRole(cfg: GuildConfig, country: string, roleId: string): GuildConfig {
  const next = removeFromRoleMap(cfg.foreignCountryRoles, country, roleId);
  return { ...cfg, foreignCountryRoles: Object.keys(next).length > 0 ? next as Record<string, string[]> : undefined };
}

export type VerificationDecision =
  | { allowed: true; mode: "citizen" }
  | { allowed: true; mode: "foreign-government" }
  | { allowed: false; reason: "country-required" | "country-not-allowed" };

export function decideVerification(args: {
  cfg: GuildConfig;
  countryName: string | null;
  isForeignGov: boolean;
}): VerificationDecision {
  const { cfg, countryName, isForeignGov } = args;
  const allowed = cfg.allowedCountries ?? [];
  const noRestriction = allowed.length === 0;
  const isCitizen = !!countryName && (noRestriction || allowed.includes(countryName));

  if (isCitizen) return { allowed: true, mode: "citizen" };
  if (cfg.allowForeignGovernment && isForeignGov && countryName) {
    return { allowed: true, mode: "foreign-government" };
  }
  if (!countryName) return { allowed: false, reason: "country-required" };
  return { allowed: false, reason: "country-not-allowed" };
}

export function rolesForCitizen(cfg: GuildConfig, countryName: string | null): string[] {
  const out = new Set<string>();
  if (cfg.verifiedRoleId) out.add(cfg.verifiedRoleId);
  if (countryName && cfg.countryRoles) {
    for (const id of cfg.countryRoles[countryName] ?? []) out.add(id);
  }
  return Array.from(out);
}

export function rolesForForeignGov(cfg: GuildConfig, countryName: string): string[] {
  const out = new Set<string>();
  if (cfg.verifiedRoleId) out.add(cfg.verifiedRoleId);
  for (const id of cfg.foreignCountryRoles?.[countryName] ?? []) out.add(id);
  return Array.from(out);
}

export function renderConfig(cfg: GuildConfig): string {
  const lines: string[] = ["**Current config**"];

  lines.push(
    `Verified role: ${cfg.verifiedRoleId ? `<@&${cfg.verifiedRoleId}>` : "_(not set, verification will fail)_"}`,
  );

  const allowed = cfg.allowedCountries ?? [];
  lines.push(
    `Allowed countries: ${allowed.length > 0 ? allowed.map((c) => `**${c}**`).join(", ") : "_(any country)_"}`,
  );

  const countryEntries = Object.entries(cfg.countryRoles ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (countryEntries.length === 0) {
    lines.push("Country roles: _(none)_");
  } else {
    lines.push("Country roles:");
    for (const [country, roleIds] of countryEntries) {
      lines.push(`· **${country}** → ${roleIds.map((id) => `<@&${id}>`).join(", ")}`);
    }
  }

  const govEntries = Object.entries(cfg.governmentRoles ?? {});
  if (govEntries.length === 0) {
    lines.push("Government roles: _(none)_");
  } else {
    lines.push("Government roles:");
    const sorted = govEntries.sort(([a], [b]) =>
      GOVERNMENT_BUCKETS.indexOf(a as GovernmentBucket) - GOVERNMENT_BUCKETS.indexOf(b as GovernmentBucket),
    );
    for (const [bucket, roleIds] of sorted) {
      const label = GOVERNMENT_BUCKET_LABELS[bucket as GovernmentBucket] ?? bucket;
      lines.push(`· ${label} → ${(roleIds ?? []).map((id) => `<@&${id}>`).join(", ")}`);
    }
  }

  lines.push(`Foreign government bypass: ${cfg.allowForeignGovernment ? "**enabled**" : "_(disabled)_"}`);

  const foreignEntries = Object.entries(cfg.foreignCountryRoles ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (foreignEntries.length === 0) {
    lines.push("Foreign country roles: _(none)_");
  } else {
    lines.push("Foreign country roles:");
    for (const [country, roleIds] of foreignEntries) {
      lines.push(`· **${country}** → ${roleIds.map((id) => `<@&${id}>`).join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function isConfigReady(cfg: GuildConfig): boolean {
  return !!cfg.verifiedRoleId;
}

export type { GovernmentPosition };
