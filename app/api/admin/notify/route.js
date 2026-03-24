import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/evolution'
import moment from 'moment-timezone'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)

const TIMEZONE = 'America/Sao_Paulo'

// POST: Send a WhatsApp confirmation request with a direct link
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

        // Build the confirmation URL from the request host
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const confirmUrl = `${protocol}://${host}/api/confirm/${apt.id}`

        const dateStr = moment(apt.starts_at).tz(TIMEZONE).format('DD/MM/YYYY')
        const timeStr = moment(apt.starts_at).tz(TIMEZONE).format('HH:mm')
        const dayName = moment(apt.starts_at).tz(TIMEZONE).format('dddd')
        const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1)

        let serviceNames = apt.service_id
        try {
            const arr = JSON.parse(apt.service_id)
            if (Array.isArray(arr)) serviceNames = arr.join(' + ')
        } catch { /* use raw string */ }

        const message =
            `Olá, *${apt.customer_name}*! 💅🌸\n\n` +
            `Temos um agendamento marcado para você no *Espaço C.A.*\n\n` +
            `📋 *Serviço:* ${serviceNames}\n` +
            `📅 *Data:* ${dayCapitalized}, ${dateStr}\n` +
            `⏰ *Horário:* ${timeStr}\n\n` +
            `Para confirmar seu agendamento, clique no link abaixo:\n` +
            `👇 ${confirmUrl}\n\n` +
            `Te esperamos! ✨`

        await sendWhatsAppMessage(apt.customer_phone, message)

        return NextResponse.json({ status: 'sent' })
    } catch (err) {
        console.error('Erro ao enviar notificação:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
