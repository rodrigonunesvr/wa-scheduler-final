export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const PROFESSIONALS = [
    { id: 'camille', name: 'Camille Almeida', role: 'Especialista', color: 'border-violet-500', initial: 'C' }
]

export const TIME_SLOTS = []
for (let h = 8; h <= 19; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

export function toSPDate(isoStr) { return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) }
export function toSPTime(isoStr) { return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) }
export function toSPFull(isoStr) { return new Date(isoStr).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }) }
export function toISO_SP(dateStr, timeStr) { return `${dateStr}T${timeStr}:00-03:00` }

export function fmt(date) {
    return new Date(date).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function isToday(date) { return fmt(date) === fmt(new Date()) }

export function parseServices(s, servicesList = []) {
    if (!s) return []
    try {
        const arr = JSON.parse(s);
        const list = Array.isArray(arr) ? arr : [s];
        return list.map(id => servicesList.find(svc => svc.id === id || svc.name === id)?.name || id);
    } catch {
        return [servicesList.find(svc => svc.id === s || svc.name === s)?.name || s];
    }
}

export function calcTotal(selectedSvcs, servicesList = []) {
    return selectedSvcs.reduce((sum, id) => sum + (servicesList.find(s => s.name === id || s.id === id)?.price || 0), 0)
}

export function calcDuration(selectedSvcs, servicesList = []) {
    return selectedSvcs.reduce((sum, id) => sum + (servicesList.find(s => s.name === id || s.id === id)?.duration || 60), 0)
}

export function getWeekDates(base) {
    const d = new Date(base); const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const mon = new Date(d); mon.setDate(diff)
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x })
}

export function getMonthDates(year, month) {
    const first = new Date(year, month, 1)
    const startDay = first.getDay()
    const start = new Date(first); start.setDate(1 - startDay)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
}

export const whatsappLink = (phone, text = '') => {
    const base = `https://wa.me/${phone.replace(/\D/g, '')}`
    return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
