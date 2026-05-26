import { describe, it, expect } from "vitest";
import { generateToken } from "../src/lib/token";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("generateToken", () => {
  it("starts with WV- prefix", () => {
    expect(generateToken()).toMatch(/^WV-/);
  });

  it("default length is 6 chars after prefix", () => {
    expect(generateToken().slice(3)).toHaveLength(6);
  });

  it("respects custom length", () => {
    expect(generateToken(10).slice(3)).toHaveLength(10);
  });

  it("only uses the safe alphabet (no 0, O, 1, I, etc.)", () => {
    for (let i = 0; i < 200; i++) {
      const body = generateToken().slice(3);
      for (const ch of body) {
        expect(ALPHABET).toContain(ch);
      }
    }
  });

  it("produces different tokens on repeated calls (probabilistic)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateToken());
    expect(seen.size).toBeGreaterThan(95);
  });
});
