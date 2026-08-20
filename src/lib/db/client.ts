import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/config/env';

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Server-side only — the service key bypasses
 * RLS and must never be shipped to the browser, which the `server-only` import
 * enforces at build time.
 */
export function db(): SupabaseClient {
  if (cached) return cached;
  const { url, serviceRoleKey } = supabaseConfig();
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'layla-lavan-analytics' } },
  });
  return cached;
}
