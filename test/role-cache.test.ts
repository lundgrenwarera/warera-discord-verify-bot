import { describe, it, expect } from "vitest";
import { roleLabel } from "../src/lib/role-cache";

describe("roleLabel", () => {
  it("renders @Name when the role is known", () => {
    const names = new Map([["123", "Verified"], ["456", "Sweden"]]);
    expect(roleLabel("123", names)).toBe("@Verified");
    expect(roleLabel("456", names)).toBe("@Sweden");
  });

  it("falls back to a short hint when the role is unknown", () => {
    const names = new Map<string, string>();
    expect(roleLabel("123456789012345678", names)).toBe("<role 345678>");
  });

  it("falls back gracefully on empty map", () => {
    expect(roleLabel("abc", new Map())).toBe("<role abc>");
  });
});
