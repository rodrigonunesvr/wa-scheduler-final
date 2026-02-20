'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Plus, X, ChevronLeft, ChevronRight, User, Phone, Briefcase, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

const SERVICES = [
    { id: 'Fibra ou Molde F1', name: 'Fibra ou Molde F1', price: 190, duration: 120 },
    { id: 'Banho de Gel', name: 'Banho de Gel', price: 150, duration: 90 },
    { id: 'Manutenção', name: 'Manutenção', price: 150, duration: 90 },
    { id: 'Manutenção (outra prof.)', name: 'Manutenção (outra prof.)', price: 170, duration: 90 },
    { id: 'Remoção', name: 'Remoção', price: 45, duration: 30 },
    { id: 'Esmaltação Básica', name: 'Esmaltação Básica', price: 20, duration: 30 },
    { id: 'Esmaltação Premium', name: 'Esmaltação Premium', price: 25, duration: 45 },
    { id: 'Esmaltação ou Pó + Francesinha', name: 'Esm. ou Pó + Francesinha', price: 35, duration: 45 },
    { id: 'Esmaltação + Francesinha + Pó', name: 'Esm. + Francesinha + Pó', price: 45, duration: 60 },
]

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function getWeekDates(baseDate) {
    const d = new Date(baseDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
    const monday = new Date(d.setDate(diff))
    const week = []
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        week.push(date)
    }
    return week
}

function formatDate(date) {
    return date.toISOString().split('T')[0]
}

function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function isToday(date) {
    const today = new Date()
    return formatDate(date) === formatDate(today)
}

