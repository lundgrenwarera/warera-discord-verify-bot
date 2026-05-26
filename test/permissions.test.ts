import { describe, it, expect } from "vitest";
import { isAdmin, parsePermissions } from "../src/lib/permissions";

describe("isAdmin", () => {
  it("returns true when ADMINISTRATOR bit is set", () => {
    expect(isAdmin(0x8n)).toBe(true);
    expect(isAdmin(0xfn)).toBe(true);
    expect(isAdmin((1n << 31n) | 0x8n)).toBe(true);
  });

  it("returns false when ADMINISTRATOR bit is unset", () => {
    expect(isAdmin(0n)).toBe(false);
    expect(isAdmin(0x4n)).toBe(false);
    expect(isAdmin(0x7n)).toBe(false);
  });
});

describe("parsePermissions", () => {
  it("returns 0 for null/undefined", () => {
    expect(parsePermissions(null)).toBe(0n);
    expect(parsePermissions(undefined)).toBe(0n);
  });

  it("parses Discord-style permission strings", () => {
    expect(parsePermissions("8")).toBe(8n);
    expect(parsePermissions("2147483647")).toBe(2147483647n);
  });

  it("handles already-bigint input", () => {
    expect(parsePermissions(123n)).toBe(123n);
  });

  it("returns 0n for garbage input", () => {
    expect(parsePermissions("not-a-number")).toBe(0n);
    expect(parsePermissions("")).toBe(0n);
  });
});
