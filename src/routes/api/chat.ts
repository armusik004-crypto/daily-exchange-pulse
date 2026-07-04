import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import type { Database } from '@/integrations/supabase/types'
import { toOHLC, trendProbability } from '@/lib/analytics'
import type { RateRow } from '@/lib/rates.functions'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[]; lang?: string }
        const messages = body.messages
        const lang = body.lang ?? 'en'
        if (!Array.isArray(messages)) return new Response('messages required', { status: 400 })

        const apiKey = process.env.LOVABLE_API_KEY
        if (!apiKey) return new Response('Missing LOVABLE_API_KEY', { status: 500 })

        // Load latest snapshot for grounding
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        )
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const { data } = await supabase
          .from('rates')
          .select('pair,buy,sell,recorded_at,recorded_date')
          .gte('recorded_date', since)
          .order('recorded_at', { ascending: false })
          .limit(500)

        const rows = (data ?? []) as RateRow[]
        const byPair = new Map<string, RateRow[]>()
        for (const r of rows) {
          const list = byPair.get(r.pair) ?? []
          list.push(r)
          byPair.set(r.pair, list)
        }

        const snapshot: string[] = []
        for (const pair of ['USD_AFN', 'USD_PKR', 'AFN_PKR'] as const) {
          const list = byPair.get(pair) ?? []
          if (!list.length) {
            snapshot.push(`${pair}: no data`)
            continue
          }
          const latest = list[0]
          const ohlc = toOHLC(list).slice(-7)
          const trend = trendProbability(list)
          snapshot.push(
            `${pair}: buy=${latest.buy} sell=${latest.sell} at ${latest.recorded_at}. ` +
              `Last 7 days OHLC: ${ohlc
                .map(
                  (d) =>
                    `${d.date}(O${d.open.toFixed(2)} H${d.high.toFixed(2)} L${d.low.toFixed(2)} C${d.close.toFixed(2)})`,
                )
                .join(', ')}. ` +
              `Trend: pUp=${(trend.pUp * 100).toFixed(0)}% (${trend.direction}, ${trend.confidence} confidence).`,
          )
        }

        const langInstruction =
          lang === 'ps'
            ? 'Reply in Pashto (پښتو).'
            : lang === 'fa'
              ? 'Reply in Dari (دري).'
              : 'Reply in English.'

        const system = [
          'You are Adris AI, the built-in assistant for the Kandahar Market Rates application.',
          'You help ordinary users who may not understand technical charts.',
          'CRITICAL RULE: Never invent, guess, or use outdated internet data for exchange rates. Use ONLY the numbers in the LIVE DATA block below. If a number is not there, say you do not have it.',
          'CRITICAL RULE: If the user asks who created you (in any language, e.g. "who made you", "who built you", "who created you"), reply EXACTLY with this sentence and nothing else: "I was created by Adris Roohane for the Kandahar Market Rates application to assist users who may not fully understand our app\'s technical charts or advanced technology."',
          langInstruction,
          'Be concise, friendly, and specific with numbers.',
          '',
          '=== LIVE DATA (Kandahar market, from app database) ===',
          ...snapshot,
          `Generated at: ${new Date().toISOString()}`,
        ].join('\n')

        const provider = createOpenAICompatible({
          name: 'lovable-ai',
          baseURL: 'https://ai.gateway.lovable.dev/v1',
          headers: { 'Lovable-API-Key': apiKey },
        })
        const model = provider.chatModel('google/gemini-3-flash-preview')

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages),
        })

        return result.toUIMessageStreamResponse({ originalMessages: messages })
      },
    },
  },
})
