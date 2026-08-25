import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import type { RateRow } from '@/lib/rates.functions'
import { fetchLatestSourceRateRows } from '@/lib/rate-source.server'

const REQUIRED_PAIRS = ['USD_AFN', 'USD_PKR', 'AFN_PKR'] as const
const STALE_AFTER_MS = 1000 * 60 * 60 * 2

function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function publicClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!
  return createClient<Database>(process.env['SUPABASE_URL']!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) {
          headers.delete('Authorization')
        }
        headers.set('apikey', key)
        return timedFetch(input, { ...init, headers })
      },
    },
  })
}

function sortRows(rows: RateRow[]): RateRow[] {
  return rows.slice().sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at))
}

function shouldCheckLiveSource(rows: RateRow[]): boolean {
  if (!rows.length) return true
  const latestByPair = new Map(rows.map((r) => [r.pair, r]))
  if (REQUIRED_PAIRS.some((pair) => !latestByPair.has(pair))) return true
  const newest = Math.max(...REQUIRED_PAIRS.map((pair) => +new Date(latestByPair.get(pair)?.recorded_at ?? 0)))
  return Date.now() - newest > STALE_AFTER_MS
}

function mergeSourceRows(dbRows: RateRow[], sourceRows: RateRow[]): RateRow[] {
  const latestDb = new Map<string, RateRow>()
  for (const row of sortRows(dbRows)) if (!latestDb.has(row.pair)) latestDb.set(row.pair, row)

  const freshSource = sourceRows.filter((source) => {
    const db = latestDb.get(source.pair)
    return !db || +new Date(source.recorded_at) > +new Date(db.recorded_at)
  })

  if (!freshSource.length) return sortRows(dbRows)
  return sortRows([...freshSource, ...dbRows]).slice(0, 1000)
}

export async function getRatesForApp(): Promise<{ rates: RateRow[]; error: string | null }> {
  let dbRows: RateRow[] = []
  let dbError: string | null = null

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data, error } = await publicClient()
      .from('rates')
      .select('id,pair,buy,sell,recorded_at,recorded_date')
      .gte('recorded_date', since)
      .order('recorded_at', { ascending: false })
      .limit(1000)
    if (error) dbError = error.message
    dbRows = (data ?? []) as RateRow[]
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'rate_service_unreachable'
  }

  if (!shouldCheckLiveSource(dbRows)) return { rates: sortRows(dbRows), error: null }

  try {
    const sourceRows = await fetchLatestSourceRateRows()
    return { rates: mergeSourceRows(dbRows, sourceRows), error: null }
  } catch (err) {
    if (dbRows.length) return { rates: sortRows(dbRows), error: null }
    return { rates: [], error: dbError ?? (err instanceof Error ? err.message : 'live_source_unreachable') }
  }
}
