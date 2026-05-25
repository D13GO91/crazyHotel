import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  '';

// Log status on load to help diagnose environment issues in the browser console
console.log('[Supabase Client Initialization]', {
  hasUrl: !!supabaseUrl,
  urlLength: supabaseUrl.length,
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey.length,
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 15) + '...' : 'none'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'ERRO: URL ou Chave do Supabase não encontrada! Verifique seu arquivo .env ou as variáveis de ambiente do seu provedor de hospedagem (Vercel, Netlify, etc.).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

