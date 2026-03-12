import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const activeOnly = searchParams.get('active_only') === 'true'

        let query = supabase.from('professionals').select('*').order('name', { ascending: true })
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
        const { name, role, color, active } = body

        if (!name) {
            return NextResponse.json({ error: 'O nome do profissional ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio.' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('professionals')
            .insert({ name, role: role || 'Especialista', color: color || 'border-violet-500', active: active ?? true })
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
        const { id, name, role, color, active } = body

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        const updates = {}
        if (name !== undefined) updates.name = name
        if (role !== undefined) updates.role = role
        if (color !== undefined) updates.color = color
        if (active !== undefined) updates.active = active

        const { data, error } = await supabase
            .from('professionals')
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

        const { error } = await supabase.from('professionals').delete().eq('id', id)
        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
