import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const activeOnly = searchParams.get('active_only') === 'true'

        let query = supabase.from('services').select('*').order('name', { ascending: true })
        if (activeOnly) {
            query = query.eq('active', true)
        }

        const { data, error } = await query

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { name, price, duration, active } = body

        if (!name || isNaN(price) || isNaN(duration)) {
            return NextResponse.json({ error: 'Campos invÃƒÆ’Ã‚Â¡lidos.' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('services')
            .insert({ name, price: Number(price), duration: Number(duration), active: active ?? true })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(request) {
    try {
        const body = await request.json()
        const { id, name, price, duration, active } = body

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        const updates = {}
        if (name !== undefined) updates.name = name
        if (price !== undefined) updates.price = Number(price)
        if (duration !== undefined) updates.duration = Number(duration)
        if (active !== undefined) updates.active = active

        const { data, error } = await supabase
            .from('services')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        const { error } = await supabase.from('services').delete().eq('id', id)
        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