export default function AdminDashboard() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [showNewModal, setShowNewModal] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)

    const weekDates = getWeekDates(currentDate)
    const weekStart = formatDate(weekDates[0])
    const weekEnd = formatDate(weekDates[6])

    const fetchAppointments = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin?start=${weekStart}&end=${weekEnd}`)
            const data = await res.json()
            setAppointments(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error('Fetch error:', e)
        }
        setLoading(false)
    }, [weekStart, weekEnd])

    useEffect(() => {
        fetchAppointments()
    }, [fetchAppointments, refreshKey])

    const prevWeek = () => {
        const d = new Date(currentDate)
        d.setDate(d.getDate() - 7)
        setCurrentDate(d)
    }
    const nextWeek = () => {
        const d = new Date(currentDate)
        d.setDate(d.getDate() + 7)
        setCurrentDate(d)
    }
    const goToday = () => {
        setCurrentDate(new Date())
        setSelectedDate(formatDate(new Date()))
    }

    const cancelAppointment = async (id) => {
        if (!confirm('Tem certeza que deseja cancelar?')) return
        try {
            await fetch('/api/admin', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: 'CANCELLED' })
            })
            setRefreshKey(k => k + 1)
        } catch (e) {
            alert('Erro ao cancelar: ' + e.message)
        }
    }

    const dayAppointments = appointments
        .filter(a => a.starts_at?.startsWith(selectedDate) && a.status === 'CONFIRMED')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

    const getCountForDay = (dateStr) => {
        return appointments.filter(a => a.starts_at?.startsWith(dateStr) && a.status === 'CONFIRMED').length
    }

    // Revenue for selected day
    const dayRevenue = dayAppointments.reduce((sum, apt) => {
        const service = SERVICES.find(s => s.id === apt.service_id)
        return sum + (service?.price || 0)
    }, 0)

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans antialiased">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Espaço C.A.</h1>
                        <p className="text-sm text-slate-500 font-medium">Painel Administrativo</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setRefreshKey(k => k + 1)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Atualizar"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-xs font-bold border border-green-100">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                            Bot Ativo
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Week Navigation */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button onClick={prevWeek} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={goToday} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-sm transition-all active:scale-95">
                            Hoje
                        </button>
                        <button onClick={nextWeek} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    <h2 className="text-lg font-bold text-slate-700">
                        {MONTH_NAMES[weekDates[0].getMonth()]} {weekDates[0].getFullYear()}
                    </h2>
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        <Plus size={16} /> Novo Agendamento
                    </button>
                </div>

                {/* Week Calendar */}
                <div className="grid grid-cols-7 gap-2 mb-6">
                    {weekDates.map((date, i) => {
                        const dateStr = formatDate(date)
                        const isSelected = dateStr === selectedDate
                        const isTodayDate = isToday(date)
                        const count = getCountForDay(dateStr)
                        const isClosed = date.getDay() === 0 || date.getDay() === 1

                        return (
                            <button
                                key={i}
                                onClick={() => !isClosed && setSelectedDate(dateStr)}
                                disabled={isClosed}
                                className={`relative p-3 rounded-2xl border-2 transition-all text-center ${isClosed
                                        ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                            : isTodayDate
                                                ? 'bg-white border-indigo-300 hover:border-indigo-400'
                                                : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md'
                                    }`}
                            >
                                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    {DAY_NAMES[date.getDay()]}
                                </p>
                                <p className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                    {date.getDate()}
                                </p>
                                {count > 0 && (
                                    <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'
                                        }`}>
                                        {count} {count === 1 ? 'agend.' : 'agend.'}
                                    </span>
                                )}
                                {isClosed && (
                                    <span className="text-xs text-slate-400 font-medium block mt-1">Fechado</span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Agendamentos</p>
                        <p className="text-3xl font-black text-indigo-600">{dayAppointments.length}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Próximo</p>
                        <p className="text-xl font-bold text-slate-800">
                            {dayAppointments[0] ? formatTime(dayAppointments[0].starts_at) : '--:--'}
                        </p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Faturamento Estimado</p>
                        <p className="text-xl font-bold text-green-600">R$ {dayRevenue.toFixed(2)}</p>
                    </div>
                </div>

                {/* Day Appointments */}
                <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-extrabold text-lg flex items-center gap-2">
                            <Clock className="text-indigo-500" size={20} />
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h3>
                    </div>

                    <div className="p-6">
                        {dayAppointments.length === 0 ? (
                            <div className="text-center py-16">
                                <Calendar className="text-slate-300 mx-auto mb-3" size={40} />
                                <p className="text-slate-500 font-medium">Nenhum agendamento para este dia.</p>
                                <button
                                    onClick={() => setShowNewModal(true)}
                                    className="mt-4 text-indigo-600 font-bold text-sm hover:underline"
                                >
                                    + Criar agendamento manual
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {dayAppointments.map((apt) => (
                                    <div key={apt.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-indigo-600 text-white w-14 h-14 rounded-xl flex items-center justify-center shadow-md">
                                                <span className="text-base font-black leading-none">{formatTime(apt.starts_at)}</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 flex items-center gap-2">
                                                    <User size={14} className="text-indigo-400" />
                                                    {apt.customer_name}
                                                </p>
                                                <div className="flex gap-3 mt-0.5">
                                                    <span className="text-sm text-slate-500 flex items-center gap-1">
                                                        <Briefcase size={12} className="text-slate-400" /> {apt.service_id}
                                                    </span>
                                                    <span className="text-sm text-slate-400 flex items-center gap-1">
                                                        <Phone size={12} /> {apt.customer_phone}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                                                <CheckCircle2 size={12} className="inline mr-1" />Confirmado
                                            </span>
                                            <button
                                                onClick={() => cancelAppointment(apt.id)}
                                                className="opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all"
                                                title="Cancelar"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Footer */}
                <footer className="mt-8 text-center text-slate-400 text-xs font-medium pb-8">
                    Plataforma Inteligente Espaço C.A. • Webhook: <code className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">/api/webhook</code>
                </footer>
            </div>

            {/* New Appointment Modal */}
            {showNewModal && (
                <NewAppointmentModal
                    selectedDate={selectedDate}
                    onClose={() => setShowNewModal(false)}
                    onSave={() => {
                        setShowNewModal(false)
                        setRefreshKey(k => k + 1)
                    }}
                />
            )}
        </main>
    )
}

function NewAppointmentModal({ selectedDate, onClose, onSave }) {
    const [form, setForm] = useState({
        customer_name: '',
        customer_phone: '',
        service_id: SERVICES[0].id,
        date: selectedDate,
        time: '09:00'
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError('')

        const service = SERVICES.find(s => s.id === form.service_id)
        const startsAt = `${form.date}T${form.time}:00`
        const endDate = new Date(new Date(startsAt).getTime() + (service?.duration || 60) * 60000)
        const endsAt = endDate.toISOString()

        try {
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: form.customer_name,
                    customer_phone: form.customer_phone,
                    service_id: form.service_id,
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <h3 className="text-lg font-extrabold">Novo Agendamento</h3>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nome da Cliente</label>
                        <input
                            type="text"
                            required
                            value={form.customer_name}
                            onChange={e => setForm({ ...form, customer_name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
                            placeholder="Maria Silva"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Telefone</label>
                        <input
                            type="text"
                            required
                            value={form.customer_phone}
                            onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
                            placeholder="5511999999999"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Serviço</label>
                        <select
                            value={form.service_id}
                            onChange={e => setForm({ ...form, service_id: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium bg-white"
                        >
                            {SERVICES.map(s => (
                                <option key={s.id} value={s.id}>{s.name} — R$ {s.price}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Data</label>
                            <input
                                type="date"
                                required
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Horário</label>
                            <input
                                type="time"
                                required
                                value={form.time}
                                onChange={e => setForm({ ...form, time: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                    >
                        {saving ? 'Salvando...' : 'Confirmar Agendamento'}
                    </button>
                </form>
            </div>
        </div>
    )
}
