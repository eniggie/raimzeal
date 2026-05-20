import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const isValidUrl = (s: string | undefined): s is string =>
  typeof s === 'string' && (s.startsWith('https://') || s.startsWith('http://'));

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
  console.warn(
    '[RAIMZEAL] Supabase is misconfigured.\n' +
    '  VITE_SUPABASE_URL must be a valid project URL like https://xxxx.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY must be the anon public key (not the service role key).\n' +
    '  Current URL prefix: ' + (supabaseUrl?.substring(0, 12) ?? 'EMPTY') + '\n' +
    '  Auth will be disabled until the correct credentials are provided.'
  );
}

export const supabaseConfigured = isValidUrl(supabaseUrl) && !!supabaseAnonKey;

export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
    },
  }
);
