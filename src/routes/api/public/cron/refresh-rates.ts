import { createFileRoute } from '@tanstack/react-router'

/**
 * Scrapes the upstream public channel preview, extracts the latest
 * Kandahar market buy/sell rates, and upserts one row per pair per day.
 *
 * Called by pg_cron hourly. Idempotent: same day re-runs UPDATE the same row.
 */
export const Route = createFileRoute('/api/public/cron/refresh-rates')({
  server: {
    handlers: {
      GET: async () => runRefresh(),
      POST: async () => runRefresh(),
    },
  },
})

const SOURCE_URL = 'https://t.me/s/Kandahar_Sarafi'

type Pair = 'USD_AFN' | 'USD_PKR' | 'AFN_PKR'
type ParsedRate = { pair: Pair; buy: number; sell: number }

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

/**
 * Parse the "detailed" post format:
 *   ډالر مقابل افغانۍ          (USD vs AFN)
 *   رانيول>>64.30
 *   خرڅول>>64.35
 *   ډالرپه کلدارو             (USD vs PKR)
 *   ...
 *   افغاني په كلدارو            (AFN vs PKR)
 */
function parseDetailed(text: string): ParsedRate[] {
  const results: ParsedRate[] = []
  // Sections separated by blank line; find header keywords + 2 numbers
  const pairs: { pair: Pair; keys: RegExp }[] = [
    { pair: 'USD_AFN', keys: /ډالر\s*مقابل\s*افغانۍ|ډالر.*افغان/iu },
    { pair: 'USD_PKR', keys: /ډالر\s*پ?ه?\s*کلدار/iu },
    { pair: 'AFN_PKR', keys: /افغاني\s*پ?ه?\s*[کك]لدار/iu },
  ]
  for (const { pair, keys } of pairs) {
    const match = keys.exec(text)
    if (!match) continue
    const after = text.slice(match.index, match.index + 400)
    const nums = Array.from(after.matchAll(/[\d]+\.?\d*/g))
      .map((m) => parseFloat(m[0]))
      .filter((n) => !Number.isNaN(n) && n > 0)
    if (nums.length >= 2) {
      results.push({ pair, buy: nums[0], sell: nums[1] })
    }
  }
  return results
}

/**
 * Parse the "compact" 3-row format:
 *   ډالـر ⚡ افـغـانـی ⚡ کـلداری
 *   298.20✬298.10☄     (USD→PKR)
 *   64.28✬64.25☄       (USD→AFN)
 *   4641✬4639☄         (AFN→PKR ×1000)
 */
function parseCompact(text: string): ParsedRate[] {
  if (!/ډالـ?ـ?ر.*افـ?غـ?انـ?[یي].*کـ?لدار/u.test(text)) return []
  const rows = Array.from(text.matchAll(/([\d]+\.?\d*)\s*[✬✦✯*]\s*([\d]+\.?\d*)/g))
  if (rows.length < 3) return []
  const order: Pair[] = ['USD_PKR', 'USD_AFN', 'AFN_PKR']
  return rows.slice(0, 3).map((m, i) => {
    let buy = parseFloat(m[1])
    let sell = parseFloat(m[2])
    if (order[i] === 'AFN_PKR' && buy > 100) {
      // Compact format omits decimal: 4641 -> 4.641
      buy = buy / 1000
      sell = sell / 1000
    }
    return { pair: order[i], buy, sell }
  })
}

function sanityCheck(rates: ParsedRate[]): ParsedRate[] {
  // Rough plausible ranges for Kandahar market
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

async function runRefresh() {
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KandaharRates/1.0)' },
    })
    if (!res.ok) {
      return Response.json({ ok: false, error: `Source HTTP ${res.status}` }, { status: 502 })
    }
    const html = await res.text()
    const postRegex =
      /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>\s*<div class="tgme_widget_message_footer/g
    const posts: string[] = []
    let m: RegExpExecArray | null
    while ((m = postRegex.exec(html)) !== null) {
      posts.push(stripHtml(m[1]))
    }
    // Walk from newest to oldest, take the first post that yields a full set
    let chosen: { text: string; rates: ParsedRate[] } | null = null
    for (let i = posts.length - 1; i >= 0; i--) {
      const text = posts[i]
      let rates = sanityCheck(parseDetailed(text))
      if (rates.length < 3) {
        const compact = sanityCheck(parseCompact(text))
        if (compact.length >= rates.length) rates = compact
      }
      const pairsFound = new Set(rates.map((r) => r.pair))
      if (pairsFound.size === 3) {
        chosen = { text, rates }
        break
      }
    }
    if (!chosen) {
      return Response.json(
        { ok: false, error: 'No parseable post found', scanned: posts.length },
        { status: 422 },
      )
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const today = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kabul' }),
    )
      .toISOString()
      .slice(0, 10)

    const rows = chosen.rates.map((r) => ({
      pair: r.pair,
      buy: r.buy,
      sell: r.sell,
      recorded_at: new Date().toISOString(),
      recorded_date: today,
      raw_source: chosen!.text.slice(0, 500),
    }))

    const { error } = await supabaseAdmin
      .from('rates')
      .upsert(rows, { onConflict: 'pair,recorded_date' })

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true, updated: rows.length, rates: chosen.rates })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
