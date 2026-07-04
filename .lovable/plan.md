# Kandahar Market Rates — Major Upgrade Plan

Six independent tracks. I'll ship them in one build.

## 1. Fix the scraper (reliable source)

The current `Kandahar_Sarafi` channel has been silent/formatting-changed for 4 days. I'll:

- Change the source to **`sarafi_kandahar`** (کندهار صرافي) — an active public Telegram channel with preview enabled that posts Kandahar market USD/AFN, USD/PKR, AFN/PKR multiple times daily. Fallback chain: try `sarafi_kandahar` → `Kandahar_Sarafi` → `da_afghan_sarafi` so a single silent channel never breaks the app.
- Broaden the parser to accept more post templates (emoji separators ✬ ✦ ⭐ ✰, arrow forms `>>` `→` `:`, Persian/Pashto digits ۰-۹ and ٠-٩).
- Add a `sources_log` insert on every cron run (ok/fail, which channel served the data, sample text) so silent-failures become visible.
- Keep pg_cron hourly.

## 2. Candlestick charts (Binance-style)

- Add `recharts`-based candlestick using `ComposedChart` + custom `Bar` shape (wick line + body rect, green bullish / red bearish). No new heavy dep.
- Group rate history into daily OHLC per pair: `open` = first record of day, `close` = last, `high`/`low` = min/max of mid-price.
- New route `/chart/$pair` with tabs for USD_AFN, USD_PKR, AFN_PKR and a 7d / 30d toggle.
- Link each home-page card to its chart tab.

## 3. Trend probability

- Server-computed on the fly from the last 30 days of stored rates.
- Simple, honest model: 7-day SMA slope + realized volatility → probability of continued direction.
  `p_up = clamp( 0.5 + (slope / (2 * stddev)), 0.05, 0.95 )`
- Display: "68% probability USD/AFN moves up" with confidence tag (Low/Med/High from sample size).
- Label the card "Statistical trend — not financial advice".

## 4. Adris AI assistant

- New floating chat button + drawer on every page.
- Uses Lovable AI Gateway (`google/gemini-3-flash-preview`), streamed via AI SDK + AI Elements primitives.
- Server route `/api/chat` injects a system prompt every turn containing:
  - Latest rates snapshot (all 3 pairs, buy/sell, timestamp)
  - Today's OHLC + 7-day trend numbers
  - Rule: "If asked 'who created you', reply exactly: *I was created by Adris Roohane for the Kandahar Market Rates application to assist users who may not fully understand our app's technical charts or advanced technology.*"
  - Rule: "Never invent rates. Use only the numbers provided in this system prompt."
- Localized answers based on the active UI language.

## 5. PWA (installable)

- Manifest-only path per project rules (installability, no offline SW noise): `public/manifest.webmanifest`, icons (generated 192/512 + maskable), theme color, `display: standalone`, `apple-touch-icon`, and `<link rel="manifest">` in root head.
- No service worker (Lovable preview safety). Chrome's "Add to Home Screen" still works.

## 6. Language switcher (Pashto / Dari / English)

- Lightweight `i18n` module: JSON dictionaries in `src/i18n/{en,ps,fa}.ts`, `useT()` hook, localStorage persistence, header dropdown.
- `<html dir="rtl">` when Pashto/Dari is active.
- Cover all UI strings (header, cards, converter, chart tabs, AI drawer, footer). AI system prompt receives the active language so replies match.

## Technical notes (for reference)

- Migration: add `sources_log` table (id, source, ok, note, created_at) with RLS locked; also index `rates(pair, recorded_date)` if missing.
- Files touched: new `src/routes/chart.$pair.tsx`, `src/routes/api/chat.ts`, `src/components/CandlestickChart.tsx`, `src/components/AdrisChat.tsx`, `src/components/LanguageMenu.tsx`, `src/i18n/*`, `src/lib/analytics.ts`, `public/manifest.webmanifest`, updates to `refresh-rates.ts`, `index.tsx`, `__root.tsx`.
- Deps to add: `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `zod` (already), plus AI Elements: `bun x ai-elements@latest add conversation message prompt-input shimmer`.

Approve and I'll build it in one pass.
