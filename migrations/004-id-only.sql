BEGIN;
ALTER TABLE public.trip_rand_app_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE CHECK(username IS NULL OR username ~ '^[a-z0-9_-]{3,32}$');
CREATE TABLE IF NOT EXISTS public.trip_rand_id_sessions (
 token_hash TEXT PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'), user_id UUID NOT NULL REFERENCES public.trip_rand_app_profiles(user_id), ip_hash TEXT NOT NULL CHECK(ip_hash ~ '^[a-f0-9]{64}$'), expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.trip_rand_id_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_rand_id_sessions FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.trip_rand_id_login(p_username TEXT,p_register BOOLEAN,p_token_hash TEXT,p_ip_hash TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id UUID; normalized TEXT:=lower(trim(p_username));
BEGIN
 IF normalized IS NULL OR normalized !~ '^[a-z0-9_-]{3,32}$' OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' OR p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$' OR p_register IS NULL THEN RAISE EXCEPTION 'invalid user input'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('trip-rand-id/'||normalized,0));
 SELECT user_id INTO owner_id FROM public.trip_rand_app_profiles WHERE username=normalized;
 IF p_register AND owner_id IS NOT NULL THEN RAISE EXCEPTION 'id already registered'; END IF;
 IF NOT p_register AND owner_id IS NULL THEN RAISE EXCEPTION 'id not found'; END IF;
 IF owner_id IS NULL THEN
  INSERT INTO public.trip_rand_app_profiles(user_id,token_hash,username) VALUES(gen_random_uuid(),encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex'),normalized) RETURNING user_id INTO owner_id;
 END IF;
 DELETE FROM public.trip_rand_id_sessions WHERE expires_at<now();
 INSERT INTO public.trip_rand_id_sessions(token_hash,user_id,ip_hash,expires_at) VALUES(p_token_hash,owner_id,p_ip_hash,now()+interval '90 days');
 RETURN jsonb_build_object('user',jsonb_build_object('id',owner_id,'username',normalized));
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_id_session(p_token_hash TEXT,p_ip_hash TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE record_data RECORD;
BEGIN
 SELECT s.ip_hash,p.user_id,p.username INTO record_data FROM public.trip_rand_id_sessions s JOIN public.trip_rand_app_profiles p ON p.user_id=s.user_id WHERE s.token_hash=p_token_hash AND s.expires_at>now();
 IF NOT FOUND THEN RETURN jsonb_build_object('user',NULL,'reason',NULL); END IF;
 IF record_data.ip_hash<>p_ip_hash THEN RETURN jsonb_build_object('user',NULL,'reason','ip_changed'); END IF;
 RETURN jsonb_build_object('user',jsonb_build_object('id',record_data.user_id,'username',record_data.username),'reason',NULL);
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_id_logout(p_token_hash TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.trip_rand_id_sessions WHERE token_hash=p_token_hash;RETURN jsonb_build_object('user',NULL);
END $$;
CREATE OR REPLACE FUNCTION public.trip_rand_app_owner(p_token TEXT) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id UUID; digest TEXT;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid data token'; END IF;
 digest:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 SELECT user_id INTO owner_id FROM public.trip_rand_id_sessions WHERE token_hash=digest AND expires_at>now();
 IF owner_id IS NULL THEN SELECT user_id INTO owner_id FROM public.trip_rand_app_profiles WHERE username IS NULL AND token_hash=digest; END IF;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'invalid data token'; END IF;RETURN owner_id;
END $$;
REVOKE ALL ON FUNCTION public.trip_rand_id_login(TEXT,BOOLEAN,TEXT,TEXT),public.trip_rand_id_session(TEXT,TEXT),public.trip_rand_id_logout(TEXT) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.trip_rand_id_login(TEXT,BOOLEAN,TEXT,TEXT),public.trip_rand_id_session(TEXT,TEXT),public.trip_rand_id_logout(TEXT) TO anon;
COMMIT;
