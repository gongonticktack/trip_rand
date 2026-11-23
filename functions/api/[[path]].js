import config from '../../supabase-config.json';
import {handleApi} from '../../backend/api.mjs';
export const onRequest=({request,env})=>handleApi(request,{SUPABASE_URL:config.supabase.url,SUPABASE_ANON_KEY:config.supabase.key,TRIP_RAND_IP_SECRET:env.TRIP_RAND_IP_SECRET},request.headers.get('CF-Connecting-IP')||'unknown');
