import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Bar, Cell } from "recharts";
import type { OHLC } from "@/lib/analytics";

type Row = OHLC & { bodyBase: number; bodyHeight: number; wickBase: number; wickHeight: number; bullish: boolean };

function prepare(data: OHLC[]): Row[] {
  return data.map((d) => {
    const bullish = d.close >= d.open;
    return {
      ...d,
      bodyBase: Math.min(d.open, d.close),
      bodyHeight: Math.max(Math.abs(d.close - d.open), (d.high - d.low) * 0.02, 0.0001),
      wickBase: d.low,
      wickHeight: d.high - d.low,
      bullish,
    };
  });
}

export function CandlestickChart({ data, height = 320 }: { data: OHLC[]; height?: number }) {
  const rows = prepare(data);
  if (!rows.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Not enough data yet.
      </div>
    );
  }
  const minLow = Math.min(...rows.map((r) => r.low));
  const maxHigh = Math.max(...rows.map((r) => r.high));
  const pad = (maxHigh - minLow) * 0.05 || 0.5;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="20%">
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
          <YAxis
            domain={[minLow - pad, maxHigh + pad]}
            tick={{ fontSize: 10 }}
            width={48}
            tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={() => ""}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload as Row | undefined;
              if (!p) return String(label);
              return `${p.date}\nO ${p.open.toFixed(2)}  H ${p.high.toFixed(2)}  L ${p.low.toFixed(2)}  C ${p.close.toFixed(2)}`;
            }}
          />
          {/* Wick */}
          <Bar dataKey="wickHeight" stackId="wick" fill="transparent" isAnimationActive={false} barSize={2}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.bullish ? "#10b981" : "#ef4444"} />
            ))}
          </Bar>
          {/* Body */}
          <Bar dataKey="bodyHeight" isAnimationActive={false}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.bullish ? "#10b981" : "#ef4444"} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
