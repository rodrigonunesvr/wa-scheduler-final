import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim()

if (!supabaseUrl) {
    console.error('⚠️ SUPABASE_URL não configurada no navegador!')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
