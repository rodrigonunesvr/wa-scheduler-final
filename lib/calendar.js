import moment from 'moment-timezone';
import { supabase } from './supabase';

const TIMEZONE = 'America/Sao_Paulo';

// Default closed days: Sunday (0) and Monday (1)
const DEFAULT_CLOSED_DAYS = [0, 1];

// ─── Helpers ───────────────────────────────────────────────

// Helper to remove accents and lowercase for comparison
export function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export async function calculateTotalDuration(services) {
    if (!Array.isArray(services)) services = [services];

    // V91+FIX: Não filtrar por 'active' (inconsistente no banco). Usar apenas is_hidden.
    const { data: dbServices } = await supabase.from('services').select('*').eq('is_hidden', false);
    const serviceMap = {};
    if (dbServices) {
        dbServices.forEach(s => serviceMap[normalizeString(s.name)] = s.duration || s.duration_minutes || 60);
    }

    return services.reduce((total, s) => {
        const normS = normalizeString(s);
        // Direct Match
        if (serviceMap[normS]) return total + serviceMap[normS];

        // Best Partial Match
        let bestMatchDur = 0;
        for (const [name, dur] of Object.entries(serviceMap)) {
            // Se o nome do banco está contido na string da IA (ex: "Premium" em "Esmaltação Premium")
            // OU se a string da IA está contida no nome do banco (ex: "Gel" em "Unha de Gel")
            if (normS.includes(name) || name.includes(normS)) {
                if (name.length > (bestMatchDur > 0 ? 3 : 0)) { // Prioriza dar match em nomes mais longos/específicos
                    bestMatchDur = dur;
                    break;
                }
            }
        }

        if (bestMatchDur > 0) return total + bestMatchDur;
        return total + 60; // Default fallback para serviços desconhecidos
    }, 0);
}

export async function calculateTotalPrice(services) {
    if (!Array.isArray(services)) services = [services];

    // V91+FIX: Não filtrar por 'active' (inconsistente no banco). Usar apenas is_hidden.
    const { data: dbServices } = await supabase.from('services').select('*').eq('is_hidden', false);
    const serviceMap = {};
    if (dbServices) {
        dbServices.forEach(s => serviceMap[normalizeString(s.name)] = s.price);
    }

    return services.reduce((total, s) => {
        const normS = normalizeString(s);
        // Direct Match
        if (serviceMap[normS]) return total + serviceMap[normS];

        // Best Partial Match
        let bestMatchPrice = 0;
        for (const [name, price] of Object.entries(serviceMap)) {
            if (normS.includes(name) || name.includes(normS)) {
                bestMatchPrice = price;
                break;
            }
        }

        return total + bestMatchPrice;
    }, 0);
}

function checkOverlap(startA, endA, startB, endB) {
    // Para ser sobreposição, o início de um deve ser ANTES do fim do outro
    // E o fim de um deve ser DEPOIS do início do outro.
    // Se startA === endB ou endA === startB, NÃO há sobreposição (são colados).
    return startA.isBefore(endB) && endA.isAfter(startB);
}

export async function fetchScheduleOverrides() {
    try {
        const { data, error } = await supabase.from('schedule_overrides').select('*');
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Erro ao buscar exceções de horários:", e);
        return [];
    }
}

export async function fetchScheduleRules() {
    try {
        const { data, error } = await supabase.from('schedule_rules').select('*');
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Erro ao buscar regras de horários:", e);
        return [];
    }
}

export function isDayOpen(dateStr, overrides, rules = []) {
    const override = (overrides || []).find(o => o.date === dateStr);
    if (override) return override.is_open;

    const rule = (rules || []).find(r => dateStr >= r.start_date && dateStr <= r.end_date);
    if (rule) return true;

    const dayOfWeek = moment.tz(dateStr, 'YYYY-MM-DD', TIMEZONE).day();
    return !DEFAULT_CLOSED_DAYS.includes(dayOfWeek);
}

