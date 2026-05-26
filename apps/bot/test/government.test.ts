import { describe, it, expect } from "vitest";
import { governmentRolesFor, positionsHeldBy } from "../src/lib/government";
import type { Government } from "../src/types";

const SWEDEN_GOV: Government = {
  president: "u-will",
  vicePresident: "u-microcrew",
  minOfDefense: "u-bullen",
  minOfEconomy: "u-hunden",
  minOfForeignAffairs: "u-konkelbaer",
};

describe("positionsHeldBy", () => {
  it("returns empty for null gov", () => {
    expect(positionsHeldBy(null, "u-will")).toEqual([]);
  });

  it("identifies single position", () => {
    expect(positionsHeldBy(SWEDEN_GOV, "u-will")).toEqual(["president"]);
    expect(positionsHeldBy(SWEDEN_GOV, "u-bullen")).toEqual(["defense"]);
  });

  it("identifies overlapping positions (one user with multiple roles)", () => {
    const dual = { ...SWEDEN_GOV, vicePresident: "u-will" };
    expect(positionsHeldBy(dual, "u-will").sort()).toEqual(["president", "vicePresident"].sort());
  });

  it("returns empty for non-government users", () => {
    expect(positionsHeldBy(SWEDEN_GOV, "u-randomperson")).toEqual([]);
  });
});

describe("governmentRolesFor", () => {
  it("returns empty when no positions", () => {
    expect(governmentRolesFor({ governmentRoles: { any: ["r"] } }, [])).toEqual([]);
  });

  it("returns empty when config has no government roles", () => {
    expect(governmentRolesFor({}, ["president"])).toEqual([]);
  });

  it("includes 'any' bucket for any position", () => {
    const cfg = { governmentRoles: { any: ["cabinet"] } };
    expect(governmentRolesFor(cfg, ["president"])).toEqual(["cabinet"]);
    expect(governmentRolesFor(cfg, ["defense"])).toEqual(["cabinet"]);
  });

  it("combines 'any' with position-specific roles, deduped", () => {
    const cfg = {
      governmentRoles: { any: ["cabinet"], president: ["potus", "cabinet"] },
    };
    expect(governmentRolesFor(cfg, ["president"])).toEqual(["cabinet", "potus"]);
  });

  it("unions across multiple held positions", () => {
    const cfg = {
      governmentRoles: { defense: ["d"], economy: ["e"] },
    };
    expect(governmentRolesFor(cfg, ["defense", "economy"])).toEqual(["d", "e"]);
  });
});
