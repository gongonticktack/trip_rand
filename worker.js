import config from './supabase-config.json';
import { handleApi } from './backend/api.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, {
        SUPABASE_URL: config.supabase.url,
        SUPABASE_ANON_KEY: config.supabase.key,
        TRIP_RAND_IP_SECRET: env.TRIP_RAND_IP_SECRET,
      }, request.headers.get('CF-Connecting-IP') || 'unknown');
    }
    return env.ASSETS.fetch(request);
  },
};
