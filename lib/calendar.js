import moment from 'moment-timezone';
import { supabase } from './supabase';

const TIMEZONE = 'America/Sao_Paulo';

// Helper: Check Overlap
function checkOverlap(startA, endA, startB, endB) {
    return startA.isBefore(endB) && endA.isAfter(startB);
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

    // Fetch existing appointments and blocks from Supabase
    const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'CONFIRMED')
        .gte('starts_at', startDate.startOf('day').toISOString());
    
    const { data: blocks } = await supabase
        .from('blocks')
        .select('*')
        .gte('starts_at', startDate.startOf('day').toISOString());

    const availableSlots = [];
    const daysToCheck = requestedDate ? 1 : 7; 
    let slotsFound = 0;
    const maxSlots = 5;

    const openHour = 7;
    const closeHour = 18;

    for (let i = 0; i < daysToCheck; i++) {
        if (slotsFound >= maxSlots) break;

        let currentDay = startDate.clone().add(i, 'days');
        const dayOfWeek = currentDay.day();

        // Skip Sunday (0) and Monday (1)
        if (dayOfWeek === 0 || dayOfWeek === 1) continue;

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
    const endsAt = moment(startsAt).add(duration, 'minutes').format();
    const { data, error } = await supabase
        .from('appointments')
        .insert({
            customer_phone: phone,
            customer_name: name,
            service_id: service,
            starts_at: startsAt,
            ends_at: endsAt,
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
