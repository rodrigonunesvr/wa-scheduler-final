import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage, sendWhatsAppButtons } from '@/lib/evolution';
import moment from 'moment-timezone';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Daily Reminder Cron Endpoint
 * This endpoint should be called once a day (e.g., at 19:00) 
 * to remind customers of their appointments for the next day.
 */
export async function GET(request) {
    try {
        // Robust Security: allow Vercel's internal cron header OR the secret bearer token
        const cronHeader = request.headers.get('x-vercel-cron');
        const authHeader = request.headers.get('authorization');
        const isVercelCron = cronHeader === '1';
        const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`;

        if (process.env.CRON_SECRET && !isVercelCron && !isAuthorized) {
            console.warn('Unauthorized cron attempt blocked.');
            return new Response('Unauthorized', { status: 401 });
        }

        // --- FIX V87: Janela de 24h Exata ---
        const now = moment().tz(TIMEZONE);
        // Janela ampliada para 70 minutos de margem
        const targetStart = now.clone().add(23, 'hours').add(20, 'minutes').toISOString();
        const targetEnd = now.clone().add(24, 'hours').add(30, 'minutes').toISOString();

        console.log(`[V87-DIAG] Radar agora (${now.format('HH:mm')}): ${targetStart} -> ${targetEnd}`);

        // DIAGNÓSTICO: Buscar todos de amanhã para avisar no log se eles existem mas estão fora da janela de 24h
        const startOfTomorrow = now.clone().add(1, 'day').startOf('day').toISOString();
        const endOfTomorrow = now.clone().add(1, 'day').endOf('day').toISOString();
        const { data: allTomorrow } = await supabase
            .from('appointments')
            .select('customer_name, starts_at, status')
            .in('status', ['CONFIRMED', 'PENDING'])
            .gte('starts_at', startOfTomorrow)
            .lte('starts_at', endOfTomorrow);

        if (allTomorrow && allTomorrow.length > 0) {
            console.log(`[V87-DIAG] Existem ${allTomorrow.length} agendamentos amanhã, mas o sistema só vai enviar os que estiverem na janela de 24h agora.`);
            allTomorrow.forEach(a => {
                const h = moment(a.starts_at).tz(TIMEZONE).format('HH:mm');
                console.log(` - Agendado: ${a.customer_name} às ${h} (Status: ${a.status})`);
            });
        }

        // Busca Real (Apenas na Janela de 24h)
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('*')
            .in('status', ['CONFIRMED', 'PENDING'])
            .or('reminder_sent.is.null,reminder_sent.eq.false')
            .gte('starts_at', targetStart)
            .lte('starts_at', targetEnd);

        if (error) {
            console.error("❌ Erro Crítico no Banco (V87-FIX):", error.message);
            throw error;
        }

        if (!appointments || appointments.length === 0) {
            return NextResponse.json({ status: 'no_appointments', window: { targetStart, targetEnd } });
        }

        console.log(`[V87-FIX] Encontrados ${appointments.length} agendamentos na janela.`);
        const stats = { sent: 0, failed: 0 };

        for (const apt of appointments) {
            try {
                const startTime = moment(apt.starts_at).tz(TIMEZONE);
                const dateStr = startTime.format('DD/MM');
                const timeStr = startTime.format('HH:mm');

                // Formatação de serviços (v87 costuma vir como string ou JSON)
                let servicesFormatted = apt.service_id;
                try {
                    if (apt.service_id.startsWith('[') || apt.service_id.startsWith('{')) {
                        const parsed = JSON.parse(apt.service_id);
                        servicesFormatted = Array.isArray(parsed) ? parsed.join(', ') : parsed;
                    }
                } catch (e) { }

                // Template solicitado pelo usuário
                const title = `Lembrete de Agendamento 💅`;
                const description = `Olá ${apt.customer_name}! 🌸\n\nPassando para lembrar do seu atendimento amanhã:\n\n📅 *Data:* ${dateStr} às ${timeStr}\n💅 *Serviço:* ${servicesFormatted}\n📍 *Local:* Espaço C.A.\n\nTe esperamos lindinha! ✨💖\n\nDeseja confirmar sua presença?`;

                const buttons = [
                    { id: `confirm_${apt.id}`, label: 'Sim, Confirmar' },
                    { id: `cancel_${apt.id}`, label: 'Não, Cancelar' }
                ];

                console.log(`[V87-FIX] Enviando botões para ${apt.customer_phone}...`);
                const result = await sendWhatsAppButtons(apt.customer_phone, title, description, buttons);

                if (result?.error) {
                    console.error(`❌ Falha Evolution API (${apt.customer_phone}):`, result.error);
                    stats.failed++;
                } else {
                    stats.sent++;
                    // Marca como enviado para evitar duplicados
                    try {
                        await supabase.from('appointments').update({ reminder_sent: true }).eq('id', apt.id);
                    } catch (skip) { }
                }
            } catch (sentErr) {
                console.error(`❌ Erro no processamento de ${apt.customer_phone}:`, sentErr);
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
