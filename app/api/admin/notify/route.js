import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppButtons } from '@/lib/evolution'
import moment from 'moment-timezone'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)

const TIMEZONE = 'America/Sao_Paulo'

// POST: Send a WhatsApp confirmation request with a button
export async function POST(request) {
    try {
        const { appointmentId } = await request.json()
        if (!appointmentId) {
            return NextResponse.json({ error: 'appointmentId required' }, { status: 400 })
        }

        const { data: apt, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .single()

        if (error || !apt) {
            return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 })
        }

        const dateStr = moment(apt.starts_at).tz(TIMEZONE).format('DD/MM/YYYY')
        const timeStr = moment(apt.starts_at).tz(TIMEZONE).format('HH:mm')
        const dayName = moment(apt.starts_at).tz(TIMEZONE).format('dddd')

        // Parse service names
        let serviceNames = apt.service_id
        try {
            const arr = JSON.parse(apt.service_id)
            if (Array.isArray(arr)) serviceNames = arr.join(' + ')
        } catch { /* use raw string */ }

        const greeting = `Olá, *${apt.customer_name}*! 💅🌸`
        const body =
            `Temos um agendamento marcado para você no *Espaço C.A.*:\n\n` +
            `📋 *Serviço:* ${serviceNames}\n` +
            `📅 *Data:* ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dateStr}\n` +
            `⏰ *Horário:* ${timeStr}\n\n` +
            `Por favor, confirme sua presença clicando no botão abaixo. ✨`

        await sendWhatsAppButtons(
            apt.customer_phone,
            greeting,
            body,
            [{ id: `confirm_${apt.id}`, label: '✅ Confirmar Agendamento' }]
        )

        return NextResponse.json({ status: 'sent' })
    } catch (err) {
        console.error('Erro ao enviar notificação:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
