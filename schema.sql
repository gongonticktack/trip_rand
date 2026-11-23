BEGIN;
CREATE TABLE IF NOT EXISTS public.trip_rand_spots (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefecture TEXT NOT NULL,
  area TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  address TEXT NOT NULL,
  access TEXT NOT NULL,
  parking TEXT NOT NULL,
  hours TEXT NOT NULL,
  fees TEXT NOT NULL,
  season TEXT NOT NULL,
  cautions TEXT NOT NULL,
  stay_minutes INTEGER NOT NULL CHECK (stay_minutes > 0),
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_url TEXT NOT NULL CHECK (source_url LIKE 'https://%'),
  source_name TEXT NOT NULL,
  extra_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  verified_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_rand_spots_prefecture_category ON public.trip_rand_spots(prefecture, category);
ALTER TABLE public.trip_rand_spots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_rand_spots FROM anon, authenticated;
GRANT SELECT ON public.trip_rand_spots TO anon, authenticated;
DO $policy$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trip_rand_spots' AND policyname='trip_rand_public_read') THEN
    CREATE POLICY trip_rand_public_read ON public.trip_rand_spots FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $policy$;
COMMENT ON TABLE public.trip_rand_spots IS 'Trip Rand public tourism research. Editorial recommendation and stay_minutes are estimates; verified_on is research date.';
COMMIT;
