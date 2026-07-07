import { queryOptions } from "@tanstack/react-query";
import { getRates, type RateRow } from "@/lib/rates.functions";

const CACHE_KEY = "km_rates_cache_v1";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type CachedRates = { rates: RateRow[]; cachedAt: number };

function readCache(): CachedRates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (!parsed || !Array.isArray(parsed.rates)) return null;
    if (Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rates: RateRow[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ rates, cachedAt: Date.now() } satisfies CachedRates),
    );
  } catch {
    /* quota — ignore */
  }
}

export type RatesQueryResult = {
  rates: RateRow[];
  error: string | null;
  fromCache?: boolean;
  cachedAt?: number;
};

export const ratesQuery = queryOptions<RatesQueryResult>({
  queryKey: ["rates"],
  queryFn: async () => {
    try {
      const res = await getRates();
      if (res.rates.length > 0) {
        writeCache(res.rates);
        return { rates: res.rates, error: res.error };
      }
      // Empty from server — prefer cache if available.
      const cached = readCache();
      if (cached) {
        return { rates: cached.rates, error: null, fromCache: true, cachedAt: cached.cachedAt };
      }
      return { rates: res.rates, error: res.error };
    } catch (err) {
      const cached = readCache();
      if (cached) {
        return {
          rates: cached.rates,
          error: null,
          fromCache: true,
          cachedAt: cached.cachedAt,
        };
      }
      throw err;
    }
  },
  staleTime: 60_000,
  // Serve cached data immediately while a fresh fetch happens in the background.
  initialData: () => {
    const cached = readCache();
    if (!cached) return undefined;
    return { rates: cached.rates, error: null, fromCache: true, cachedAt: cached.cachedAt };
  },
  initialDataUpdatedAt: () => readCache()?.cachedAt,
});
