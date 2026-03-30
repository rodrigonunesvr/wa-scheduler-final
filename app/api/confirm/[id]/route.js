import { createClient } from '@supabase/supabase-js'
import moment from 'moment-timezone'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)

const TIMEZONE = 'America/Sao_Paulo'

// GET: Client clicks this link in WhatsApp → appointment is confirmed
export async function GET(request, { params }) {
    const { id } = await params

    try {
        // Fetch appointment details
        const { data: apt, error: fetchErr } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchErr || !apt) {
            return new Response(pageHtml('❌ Não encontrado', 'Agendamento não encontrado ou já expirado.', '#ef4444'), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            })
        }

        if (apt.status === 'CONFIRMED') {
            const dateStr = moment(apt.starts_at).tz(TIMEZONE).format('DD/MM/YYYY [às] HH:mm')
            return new Response(pageHtml('✅ Já confirmado!', `Seu agendamento de ${dateStr} já estava confirmado. Te esperamos! 💅`, '#10b981'), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            })
        }

        if (apt.status === 'CANCELLED') {
            return new Response(pageHtml('❌ Cancelado', 'Este agendamento foi cancelado. Entre em contato pelo WhatsApp para remarcar.', '#ef4444'), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            })
        }

        // Confirm the appointment
        const { error: updateErr } = await supabase
            .from('appointments')
            .update({ status: 'CONFIRMED' })
            .eq('id', id)

        if (updateErr) throw updateErr

        const dateStr = moment(apt.starts_at).tz(TIMEZONE).format('dddd, DD/MM/YYYY [às] HH:mm')
        let serviceNames = apt.service_id
        try { const arr = JSON.parse(apt.service_id); if (Array.isArray(arr)) serviceNames = arr.join(' + ') } catch { }

        return new Response(pageHtml(
            '✅ Agendamento Confirmado!',
            `Olá, <strong>${apt.customer_name}</strong>! 🌸<br><br>
            Seu agendamento foi confirmado com sucesso:<br><br>
            💅 <strong>Serviço:</strong> ${serviceNames}<br>
            📅 <strong>Data:</strong> ${dateStr}<br><br>
            Te esperamos no <strong>Espaço C.A.</strong>! ✨<br>
            Qualquer dúvida, nos chame no WhatsApp. 😊`,
            '#10b981'
        ), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
    } catch (err) {
        return new Response(pageHtml('❌ Erro', 'Ocorreu um erro ao confirmar. Tente novamente ou contate-nos.', '#ef4444'), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
    }
}

function pageHtml(title, message, color) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Espaço C.A.</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f8f5ff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: white; border-radius: 24px; padding: 40px 32px; max-width: 420px; width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,.08); text-align: center; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 800; color: ${color}; margin-bottom: 16px; }
    .msg { font-size: 15px; color: #444; line-height: 1.7; }
    .logo { margin-top: 32px; font-size: 13px; color: #aaa; font-weight: 600; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${color === '#10b981' ? '💅' : '😕'}</div>
    <h1>${title}</h1>
    <p class="msg">${message}</p>
    <p class="logo">ESPAÇO C.A.</p>
  </div>
</body>
</html>`
}