export function getOpenHours(dateStr, scheduleRules) {
    let openHour = 7, openMin = 0;
    let closeHour = 19, closeMin = 30;

    const rule = (scheduleRules || []).find(r => dateStr >= r.start_date && dateStr <= r.end_date);
    if (rule) {
        const [oh, om] = rule.open_time.split(':').map(Number);
        const [ch, cm] = rule.close_time.split(':').map(Number);
        openHour = oh; openMin = om;
        closeHour = ch; closeMin = cm;
    }
    return { openHour, openMin, closeHour, closeMin };
}

export function isTimeValid(start, end, scheduleRules) {
    const dateStr = start.format('YYYY-MM-DD');
    const { openHour, openMin, closeHour, closeMin } = getOpenHours(dateStr, scheduleRules);

    const openTime = start.clone().hour(openHour).minute(openMin).second(0);
    const closeTime = start.clone().hour(closeHour).minute(closeMin).second(0);

    // Valida se o agendamento cabe dentro do horário de abertura
    if (start.isBefore(openTime) || end.isAfter(closeTime)) return false;

    // Intervalo de almoço removido (agora deve ser controlado via bloqueios no banco)

    return true;
}

// ─── Main Functions ────────────────────────────────────────

export async function findAvailableSlots({
    requestedDate,
    serviceDuration = 60,
    services = null,
    period = null
}) {
    let realDuration = serviceDuration;
    if (services) {
        realDuration = await calculateTotalDuration(services);
    }

    const now = moment().tz(TIMEZONE);
    let startDate = requestedDate ? moment.tz(requestedDate, 'YYYY-MM-DD', TIMEZONE) : now.clone();

    if (startDate.isBefore(now, 'day')) {
        startDate = now.clone();
    }

    const [scheduleOverrides, scheduleRules] = await Promise.all([
        fetchScheduleOverrides(),
        fetchScheduleRules()
    ]);

    const availableSlots = [];
    const daysToCheck = requestedDate ? 1 : 14;
    let slotsFound = 0;
    const maxSlots = 40;

    for (let i = 0; i < daysToCheck; i++) {
        if (slotsFound >= maxSlots) break;

        let currentDay = startDate.clone().add(i, 'days');
        const dateStr = currentDay.format('YYYY-MM-DD');

        if (!isDayOpen(dateStr, scheduleOverrides, scheduleRules)) continue;

        // FETCH DATA PER DAY (v83: Forced UTC comparisons)
        const dayIsoStart = currentDay.clone().startOf('day').toISOString();
        const dayIsoEnd = currentDay.clone().endOf('day').toISOString();

        const [{ data: appointments }, { data: blocks }] = await Promise.all([
            supabase
                .from('appointments')
                .select('*')
                .in('status', ['CONFIRMED', 'PENDING'])
                .gte('starts_at', dayIsoStart)
                .lte('starts_at', dayIsoEnd),
            supabase
                .from('blocks')
                .select('*')
                .gte('starts_at', dayIsoStart)
                .lte('starts_at', dayIsoEnd)
        ]);

        const { openHour, openMin, closeHour, closeMin } = getOpenHours(dateStr, scheduleRules);
        const closeTime = currentDay.clone().hour(closeHour).minute(closeMin).second(0);
        let timeCursor = currentDay.clone().hour(openHour).minute(openMin).second(0);

        if (currentDay.isSame(now, 'day')) {
            let nextSlot = now.clone().add(15, 'minutes');
            const rem = nextSlot.minute() % 5;
            if (rem > 0) nextSlot.add(5 - rem, 'minutes');
            nextSlot.second(0);
            if (timeCursor.isBefore(nextSlot)) timeCursor = nextSlot;
        }

        while (timeCursor.isBefore(closeTime)) {
            if (slotsFound >= maxSlots) break;
            const slotStart = timeCursor.clone();
            const slotEnd = slotStart.clone().add(realDuration, 'minutes');

            if (period === 'manha' && slotStart.hour() >= 12) {
                timeCursor.add(5, 'minutes');
                continue;
            }
            if (period === 'tarde' && slotStart.hour() < 12) {
                timeCursor.add(5, 'minutes');
                continue;
            }

            if (!isTimeValid(slotStart, slotEnd, scheduleRules)) {
                timeCursor.add(5, 'minutes');
                continue;
            }

            let conflict = false;
            if (appointments) {
                for (const apt of appointments) {
                    const aptStart = moment.tz(apt.starts_at, TIMEZONE);
                    const aptEnd = moment.tz(apt.ends_at, TIMEZONE);
                    if (checkOverlap(slotStart, slotEnd, aptStart, aptEnd)) {
                        console.log(`⚠️ CONFLITO AGENDAMENTO: Slot ${slotStart.format('HH:mm')} bloqueado por ${apt.customer_name} (${aptStart.format('HH:mm')}-${aptEnd.format('HH:mm')}) status=${apt.status}`);
                        conflict = true;
                        break;
                    }
                }
            }
            if (!conflict && blocks && blocks.length > 0) {
                for (const block of blocks) {
                    const bStart = moment.tz(block.starts_at, TIMEZONE);
                    const bEnd = moment.tz(block.ends_at, TIMEZONE);
                    if (checkOverlap(slotStart, slotEnd, bStart, bEnd)) {
                        console.log(`🛑 CONFLITO BLOCO: Slot ${slotStart.format('HH:mm')} bloqueado por bloqueio (${bStart.format('HH:mm')}-${bEnd.format('HH:mm')})`);
                        conflict = true;
                        break;
                    }
                }
            }

            if (!conflict) {
                availableSlots.push({
                    start: slotStart.toISOString(),
                    label: slotStart.format('DD/MM (ddd) HH:mm'),
                    date: slotStart.format('YYYY-MM-DD'),
                    time: slotStart.format('HH:mm')
                });
                slotsFound++;
            }
            timeCursor.add(5, 'minutes');
        }
    }
    return availableSlots;
}

