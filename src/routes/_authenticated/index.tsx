import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useSuspenseQuery, queryOptions } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, RefreshCw, BarChart3 } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getRates, type RateRow } from '@/lib/rates.functions'
import { trendProbability } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LanguageMenu } from '@/components/LanguageMenu'
import { useI18n } from '@/i18n'

const ratesQuery = queryOptions({
  queryKey: ['rates'],
  queryFn: () => getRates(),
  staleTime: 60_000,
})

export const Route = createFileRoute('/_authenticated/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(ratesQuery),
  component: HomePage,
})

type PairKey = 'USD_AFN' | 'USD_PKR' | 'AFN_PKR'

const PAIRS: { key: PairKey; fromFlag: string; toFlag: string }[] = [
  { key: 'USD_AFN', fromFlag: '🇺🇸', toFlag: '🇦🇫' },
  { key: 'USD_PKR', fromFlag: '🇺🇸', toFlag: '🇵🇰' },
  { key: 'AFN_PKR', fromFlag: '🇦🇫', toFlag: '🇵🇰' },
]

function groupByPair(rows: RateRow[]) {
  const map = new Map<string, RateRow[]>()
  for (const r of rows) {
    const list = map.get(r.pair) ?? []
    list.push(r)
    map.set(r.pair, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at))
  }
  return map
}

function formatNum(n: number) {
  if (n >= 100) return n.toFixed(2)
  if (n >= 10) return n.toFixed(2)
  return n.toFixed(3)
}

function useTimeAgo(iso?: string) {
  // Only render on client to avoid hydration mismatch.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  if (!iso || now === null) return null
  const diff = now - +new Date(iso)
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function HomePage() {
  const router = useRouter()
  const { data } = useSuspenseQuery(ratesQuery)
  const grouped = useMemo(() => groupByPair(data.rates), [data.rates])
  const [refreshing, setRefreshing] = useState(false)
  const { t, dir } = useI18n()
  const ago = useTimeAgo(data.rates[0]?.recorded_at)

  const triggerRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/public/cron/refresh-rates', { method: 'POST' })
      await router.invalidate()
    } finally {
      setRefreshing(false)
    }
  }

  const hasData = data.rates.length > 0

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-background to-background dark:from-emerald-950/20">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-foreground truncate">
              {t('app_title')}
            </h1>
            <p className="text-[11px] text-muted-foreground truncate">{t('tagline')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageMenu />
            <Button
              size="sm"
              variant="outline"
              onClick={triggerRefresh}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('refresh')}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {ago && (
          <p className="text-xs text-muted-foreground text-center">
            {t('last_updated')} {ago}
          </p>
        )}

        {!hasData ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">{t('no_data')}</p>
            <Button onClick={triggerRefresh} disabled={refreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {t('load_rates')}
            </Button>
          </Card>
        ) : (
          <section className="grid gap-3">
            {PAIRS.map((p) => {
              const history = grouped.get(p.key) ?? []
              const latest = history[0]
              const previous = history[1]
              if (!latest) return null
              const mid = (Number(latest.buy) + Number(latest.sell)) / 2
              const prevMid = previous ? (Number(previous.buy) + Number(previous.sell)) / 2 : mid
              const delta = mid - prevMid
              const pct = prevMid ? (delta / prevMid) * 100 : 0
              const up = delta >= 0
              const trend = trendProbability(history)
              const pUp = Math.round(trend.pUp * 100)
              return (
                <Card key={p.key} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl">
                        {p.fromFlag} <span className="text-muted-foreground">→</span> {p.toFlag}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t(`pair_${p.key}` as 'pair_USD_AFN')}
                      </p>
                    </div>
                    <div
                      className={`flex items-center gap-1 text-xs font-medium ${
                        up ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {up ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {pct ? `${up ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t('buy')}
                      </p>
                      <p className="font-mono text-xl font-semibold text-foreground tabular-nums">
                        {formatNum(Number(latest.buy))}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t('sell')}
                      </p>
                      <p className="font-mono text-xl font-semibold text-foreground tabular-nums">
                        {formatNum(Number(latest.sell))}
                      </p>
                    </div>
                  </div>

                  {history.length > 1 && (
                    <div className="mt-3 h-16">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={history
                            .slice()
                            .reverse()
                            .map((r) => ({
                              date: r.recorded_date.slice(5),
                              value: (Number(r.buy) + Number(r.sell)) / 2,
                            }))}
                        >
                          <XAxis dataKey="date" hide />
                          <YAxis hide domain={['dataMin', 'dataMax']} />
                          <Tooltip
                            contentStyle={{ fontSize: 11, padding: 6, borderRadius: 6 }}
                            formatter={(v: number) => formatNum(v)}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={up ? '#059669' : '#dc2626'}
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-muted-foreground">
                      <span className={pUp >= 50 ? 'text-emerald-600' : 'text-rose-600'}>
                        {pUp}%
                      </span>{' '}
                      {pUp >= 50 ? t('prob_up') : t('prob_down').replace('down', 'down')}
                    </div>
                    <Button asChild size="sm" variant="ghost" className="gap-1 h-7">
                      <Link to="/chart/$pair" params={{ pair: p.key }}>
                        <BarChart3 className="h-3.5 w-3.5" />
                        {t('candlestick')}
                      </Link>
                    </Button>
                  </div>
                </Card>
              )
            })}
          </section>
        )}

        {hasData && <Converter grouped={grouped} />}

        <footer className="pt-6 pb-24 text-center text-[11px] text-muted-foreground">
          {t('footer')}
        </footer>
      </main>
    </div>
  )
}

function Converter({ grouped }: { grouped: Map<string, RateRow[]> }) {
  const { t } = useI18n()
  const [from, setFrom] = useState<'USD' | 'AFN' | 'PKR'>('USD')
  const [to, setTo] = useState<'USD' | 'AFN' | 'PKR'>('AFN')
  const [amount, setAmount] = useState('1')

  const rate = useMemo(() => {
    if (from === to) return 1
    const get = (pair: PairKey) => {
      const r = grouped.get(pair)?.[0]
      if (!r) return null
      return (Number(r.buy) + Number(r.sell)) / 2
    }
    const usdAfn = get('USD_AFN')
    const usdPkr = get('USD_PKR')
    const afnPkr = get('AFN_PKR')
    const direct: Record<string, number | null> = {
      USD_AFN: usdAfn,
      AFN_USD: usdAfn ? 1 / usdAfn : null,
      USD_PKR: usdPkr,
      PKR_USD: usdPkr ? 1 / usdPkr : null,
      AFN_PKR: afnPkr,
      PKR_AFN: afnPkr ? 1 / afnPkr : null,
    }
    return direct[`${from}_${to}`] ?? null
  }, [from, to, grouped])

  const value = parseFloat(amount)
  const result = rate && !Number.isNaN(value) ? value * rate : null

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">{t('quick_converter')}</h2>
      <div className="grid gap-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('from')}
            </label>
            <div className="flex gap-2 mt-1">
              <Select value={from} onValueChange={(v) => setFrom(v as 'USD')}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="AFN">AFN</SelectItem>
                  <SelectItem value="PKR">PKR</SelectItem>
                </SelectContent>
              </Select>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 font-mono"
              />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={swap} className="mb-0.5">
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('to')}
          </label>
          <div className="flex gap-2 mt-1">
            <Select value={to} onValueChange={(v) => setTo(v as 'USD')}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="AFN">AFN</SelectItem>
                <SelectItem value="PKR">PKR</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-sm tabular-nums">
              {result !== null ? formatNum(result) : '—'}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
