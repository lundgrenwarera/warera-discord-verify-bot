import type { Government, GovernmentPosition, GuildConfig } from "../types";
import { GOVERNMENT_POSITIONS } from "../types";

const POSITION_TO_API: Record<GovernmentPosition, keyof Government> = {
  president: "president",
  vicePresident: "vicePresident",
  defense: "minOfDefense",
  economy: "minOfEconomy",
  foreignAffairs: "minOfForeignAffairs",
};

export function positionsHeldBy(
  gov: Government | null,
  wareraUserId: string,
): GovernmentPosition[] {
  if (!gov) return [];
  return GOVERNMENT_POSITIONS.filter((p) => {
    const value = gov[POSITION_TO_API[p]];
    return typeof value === "string" && value === wareraUserId;
  });
}

export function governmentRolesFor(
  cfg: GuildConfig,
  positionsHeld: GovernmentPosition[],
): string[] {
  if (positionsHeld.length === 0) return [];
  const map = cfg.governmentRoles ?? {};
  const out = new Set<string>();
  for (const id of map.any ?? []) out.add(id);
  for (const p of positionsHeld) {
    for (const id of map[p] ?? []) out.add(id);
  }
  return Array.from(out);
}
