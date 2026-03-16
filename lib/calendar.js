import moment from 'moment-timezone';
import { supabase } from './supabase';

const TIMEZONE = 'America/Sao_Paulo';

// Default closed days: Sunday (0) and Monday (1)
const DEFAULT_CLOSED_DAYS = [0, 1];

export async function calculateTotalDuration(services) {
    if (!Array.isArray(services)) services = [services];

    const { data: dbServices } = await supabase.from('services').select('*').eq('is_hidden', false);
    const serviceDurations = {};
    if (dbServices) {
        dbServices.forEach(s => serviceDurations[s.name] = s.duration);
    }

    return services.reduce((total, s) => {
        if (serviceDurations[s]) return total + serviceDurations[s];

        for (const [name, dur] of Object.entries(serviceDurations)) {
            if (s.toLowerCase().includes(name.toLowerCase())) return total + dur;
        }

        return total + 60; // Default fallback
    }, 0);
}

// Helper: Check Overlap
function checkOverlap(startA, endA, startB, endB) {
    return startA.isBefore(endB) && endA.isAfter(startB);
}

// Helper: Fetch schedule overrides from Supabase
export async function fetchScheduleOverrides() {
    try {
        const { data, error } = await supabase
            .from('schedule_overrides')
            .select('*');
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Erro ao buscar exceções de horários:", e);
        return [];
    }
}

// Helper: Fetch schedule rules (Periods) from Supabase
export async function fetchScheduleRules() {
    try {
        const { data, error } = await supabase
            .from('schedule_rules')
            .select('*');
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Erro ao buscar regras de horários:", e);
        return [];
    }
}

// Helper: Check if a day is open (considering overrides and special rules)
export function isDayOpen(dateStr, overrides, rules = []) {
    // dateStr = 'YYYY-MM-DD'
    const override = (overrides || []).find(o => o.date === dateStr);
    if (override) return override.is_open;

    // Special rules override default closed days
    const rule = (rules || []).find(r => dateStr >= r.start_date && dateStr <= r.end_date);
    if (rule) return true;

    // Default: closed on Sunday (0) and Monday (1)
    const dayOfWeek = moment.tz(dateStr, 'YYYY-MM-DD', TIMEZONE).day();
    return !DEFAULT_CLOSED_DAYS.includes(dayOfWeek);
}

// Helper: Get open hours for a specific date
export function getOpenHours(dateStr, scheduleRules) {
    let openHour = 7, openMin = 0;
    let closeHour = 18, closeMin = 0;

    const rule = (scheduleRules || []).find(r => dateStr >= r.start_date && dateStr <= r.end_date);
    if (rule) {
        const [oh, om] = rule.open_time.split(':').map(Number);
        const [ch, cm] = rule.close_time.split(':').map(Number);
        openHour = oh; openMin = om;
        closeHour = ch; closeMin = cm;
    }
    return { openHour, openMin, closeHour, closeMin };
}

// Helper: Check if a specific period (start to end) is valid within open hours and lunch
export function isTimeValid(start, end, scheduleRules) {
    const dateStr = start.format('YYYY-MM-DD');
    const { openHour, openMin, closeHour, closeMin } = getOpenHours(dateStr, scheduleRules);

    const openTime = start.clone().hour(openHour).minute(openMin).second(0);
    const closeTime = start.clone().hour(closeHour).minute(closeMin).second(0);

    // 1. Check bounds
    if (start.isBefore(openTime) || end.isAfter(closeTime)) return false;

    // 2. Check Lunch (11:00 - 12:00)
    const lunchStart = start.clone().hour(11).minute(0).second(0);
    const lunchEnd = start.clone().hour(12).minute(0).second(0);
    if (checkOverlap(start, end, lunchStart, lunchEnd)) return false;

    return true;
}

