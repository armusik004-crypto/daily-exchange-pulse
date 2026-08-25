import { queryOptions } from "@tanstack/react-query";
import { getRates, type RateRow } from "@/lib/rates.functions";
import { supabase } from "@/integrations/supabase/client";
import { apiUrl, IS_PACKAGED_APP } from "@/lib/api-base";

// Direct database read used when the server function is unreachable
// (e.g. the packaged offline/APK build served from a local file origin).
async function fetchRatesDirect(): Promise<RateRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("rates")
    .select("id,pair,buy,sell,recorded_at,recorded_date")
    .gte("recorded_date", since)
    .order("recorded_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as RateRow[];
}


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
    let serverError: string | null = null;
    try {
      const res = IS_PACKAGED_APP
        ? ((await fetch(apiUrl("/api/public/rates"), { cache: "no-store" }).then((r) => r.json())) as RatesQueryResult)
        : await getRates();
      if (res.rates.length > 0) {
        writeCache(res.rates);
        return { rates: res.rates, error: null };
      }
      serverError = res.error;
    } catch (err) {
      serverError = err instanceof Error ? err.message : "network_error";
    }

    // Server route empty/unreachable in APK mode — try the database directly.
    // On the web build, skipping this avoids slow duplicate failed requests.
    if (typeof window !== "undefined" && IS_PACKAGED_APP) {
      try {
        const rows = await fetchRatesDirect();
        if (rows.length > 0) {
          writeCache(rows);
          return { rates: rows, error: null };
        }
      } catch (err) {
        serverError = err instanceof Error ? err.message : serverError;
      }
    }

    // Last resort: cached rates, clearly marked as cached. Never fabricate.
    const cached = readCache();
    if (cached) {
      return {
        rates: cached.rates,
        error: null,
        fromCache: true,
        cachedAt: cached.cachedAt,
      };
    }
    return { rates: [], error: serverError ?? "unavailable" };
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
