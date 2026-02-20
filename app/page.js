'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Plus, X, ChevronLeft, ChevronRight, User, Phone, Briefcase, CheckCircle2, XCircle, RefreshCw, LayoutGrid, List, Home, Users, Scissors } from 'lucide-react'

const SERVICES = [
    { id: 'Fibra ou Molde F1', name: 'Fibra ou Molde F1', price: 190, duration: 120 },
    { id: 'Banho de Gel', name: 'Banho de Gel', price: 150, duration: 90 },
    { id: 'Manutenção', name: 'Manutenção', price: 150, duration: 90 },
    { id: 'Manutenção (outra prof.)', name: 'Manutenção (outra prof.)', price: 170, duration: 90 },
    { id: 'Remoção', name: 'Remoção', price: 45, duration: 30 },
    { id: 'Esmaltação Básica', name: 'Esmaltação Básica', price: 20, duration: 30 },
    { id: 'Esmaltação Premium', name: 'Esmaltação Premium', price: 25, duration: 45 },
    { id: 'Esm. ou Pó + Francesinha', name: 'Esm. ou Pó + Francesinha', price: 35, duration: 45 },
    { id: 'Esm. + Francesinha + Pó', name: 'Esm. + Francesinha + Pó', price: 45, duration: 60 },
]

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const TIME_SLOTS = []
for (let h = 7; h <= 19; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

function getWeekDates(baseDate) {
    const d = new Date(baseDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d)
    monday.setDate(diff)
    const week = []
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        week.push(date)
    }
    return week
}

function fmt(date) { return date.toISOString().split('T')[0] }

function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function isToday(date) { return fmt(date) === fmt(new Date()) }

function parseServices(serviceStr) {
    if (!serviceStr) return []
    try { return JSON.parse(serviceStr) } catch { return [serviceStr] }
}

function calcTotal(services) {
    return services.reduce((sum, sId) => {
        const svc = SERVICES.find(s => s.id === sId)
        return sum + (svc?.price || 0)
    }, 0)
}

function calcDuration(services) {
    return services.reduce((sum, sId) => {
        const svc = SERVICES.find(s => s.id === sId)
        return sum + (svc?.duration || 60)
    }, 0)
}

