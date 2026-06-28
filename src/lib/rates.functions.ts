import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  )
}

export type RateRow = {
  pair: string
  buy: number
  sell: number
  recorded_at: string
  recorded_date: string
}

export const getRates = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = publicClient()
  // Latest row per pair + 30 days of history
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('rates')
    .select('pair,buy,sell,recorded_at,recorded_date')
    .gte('recorded_date', since)
    .order('recorded_at', { ascending: false })
    .limit(500)
  if (error) return { rates: [] as RateRow[], error: error.message }
  return { rates: (data ?? []) as RateRow[], error: null }
})
