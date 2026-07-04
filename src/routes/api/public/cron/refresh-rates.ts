import { createFileRoute } from '@tanstack/react-router'

/**
 * Scrapes Kandahar-market Telegram channels with public preview enabled,
 * extracts USD/AFN, USD/PKR, AFN/PKR buy/sell rates, and upserts one row
 * per pair per day. Called hourly by pg_cron. Idempotent.
 *
 * Fallback chain: tries multiple channels in order; the first that yields
 * a full 3-pair set wins. Every attempt is logged to `sources_log`.
 */
export const Route = createFileRoute('/api/public/cron/refresh-rates')({
  server: {
    handlers: {
      GET: async () => runRefresh(),
      POST: async () => runRefresh(),
    },
  },
})

// Ordered by "most likely active first". Add/remove as channels change.
const SOURCE_CHANNELS = [
  'Kandahar_Sarafi',
  'sarafi_kandahar',
  'kandahar_rates',
  'KandaharSarafi',
  'da_afghan_sarafi',
]

type Pair = 'USD_AFN' | 'USD_PKR' | 'AFN_PKR'
type ParsedRate = { pair: Pair; buy: number; sell: number }

// Persian/Arabic digits -> ASCII
function normalizeDigits(s: string): string {
  const map: Record<string, string> = {
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
  }
  return s.replace(/[۰-۹٠-٩]/g, (ch) => map[ch] ?? ch)
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&#33;/g, '!')
    .replace(/&nbsp;/g, ' ')
}

function parseDetailed(text: string): ParsedRate[] {
  const results: ParsedRate[] = []
  const pairs: { pair: Pair; keys: RegExp }[] = [
    { pair: 'USD_AFN', keys: /(ډالر|دالر|دولار).{0,20}(افغان)/iu },
    { pair: 'USD_PKR', keys: /(ډالر|دالر|دولار).{0,20}(کلدار|کالدار|روپ)/iu },
    { pair: 'AFN_PKR', keys: /(افغان).{0,20}(کلدار|کالدار|روپ)/iu },
  ]
  for (const { pair, keys } of pairs) {
    const match = keys.exec(text)
    if (!match) continue
    const after = text.slice(match.index, match.index + 400)
    const nums = Array.from(after.matchAll(/[\d]+\.?\d*/g))
      .map((m) => parseFloat(m[0]))
      .filter((n) => !Number.isNaN(n) && n > 0)
    if (nums.length >= 2) results.push({ pair, buy: nums[0], sell: nums[1] })
  }
  return results
}

function parseCompact(text: string): ParsedRate[] {
  if (!/(ډالر|دالر).{0,40}(افغان).{0,40}(کلدار|روپ)/iu.test(text)) return []
  const rows = Array.from(
    text.matchAll(/([\d]+\.?\d*)\s*[✬✦✯✰⭐*✤✷☆]\s*([\d]+\.?\d*)/g),
  )
  if (rows.length < 3) return []
  const order: Pair[] = ['USD_PKR', 'USD_AFN', 'AFN_PKR']
  return rows.slice(0, 3).map((m, i) => {
    let buy = parseFloat(m[1])
    let sell = parseFloat(m[2])
    if (order[i] === 'AFN_PKR' && buy > 100) {
      buy = buy / 1000
      sell = sell / 1000
    }
    return { pair: order[i], buy, sell }
  })
}

function sanityCheck(rates: ParsedRate[]): ParsedRate[] {
  const ranges: Record<Pair, [number, number]> = {
    USD_AFN: [40, 120],
    USD_PKR: [150, 500],
    AFN_PKR: [1.5, 10],
  }
  return rates.filter((r) => {
    const [lo, hi] = ranges[r.pair]
    return r.buy >= lo && r.buy <= hi && r.sell >= lo && r.sell <= hi
  })
}

async function tryChannel(channel: string): Promise<{ text: string; rates: ParsedRate[] } | null> {
  const url = `https://t.me/s/${channel}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KandaharRates/1.0)' },
  })
  if (!res.ok) return null
  const html = await res.text()
  const postRegex =
    /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>\s*<div class="tgme_widget_message_footer/g
  const posts: string[] = []
  let m: RegExpExecArray | null
  while ((m = postRegex.exec(html)) !== null) posts.push(normalizeDigits(stripHtml(m[1])))

  for (let i = posts.length - 1; i >= 0; i--) {
    const text = posts[i]
    let rates = sanityCheck(parseDetailed(text))
    if (rates.length < 3) {
      const compact = sanityCheck(parseCompact(text))
      if (compact.length >= rates.length) rates = compact
    }
    if (new Set(rates.map((r) => r.pair)).size === 3) return { text, rates }
  }
  return null
}

async function runRefresh() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const attempts: { source: string; ok: boolean; note: string }[] = []
  let chosen: { source: string; text: string; rates: ParsedRate[] } | null = null

  for (const channel of SOURCE_CHANNELS) {
    try {
      const r = await tryChannel(channel)
      if (r) {
        attempts.push({ source: channel, ok: true, note: `parsed ${r.rates.length} pairs` })
        chosen = { source: channel, ...r }
        break
      }
      attempts.push({ source: channel, ok: false, note: 'no full 3-pair post found' })
    } catch (err) {
      attempts.push({
        source: channel,
        ok: false,
        note: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Log every attempt (best-effort)
  await supabaseAdmin.from('sources_log').insert(attempts).then(() => null, () => null)

  if (!chosen) {
    return Response.json(
      { ok: false, error: 'No source produced a full 3-pair set', attempts },
      { status: 422 },
    )
  }

  const today = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kabul' }),
  ).toISOString().slice(0, 10)

  const rows = chosen.rates.map((r) => ({
    pair: r.pair,
    buy: r.buy,
    sell: r.sell,
    recorded_at: new Date().toISOString(),
    recorded_date: today,
    raw_source: `[${chosen!.source}] ${chosen!.text.slice(0, 480)}`,
  }))

  const { error } = await supabaseAdmin
    .from('rates')
    .upsert(rows, { onConflict: 'pair,recorded_date' })

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  return Response.json({ ok: true, source: chosen.source, updated: rows.length, rates: chosen.rates })
}
