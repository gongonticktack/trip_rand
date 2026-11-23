BEGIN;
ALTER TABLE public.trip_rand_spots
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION CHECK(latitude BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION CHECK(longitude BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS location_source_url TEXT,
  ADD COLUMN IF NOT EXISTS nagoya_minutes_min INTEGER CHECK(nagoya_minutes_min>0),
  ADD COLUMN IF NOT EXISTS nagoya_minutes_max INTEGER,
  ADD COLUMN IF NOT EXISTS travel_note TEXT;
CREATE TABLE IF NOT EXISTS public.trip_rand_visits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_slug TEXT NOT NULL REFERENCES public.trip_rand_spots(slug),
  visited BOOLEAN NOT NULL DEFAULT true,
  visited_on DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,spot_slug)
);
CREATE TABLE IF NOT EXISTS public.trip_rand_photos (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  spot_slug TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(user_id,spot_slug) REFERENCES public.trip_rand_visits(user_id,spot_slug) ON DELETE CASCADE,
  CHECK(storage_path=user_id::text || '/' || spot_slug || '/' || id::text || '.jpg')
);
ALTER TABLE public.trip_rand_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_rand_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_rand_visits, public.trip_rand_photos FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.trip_rand_visits TO authenticated;
GRANT SELECT,INSERT ON public.trip_rand_photos TO authenticated;
DO $policies$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trip_rand_visits' AND policyname='trip_rand_visit_owner') THEN
    CREATE POLICY trip_rand_visit_owner ON public.trip_rand_visits FOR ALL TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trip_rand_photos' AND policyname='trip_rand_photo_read') THEN
    CREATE POLICY trip_rand_photo_read ON public.trip_rand_photos FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
    CREATE POLICY trip_rand_photo_insert ON public.trip_rand_photos FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.trip_rand_visits v WHERE v.user_id=(SELECT auth.uid()) AND v.spot_slug=trip_rand_photos.spot_slug AND v.visited));
  END IF;
END $policies$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('trip-rand-photos','trip-rand-photos',false,5242880,ARRAY['image/jpeg'])
ON CONFLICT(id) DO NOTHING;
DO $storage$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='trip_rand_storage_read') THEN
    CREATE POLICY trip_rand_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='trip-rand-photos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
    CREATE POLICY trip_rand_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='trip-rand-photos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND EXISTS(SELECT 1 FROM public.trip_rand_visits v WHERE v.user_id=(SELECT auth.uid()) AND v.spot_slug=(storage.foldername(name))[2] AND v.visited));
    CREATE POLICY trip_rand_storage_cleanup ON storage.objects FOR DELETE TO authenticated USING(bucket_id='trip-rand-photos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND NOT EXISTS(SELECT 1 FROM public.trip_rand_photos p WHERE p.storage_path=name));
  END IF;
END $storage$;
COMMIT;
