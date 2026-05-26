const BASE = "https://api2.warera.io/trpc";

export class WareraApiError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

async function trpcGet<T>(endpoint: string, input?: Record<string, unknown>): Promise<T> {
  const url = new URL(`${BASE}/${endpoint}`);
  if (input) url.searchParams.set("input", JSON.stringify(input));
  const r = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "warera-discord-verify-bot/0.1" },
  });
  if (!r.ok) throw new WareraApiError(r.status, `${endpoint} returned ${r.status}`);
  const body = await r.json() as { result?: { data: T }; error?: { message?: string } };
  if (body.error) throw new WareraApiError(500, body.error.message ?? "tRPC error");
  return body.result!.data;
}

interface SearchResult { userIds?: string[] }

export interface WareraUser {
  _id: string;
  username: string;
  country?: string;
  leveling?: { level: number };
}

export interface WareraCompany {
  _id: string;
  name?: string;
  itemCode: string;
}

export async function resolveUsername(username: string): Promise<WareraUser | null> {
  const trimmed = username.trim();
  if (!trimmed) return null;
  const data = await trpcGet<SearchResult>("search.searchAnything", { searchText: trimmed });
  const ids = data?.userIds ?? [];
  for (const id of ids) {
    try {
      const u = await trpcGet<WareraUser>("user.getUserById", { userId: id });
      if (u.username?.toLowerCase() === trimmed.toLowerCase()) return u;
    } catch {
      /* skip and try next */
    }
  }
  return null;
}

export async function fetchUserById(userId: string): Promise<WareraUser> {
  return trpcGet<WareraUser>("user.getUserById", { userId });
}

export async function fetchCompanies(userId: string): Promise<WareraCompany[]> {
  const listing = await trpcGet<{ items?: Array<string | { _id?: string }> }>(
    "company.getCompanies",
    { userId, perPage: 100 },
  );
  const ids = (listing.items ?? [])
    .map((e) => (typeof e === "string" ? e : e?._id))
    .filter((x): x is string => !!x);
  const companies = await Promise.all(
    ids.map((id) => trpcGet<WareraCompany>("company.getById", { companyId: id })),
  );
  return companies;
}

export interface WareraCountry {
  _id: string;
  name: string;
}

const COUNTRY_CACHE_KEY = "countries:v1";
const COUNTRY_CACHE_TTL = 24 * 60 * 60;

export async function getCountryName(
  kv: KVNamespace,
  countryId: string | undefined,
): Promise<string | null> {
  if (!countryId) return null;
  const map = await getCountryMap(kv);
  return map.get(countryId) ?? null;
}

async function getCountryMap(kv: KVNamespace): Promise<Map<string, string>> {
  const cached = await kv.get(COUNTRY_CACHE_KEY, "json") as Array<[string, string]> | null;
  if (cached) return new Map(cached);
  const list = await trpcGet<WareraCountry[]>("country.getAllCountries");
  const entries = list.map((c): [string, string] => [c._id, c.name]);
  await kv.put(COUNTRY_CACHE_KEY, JSON.stringify(entries), { expirationTtl: COUNTRY_CACHE_TTL });
  return new Map(entries);
}

export async function getCountryNames(kv: KVNamespace): Promise<string[]> {
  const map = await getCountryMap(kv);
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}