// Main Function: Find Available Slots
export async function findAvailableSlots({
    requestedDate, // string 'YYYY-MM-DD' or null
    serviceDuration = 60,
    period = null // 'manha' or 'tarde'
}) {
    const now = moment().tz(TIMEZONE);
    let startDate = requestedDate ? moment.tz(requestedDate, 'YYYY-MM-DD', TIMEZONE) : now.clone();

    // If requested date is in the past, use today
    if (startDate.isBefore(now, 'day')) {
        startDate = now.clone();
    }

    // Fetch existing appointments, blocks, schedule overrides, and rules from Supabase
    const [{ data: appointments }, { data: blocks }, scheduleOverrides, scheduleRules] = await Promise.all([
        supabase
            .from('appointments')
            .select('*')
            .in('status', ['CONFIRMED', 'PENDING'])
            .gte('starts_at', startDate.clone().startOf('day').toISOString())
            .lte('starts_at', startDate.clone().endOf('day').toISOString()),
        supabase
            .from('blocks')
            .select('*')
            .gte('starts_at', startDate.clone().startOf('day').toISOString())
            .lte('starts_at', startDate.clone().endOf('day').toISOString()),
        fetchScheduleOverrides(),
        fetchScheduleRules()
    ]);

    const availableSlots = [];
    const daysToCheck = requestedDate ? 1 : 14; // Aumentado para 14 dias para dar mais opções por turno
    let slotsFound = 0;
    const maxSlots = 40; // Aumentado para cobrir mais opções com granularidade de 5min

    for (let i = 0; i < daysToCheck; i++) {
        if (slotsFound >= maxSlots) break;

        let currentDay = startDate.clone().add(i, 'days');
        const dateStr = currentDay.format('YYYY-MM-DD');

        // Check if this day is open (using overrides and special rules)
        if (!isDayOpen(dateStr, scheduleOverrides, scheduleRules)) continue;

        // Check for Special Rule (Period)
        const { openHour, openMin, closeHour, closeMin } = getOpenHours(dateStr, scheduleRules);
        const closeTime = currentDay.clone().hour(closeHour).minute(closeMin).second(0);

        // Set cursor
        let timeCursor = currentDay.clone().hour(openHour).minute(openMin).second(0);

        // If today, ensure we start after NOW + buffer
        if (currentDay.isSame(now, 'day')) {
            let nextSlot = now.clone().add(15, 'minutes'); // Buffer de 15 min
            const rem = nextSlot.minute() % 5;
            if (rem > 0) nextSlot.add(5 - rem, 'minutes');
            nextSlot.second(0);

            if (timeCursor.isBefore(nextSlot)) {
                timeCursor = nextSlot;
            }
        }

        // Iterate hours
        while (timeCursor.isBefore(closeTime)) {
            if (slotsFound >= maxSlots) break;

            const slotStart = timeCursor.clone();
            const slotEnd = slotStart.clone().add(serviceDuration, 'minutes');

            // 1.5 Check Period Filter (Manhã: < 12:00, Tarde: >= 12:00)
            if (period === 'manha' && slotStart.hour() >= 12) {
                timeCursor.add(5, 'minutes');
                continue;
            }
            if (period === 'tarde' && slotStart.hour() < 12) {
                timeCursor.add(5, 'minutes');
                continue;
            }

            // Ensure slot is valid (within open hours and outside lunch)
            if (!isTimeValid(slotStart, slotEnd, scheduleRules)) {
                timeCursor.add(5, 'minutes');
                continue;
            }

            // 2. Check Appointments
            let conflict = false;
            if (appointments) {
                for (const apt of appointments) {
                    const aptStart = moment(apt.starts_at);
                    const aptEnd = moment(apt.ends_at);
                    if (checkOverlap(slotStart, slotEnd, aptStart, aptEnd)) {
                        conflict = true;
                        break;
                    }
                }
            }

            // 3. Check Blocks
            if (!conflict && blocks) {
                for (const block of blocks) {
                    const blockStart = moment(block.starts_at);
                    const blockEnd = moment(block.ends_at);
                    if (checkOverlap(slotStart, slotEnd, blockStart, blockEnd)) {
                        conflict = true;
                        break;
                    }
                }
            }

            // Add if free
            if (!conflict) {
                availableSlots.push({
                    start: slotStart.format(), // ISO
                    label: slotStart.format('DD/MM (ddd) HH:mm'), // Readable
                    date: slotStart.format('YYYY-MM-DD'),
                    time: slotStart.format('HH:mm')
                });
                slotsFound++;
            }
            // Passo de 5 minutos para máxima precisão e aproveitamento da agenda
            timeCursor.add(5, 'minutes');
        }
    }

    return availableSlots;
}