export async function bookAppointment({
    phone,
    name,
    service,
    services,
    startsAt
}) {
    const serviceList = services || (Array.isArray(service) ? service : [service]);

    // Validation
    // V91+FIX: Não filtrar por 'active' (inconsistente no banco). Usar apenas is_hidden.
    const { data: activeDB } = await supabase.from('services').select('name').eq('is_hidden', false);
    const activeNames = (activeDB || []).map(s => normalizeString(s.name));
    const displayNames = (activeDB || []).map(s => s.name).join(', ');

    for (const s of serviceList) {
        const normS = normalizeString(s);
        const found = activeNames.some(name => normS.includes(name));
        if (!found) {
            return { error: true, message: `O serviço "${s}" não está disponível. Opções: ${displayNames}.` };
        }
    }

    const finalDuration = await calculateTotalDuration(serviceList);
    const serviceStr = Array.isArray(serviceList) && serviceList.length > 1 ? JSON.stringify(serviceList) : serviceList[0];

    // Parse the start time: respect UTC offset if present (Z), then convert to BRT
    // Using moment(startsAt) first parses any ISO string correctly (UTC-aware),
    // then .tz(TIMEZONE) converts it to São Paulo for validation and display.
    const start = moment(startsAt).tz(TIMEZONE);
    const end = start.clone().add(finalDuration, 'minutes');

    console.log(`[bookAppointment] Input startsAt: ${startsAt} → BRT: ${start.format('YYYY-MM-DD HH:mm')} → UTC: ${start.toISOString()}`);

    const [scheduleOverrides, scheduleRules] = await Promise.all([
        fetchScheduleOverrides(),
        fetchScheduleRules()
    ]);

    if (!isDayOpen(start.format('YYYY-MM-DD'), scheduleOverrides, scheduleRules)) {
        console.warn(`[bookAppointment] ❌ Dia fechado: ${start.format('YYYY-MM-DD')}`);
        return { error: true, message: "Este dia está fechado." };
    }

    if (!isTimeValid(start, end, scheduleRules)) {
        console.warn(`[bookAppointment] ❌ Horário inválido ou fora do expediente: ${start.format('HH:mm')} - ${end.format('HH:mm')}`);
        return { error: true, message: "Horário inválido (fechado ou almoço)." };
    }

    const { data: existing } = await supabase
        .from('appointments')
        .select('*')
        .in('status', ['CONFIRMED', 'PENDING'])
        .gte('starts_at', start.clone().startOf('day').toISOString())
        .lte('starts_at', start.clone().endOf('day').toISOString());

    if (existing) {
        for (const apt of existing) {
            const aptStart = moment.tz(apt.starts_at, TIMEZONE);
            const aptEnd = moment.tz(apt.ends_at, TIMEZONE);
            if (checkOverlap(start, end, aptStart, aptEnd)) {
                return { error: true, message: `Horário ocupado por ${apt.customer_name}.` };
            }
        }
    }

    const { data, error } = await supabase
        .from('appointments')
        .insert({
            customer_phone: phone,
            customer_name: name,
            service_id: serviceStr,
            starts_at: start.toISOString(), // v83: Standard UTC ISO
            ends_at: end.toISOString(),     // v83: Standard UTC ISO
            status: 'PENDING'
        })
        .select()
        .single();

    if (error) throw error;
    const totalPrice = await calculateTotalPrice(serviceList);
    return { ...data, total_price: totalPrice };
}

