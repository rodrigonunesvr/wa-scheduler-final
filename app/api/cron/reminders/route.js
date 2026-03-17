import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/evolution';
import moment from 'moment-timezone';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Daily Reminder Cron Endpoint
 * This endpoint should be called once a day (e.g., at 19:00) 
 * to remind customers of their appointments for the next day.
 */
export async function GET(request) {
    try {
        // Simple security: check for a secret header
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Lógica de Janela Relativa (24h exatas) - v84
        // Busca agendamentos que começam entre 23h e 26h a partir de AGORA
        // Isso garante que se o cron de 1h falhar, o próximo pegue o agendamento.
        const targetStart = moment().tz(TIMEZONE).add(23, 'hours').toISOString();
        const targetEnd = moment().tz(TIMEZONE).add(26, 'hours').toISOString();

        console.log(`[v84] Checking reminders window: ${targetStart} to ${targetEnd}`);

        // Fetch confirmed appointments for this specific window
        let query = supabase
            .from('appointments')
            .select('*')
            .in('status', ['CONFIRMED', 'PENDING'])
            .gte('starts_at', targetStart)
            .lte('starts_at', targetEnd);

        // Tentamos filtrar pela coluna nova, mas o código não quebra se ela não existir
        try {
            query = query.is('reminder_sent', null);
        } catch (e) {
            console.warn("⚠️ Coluna 'reminder_sent' ausente ou erro no filtro. Ignorando trava de duplicados.");
        }

        const { data: appointments, error } = await query;

        if (error) {
            console.error("❌ Erro ao buscar agendamentos (v84):", error.message);
            // Se for erro de coluna, o usuário precisa rodar o SQL
            if (error.message.includes("reminder_sent")) {
                throw new Error("Atenção: A coluna 'reminder_sent' não existe. Execute o SQL no painel Supabase.");
            }
            throw error;
        }

        if (!appointments || appointments.length === 0) {
            return NextResponse.json({ status: 'no_appointments', window: { targetStart, targetEnd } });
        }

        console.log(`[v84] Found ${appointments.length} appointments in window.`);
        const stats = { sent: 0, failed: 0 };

        for (const apt of appointments) {
            try {
                const timeRelative = moment(apt.starts_at).tz(TIMEZONE);
                const timeStr = timeRelative.format('HH:mm');
                const dateStr = timeRelative.format('DD/MM');

                let message = '';
                if (apt.status === 'PENDING') {
                    message = `Olá ${apt.customer_name}! Passando para confirmar seu agendamento para amanhã, dia ${dateStr}, às ${timeStr}. ✨\n\n*Clique no link abaixo ou responda "Sim" para confirmar:*`;
                } else {
                    message = `Olá ${apt.customer_name}! Lembrete do seu agendamento para amanhã, dia ${dateStr}, às ${timeStr}. ✨ Nos vemos em breve!`;
                }

                console.log(`[v84] Sending message to ${apt.customer_phone} (${apt.customer_name})...`);
                const result = await sendWhatsAppMessage(apt.customer_phone, message);

                if (result?.error) {
                    console.error(`❌ Falha Evolution API (${apt.customer_phone}):`, result.error);
                    stats.failed++;
                } else {
                    stats.sent++;
                    // v84: Marca como enviado para evitar duplicados (se a coluna existir)
                    try {
                        await supabase.from('appointments').update({ reminder_sent: true }).eq('id', apt.id);
                    } catch (skip) { }
                }
            } catch (sentErr) {
                console.error(`❌ Critical error for ${apt.customer_phone}:`, sentErr);
                stats.failed++;
            }
        }

        return NextResponse.json({
            status: 'completed',
            window: { targetStart, targetEnd },
            total: appointments.length,
            ...stats
        });

    } catch (err) {
        console.error('Reminder Cron Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