export async function bookAppointment({
    phone,
    name,
    service,
    services, // Can pass array or single string
    startsAt,
    duration // Optional override
}) {
    const serviceList = services || (Array.isArray(service) ? service : [service]);
    const finalDuration = duration || await calculateTotalDuration(serviceList);
    const serviceStr = Array.isArray(serviceList) && serviceList.length > 1 ? JSON.stringify(serviceList) : serviceList[0];

    // Force parsing in Sao Paulo timezone to avoid offset issues
    const start = moment.tz(startsAt, TIMEZONE);
    const end = start.clone().add(finalDuration, 'minutes');
    const isoStartsAt = start.format(); // Persistent ISO with TZ
    const isoEndsAt = end.format();

    // 1. Check Overrides and Rules for Opening
    const dateStr = start.format('YYYY-MM-DD');
    const [scheduleOverrides, scheduleRules] = await Promise.all([
        fetchScheduleOverrides(),
        fetchScheduleRules()
    ]);

    if (!isDayOpen(dateStr, scheduleOverrides, scheduleRules)) {
        return { error: true, message: "Este dia está fechado para atendimentos." };
    }

    if (!isTimeValid(start, end, scheduleRules)) {
        const { openHour, openMin, closeHour, closeMin } = getOpenHours(dateStr, scheduleRules);
        return {
            error: true,
            message: `Este horário está fora do expediente (${openHour}:${openMin.toString().padStart(2, '0')} - ${closeHour}:${closeMin.toString().padStart(2, '0')}) ou coincide com o horário de almoço (11:00 - 12:00).`
        };
    }

    // 2. Check for overlapping appointments (confirmed or pending)
    const { data: existing } = await supabase
        .from('appointments')
        .select('*')
        .in('status', ['CONFIRMED', 'PENDING'])
        .gte('starts_at', start.toISOString())
        .lte('starts_at', end.toISOString());

    if (existing) {
        for (const apt of existing) {
            const aptStart = moment(apt.starts_at);
            const aptEnd = moment(apt.ends_at);
            if (checkOverlap(start, end, aptStart, aptEnd)) {
                const timeStr = aptStart.tz(TIMEZONE).format('HH:mm');
                return {
                    error: true,
                    message: `Esse horário já está ocupado (${timeStr} - ${apt.customer_name}). Por favor, escolha outro horário.`
                };
            }
        }
    }

    const { data, error } = await supabase
        .from('appointments')
        .insert({
            customer_phone: phone,
            customer_name: name,
            service_id: serviceStr,
            starts_at: isoStartsAt,
            ends_at: isoEndsAt,
            status: 'PENDING'
        })
        .select()
        .single();

    if (error) {
        console.error('Supabase Insert Error:', error);
        throw error;
    }
    return data;
}

// Function to update an existing appointment (useful for adding services)
export async function updateAppointment({
    id,
    service,
    services, // Can pass array or single string
    duration // Optional override
}) {
    const { data: apt, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !apt) {
        return { error: true, message: 'Agendamento não encontrado.' };
    }

    const serviceList = services || (Array.isArray(service) ? service : [service]);
    const finalDuration = duration || await calculateTotalDuration(serviceList);
    const serviceStr = Array.isArray(serviceList) && serviceList.length > 1 ? JSON.stringify(serviceList) : serviceList[0];

    // Ensure we add to the start time correctly using the timezone
    const newEnd = moment.tz(apt.starts_at, TIMEZONE).add(finalDuration, 'minutes').format();

    const { data, error } = await supabase
        .from('appointments')
        .update({
            service_id: serviceStr,
            ends_at: newEnd
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Supabase Update Error:', error);
        throw error;
    }
    return data;
}

export async function getAppointmentsByPhone(phone) {
    const now = moment().tz(TIMEZONE).toISOString();
    const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_phone', phone)
        .in('status', ['CONFIRMED', 'PENDING'])
        .gte('starts_at', now)
        .order('starts_at', { ascending: true });

    if (error) {
        console.error('Supabase Select Error:', error);
        throw error;
    }
    return data || [];
}

export async function cancelAppointment(phone, date) {
    // Find the appointment by phone and date using exact Brazil day boundaries
    const mDate = moment.tz(date, 'YYYY-MM-DD', TIMEZONE);
    const dayStart = mDate.clone().startOf('day').toISOString();
    const dayEnd = mDate.clone().endOf('day').toISOString();

    const { data: appointments, error: findError } = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_phone', phone)
        .in('status', ['CONFIRMED', 'PENDING'])
        .gte('starts_at', dayStart)
        .lte('starts_at', dayEnd);

    if (findError) {
        console.error('Supabase Find Error:', findError);
        throw findError;
    }

    if (!appointments || appointments.length === 0) {
        return { status: 'not_found', message: 'Nenhum agendamento encontrado nessa data.' };
    }

    // Cancel the first matching appointment
    const apt = appointments[0];
    const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'CANCELLED' })
        .eq('id', apt.id)
        .select()
        .single();

    if (error) {
        console.error('Supabase Cancel Error:', error);
        throw error;
    }
    return data;
}

export async function confirmAppointment(phone, date) {
    const mDate = moment.tz(date, 'YYYY-MM-DD', TIMEZONE);
    const dayStart = mDate.clone().startOf('day').toISOString();
    const dayEnd = mDate.clone().endOf('day').toISOString();

    const { data: appointments, error: findError } = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_phone', phone)
        .eq('status', 'PENDING')
        .gte('starts_at', dayStart)
        .lte('starts_at', dayEnd);

    if (findError || !appointments || appointments.length === 0) {
        return { status: 'not_found', message: 'Nenhum agendamento pendente encontrado nessa data.' };
    }

    const { data, error } = await supabase
        .from('appointments')
        .update({ status: 'CONFIRMED' })
        .eq('id', appointments[0].id)
        .select()
        .single();

    if (error) {
        console.error('Supabase Confirm Error:', error);
        throw error;
    }
    return { status: 'success', data };
}