export async function updateAppointment({ id, services }) {
    const { data: apt, error: fetchError } = await supabase.from('appointments').select('*').eq('id', id).single();
    if (fetchError || !apt) return { error: true, message: 'Agendamento não encontrado.' };

    const serviceList = Array.isArray(services) ? services : [services];
    const finalDuration = await calculateTotalDuration(serviceList);
    const serviceStr = serviceList.length > 1 ? JSON.stringify(serviceList) : serviceList[0];
    const newEnd = moment.tz(apt.starts_at, TIMEZONE).add(finalDuration, 'minutes').format();

    const { data, error } = await supabase
        .from('appointments')
        .update({ service_id: serviceStr, ends_at: newEnd })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    const totalPrice = await calculateTotalPrice(serviceList);
    return { ...data, total_price: totalPrice };
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
    if (error) throw error;
    return data || [];
}

export async function cancelAppointment(phone, date) {
    const mDate = moment.tz(date, 'YYYY-MM-DD', TIMEZONE);
    const { data: appointments, error: findError } = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_phone', phone)
        .in('status', ['CONFIRMED', 'PENDING'])
        .gte('starts_at', mDate.clone().startOf('day').toISOString())
        .lte('starts_at', mDate.clone().endOf('day').toISOString());

    if (findError || !appointments || appointments.length === 0) return { status: 'not_found' };

    const { data, error } = await supabase.from('appointments').update({ status: 'CANCELLED' }).eq('id', appointments[0].id).select().single();
    if (error) throw error;
    return data;
}

export async function confirmAppointment(phone, date) {
    const mDate = moment.tz(date, 'YYYY-MM-DD', TIMEZONE);
    const { data: appointments, error: findError } = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_phone', phone)
        .eq('status', 'PENDING')
        .gte('starts_at', mDate.clone().startOf('day').toISOString())
        .lte('starts_at', mDate.clone().endOf('day').toISOString());

    if (findError || !appointments || appointments.length === 0) return { status: 'not_found' };

    const { data, error } = await supabase.from('appointments').update({ status: 'CONFIRMED' }).eq('id', appointments[0].id).select().single();
    if (error) throw error;
    return { status: 'success', data };
}
