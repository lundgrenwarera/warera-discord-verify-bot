import { describe, it, expect } from "vitest";
import {
  countriesPanel, countryRolesPanel, foreignGovPanel, govRolesPanel,
  mainPanel, renderPanel,
} from "../src/lib/panel";

const ROLE_NAMES = new Map([
  ["r-verified", "Verified"],
  ["r-sweden", "Sweden"],
  ["r-cabinet", "Cabinet"],
  ["r-portugal", "Portugal"],
]);

function findSelectOptions(payload: { components: unknown[] }, customId: string): Array<{ label: string; value: string }> {
  for (const r of payload.components) {
    const components = (r as { components?: unknown[] }).components ?? [];
    for (const c of components) {
      const comp = c as { custom_id?: string; options?: Array<{ label: string; value: string }> };
      if (comp.custom_id === customId) return comp.options ?? [];
    }
  }
  return [];
}

describe("countryRolesPanel", () => {
  it("renders role names (not IDs) in the remove-role dropdown", () => {
    const cfg = { countryRoles: { Sweden: ["r-sweden", "r-verified"] } };
    const payload = countryRolesPanel({ cfg, roleNames: ROLE_NAMES }, "Sweden");
    const opts = findSelectOptions(payload, "setup:country-role:remove:Sweden");
    expect(opts.map((o) => o.label).sort()).toEqual(["@Sweden", "@Verified"]);
    expect(opts.map((o) => o.value).sort()).toEqual(["r-sweden", "r-verified"]);
  });

  it("falls back to a short hint when role is unknown", () => {
    const cfg = { countryRoles: { Sweden: ["unknown-role-id"] } };
    const payload = countryRolesPanel({ cfg, roleNames: ROLE_NAMES }, "Sweden");
    const opts = findSelectOptions(payload, "setup:country-role:remove:Sweden");
    expect(opts[0].label).toContain("role");
    expect(opts[0].value).toBe("unknown-role-id");
  });

  it("offers any allowed country in the picker even if no roles assigned yet", () => {
    const cfg = { allowedCountries: ["Sweden", "Norway"] };
    const payload = countryRolesPanel({ cfg, roleNames: ROLE_NAMES }, undefined);
    const opts = findSelectOptions(payload, "setup:country-role:pick");
    expect(opts.map((o) => o.value).sort()).toEqual(["Norway", "Sweden"]);
  });
});

describe("govRolesPanel", () => {
  it("renders role names in the remove dropdown", () => {
    const cfg = { governmentRoles: { any: ["r-cabinet"] } };
    const payload = govRolesPanel({ cfg, roleNames: ROLE_NAMES }, "any");
    const opts = findSelectOptions(payload, "setup:gov-role:remove:any");
    expect(opts).toEqual([{ label: "@Cabinet", value: "r-cabinet" }]);
  });
});

describe("foreignGovPanel", () => {
  it("renders role names in the remove dropdown", () => {
    const cfg = { foreignCountryRoles: { Portugal: ["r-portugal"] } };
    const payload = foreignGovPanel({ cfg, roleNames: ROLE_NAMES }, "Portugal");
    const opts = findSelectOptions(payload, "setup:foreign-gov:remove-role:Portugal");
    expect(opts).toEqual([{ label: "@Portugal", value: "r-portugal" }]);
  });
});

describe("countriesPanel", () => {
  it("disables Remove country when none are allowed", () => {
    const payload = countriesPanel({});
    const removeButton = findButton(payload, "setup:country:remove-pick");
    expect(removeButton.disabled).toBe(true);
  });

  it("enables Remove country when at least one is set", () => {
    const payload = countriesPanel({ allowedCountries: ["Sweden"] });
    const removeButton = findButton(payload, "setup:country:remove-pick");
    expect(removeButton.disabled).toBeFalsy();
  });
});

describe("mainPanel", () => {
  it("disables Post welcome until a verified role is set", () => {
    const payload = mainPanel({});
    const btn = findButton(payload, "setup:post-welcome");
    expect(btn.disabled).toBe(true);
  });

  it("enables Post welcome once a verified role is set", () => {
    const payload = mainPanel({ verifiedRoleId: "r-verified" });
    const btn = findButton(payload, "setup:post-welcome");
    expect(btn.disabled).toBeFalsy();
  });
});

describe("renderPanel dispatch", () => {
  it("routes each kind to its panel", () => {
    const ctx = { cfg: {}, roleNames: ROLE_NAMES };
    expect((renderPanel({ kind: "main" }, ctx).embeds[0] as { title: string }).title).toBe("Verify Bot setup");
    expect((renderPanel({ kind: "countries" }, ctx).embeds[0] as { title: string }).title).toBe("Who can verify");
    expect((renderPanel({ kind: "country-roles" }, ctx).embeds[0] as { title: string }).title).toBe("Roles per country");
    expect((renderPanel({ kind: "gov-roles" }, ctx).embeds[0] as { title: string }).title).toBe("Government roles");
    expect((renderPanel({ kind: "foreign-gov" }, ctx).embeds[0] as { title: string }).title).toBe("Foreign government");
  });
});

function findButton(payload: { components: unknown[] }, customId: string): { disabled?: boolean } {
  for (const r of payload.components) {
    const components = (r as { components?: unknown[] }).components ?? [];
    for (const c of components) {
      const comp = c as { custom_id?: string; disabled?: boolean };
      if (comp.custom_id === customId) return comp;
    }
  }
  throw new Error(`button ${customId} not found`);
}
