
CREATE TABLE public.rates (
  id BIGSERIAL PRIMARY KEY,
  pair TEXT NOT NULL,
  buy NUMERIC(14,4) NOT NULL,
  sell NUMERIC(14,4) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kabul')::date,
  raw_source TEXT
);
CREATE UNIQUE INDEX rates_pair_date_uniq ON public.rates(pair, recorded_date);
CREATE INDEX rates_pair_recorded_at_idx ON public.rates(pair, recorded_at DESC);

GRANT SELECT ON public.rates TO anon;
GRANT SELECT ON public.rates TO authenticated;
GRANT ALL ON public.rates TO service_role;

ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rates are publicly readable" ON public.rates FOR SELECT USING (true);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
