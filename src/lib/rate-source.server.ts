import type { RateRow } from '@/lib/rates.functions'

type Pair = 'USD_AFN' | 'USD_PKR' | 'AFN_PKR'

type ParsedRate = {
  pair: Pair
  buy: number
  sell: number
  at: string
  raw: string
}

const SOURCE_CHANNELS = ['kandahar123']

function normalizeDigits(s: string): string {
  const map: Record<string, string> = {
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9',
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  }
  return s
    .replace(/[۰-۹٠-٩]/g, (ch) => map[ch] ?? ch)
    .replace(/ك/g, 'ک')
    .replace(/ي/g, 'ی')
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#33;/g, '!')
    .replace(/&nbsp;/g, ' ')
}

function parseDetailed(text: string): Omit<ParsedRate, 'at' | 'raw'>[] {
  const results: Omit<ParsedRate, 'at' | 'raw'>[] = []
  const pairs: { pair: Pair; keys: RegExp }[] = [
    { pair: 'USD_AFN', keys: /(ډالر|دالر|دولار).{0,24}(افغان)/iu },
    { pair: 'USD_PKR', keys: /(ډالر|دالر|دولار).{0,24}(کلدار|کالدار|روپ)/iu },
    { pair: 'AFN_PKR', keys: /(افغان).{0,24}(کلدار|کالدار|روپ)/iu },
  ]
  for (const { pair, keys } of pairs) {
    const match = keys.exec(text)
    if (!match) continue
    const after = text.slice(match.index, match.index + 420)
    const nums = Array.from(after.matchAll(/[\d]+\.?\d*/g))
      .map((m) => parseFloat(m[0]))
      .filter((n) => !Number.isNaN(n) && n > 0)
    if (nums.length >= 2) results.push({ pair, buy: nums[0], sell: nums[1] })
  }
  return results
}

function parseCompact(text: string): Omit<ParsedRate, 'at' | 'raw'>[] {
  if (!/(ډالر|دالر).{0,40}(افغان).{0,40}(کلدار|روپ)/iu.test(text)) return []
  const rows = Array.from(text.matchAll(/([\d]+\.?\d*)\s*[✬✦✯✰⭐*✤✷☆]\s*([\d]+\.?\d*)/g))
  if (rows.length < 3) return []
  const order: Pair[] = ['USD_PKR', 'USD_AFN', 'AFN_PKR']
  return rows.slice(0, 3).map((m, i) => {
    let buy = parseFloat(m[1])
    let sell = parseFloat(m[2])
    if (order[i] === 'AFN_PKR' && buy > 100) {
      buy /= 1000
      sell /= 1000
    }
    return { pair: order[i], buy, sell }
  })
}

function sanityCheck(rates: Omit<ParsedRate, 'at' | 'raw'>[]): Omit<ParsedRate, 'at' | 'raw'>[] {
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

function kabulDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kabul' }).format(new Date(iso))
}

function syntheticId(pair: string, iso: string): number {
  const text = `${pair}:${iso}`
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return -Math.max(1, Math.abs(hash))
}

async function tryChannel(channel: string): Promise<ParsedRate[] | null> {
  const res = await fetch(`https://t.me/s/${channel}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KandaharRates/1.0)' },
  })
  if (!res.ok) return null
  const html = await res.text()
  const postRegex =
    /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>\s*<div class="tgme_widget_message_footer([\s\S]*?)<\/div>\s*<\/div>/g
  const posts: { text: string; at?: string }[] = []
  let m: RegExpExecArray | null
  while ((m = postRegex.exec(html)) !== null) {
    const footer = m[2] ?? ''
    const dt = /datetime="([^"]+)"/.exec(footer)?.[1]
    posts.push({ text: normalizeDigits(stripHtml(m[1])), at: dt ? new Date(dt).toISOString() : undefined })
  }

  const found = new Map<Pair, ParsedRate>()
  for (let i = posts.length - 1; i >= 0 && found.size < 3; i -= 1) {
    const { text, at } = posts[i]
    if (!at) continue
    let rates = sanityCheck(parseDetailed(text))
    if (!rates.length) rates = sanityCheck(parseCompact(text))
    for (const r of rates) {
      if (!found.has(r.pair)) found.set(r.pair, { ...r, at, raw: text.slice(0, 480) })
    }
  }

  return found.size === 3 ? Array.from(found.values()) : null
}

export async function fetchLatestSourceRateRows(): Promise<RateRow[]> {
  for (const channel of SOURCE_CHANNELS) {
    const rates = await tryChannel(channel)
    if (!rates) continue
    return rates.map((r) => ({
      id: syntheticId(r.pair, r.at),
      pair: r.pair,
      buy: r.buy,
      sell: r.sell,
      recorded_at: r.at,
      recorded_date: kabulDate(r.at),
    }))
  }
  throw new Error('No live Kandahar source produced the required rates')
}
