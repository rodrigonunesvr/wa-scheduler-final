import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, sendWhatsAppButtons } from '@/lib/evolution'
import moment from 'moment-timezone'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)

const TIMEZONE = 'America/Sao_Paulo';

// GET: Fetch appointments, customers, blocks, or stats
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const type = searchParams.get('type')

    try {
        // --- Customers ---
        if (type === 'customers') {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true })
            if (error) throw error
            return NextResponse.json(data)
        }

        // --- Help Requests (Support) ---
        if (type === 'help_requests') {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('help_requested', true)
                .order('help_requested_at', { ascending: false })
            if (error) throw error
            return NextResponse.json(data)
        }

        // --- Blocks ---
        if (type === 'blocks') {
            let query = supabase.from('blocks').select('*').order('starts_at', { ascending: true })
            if (startDate) query = query.gte('starts_at', startDate + 'T00:00:00-03:00')
            if (endDate) query = query.lte('starts_at', endDate + 'T23:59:59-03:00')
            const { data, error } = await query
            if (error) throw error
            return NextResponse.json(data || [])
        }

        // --- Stats (financial report) ---
        if (type === 'stats') {
            const { data: allApts, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('status', 'CONFIRMED')
            if (error) throw error
            return NextResponse.json(allApts || [])
        }

        // --- Schedule overrides ---
        if (type === 'schedule') {
            const { data, error } = await supabase
                .from('schedule_overrides')
                .select('*')
                .order('date', { ascending: true })
            if (error) throw error
            return NextResponse.json(data || [])
        }

        // --- Schedule rules (Special Periods) ---
        if (type === 'rules') {
            const { data, error } = await supabase
                .from('schedule_rules')
                .select('*')
                .order('start_date', { ascending: true })
            if (error) throw error
            return NextResponse.json(data || [])
        }

        // --- Default: appointments (includes all statuses for visual display) ---
        let query = supabase
            .from('appointments')
            .select('*')
            .order('starts_at', { ascending: true })

        if (startDate) query = query.gte('starts_at', startDate + 'T00:00:00-03:00')
        if (endDate) query = query.lte('starts_at', endDate + 'T23:59:59-03:00')

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Create appointment or block
export async function POST(request) {
    try {
        const body = await request.json()

        // --- Create Block ---
        if (body.type === 'block') {
            const { title, starts_at, ends_at } = body

            // Defensivamente tentamos inserir com 'title'. 
            // Se falhar por falta da coluna, tentamos sem ela.
            const insertRecord = { starts_at, ends_at }
            if (title) insertRecord.title = title

            const { data, error } = await supabase
                .from('blocks')
                .insert(insertRecord)
                .select()
                .single()

            if (error) {
                // Se o erro for especificamente falta da coluna 'title', tentamos sem ela
                if (error.message.includes("column \"title\"") || error.message.includes("column of 'blocks'")) {
                    const { data: retryData, error: retryError } = await supabase
                        .from('blocks')
                        .insert({ starts_at, ends_at })
                        .select()
                        .single()
                    if (retryError) throw retryError
                    return NextResponse.json(retryData)
                }
                throw error
            }
            return NextResponse.json(data)
        }

        // --- Create/Update Schedule Override ---
        if (body.type === 'schedule') {
            const { date, is_open, reason } = body
            const { data, error } = await supabase
                .from('schedule_overrides')
                .upsert({ date, is_open, reason: reason || '' }, { onConflict: 'date' })
                .select()
                .single()
            if (error) throw error
            return NextResponse.json(data)
        }

        // --- Create/Update Schedule Rule (Special Period) ---
        if (body.type === 'rule') {
            const { id, start_date, end_date, open_time, close_time, label } = body
            const payload = { start_date, end_date, open_time, close_time, label: label || '' }

            let query;
            if (id) {
                query = supabase.from('schedule_rules').update(payload).eq('id', id)
            } else {
                query = supabase.from('schedule_rules').insert(payload)
            }

            const { data, error } = await query.select().single()
            if (error) throw error
            return NextResponse.json(data)
        }

        // --- Create Appointment (with overlap check) ---
        const { customer_name, customer_phone, service_id, starts_at, ends_at, notes } = body

        const mStart = moment.tz(starts_at, TIMEZONE)
        const mEnd = moment.tz(ends_at, TIMEZONE)
        const dayPrefix = mStart.format('YYYY-MM-DD')
        const dayIsoStart = mStart.clone().startOf('day').toISOString()
        const dayIsoEnd = mStart.clone().endOf('day').toISOString()

        // Check appointment conflicts (Strict Overlap Check)
        const { data: existing } = await supabase
            .from('appointments')
            .select('id, customer_name, starts_at, ends_at')
            .in('status', ['CONFIRMED', 'PENDING'])
            .gte('starts_at', dayIsoStart)
            .lte('starts_at', dayIsoEnd)

        if (existing) {
            for (const apt of existing) {
                const aptStart = moment.tz(apt.starts_at, TIMEZONE)
                const aptEnd = moment.tz(apt.ends_at, TIMEZONE)
                if (mStart.isBefore(aptEnd) && mEnd.isAfter(aptStart)) {
                    const time = aptStart.format('HH:mm')
                    return NextResponse.json({
                        error: `Conflito de horário! Já existe agendamento de ${apt.customer_name} às ${time}.`
                    }, { status: 409 })
                }
            }
        }

        // Check block conflicts
        const { data: existingBlocks } = await supabase
            .from('blocks')
            .select('*')
            .gte('starts_at', dayIsoStart)
            .lte('starts_at', dayIsoEnd)

        if (existingBlocks) {
            for (const block of existingBlocks) {
                const bStart = moment.tz(block.starts_at, TIMEZONE)
                const bEnd = moment.tz(block.ends_at, TIMEZONE)
                if (mStart.isBefore(bEnd) && mEnd.isAfter(bStart)) {
                    return NextResponse.json({
                        error: `Conflito! Esse horário está bloqueado (${block.title || 'Bloqueio'}).`
                    }, { status: 409 })
                }
            }
        }

        const insertData = {
            customer_name,
            customer_phone,
            service_id,
            starts_at,
            ends_at,
            status: 'PENDING'
        }
        if (notes) insertData.notes = notes

        const { data, error } = await supabase
            .from('appointments')
            .insert(insertData)
            .select()
            .single()

        if (error) throw error

        // Auto-register customer
        await supabase
            .from('customers')
            .upsert({ phone: customer_phone, name: customer_name }, { onConflict: 'phone' })

        // --- NOTIFICAÇÃO DE NOVO AGENDAMENTO ---
        try {
            const dateFmt = moment(starts_at).tz(TIMEZONE).format('DD/MM [às] HH:mm');
            const msg = `Olá ${customer_name}! 🌸💅

Seu agendamento está confirmado!\n\n📅 *Data:* ${dateFmt}\n📍 *Local:* Espaço C.A.\n\nTe esperamos com carinho! ✨💓\n\nQualquer dúvida, é só responder aqui. 😊`;
            await sendWhatsAppMessage(customer_phone, msg);
        } catch (msgErr) {
            console.error('Erro ao enviar notificação inicial:', msgErr);
        }

        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH: Update appointment (cancel, reschedule, add notes)
export async function PATCH(request) {
    try {
        const body = await request.json()
        const { id, status, starts_at, ends_at, notes } = body

        // If rescheduling, check for conflicts
        if (starts_at && ends_at) {
            const { data: existing } = await supabase
                .from('appointments')
                .select('id, customer_name, starts_at')
                .neq('id', id)
                .in('status', ['CONFIRMED', 'PENDING'])
                .lt('starts_at', ends_at)
                .gt('ends_at', starts_at)

            if (existing && existing.length > 0) {
                const apt = existing[0]
                const time = new Date(apt.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                return NextResponse.json({
                    error: `Conflito! Esse horário já está ocupado por ${apt.customer_name} (${time}).`
                }, { status: 409 })
            }
        }

        const update = {}
        if (status) update.status = status
        if (starts_at) update.starts_at = starts_at
        if (ends_at) update.ends_at = ends_at
        if (notes !== undefined) update.notes = notes

        // Support for updating customer (name and phone)
        if (body.type === 'customer') {
            const { oldPhone, newName, newPhone } = body

            // 1. Update customer record
            const { error: custError } = await supabase
                .from('customers')
                .update({ name: newName, phone: newPhone })
                .eq('phone', oldPhone)
            if (custError) throw custError

            // 2. Cascade phone change to appointments
            if (oldPhone !== newPhone) {
                const { error: aptUpdateError } = await supabase
                    .from('appointments')
                    .update({ customer_phone: newPhone, customer_name: newName }) // Optional: update name too for consistency
                    .eq('customer_phone', oldPhone)
                if (aptUpdateError) throw aptUpdateError
            }

            return NextResponse.json({ status: 'customer updated' })
        }

        // Support for updating customer (marking help as resolved - legacy)
        const help_requested = body.help_requested
        const customer_id = body.customer_id
        if (customer_id && help_requested !== undefined) {
            const { error: custError } = await supabase
                .from('customers')
                .update({ help_requested: help_requested })
                .eq('id', customer_id)
            if (custError) throw custError
            return NextResponse.json({ status: 'customer updated' })
        }

        const { data, error } = await supabase
            .from('appointments')
            .update(update)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        // --- NOTIFICAÇÃO DE ATUALIZAÇÃO ---
        try {
            if (status === 'CANCELED' || status === 'CANCELLED') {
                const msg = `Olá ${data.customer_name}! 💜\n\nSeu agendamento do dia *${moment(data.starts_at).tz(TIMEZONE).format('DD/MM')}* foi cancelado.\n\nQuando quiser remarcar, a gente já separa um horário especial para você! 🌸💅\n\nBj, Espaço C.A. ✨`;
                await sendWhatsAppMessage(data.customer_phone, msg);
            } else if (starts_at) {
                const dateFmt = moment(starts_at).tz(TIMEZONE).format('DD/MM [às] HH:mm');
                const msg = `Olá ${data.customer_name}! 🌸✨\n\nSeu agendamento foi remarcado!\n\n📅 *Nova data:* ${dateFmt}\n📍 *Local:* Espaço C.A.\n\nTe esperamos lindinha! 💅💖\n\nQualquer dúvida, estamos aqui!`;
                await sendWhatsAppMessage(data.customer_phone, msg);
            }
        } catch (msgErr) {
            console.error('Erro ao enviar notificação de atualização:', msgErr);
        }

        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Remove a block
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        const type = searchParams.get('type')

        if (type === 'block') {
            const { error } = await supabase
                .from('blocks')
                .delete()
                .eq('id', id)
            if (error) throw error
            return NextResponse.json({ status: 'deleted' })
        }

        if (type === 'schedule') {
            const { error } = await supabase
                .from('schedule_overrides')
                .delete()
                .eq('id', id)
            if (error) throw error
            return NextResponse.json({ status: 'deleted' })
        }

        if (type === 'rule') {
            const { error } = await supabase
                .from('schedule_rules')
                .delete()
                .eq('id', id)
            if (error) throw error
            return NextResponse.json({ status: 'deleted' })
        }

        return NextResponse.json({ error: 'Type required' }, { status: 400 })
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
