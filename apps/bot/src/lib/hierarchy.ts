export interface DiscordRole {
  id: string;
  name: string;
  position: number;
  managed: boolean;
}

export interface HierarchyCheck {
  ok: boolean;
  botMaxPosition: number;
  blocking: Array<{ id: string; name: string; position: number }>;
}

export function checkHierarchy(args: {
  allGuildRoles: DiscordRole[];
  botMemberRoleIds: string[];
  configuredRoleIds: string[];
}): HierarchyCheck {
  const { allGuildRoles, botMemberRoleIds, configuredRoleIds } = args;
  const byId = new Map(allGuildRoles.map((r) => [r.id, r]));

  const botPositions = botMemberRoleIds
    .map((id) => byId.get(id)?.position ?? -1)
    .filter((p) => p >= 0);
  const botMaxPosition = botPositions.length > 0 ? Math.max(...botPositions) : 0;

  const blocking = configuredRoleIds
    .map((id) => byId.get(id))
    .filter((r): r is DiscordRole => !!r)
    .filter((r) => r.position >= botMaxPosition)
    .map((r) => ({ id: r.id, name: r.name, position: r.position }));

  return { ok: blocking.length === 0, botMaxPosition, blocking };
}

export function collectConfiguredRoleIds(cfg: {
  verifiedRoleId?: string;
  countryRoles?: Record<string, string[]>;
  governmentRoles?: Partial<Record<string, string[]>>;
  foreignCountryRoles?: Record<string, string[]>;
}): string[] {
  const out = new Set<string>();
  if (cfg.verifiedRoleId) out.add(cfg.verifiedRoleId);
  for (const ids of Object.values(cfg.countryRoles ?? {})) for (const id of ids) out.add(id);
  for (const ids of Object.values(cfg.governmentRoles ?? {})) for (const id of ids ?? []) out.add(id);
  for (const ids of Object.values(cfg.foreignCountryRoles ?? {})) for (const id of ids) out.add(id);
  return Array.from(out);
}
