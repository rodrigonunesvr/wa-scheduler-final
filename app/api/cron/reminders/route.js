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

        // Lógica de Janela Relativa (24h exatas) - v83
        // Busca agendamentos que começam entre 23h:15m e 24h:15m a partir de AGORA
        // Isso cobre a execução de hora em hora com folga para evitar duplicados se o cron atrasar.
        const targetStart = moment().tz(TIMEZONE).add(23, 'hours').add(15, 'minutes').toISOString();
        const targetEnd = moment().tz(TIMEZONE).add(24, 'hours').add(15, 'minutes').toISOString();

        console.log(`Checking reminders window: ${targetStart} to ${targetEnd}`);

        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('*')
            .in('status', ['CONFIRMED', 'PENDING'])
            .is('reminder_sent', null) // v83: Evita reenvio
            .gte('starts_at', targetStart)
            .lte('starts_at', targetEnd);

        if (error) throw error;

        if (!appointments || appointments.length === 0) {
            return NextResponse.json({ status: 'no_appointments', date: tomorrow });
        }

        const stats = { sent: 0, failed: 0 };

        for (const apt of appointments) {
            try {
                const timeStr = moment(apt.starts_at).tz(TIMEZONE).format('HH:mm');
                let message = '';

                if (apt.status === 'PENDING') {
                    message = `Olá ${apt.customer_name}! Passando para confirmar seu agendamento amanhã, dia ${moment(tomorrow).format('DD/MM')}, às ${timeStr}. ✨\n\n*Clique no link abaixo ou responda "Sim" para confirmar:*`;
                    // O bot Clara está treinado para entender "Sim" e confirmar via ferramenta confirm_appointment.
                } else {
                    message = `Olá ${apt.customer_name}! Lembrete do seu agendamento amanhã, dia ${moment(tomorrow).format('DD/MM')}, às ${timeStr}. ✨ Nos vemos em breve!`;
                }

                const result = await sendWhatsAppMessage(apt.customer_phone, message);
                if (result?.error) {
                    stats.failed++;
                } else {
                    stats.sent++;
                    // v83: Marca como enviado para evitar duplicados
                    await supabase.from('appointments').update({ reminder_sent: true }).eq('id', apt.id);
                }
            } catch (sentErr) {
                console.error(`Failed to send reminder to ${apt.customer_phone}:`, sentErr);
                stats.failed++;
            }
        }

        return NextResponse.json({
            status: 'completed',
            date: tomorrow,
            total: appointments.length,
            ...stats
        });

    } catch (err) {
        console.error('Reminder Cron Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
