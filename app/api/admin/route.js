import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)

// GET: Fetch appointments for a date range
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const type = searchParams.get('type') // 'appointments' or 'customers'

    try {
        if (type === 'customers') {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true })
            if (error) throw error
            return NextResponse.json(data)
        }

        // Default: appointments
        let query = supabase
            .from('appointments')
            .select('*')
            .order('starts_at', { ascending: true })

        if (startDate) query = query.gte('starts_at', startDate + 'T00:00:00')
        if (endDate) query = query.lte('starts_at', endDate + 'T23:59:59')

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Create new appointment (with overlap check)
export async function POST(request) {
    try {
        const body = await request.json()
        const { customer_name, customer_phone, service_id, starts_at, ends_at } = body

        // Check for overlapping appointments
        const newStart = new Date(starts_at).getTime()
        const newEnd = new Date(ends_at).getTime()
        const dayStart = starts_at.split('T')[0] + 'T00:00:00'
        const dayEnd = starts_at.split('T')[0] + 'T23:59:59'

        const { data: existing } = await supabase
            .from('appointments')
            .select('*')
            .eq('status', 'CONFIRMED')
            .gte('starts_at', dayStart)
            .lte('starts_at', dayEnd)

        if (existing) {
            for (const apt of existing) {
                const aptStart = new Date(apt.starts_at).getTime()
                const aptEnd = new Date(apt.ends_at).getTime()
                if (newStart < aptEnd && newEnd > aptStart) {
                    const time = new Date(apt.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                    return NextResponse.json({
                        error: `Conflito de horário! Já existe agendamento de ${apt.customer_name} às ${time}.`
                    }, { status: 409 })
                }
            }
        }

        const { data, error } = await supabase
            .from('appointments')
            .insert({
                customer_name,
                customer_phone,
                service_id,
                starts_at,
                ends_at,
                status: 'CONFIRMED'
            })
            .select()
            .single()

        if (error) throw error

        // Auto-register customer
        await supabase
            .from('customers')
            .upsert({ phone: customer_phone, name: customer_name }, { onConflict: 'phone' })

        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH: Update appointment (cancel or reschedule)
export async function PATCH(request) {
    try {
        const body = await request.json()
        const { id, status, starts_at, ends_at } = body

        const update = {}
        if (status) update.status = status
        if (starts_at) update.starts_at = starts_at
        if (ends_at) update.ends_at = ends_at

        const { data, error } = await supabase
            .from('appointments')
            .update(update)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
