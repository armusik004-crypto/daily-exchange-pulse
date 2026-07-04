import type { RateRow } from "@/lib/rates.functions";

export type OHLC = { date: string; open: number; high: number; low: number; close: number };

function mid(r: RateRow) {
  return (Number(r.buy) + Number(r.sell)) / 2;
}

/** Group rows into daily OHLC (using mid price). Rows may arrive in any order. */
export function toOHLC(rows: RateRow[]): OHLC[] {
  const byDay = new Map<string, RateRow[]>();
  for (const r of rows) {
    const list = byDay.get(r.recorded_date) ?? [];
    list.push(r);
    byDay.set(r.recorded_date, list);
  }
  const days = Array.from(byDay.keys()).sort();
  return days.map((date) => {
    const list = byDay.get(date)!.slice().sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at));
    const prices = list.map(mid);
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    return { date, open, high, low, close };
  });
}

/** Probability that price continues its recent direction, based on SMA slope vs volatility. */
export function trendProbability(rows: RateRow[]): {
  pUp: number;
  direction: "up" | "down" | "flat";
  confidence: "low" | "medium" | "high";
  samples: number;
} {
  if (rows.length < 2) return { pUp: 0.5, direction: "flat", confidence: "low", samples: rows.length };
  const ohlc = toOHLC(rows);
  const closes = ohlc.map((d) => d.close);
  const n = Math.min(7, closes.length);
  const recent = closes.slice(-n);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const slope = (last - first) / n;

  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((s, x) => s + (x - mean) ** 2, 0) / closes.length;
  const std = Math.sqrt(variance) || Math.abs(mean) * 0.001 || 0.0001;

  const raw = 0.5 + slope / (2 * std);
  const pUp = Math.max(0.05, Math.min(0.95, raw));
  const direction: "up" | "down" | "flat" =
    Math.abs(pUp - 0.5) < 0.03 ? "flat" : pUp > 0.5 ? "up" : "down";
  const confidence: "low" | "medium" | "high" =
    ohlc.length >= 14 ? "high" : ohlc.length >= 5 ? "medium" : "low";
  return { pUp, direction, confidence, samples: ohlc.length };
}
