import { describe, it, expect } from "vitest";
import {
  addAllowedCountry, addCountryRole, addForeignCountryRole, addGovernmentRole,
  decideVerification, normalizeConfig, removeAllowedCountry, removeCountryRole,
  removeForeignCountryRole, removeGovernmentRole, renderConfig,
  rolesForCitizen, rolesForForeignGov, setAllowForeignGovernment,
} from "../src/lib/config";

describe("normalizeConfig", () => {
  it("returns empty config for null/undefined/non-object input", () => {
    expect(normalizeConfig(null)).toEqual({});
    expect(normalizeConfig(undefined)).toEqual({});
    expect(normalizeConfig("string")).toEqual({});
    expect(normalizeConfig(123)).toEqual({});
  });

  it("preserves canonical-shape config", () => {
    const canonical = {
      verifiedRoleId: "r1",
      allowedCountries: ["Sweden", "Norway"],
      countryRoles: { Sweden: ["r2", "r3"] },
    };
    expect(normalizeConfig(canonical)).toMatchObject(canonical);
  });

  it("coerces legacy string-valued countryRoles to arrays", () => {
    const legacy = { verifiedRoleId: "r1", countryRoles: { Sweden: "r2", Norway: "r3" } };
    expect(normalizeConfig(legacy)).toMatchObject({
      verifiedRoleId: "r1",
      countryRoles: { Sweden: ["r2"], Norway: ["r3"] },
    });
  });

  it("drops invalid government bucket keys", () => {
    const raw = {
      governmentRoles: {
        president: ["r1"],
        garbage: ["r2"],
      },
    };
    const result = normalizeConfig(raw);
    expect(result.governmentRoles).toEqual({ president: ["r1"] });
  });

  it("preserves allowForeignGovernment booleans", () => {
    expect(normalizeConfig({ allowForeignGovernment: true }).allowForeignGovernment).toBe(true);
    expect(normalizeConfig({ allowForeignGovernment: false }).allowForeignGovernment).toBe(false);
  });

  it("normalizes foreignCountryRoles like countryRoles", () => {
    expect(normalizeConfig({ foreignCountryRoles: { Portugal: "r1" } })
      .foreignCountryRoles).toEqual({ Portugal: ["r1"] });
  });

  it("drops empty arrays", () => {
    expect(normalizeConfig({ allowedCountries: [] }).allowedCountries).toBeUndefined();
    expect(normalizeConfig({ countryRoles: {} }).countryRoles).toBeUndefined();
    expect(normalizeConfig({ governmentRoles: {} }).governmentRoles).toBeUndefined();
  });
});

describe("allowedCountries helpers", () => {
  it("adds and dedupes and sorts", () => {
    let cfg = {};
    cfg = addAllowedCountry(cfg, "Sweden");
    cfg = addAllowedCountry(cfg, "Norway");
    cfg = addAllowedCountry(cfg, "Sweden");
    expect(cfg).toEqual({ allowedCountries: ["Norway", "Sweden"] });
  });

  it("removing the last entry clears the field", () => {
    const cfg = removeAllowedCountry({ allowedCountries: ["Sweden"] }, "Sweden");
    expect(cfg.allowedCountries).toBeUndefined();
  });
});

describe("countryRoles helpers", () => {
  it("adds and dedupes", () => {
    let cfg = {};
    cfg = addCountryRole(cfg, "Sweden", "r1");
    cfg = addCountryRole(cfg, "Sweden", "r2");
    cfg = addCountryRole(cfg, "Sweden", "r1");
    expect(cfg).toEqual({ countryRoles: { Sweden: ["r1", "r2"] } });
  });

  it("removing the last role clears the country", () => {
    const cfg = removeCountryRole({ countryRoles: { Sweden: ["r1"] } }, "Sweden", "r1");
    expect(cfg.countryRoles).toBeUndefined();
  });
});

describe("governmentRoles helpers", () => {
  it("adds across buckets", () => {
    let cfg = {};
    cfg = addGovernmentRole(cfg, "any", "ra");
    cfg = addGovernmentRole(cfg, "president", "rp");
    cfg = addGovernmentRole(cfg, "any", "ra");
    expect(cfg).toEqual({ governmentRoles: { any: ["ra"], president: ["rp"] } });
  });

  it("removes and cleans up empty buckets", () => {
    const cfg = removeGovernmentRole({ governmentRoles: { president: ["rp"] } }, "president", "rp");
    expect(cfg.governmentRoles).toBeUndefined();
  });
});

