import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { type RateRow } from "@/lib/rates.functions";
import { ratesQuery } from "@/lib/rates-query";
import { toOHLC, trendProbability } from "@/lib/analytics";
import { CandlestickChart } from "@/components/CandlestickChart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

const PAIRS = ["USD_AFN", "USD_PKR", "AFN_PKR"] as const;
type Pair = (typeof PAIRS)[number];

export const Route = createFileRoute("/chart/$pair")({
  loader: async ({ context, params }) => {
    if (!PAIRS.includes(params.pair as Pair)) throw notFound();
    return context.queryClient.ensureQueryData(ratesQuery);
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.pair.replace("_", " → ")} Candlestick — Kandahar Market Rates` },
      { name: "description", content: `Daily candlestick chart of ${params.pair} in the Kandahar local market.` },
    ],
  }),
  component: ChartPage,
  notFoundComponent: () => <div className="p-6 text-sm">Unknown pair.</div>,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

function ChartPage() {
  const { pair } = Route.useParams();
  const { data } = useSuspenseQuery(ratesQuery);
  const { t, dir } = useI18n();
  const [range, setRange] = useState<7 | 30>(30);

  const rows = useMemo(
    () => (data.rates as RateRow[]).filter((r) => r.pair === pair),
    [data.rates, pair],
  );
  const ohlc = useMemo(() => toOHLC(rows).slice(-range), [rows, range]);
  const trend = useMemo(() => trendProbability(rows), [rows]);
  const latest = rows[0];

  const pUp = Math.round(trend.pUp * 100);
  const pDown = 100 - pUp;

  return (
    <div dir={dir} className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button asChild size="sm" variant="ghost" className="gap-1">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </Link>
          </Button>
          <h1 className="text-base font-semibold">
            {t(`pair_${pair}` as "pair_USD_AFN")}
          </h1>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3 flex gap-2 overflow-x-auto">
          {PAIRS.map((p) => (
            <Link
              key={p}
              to="/chart/$pair"
              params={{ pair: p }}
              className={`text-xs whitespace-nowrap rounded-full border px-3 py-1 ${
                p === pair
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.replace("_", " → ")}
            </Link>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        {latest && (
          <Card className="p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("buy")} / {t("sell")}
                </p>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {Number(latest.buy).toFixed(2)}
                  <span className="text-muted-foreground"> / </span>
                  {Number(latest.sell).toFixed(2)}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setRange(7)}
                  className={`text-xs rounded-md px-2 py-1 border ${range === 7 ? "bg-foreground text-background" : "border-border"}`}
                >
                  {t("range_7d")}
                </button>
                <button
                  onClick={() => setRange(30)}
                  className={`text-xs rounded-md px-2 py-1 border ${range === 30 ? "bg-foreground text-background" : "border-border"}`}
                >
                  {t("range_30d")}
                </button>
              </div>
            </div>
            <CandlestickChart data={ohlc} />
          </Card>
        )}

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">{t("trend_title")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
              <p className="text-[10px] uppercase text-emerald-700 dark:text-emerald-400">
                {t("prob_up")}
              </p>
              <p className="text-2xl font-bold text-emerald-600">{pUp}%</p>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3">
              <p className="text-[10px] uppercase text-rose-700 dark:text-rose-400">
                {t("prob_down")}
              </p>
              <p className="text-2xl font-bold text-rose-600">{pDown}%</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("confidence")}: {t(trend.confidence)} · {t("trend_disclaimer")}
          </p>
        </Card>
      </main>
    </div>
  );
}
