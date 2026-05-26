import { describe, it, expect } from "vitest";
import { checkHierarchy, collectConfiguredRoleIds, type DiscordRole } from "../src/lib/hierarchy";

const roles: DiscordRole[] = [
  { id: "everyone", name: "@everyone", position: 0, managed: false },
  { id: "member", name: "Member", position: 1, managed: false },
  { id: "verified", name: "Verified", position: 2, managed: false },
  { id: "sweden", name: "Sweden", position: 3, managed: false },
  { id: "president", name: "President", position: 5, managed: false },
  { id: "warera-bot", name: "WarEra", position: 4, managed: true },
  { id: "admin", name: "Admin", position: 10, managed: false },
];

describe("checkHierarchy", () => {
  it("passes when all configured roles are below the bot's highest role", () => {
    const r = checkHierarchy({
      allGuildRoles: roles,
      botMemberRoleIds: ["warera-bot"],
      configuredRoleIds: ["verified", "sweden"],
    });
    expect(r.ok).toBe(true);
    expect(r.botMaxPosition).toBe(4);
    expect(r.blocking).toEqual([]);
  });

  it("flags roles that are at or above the bot's highest role position", () => {
    const r = checkHierarchy({
      allGuildRoles: roles,
      botMemberRoleIds: ["warera-bot"],
      configuredRoleIds: ["verified", "president", "admin"],
    });
    expect(r.ok).toBe(false);
    expect(r.blocking.map((b) => b.name).sort()).toEqual(["Admin", "President"]);
  });

  it("uses the bot's HIGHEST role if it has multiple", () => {
    const more: DiscordRole[] = [...roles, { id: "elevated", name: "Elevated", position: 8, managed: true }];
    const r = checkHierarchy({
      allGuildRoles: more,
      botMemberRoleIds: ["warera-bot", "elevated"],
      configuredRoleIds: ["president"],
    });
    expect(r.ok).toBe(true);
    expect(r.botMaxPosition).toBe(8);
  });

  it("treats no bot roles as position 0 (everything blocks)", () => {
    const r = checkHierarchy({
      allGuildRoles: roles,
      botMemberRoleIds: [],
      configuredRoleIds: ["verified"],
    });
    expect(r.ok).toBe(false);
    expect(r.blocking).toHaveLength(1);
  });

  it("ignores configured role ids that don't exist in the guild", () => {
    const r = checkHierarchy({
      allGuildRoles: roles,
      botMemberRoleIds: ["warera-bot"],
      configuredRoleIds: ["sweden", "nonexistent"],
    });
    expect(r.ok).toBe(true);
  });
});

describe("collectConfiguredRoleIds", () => {
  it("returns empty for empty config", () => {
    expect(collectConfiguredRoleIds({})).toEqual([]);
  });

  it("includes verified + per-country + government + foreign-country roles, deduped", () => {
    const ids = collectConfiguredRoleIds({
      verifiedRoleId: "v",
      countryRoles: { Sweden: ["s1"], Norway: ["s2", "v"] },
      governmentRoles: { president: ["p"], any: ["c"] },
      foreignCountryRoles: { Portugal: ["pt"] },
    });
    expect(ids.sort()).toEqual(["c", "p", "pt", "s1", "s2", "v"]);
  });
});
