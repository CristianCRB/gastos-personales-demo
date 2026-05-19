import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, getPublicClient, checkSupabaseConnection as checkConnection } from '@/config/supabase.js';
import { env } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';

export { getAdminClient, getPublicClient };
export const checkSupabaseConnection = checkConnection;

let untypedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (untypedClient) return untypedClient;

  // Use service_role key for all backend operations (bypasses RLS).
  // This is safe because this is a backend-only app — there's no
  // client-side code that uses this client.
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  if (!env.SUPABASE_URL || !key) {
    logger.warn('Supabase not configured — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return null;
  }

  untypedClient = createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });

  return untypedClient;
}

export function isSupabaseAvailable(): boolean {
  return !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY;
}
