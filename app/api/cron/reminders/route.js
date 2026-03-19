import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppButtons } from '@/lib/evolution';
import moment from 'moment-timezone';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Window-based Reminder Cron Endpoint
 * This endpoint should be called frequently (e.g., every 30-60 minutes).
 * It sends reminders for appointments starting in ~24 hours.
 */
export async function GET(request) {
    try {
        // Simple security: check for a secret header
        const authHeader = request.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Window: Appointments starting between 23.5 and 24.6 hours from now
        // A ~70 minute window with a 60 minute cron ensures coverage even with slight drift
        const now = moment().tz(TIMEZONE);
        const windowStart = now.clone().add(23, 'hours').add(25, 'minutes').toISOString();
        const windowEnd = now.clone().add(24, 'hours').add(35, 'minutes').toISOString();

        console.log(`Checking reminders for window: ${windowStart} to ${windowEnd}`);

        // Fetch confirmed appointments in the window
        // Note: We use 'PENDING' or 'CONFIRMED' depending on the flow. 
        // For now, let's target 'CONFIRMED' but filter those who haven't received a reminder yet if possible.
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('status', 'CONFIRMED')
            .gte('starts_at', windowStart)
            .lte('starts_at', windowEnd);

        if (error) throw error;

        if (!appointments || appointments.length === 0) {
            return NextResponse.json({ status: 'no_appointments', windowStart, windowEnd });
        }

        const stats = { sent: 0, failed: 0 };

        for (const apt of appointments) {
            try {
                const startTime = moment(apt.starts_at).tz(TIMEZONE);
                const dateStr = startTime.format('DD/MM');
                const timeStr = startTime.format('HH:mm');

                // Format service names (handle JSON if needed)
                let servicesFormatted = apt.service_id;
                try {
                    if (apt.service_id.startsWith('[') || apt.service_id.startsWith('{')) {
                        const parsed = JSON.parse(apt.service_id);
                        servicesFormatted = Array.isArray(parsed) ? parsed.join(', ') : parsed;
                    }
                } catch (e) { /* Not JSON, use as is */ }

                // Construct the highly clear message requested by user
                const title = `Confirmação de Agendamento`;
                const description = `Olá ${apt.customer_name}, por favor, confirme seu atendimento no dia ${dateStr} às ${timeStr}, com o serviço de ${servicesFormatted}.\n\nDeseja confirmar seu agendamento?`;

                const buttons = [
                    { id: `confirm_${apt.id}`, label: 'Sim, Confirmar' },
                    { id: `cancel_${apt.id}`, label: 'Não, Cancelar' }
                ];

                const result = await sendWhatsAppButtons(apt.customer_phone, title, description, buttons);

                if (result?.error) {
                    stats.failed++;
                } else {
                    stats.sent++;
                    // Optional: mark appointment as "reminder_sent" or similar
                }
            } catch (sentErr) {
                console.error(`Failed to send reminder to ${apt.customer_phone}:`, sentErr);
                stats.failed++;
            }
        }

        return NextResponse.json({
            status: 'completed',
            total: appointments.length,
            ...stats
        });

    } catch (err) {
        console.error('Reminder Cron Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