describe("foreign government helpers", () => {
  it("toggles allowForeignGovernment cleanly", () => {
    expect(setAllowForeignGovernment({}, true).allowForeignGovernment).toBe(true);
    expect(setAllowForeignGovernment({ allowForeignGovernment: true }, false).allowForeignGovernment).toBeUndefined();
  });

  it("manages foreignCountryRoles map", () => {
    let cfg = {};
    cfg = addForeignCountryRole(cfg, "Portugal", "r1");
    cfg = addForeignCountryRole(cfg, "Portugal", "r2");
    expect(cfg).toEqual({ foreignCountryRoles: { Portugal: ["r1", "r2"] } });
    cfg = removeForeignCountryRole(cfg, "Portugal", "r1");
    expect(cfg).toEqual({ foreignCountryRoles: { Portugal: ["r2"] } });
    cfg = removeForeignCountryRole(cfg, "Portugal", "r2");
    expect(cfg.foreignCountryRoles).toBeUndefined();
  });
});

describe("decideVerification", () => {
  it("allows any citizen when no restriction", () => {
    expect(decideVerification({ cfg: {}, countryName: "Sweden", isForeignGov: false }))
      .toEqual({ allowed: true, mode: "citizen" });
    expect(decideVerification({ cfg: {}, countryName: null, isForeignGov: false }))
      .toEqual({ allowed: false, reason: "country-required" });
  });

  it("rejects non-citizens when country restriction is set", () => {
    const cfg = { allowedCountries: ["Sweden"] };
    expect(decideVerification({ cfg, countryName: "Norway", isForeignGov: false }))
      .toEqual({ allowed: false, reason: "country-not-allowed" });
  });

  it("allows foreign gov bypass when enabled", () => {
    const cfg = { allowedCountries: ["Sweden"], allowForeignGovernment: true };
    expect(decideVerification({ cfg, countryName: "Portugal", isForeignGov: true }))
      .toEqual({ allowed: true, mode: "foreign-government" });
  });

  it("foreign gov bypass requires both flag and gov membership", () => {
    const cfg = { allowedCountries: ["Sweden"], allowForeignGovernment: true };
    expect(decideVerification({ cfg, countryName: "Portugal", isForeignGov: false }))
      .toEqual({ allowed: false, reason: "country-not-allowed" });
    const cfg2 = { allowedCountries: ["Sweden"] };
    expect(decideVerification({ cfg: cfg2, countryName: "Portugal", isForeignGov: true }))
      .toEqual({ allowed: false, reason: "country-not-allowed" });
  });

  it("citizens take priority over foreign-gov when both apply", () => {
    const cfg = { allowedCountries: ["Sweden"], allowForeignGovernment: true };
    expect(decideVerification({ cfg, countryName: "Sweden", isForeignGov: true }))
      .toEqual({ allowed: true, mode: "citizen" });
  });
});

describe("rolesForCitizen", () => {
  it("always includes verified role", () => {
    expect(rolesForCitizen({ verifiedRoleId: "v" }, null)).toEqual(["v"]);
    expect(rolesForCitizen({ verifiedRoleId: "v" }, "Sweden")).toEqual(["v"]);
  });

  it("includes country-specific roles", () => {
    const cfg = { verifiedRoleId: "v", countryRoles: { Sweden: ["s1", "s2"] } };
    expect(rolesForCitizen(cfg, "Sweden")).toEqual(["v", "s1", "s2"]);
    expect(rolesForCitizen(cfg, "Norway")).toEqual(["v"]);
  });

  it("dedupes verified+country overlap", () => {
    const cfg = { verifiedRoleId: "v", countryRoles: { Sweden: ["v", "s1"] } };
    expect(rolesForCitizen(cfg, "Sweden")).toEqual(["v", "s1"]);
  });
});

describe("rolesForForeignGov", () => {
  it("includes verified + foreign country roles", () => {
    const cfg = { verifiedRoleId: "v", foreignCountryRoles: { Portugal: ["p1"] } };
    expect(rolesForForeignGov(cfg, "Portugal")).toEqual(["v", "p1"]);
  });

  it("returns just verified if no per-country role", () => {
    expect(rolesForForeignGov({ verifiedRoleId: "v" }, "Portugal")).toEqual(["v"]);
  });
});

describe("renderConfig", () => {
  it("renders a fully empty config without throwing", () => {
    const s = renderConfig({});
    expect(s).toContain("Verified role:");
    expect(s).toContain("Allowed countries:");
    expect(s).toContain("Country roles:");
    expect(s).toContain("Government roles:");
    expect(s).toContain("Foreign government bypass:");
  });

  it("includes role mentions for all configured roles", () => {
    const s = renderConfig({
      verifiedRoleId: "v",
      countryRoles: { Sweden: ["s"] },
      governmentRoles: { president: ["p"] },
      foreignCountryRoles: { Portugal: ["pt"] },
    });
    expect(s).toContain("<@&v>");
    expect(s).toContain("<@&s>");
    expect(s).toContain("<@&p>");
    expect(s).toContain("<@&pt>");
  });
});