// ─── Main Component ───────────────────────────────────────
export default function AdminDashboard() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(fmt(new Date()))
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [showNewModal, setShowNewModal] = useState(false)
    const [viewMode, setViewMode] = useState('week') // 'week' or 'day'
    const [refreshKey, setRefreshKey] = useState(0)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [activePage, setActivePage] = useState('agenda')

    const weekDates = getWeekDates(currentDate)
    const weekStart = fmt(weekDates[0])
    const weekEnd = fmt(weekDates[6])

    const fetchAppointments = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin?start=${weekStart}&end=${weekEnd}`)
            const data = await res.json()
            setAppointments(Array.isArray(data) ? data : [])
        } catch (e) { console.error(e) }
        setLoading(false)
    }, [weekStart, weekEnd])

    useEffect(() => { fetchAppointments() }, [fetchAppointments, refreshKey])

    const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d) }
    const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d) }
    const prevDay = () => { const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setSelectedDate(fmt(d)) }
    const nextDay = () => { const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setSelectedDate(fmt(d)) }
    const goToday = () => { setCurrentDate(new Date()); setSelectedDate(fmt(new Date())) }

    const cancelAppointment = async (id) => {
        if (!confirm('Cancelar este agendamento?')) return
        await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'CANCELLED' }) })
        setRefreshKey(k => k + 1)
    }

    const confirmed = appointments.filter(a => a.status === 'CONFIRMED')
    const dayApts = confirmed.filter(a => a.starts_at?.startsWith(selectedDate)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    const getCount = (d) => confirmed.filter(a => a.starts_at?.startsWith(d)).length

    const dayRevenue = dayApts.reduce((sum, apt) => sum + calcTotal(parseServices(apt.service_id)), 0)

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-gradient-to-b from-violet-700 to-purple-900 text-white transition-all duration-300 flex flex-col shrink-0`}>
                <div className="p-4 flex items-center gap-3 border-b border-white/10">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-white/10 transition">
                        <LayoutGrid size={20} />
                    </button>
                    {sidebarOpen && <span className="font-extrabold text-lg tracking-tight">Espaço C.A.</span>}
                </div>
                <nav className="flex-1 py-3 space-y-0.5 px-2">
                    {[
                        { id: 'agenda', icon: Calendar, label: 'Agenda' },
                        { id: 'clientes', icon: Users, label: 'Clientes' },
                        { id: 'servicos', icon: Scissors, label: 'Serviços' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActivePage(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activePage === item.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <item.icon size={18} />
                            {sidebarOpen && item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-3 border-t border-white/10">
                    <div className="flex items-center gap-2 text-xs font-medium text-white/50">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                        </span>
                        {sidebarOpen && 'Bot Ativo'}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {/* Top Bar */}
                <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {/* View toggle */}
                        <div className="flex bg-slate-100 rounded-xl p-0.5">
                            <button onClick={() => setViewMode('day')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>
                                Dia
                            </button>
                            <button onClick={() => setViewMode('week')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>
                                Semana
                            </button>
                        </div>

                        <button onClick={viewMode === 'week' ? prevWeek : prevDay} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><ChevronLeft size={18} /></button>
                        <button onClick={goToday} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition">HOJE</button>
                        <button onClick={viewMode === 'week' ? nextWeek : nextDay} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><ChevronRight size={18} /></button>

                        <span className="text-sm font-bold text-slate-700 ml-2">
                            {viewMode === 'week'
                                ? `${weekDates[0].getDate()} de ${MONTH_NAMES[weekDates[0].getMonth()]}`
                                : new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                            }
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" title="Atualizar">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setShowNewModal(true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 shadow-lg shadow-violet-200 transition active:scale-95"
                        >
                            <Plus size={14} /> Novo
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-4">
                    {viewMode === 'week' ? (
                        <WeekView
                            weekDates={weekDates}
                            selectedDate={selectedDate}
                            setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }}
                            getCount={getCount}
                            appointments={confirmed}
                        />
                    ) : (
                        <DayView
                            selectedDate={selectedDate}
                            appointments={dayApts}
                            onCancel={cancelAppointment}
                            dayRevenue={dayRevenue}
                        />
                    )}
                </div>
            </main>

            {showNewModal && (
                <NewAppointmentModal
                    selectedDate={selectedDate}
                    onClose={() => setShowNewModal(false)}
                    onSave={() => { setShowNewModal(false); setRefreshKey(k => k + 1) }}
                />
            )}
        </div>
    )
}

// ─── Week View ─────────────────────────────────────────────
function WeekView({ weekDates, selectedDate, setSelectedDate, getCount, appointments }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header row */}
            <div className="grid grid-cols-7 border-b border-slate-100">
                {weekDates.map((date, i) => {
                    const dateStr = fmt(date)
                    const todayDate = isToday(date)
                    const isClosed = date.getDay() === 0 || date.getDay() === 1
                    const count = getCount(dateStr)
                    return (
                        <button
                            key={i}
                            onClick={() => !isClosed && setSelectedDate(dateStr)}
                            disabled={isClosed}
                            className={`py-4 text-center border-r border-slate-100 last:border-r-0 transition-all ${isClosed ? 'bg-slate-50 opacity-40 cursor-not-allowed' : 'hover:bg-violet-50 cursor-pointer'
                                }`}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{DAY_NAMES_SHORT[date.getDay()]}</p>
                            <p className={`text-2xl font-black mb-1 ${todayDate ? 'text-violet-600' : 'text-slate-700'}`}>{date.getDate()}</p>
                            <p className={`text-[10px] font-bold ${todayDate ? 'text-violet-500' : 'text-slate-400'}`}>{MONTH_NAMES[date.getMonth()]}</p>
                            {count > 0 && (
                                <span className="inline-block mt-2 bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {count} agend.
                                </span>
                            )}
                            {isClosed && <span className="block text-[10px] text-slate-400 mt-1">Fechado</span>}
                        </button>
                    )
                })}
            </div>

            {/* Time grid preview */}
            <div className="grid grid-cols-7">
                {weekDates.map((date, dayIdx) => {
                    const dateStr = fmt(date)
                    const isClosed = date.getDay() === 0 || date.getDay() === 1
                    const dayApts = appointments.filter(a => a.starts_at?.startsWith(dateStr))

                    return (
                        <div key={dayIdx} className={`border-r border-slate-100 last:border-r-0 min-h-[200px] p-1.5 ${isClosed ? 'bg-slate-50/50' : ''}`}>
                            {dayApts.slice(0, 5).map(apt => {
                                const svcs = parseServices(apt.service_id)
                                return (
                                    <div
                                        key={apt.id}
                                        onClick={() => setSelectedDate(dateStr)}
                                        className="mb-1 px-2 py-1.5 bg-violet-100 border-l-3 border-violet-500 rounded-lg cursor-pointer hover:bg-violet-200 transition-colors"
                                        style={{ borderLeftWidth: '3px' }}
                                    >
                                        <p className="text-[10px] font-bold text-violet-700">{fmtTime(apt.starts_at)}</p>
                                        <p className="text-[10px] font-semibold text-slate-700 truncate">{apt.customer_name}</p>
                                        <p className="text-[9px] text-slate-500 truncate">{svcs.join(', ')}</p>
                                    </div>
                                )
                            })}
                            {dayApts.length > 5 && (
                                <p className="text-[9px] text-center text-slate-400 font-medium">+{dayApts.length - 5} mais</p>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Day View (Time Grid) ─────────────────────────────────
function DayView({ selectedDate, appointments, onCancel, dayRevenue }) {
    const getAptAtSlot = (slot) => {
        return appointments.filter(apt => {
            const aptTime = fmtTime(apt.starts_at)
            return aptTime === slot
        })
    }

    const isAptOccupying = (slot, apt) => {
        const startMin = timeToMin(fmtTime(apt.starts_at))
        const svcs = parseServices(apt.service_id)
        const dur = calcDuration(svcs)
        const slotMin = timeToMin(slot)
        return slotMin >= startMin && slotMin < startMin + dur
    }

    return (
        <div className="flex gap-4">
            {/* Time Grid */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                        <Clock className="text-violet-500" size={18} />
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <span className="text-xs font-bold text-slate-400">{appointments.length} agendamento{appointments.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="relative">
                    {TIME_SLOTS.map((slot, idx) => {
                        const aptsAtSlot = getAptAtSlot(slot)
                        const isHour = slot.endsWith(':00')

                        return (
                            <div key={idx} className={`flex items-stretch min-h-[44px] ${isHour ? 'border-t border-slate-150' : 'border-t border-slate-50'}`}>
                                {/* Time label */}
                                <div className="w-16 shrink-0 flex items-start justify-end pr-3 pt-1">
                                    {isHour && <span className="text-[11px] font-bold text-slate-400">{slot}</span>}
                                </div>

                                {/* Content area */}
                                <div className="flex-1 relative border-l border-slate-100 px-2 py-0.5">
                                    {aptsAtSlot.map(apt => {
                                        const svcs = parseServices(apt.service_id)
                                        const dur = calcDuration(svcs)
                                        const blocks = Math.max(1, Math.round(dur / 30))
                                        const total = calcTotal(svcs)

                                        return (
                                            <div
                                                key={apt.id}
                                                className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl px-3 py-2 shadow-md hover:shadow-lg transition-shadow group relative"
                                                style={{ minHeight: `${blocks * 44 - 8}px` }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="font-bold text-sm">{apt.customer_name}</p>
                                                        <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                                                            <Phone size={10} /> {apt.customer_phone}
                                                        </p>
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {svcs.map((s, i) => (
                                                                <span key={i} className="bg-white/20 text-[10px] font-semibold px-2 py-0.5 rounded-full">{s}</span>
                                                            ))}
                                                        </div>
                                                        <p className="text-white/70 text-[10px] mt-1">{fmtTime(apt.starts_at)} — {dur}min • R$ {total}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => onCancel(apt.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white/20 hover:bg-red-500 transition-all"
                                                        title="Cancelar"
                                                    >
                                                        <XCircle size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Side Panel - Stats */}
            <div className="w-64 shrink-0 space-y-3">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Agendamentos</p>
                    <p className="text-4xl font-black text-violet-600">{appointments.length}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Faturamento</p>
                    <p className="text-2xl font-black text-green-600">R$ {dayRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Próximos</p>
                    <div className="space-y-2">
                        {appointments.slice(0, 4).map(apt => (
                            <div key={apt.id} className="flex items-center gap-2">
                                <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-1 rounded-lg">{fmtTime(apt.starts_at)}</span>
                                <span className="text-xs font-medium text-slate-700 truncate">{apt.customer_name}</span>
                            </div>
                        ))}
                        {appointments.length === 0 && <p className="text-xs text-slate-400">Nenhum agendamento</p>}
                    </div>
                </div>
            </div>
        </div>
    )
}

function timeToMin(timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + m
}

// ─── New Appointment Modal (Multi-Service) ─────────────────
function NewAppointmentModal({ selectedDate, onClose, onSave }) {
    const [form, setForm] = useState({
        customer_name: '',
        customer_phone: '',
        services: [],
        date: selectedDate,
        time: '09:00'
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const toggleService = (id) => {
        setForm(prev => ({
            ...prev,
            services: prev.services.includes(id)
                ? prev.services.filter(s => s !== id)
                : [...prev.services, id]
        }))
    }

    const totalPrice = calcTotal(form.services)
    const totalDuration = calcDuration(form.services)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (form.services.length === 0) { setError('Selecione ao menos um serviço.'); return }
        setSaving(true)
        setError('')

        const startsAt = `${form.date}T${form.time}:00`
        const endDate = new Date(new Date(startsAt).getTime() + totalDuration * 60000)
        const endsAt = endDate.toISOString()

        try {
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: form.customer_name,
                    customer_phone: form.customer_phone,
                    service_id: JSON.stringify(form.services),
                    starts_at: startsAt,
                    ends_at: endsAt
                })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            onSave()
        } catch (e) {
            setError(e.message)
        }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-purple-700 text-white">
                    <h3 className="text-base font-extrabold">Novo Agendamento</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition"><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-auto">
                    {/* Name & Phone */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Nome</label>
                            <input
                                type="text" required value={form.customer_name}
                                onChange={e => setForm({ ...form, customer_name: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium"
                                placeholder="Maria Silva"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Telefone</label>
                            <input
                                type="text" required value={form.customer_phone}
                                onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium"
                                placeholder="5511999999999"
                            />
                        </div>
                    </div>

                    {/* Services (Multi-Select) */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Serviços (selecione um ou mais)</label>
                        <div className="space-y-1.5">
                            {SERVICES.map(s => {
                                const selected = form.services.includes(s.id)
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => toggleService(s.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm ${selected
                                                ? 'border-violet-500 bg-violet-50 text-violet-900'
                                                : 'border-slate-150 hover:border-violet-200 text-slate-700'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
                                                }`}>
                                                {selected && <CheckCircle2 size={12} className="text-white" />}
                                            </div>
                                            <span className="font-semibold">{s.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-violet-600">R$ {s.price}</span>
                                            <span className="text-slate-400 text-xs ml-2">{s.duration}min</span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Totals */}
                    {form.services.length > 0 && (
                        <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-violet-600">{form.services.length} serviço{form.services.length > 1 ? 's' : ''}</span>
                                <span className="text-xs text-violet-400 ml-2">• {totalDuration}min</span>
                            </div>
                            <span className="text-lg font-black text-violet-700">R$ {totalPrice}</span>
                        </div>
                    )}

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Data</label>
                            <input
                                type="date" required value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Horário</label>
                            <input
                                type="time" required value={form.time}
                                onChange={e => setForm({ ...form, time: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>
                    )}

                    <button
                        type="submit" disabled={saving}
                        className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 transition-all shadow-lg shadow-violet-200 active:scale-[0.99]"
                    >
                        {saving ? 'Salvando...' : `Confirmar — R$ ${totalPrice}`}
                    </button>
                </form>
            </div>
        </div>
    )
}
