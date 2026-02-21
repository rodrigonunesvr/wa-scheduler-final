import moment from 'moment-timezone';
import { supabase } from './supabase';

const TIMEZONE = 'America/Sao_Paulo';

// Default closed days: Sunday (0) and Monday (1)
const DEFAULT_CLOSED_DAYS = [0, 1];

// Helper: Check Overlap
function checkOverlap(startA, endA, startB, endB) {
    return startA.isBefore(endB) && endA.isAfter(startB);
}

// Helper: Fetch schedule overrides from Supabase
export async function fetchScheduleOverrides() {
    const { data } = await supabase
        .from('schedule_overrides')
        .select('*');
    return data || [];
}

// Helper: Check if a day is open (considering overrides)
export function isDayOpen(dateStr, overrides) {
    // dateStr = 'YYYY-MM-DD'
    const override = overrides.find(o => o.date === dateStr);
    if (override) return override.is_open;
    // Default: closed on Sunday (0) and Monday (1)
    const dayOfWeek = moment.tz(dateStr, 'YYYY-MM-DD', TIMEZONE).day();
    return !DEFAULT_CLOSED_DAYS.includes(dayOfWeek);
}

// Main Function: Find Available Slots
export async function findAvailableSlots({
    requestedDate, // string 'YYYY-MM-DD' or null
    serviceDuration = 60
}) {
    const now = moment().tz(TIMEZONE);
    let startDate = requestedDate ? moment.tz(requestedDate, 'YYYY-MM-DD', TIMEZONE) : now.clone();

    // If requested date is in the past, use today
    if (startDate.isBefore(now, 'day')) {
        startDate = now.clone();
    }

    // Fetch existing appointments, blocks, and schedule overrides from Supabase
    const [{ data: appointments }, { data: blocks }, scheduleOverrides] = await Promise.all([
        supabase
            .from('appointments')
            .select('*')
            .eq('status', 'CONFIRMED')
            .gte('starts_at', startDate.startOf('day').toISOString()),
        supabase
            .from('blocks')
            .select('*')
            .gte('starts_at', startDate.startOf('day').toISOString()),
        fetchScheduleOverrides()
    ]);

    const availableSlots = [];
    const daysToCheck = requestedDate ? 1 : 7;
    let slotsFound = 0;
    const maxSlots = 5;

    const openHour = 7;
    const closeHour = 18;

    for (let i = 0; i < daysToCheck; i++) {
        if (slotsFound >= maxSlots) break;

        let currentDay = startDate.clone().add(i, 'days');
        const dateStr = currentDay.format('YYYY-MM-DD');

        // Check if this day is open (using overrides)
        if (!isDayOpen(dateStr, scheduleOverrides)) continue;

        // Set cursor
        let timeCursor = currentDay.clone().hour(openHour).minute(0).second(0);

        // If today, ensure we start after NOW + buffer
        if (currentDay.isSame(now, 'day')) {
            let nextSlot = now.clone().add(30, 'minutes');
            const rem = nextSlot.minute() % 30;
            if (rem > 0) nextSlot.add(30 - rem, 'minutes');
            nextSlot.second(0);

            if (timeCursor.isBefore(nextSlot)) {
                timeCursor = nextSlot;
            }
        }

        // Iterate hours
        while (timeCursor.hour() < closeHour) {
            if (slotsFound >= maxSlots) break;

            const slotStart = timeCursor.clone();
            const slotEnd = slotStart.clone().add(serviceDuration, 'minutes');

            // 1. Check Lunch (11:00 - 12:00) strict block
            const lunchStart = slotStart.clone().hour(11).minute(0);
            const lunchEnd = slotStart.clone().hour(12).minute(0);

            if (checkOverlap(slotStart, slotEnd, lunchStart, lunchEnd)) {
                timeCursor.add(30, 'minutes');
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
                timeCursor.add(serviceDuration, 'minutes');
            } else {
                timeCursor.add(30, 'minutes');
            }
        }
    }

    return availableSlots;
}

export async function bookAppointment({
    phone,
    name,
    service,
    startsAt,
    duration = 60
}) {
    // Force parsing in Sao Paulo timezone to avoid offset issues
    const start = moment.tz(startsAt, TIMEZONE);
    const end = start.clone().add(duration, 'minutes');
    const isoStartsAt = start.format(); // Persistent ISO with TZ
    const isoEndsAt = end.format();

    // Check for overlapping appointments
    const { data: existing } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'CONFIRMED')
        .gte('starts_at', start.clone().startOf('day').toISOString())
        .lte('starts_at', start.clone().endOf('day').toISOString());

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
            service_id: service,
            starts_at: isoStartsAt,
            ends_at: isoEndsAt,
            status: 'CONFIRMED'
        })
        .select()
        .single();

    if (error) {
        console.error('Supabase Insert Error:', error);
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
        .eq('status', 'CONFIRMED')
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
        .eq('status', 'CONFIRMED')
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
