import { createClient } from '@supabase/supabase-js'

// No servidor, priorizamos a SERVICE_ROLE_KEY para garantir que o bot tenha permissões de admin (bypass RLS)
// No cliente (navegador), as variáveis NEXT_PUBLIC_ serão usadas.
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim()

if (supabaseUrl) {
    console.log('🔗 Supabase Host:', new URL(supabaseUrl).hostname)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('🛡️ Usando SERVICE_ROLE_KEY (Modo Admin Ativo)')
    }
} else {
    console.error('⚠️ SUPABASE_URL não configurada!')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
