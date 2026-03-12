import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').trim()

export const supabase = createClient(supabaseUrl, supabaseKey)
