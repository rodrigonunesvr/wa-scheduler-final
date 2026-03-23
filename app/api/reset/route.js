import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/reset?phone=5521999999999
 * Clears the bot session context for a specific phone number.
 * Use this whenever you want to reset the bot's conversation state for testing.
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
        return NextResponse.json({ error: 'Provide ?phone=number' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')

    const { error } = await supabase
        .from('wa_sessions')
        .update({ context_json: [], state: 'START' })
        .eq('phone', cleanPhone)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Session cleared for ${cleanPhone}` })
}
