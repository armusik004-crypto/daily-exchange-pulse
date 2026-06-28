# Kandahar Market Rates

A clean English-language web app showing daily currency exchange rates for the Kandahar market. The Telegram source is never mentioned anywhere in the UI — users see it as our own rates service.

**Branding:** "Kandahar Market Rates" — tagline "Live and Accurate Market Rates of Kandahar"

## What the user sees

**Home / Rates board**
- Big card per currency vs Afghani (AFN): Buy / Sell prices, last updated time.
- Green up-arrow / red down-arrow with % change vs yesterday.
- Search bar to filter currencies by name or code.
- ⭐ Favorite button — favorited currencies pin to the top (saved in browser).
- Currencies covered: USD, EUR, GBP, SAR, AED, PKR, IRR (Toman), INR, CNY, CAD, AUD, TRY, RUB — every major world currency the source publishes.

**Currency detail page** (tap a card)
- Today's buy/sell with change indicator.
- 30-day historical line chart (Recharts).
- Quick converter at the bottom: type an amount in AFN or the foreign currency, see the other side instantly.

**Converter page**
- Standalone two-field converter with currency dropdowns, swap button, uses latest rates.

**Header**
- Logo + name, nav: Rates · Converter · About.
- Subtle "Last updated: 2 hours ago" badge.

## Visual direction

- Clean, trustworthy, financial-app feel (think Wise / Revolut, not crypto-flashy).
- Light theme default with dark-mode toggle.
- Accent color: deep emerald green (#0F766E) for positive, warm red (#DC2626) for negative, neutral slate for UI.
- Typography: Inter for UI, JetBrains Mono for numbers (so prices align nicely).
- Card-based layout, generous whitespace, mobile-first (390px tested).

## How rates get into the app (technical)

1. **Lovable Cloud** is enabled for database + scheduled jobs.
2. Tables:
   - `currencies` (code, name, symbol, flag emoji, display_order)
   - `rates` (currency_code, buy, sell, recorded_at, source_message_id) — one row per day per currency, public-readable.
3. **Refresh server route** at `/api/public/cron/refresh-rates`:
   - Fetches the public preview page `https://t.me/s/kandahar_rates` server-side.
   - Parses the latest post's text (regex extraction of currency lines like "USD 70.20 / 70.40").
   - If a post is image-only, falls back to the most recent text-only post and logs a warning.
   - Upserts rows into `rates` keyed by `(currency_code, date)`.
   - Protected by a `CRON_SECRET` header check.
4. **pg_cron** schedules this endpoint to run every hour (so updates appear the same day they're posted, not just once at midnight). Manual "Refresh now" button on an admin-hidden URL for testing.
5. Frontend reads via a public server function that returns latest + previous day per currency, plus 30-day history for detail pages.

## Risks I want to flag

- The Telegram channel may post rates as **images** instead of text. The plain HTTP scrape only sees text. If most posts are images, we'll need to add OCR (Lovable AI vision) as a second step — I'll build the text path first, see what comes through, and add OCR only if needed.
- t.me/s/ public preview must be enabled on the channel (it usually is for public channels). If it's disabled, we'd need a different ingestion path.

## Out of scope for v1

- Push/email alerts when rates change.
- Multi-language UI (English only per your request).
- User accounts (favorites are stored in the browser).
- Trading or transaction features — display only.

Tell me if you want to adjust the currency list, branding name, or feature set before I build.
