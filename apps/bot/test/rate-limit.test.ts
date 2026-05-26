import { describe, it, expect } from "vitest";
import { consume } from "../src/lib/rate-limit";
import { FakeKV } from "./helpers/fake-kv";

const CONFIG = { max: 3, windowSec: 60 };

describe("rate-limit consume", () => {
  it("allows up to max within window", async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) {
      const r = await consume(kv as unknown as KVNamespace, "k", CONFIG, 1000);
      expect(r.ok).toBe(true);
    }
    expect(r => r).toBeTruthy(); // sanity
  });

  it("rejects the (max+1)th call within window", async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) {
      await consume(kv as unknown as KVNamespace, "k", CONFIG, 1000);
    }
    const blocked = await consume(kv as unknown as KVNamespace, "k", CONFIG, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after window expires", async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) {
      await consume(kv as unknown as KVNamespace, "k", CONFIG, 1000);
    }
    // 60 seconds later - exactly at window boundary
    const after = await consume(kv as unknown as KVNamespace, "k", CONFIG, 1060);
    expect(after.ok).toBe(true);
  });

  it("does not share state across keys", async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) {
      await consume(kv as unknown as KVNamespace, "user-a", CONFIG, 1000);
    }
    const r = await consume(kv as unknown as KVNamespace, "user-b", CONFIG, 1000);
    expect(r.ok).toBe(true);
  });

  it("retryAfterSec reflects time left in window", async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) {
      await consume(kv as unknown as KVNamespace, "k", CONFIG, 1000);
    }
    // 30 seconds into the window, blocked call should have ~30s retry
    const blocked = await consume(kv as unknown as KVNamespace, "k", CONFIG, 1030);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(29);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(31);
  });
});
