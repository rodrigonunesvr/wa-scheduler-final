import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)

const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID
const ZAPI_TOKEN = process.env.ZAPI_TOKEN

async function sendWhatsApp(phone, message) {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
    })
    return res.json()
}

// GET /api/cron/confirm — Run daily to send 24h reminders
export async function GET(request) {
    try {
        // Optional: verify cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Find appointments starting in the next 24-28 hours (window to avoid duplicates)
        const now = new Date()
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        const in28h = new Date(now.getTime() + 28 * 60 * 60 * 1000)

        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('status', 'CONFIRMED')
            .gte('starts_at', in24h.toISOString())
            .lte('starts_at', in28h.toISOString())

        if (error) throw error

        const results = []

        for (const apt of appointments || []) {
            // Parse services for display
            let serviceNames = apt.service_id
            try {
                const parsed = JSON.parse(apt.service_id)
                if (Array.isArray(parsed)) serviceNames = parsed.join(' + ')
            } catch { /* keep original */ }

            // Format date/time in São Paulo timezone
            const dateFormatted = new Date(apt.starts_at).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'America/Sao_Paulo'
            })
            const timeFormatted = new Date(apt.starts_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
            })

            const message = `✨ Olá ${apt.customer_name}! Aqui é a Clara do Espaço C.A. 💅\n\n` +
                `Passando para lembrar do seu agendamento:\n\n` +
                `📅 *${dateFormatted}*\n` +
                `🕐 *${timeFormatted}*\n` +
                `💅 *${serviceNames}*\n\n` +
                `Posso confirmar sua presença? Responda:\n` +
                `✅ *SIM* — Confirmado!\n` +
                `❌ *NÃO* — Preciso cancelar\n` +
                `🔄 *REAGENDAR* — Quero mudar o horário\n\n` +
                `Te esperamos! 💜`

            try {
                await sendWhatsApp(apt.customer_phone, message)
                results.push({ phone: apt.customer_phone, name: apt.customer_name, status: 'sent' })
            } catch (e) {
                results.push({ phone: apt.customer_phone, name: apt.customer_name, status: 'error', error: e.message })
            }
        }

        return NextResponse.json({
            message: `Processed ${results.length} reminders`,
            results,
            window: { from: in24h.toISOString(), to: in28h.toISOString() }
        })
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
