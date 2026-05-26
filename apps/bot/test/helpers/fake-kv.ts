/**
 * Minimal in-memory KV stub for tests. Implements the subset of KVNamespace
 * we actually use: get/put/delete and put's expirationTtl option.
 *
 * Not a full mock — no list, no metadata, no caching semantics.
 */

interface Entry {
  value: string;
  expiresAt: number | null;
}

export class FakeKV {
  private store = new Map<string, Entry>();
  private now: () => number;

  constructor(nowFn: () => number = () => Date.now()) {
    this.now = nowFn;
  }

  setNow(fn: () => number): void {
    this.now = fn;
  }

  async get(key: string, type?: "text" | "json"): Promise<unknown> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && this.now() / 1000 > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    if (type === "json") {
      try { return JSON.parse(entry.value); } catch { return null; }
    }
    return entry.value;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const expiresAt = opts?.expirationTtl ? this.now() / 1000 + opts.expirationTtl : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Useful escape hatches for tests
  _raw(key: string): Entry | undefined { return this.store.get(key); }
  _size(): number { return this.store.size; }
  _clear(): void { this.store.clear(); }
}
