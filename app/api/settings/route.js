import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        let { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()

        if (error && error.code === 'PGRST116') {
            const { data: newData, error: insertError } = await supabase
                .from('settings')
                .insert({
                    id: 1,
                    business_name: 'AgendaÍ',
                    niche: 'salon',
                    primary_color: '#8b5cf6'
                })
                .select()
                .single()

            if (insertError) throw insertError
            data = newData
            error = null
        } else if (error) {
            throw error
        }

        return NextResponse.json(data || {})
    } catch (error) {
        console.error('Settings GET error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(request) {
    try {
        const body = await request.json()
        const { business_name, niche, primary_color, logo_url, welcome_message } = body

        const updateData = { updated_at: new Date().toISOString() }
        if (business_name !== undefined) updateData.business_name = business_name
        if (niche !== undefined) updateData.niche = niche
        if (primary_color !== undefined) updateData.primary_color = primary_color
        if (logo_url !== undefined) updateData.logo_url = logo_url
        if (welcome_message !== undefined) updateData.welcome_message = welcome_message

        const { data, error } = await supabase
            .from('settings')
            .update(updateData)
            .eq('id', 1)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        console.error('Settings PATCH error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
