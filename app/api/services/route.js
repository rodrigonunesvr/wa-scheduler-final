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

        // Validação básica de UUID para evitar erro 500 do Postgres
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        
        if (!isUUID) {
            // Se não é UUID, é item padrão. Precisamos "escondê-lo" no BD.
            // Tentamos inserir um registro com o nome do ID e marcá-lo como oculto/inativo
            // Isso é para lidar com itens "padrão" que não existem no banco mas precisam ser "removidos" da UI
            const { data, error: insertError } = await supabase
                .from('services')
                .insert({ name: id, is_hidden: true, active: false })
                .select();
            
            // Se houver um erro de conflito (item já existe), ignoramos e consideramos sucesso
            // Caso contrário, se for outro erro, lançamos
            if (insertError && insertError.code !== '23505') { // 23505 é código para unique_violation
                throw insertError;
            }
            return NextResponse.json({ success: true, message: 'Item padrão ocultado' })
        }

        // Para itens já no banco, apenas marcamos como ocultos
        const { error } = await supabase.from('services').update({ is_hidden: true }).eq('id', id)
        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
