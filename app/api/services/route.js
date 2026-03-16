import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const activeOnly = searchParams.get('active_only') === 'true'

        let query = supabase.from('services').select('*').eq('is_hidden', false).order('name', { ascending: true })
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
            return NextResponse.json({ error: 'Campos inválidos.' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('services')
            .insert({
                name,
                price: Number(price),
                duration: Number(duration),
                active: body.active ?? true,
                is_hidden: body.is_hidden ?? false
            })
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
        if (body.name !== undefined) updates.name = body.name
        if (body.price !== undefined) updates.price = Number(body.price)
        if (body.duration !== undefined) updates.duration = Number(body.duration)
        if (body.active !== undefined) updates.active = body.active
        if (body.is_hidden !== undefined) updates.is_hidden = body.is_hidden

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

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        if (isUUID) {
            const { data: svc } = await supabase.from('services').select('name').eq('id', id).single();
            const protectedNames = [
                'Fibra ou Molde F1', 'Banho de Gel', 'Manutenção',
                'Manutenção (outra prof.)', 'Remoção', 'Esmaltação Básica',
                'Esmaltação Premium', 'Esm. ou Pó + Francesinha', 'Esm. + Francesinha + Pó'
            ];

            if (svc && protectedNames.includes(svc.name)) {
                await supabase.from('services').update({ is_hidden: true, active: false }).eq('id', id);
                return NextResponse.json({ success: true, message: 'Item padrão modificado ocultado' })
            } else {
                const { error } = await supabase.from('services').delete().eq('id', id)
                if (error) throw error
                return NextResponse.json({ success: true, message: 'Item personalizado deletado' })
            }
        } else {
            const { error } = await supabase.from('services').insert({ name: id, is_hidden: true, active: false });
            if (error && error.code !== '23505') throw error;
            return NextResponse.json({ success: true, message: 'Item padrão puro ocultado' })
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
