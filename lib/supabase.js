import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').trim()

if (supabaseUrl) {
    console.log('ðŸ”— Supabase Host:', new URL(supabaseUrl).hostname)
} else {
    console.error('âš ï¸ SUPABASE_URL nÃ£o configurada!')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
