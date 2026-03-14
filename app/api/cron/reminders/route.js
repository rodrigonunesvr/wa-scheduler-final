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

        // Get tomorrow's date range in Brazil timezone
        const tomorrow = moment().tz(TIMEZONE).add(1, 'day').format('YYYY-MM-DD');
        const dayStart = moment.tz(tomorrow, 'YYYY-MM-DD', TIMEZONE).startOf('day').toISOString();
        const dayEnd = moment.tz(tomorrow, 'YYYY-MM-DD', TIMEZONE).endOf('day').toISOString();

        console.log(`Checking reminders for tomorrow: ${tomorrow} (${dayStart} to ${dayEnd})`);

        // Fetch confirmed appointments for tomorrow
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('*')
            .in('status', ['CONFIRMED', 'PENDING'])
            .gte('starts_at', dayStart)
            .lte('starts_at', dayEnd);

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
