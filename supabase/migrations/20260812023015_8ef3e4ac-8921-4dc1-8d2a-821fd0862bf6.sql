CREATE TABLE public.rate_views (
  id bigserial PRIMARY KEY,
  rate_id bigint NOT NULL REFERENCES public.rates(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_id, device_id)
);
CREATE INDEX rate_views_rate_id_idx ON public.rate_views(rate_id);
GRANT SELECT ON public.rate_views TO anon, authenticated;
GRANT ALL ON public.rate_views TO service_role;
ALTER TABLE public.rate_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rate views are publicly readable" ON public.rate_views FOR SELECT USING (true);

CREATE TABLE public.rate_likes (
  id bigserial PRIMARY KEY,
  rate_id bigint NOT NULL REFERENCES public.rates(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_id, device_id)
);
CREATE INDEX rate_likes_rate_id_idx ON public.rate_likes(rate_id);
GRANT SELECT ON public.rate_likes TO anon, authenticated;
GRANT ALL ON public.rate_likes TO service_role;
ALTER TABLE public.rate_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rate likes are publicly readable" ON public.rate_likes FOR SELECT USING (true);