import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Dois clients com storageKey próprio = duas sessões independentes no mesmo
// navegador. Sem isso, o Supabase guarda a sessão sob uma chave única e o
// Painel e o Studio compartilhariam o mesmo login — sair de um derrubava o
// outro. Cada área tem seu próprio login/senha e sessão separada.
const makeClient = (storageKey) =>
  isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { storageKey, persistSession: true, autoRefreshToken: true },
      })
    : null;

// Studio (unidade / reseller)
export const supabase = makeClient('sb-studio-auth');
// Painel de gerenciamento (master)
export const supabaseAdmin = makeClient('sb-admin-auth');
