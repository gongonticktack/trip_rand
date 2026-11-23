BEGIN;
CREATE TABLE IF NOT EXISTS public.trip_rand_app_profiles (
 user_id UUID PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.trip_rand_app_visits (
 user_id UUID NOT NULL REFERENCES public.trip_rand_app_profiles(user_id),spot_slug TEXT NOT NULL REFERENCES public.trip_rand_spots(slug),visited BOOLEAN NOT NULL DEFAULT true,visited_on DATE NOT NULL DEFAULT CURRENT_DATE,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(user_id,spot_slug)
);
CREATE TABLE IF NOT EXISTS public.trip_rand_app_photos (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL,spot_slug TEXT NOT NULL,jpeg BYTEA NOT NULL CHECK(octet_length(jpeg)<=5242880 AND substring(jpeg FROM 1 FOR 3)=decode('ffd8ff','hex')),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),FOREIGN KEY(user_id,spot_slug) REFERENCES public.trip_rand_app_visits(user_id,spot_slug)
);
ALTER TABLE public.trip_rand_app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_rand_app_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_rand_app_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_rand_app_profiles,public.trip_rand_app_visits,public.trip_rand_app_photos FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.trip_rand_profile_create(p_user_id UUID,p_token_hash TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.trip_rand_app_profiles(user_id,token_hash) VALUES(p_user_id,p_token_hash);
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_app_owner(p_token TEXT) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id UUID;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid data token'; END IF;
 SELECT user_id INTO owner_id FROM public.trip_rand_app_profiles WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 IF owner_id IS NULL THEN RAISE EXCEPTION 'invalid data token'; END IF;
 RETURN owner_id;
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_visit_list(p_token TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id UUID:=public.trip_rand_app_owner(p_token); result JSONB;
BEGIN
 SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.spot_slug),'[]'::jsonb) INTO result FROM public.trip_rand_app_visits v WHERE user_id=owner_id;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_visit_save(p_token TEXT,p_slug TEXT,p_visited BOOLEAN,p_date DATE) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id UUID:=public.trip_rand_app_owner(p_token);result JSONB;
BEGIN
 INSERT INTO public.trip_rand_app_visits(user_id,spot_slug,visited,visited_on) VALUES(owner_id,p_slug,p_visited,p_date) ON CONFLICT(user_id,spot_slug) DO UPDATE SET visited=EXCLUDED.visited,visited_on=EXCLUDED.visited_on,updated_at=now() RETURNING to_jsonb(trip_rand_app_visits.*) INTO result;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_photo_list(p_token TEXT,p_slug TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id UUID:=public.trip_rand_app_owner(p_token);result JSONB;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'created_at',created_at) ORDER BY created_at),'[]'::jsonb) INTO result FROM public.trip_rand_app_photos WHERE user_id=owner_id AND spot_slug=p_slug;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_photo_save(p_token TEXT,p_slug TEXT,p_jpeg TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id UUID:=public.trip_rand_app_owner(p_token);photo_id UUID;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text || '/' || p_slug,0));
 IF NOT EXISTS(SELECT 1 FROM public.trip_rand_app_visits WHERE user_id=owner_id AND spot_slug=p_slug AND visited) THEN RAISE EXCEPTION 'visit required'; END IF;
 IF (SELECT count(*) FROM public.trip_rand_app_photos WHERE user_id=owner_id AND spot_slug=p_slug)>=10 THEN RAISE EXCEPTION 'photo limit reached'; END IF;
 IF length(p_jpeg)>6990510 THEN RAISE EXCEPTION 'photo too large'; END IF;
 INSERT INTO public.trip_rand_app_photos(user_id,spot_slug,jpeg) VALUES(owner_id,p_slug,decode(p_jpeg,'base64')) RETURNING id INTO photo_id;RETURN jsonb_build_object('id',photo_id);
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_photo_get(p_token TEXT,p_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id UUID:=public.trip_rand_app_owner(p_token);result JSONB;
BEGIN
 SELECT jsonb_build_object('id',id,'jpeg',replace(encode(jpeg,'base64'),E'\n','')) INTO result FROM public.trip_rand_app_photos WHERE id=p_id AND user_id=owner_id;IF result IS NULL THEN RAISE EXCEPTION 'photo not found'; END IF;RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.trip_rand_app_owner(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.trip_rand_profile_create(UUID,TEXT),public.trip_rand_visit_list(TEXT),public.trip_rand_visit_save(TEXT,TEXT,BOOLEAN,DATE),public.trip_rand_photo_list(TEXT,TEXT),public.trip_rand_photo_save(TEXT,TEXT,TEXT),public.trip_rand_photo_get(TEXT,UUID) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.trip_rand_profile_create(UUID,TEXT),public.trip_rand_visit_list(TEXT),public.trip_rand_visit_save(TEXT,TEXT,BOOLEAN,DATE),public.trip_rand_photo_list(TEXT,TEXT),public.trip_rand_photo_save(TEXT,TEXT,TEXT),public.trip_rand_photo_get(TEXT,UUID) TO anon;
COMMIT;
