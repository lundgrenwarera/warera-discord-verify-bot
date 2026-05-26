export interface RateLimitConfig {
  /** Number of allowed events. */
  max: number;
  /** Window in seconds. */
  windowSec: number;
}

export const LIMITS = {
  verifyStart:   { max: 3,  windowSec: 60 * 60 },
  verifyConfirm: { max: 10, windowSec: 60 * 60 },
  whois:         { max: 20, windowSec: 60 * 60 },
  wareraLookup:  { max: 5,  windowSec: 60 * 10 },
  globalApi:     { max: 200, windowSec: 60 },
} satisfies Record<string, RateLimitConfig>;

interface CounterRecord {
  count: number;
  windowStart: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function consume(
  kv: KVNamespace,
  key: string,
  config: RateLimitConfig,
  now = Math.floor(Date.now() / 1000),
): Promise<RateLimitResult> {
  const raw = await kv.get(key, "json") as CounterRecord | null;
  const fresh = !raw || now - raw.windowStart >= config.windowSec;
  const next: CounterRecord = fresh
    ? { count: 1, windowStart: now }
    : { count: raw.count + 1, windowStart: raw.windowStart };

  if (next.count > config.max) {
    const retryAfterSec = Math.max(1, config.windowSec - (now - next.windowStart));
    return { ok: false, remaining: 0, retryAfterSec };
  }

  await kv.put(key, JSON.stringify(next), {
    expirationTtl: config.windowSec + 30,
  });

  return {
    ok: true,
    remaining: config.max - next.count,
    retryAfterSec: 0,
  };
}
