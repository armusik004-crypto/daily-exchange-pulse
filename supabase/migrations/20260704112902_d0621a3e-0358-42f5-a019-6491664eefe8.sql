CREATE TABLE IF NOT EXISTS public.sources_log (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.sources_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sources_log_id_seq TO service_role;
ALTER TABLE public.sources_log ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (via edge/server admin) writes; not exposed to clients.

CREATE UNIQUE INDEX IF NOT EXISTS rates_pair_date_uidx ON public.rates(pair, recorded_date);
CREATE INDEX IF NOT EXISTS rates_pair_recorded_at_idx ON public.rates(pair, recorded_at DESC);