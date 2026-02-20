const moment = require('moment-timezone');

const TIMEZONE = 'America/Sao_Paulo';

// Helper: Check Overlap
function checkOverlap(startA, endA, startB, endB) {
    return startA.isBefore(endB) && endA.isAfter(startB);
}

// Main Function: Find Available Slots
export async function findAvailableSlots({
    requestedDate, // string 'YYYY-MM-DD' or null
    serviceDuration = 60,
    appointments = [], // Array from DB
    blocks = [] // Array from DB
}) {
    const now = moment().tz(TIMEZONE);
    let startDate = requestedDate ? moment.tz(requestedDate, 'YYYY-MM-DD', TIMEZONE) : now.clone();

    // If requested date is in the past, use today
    if (startDate.isBefore(now, 'day')) {
        startDate = now.clone();
    }

    const availableSlots = [];
    const daysToCheck = requestedDate ? 1 : 7; // If user asked specific date, check only that date. Else check week.
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
            // Round up to next 30 min
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
            for (const apt of appointments) {
                // Assume apt has .starts_at and .ends_at (ISO strings)
                const aptStart = moment(apt.starts_at);
                const aptEnd = moment(apt.ends_at);
                if (checkOverlap(slotStart, slotEnd, aptStart, aptEnd)) {
                    conflict = true;
                    break;
                }
            }

            // 3. Check Blocks
            if (!conflict) {
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
                // To give variety, maybe skip 60 mins? Or 30 mins for density?
                // Let's skip serviceDuration so we don't offer 14:00 AND 14:30 if service is 60m (overlap self).
                // Actually, logic allows 14:00 and 14:30 starts. But for simplicity let's jump 60m.
                timeCursor.add(serviceDuration, 'minutes');
            } else {
                timeCursor.add(30, 'minutes'); // Try next 30 min block
            }
        }
    }

    return availableSlots;
}
