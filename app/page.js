'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Plus, X, ChevronLeft, ChevronRight, Phone, CheckCircle2, XCircle, RefreshCw, LayoutGrid, Users, Scissors, AlertTriangle, CalendarClock, MoreVertical, Search, Edit2, Trash2, DollarSign, Save, Lock, BarChart3, TrendingUp, FileText, Ban, Download, Eye, EyeOff, ExternalLink, History, PieChart, Target, Crown, ArrowUpRight, Award, MessageCircle, ArrowRight, Headset } from 'lucide-react'

const whatsappLink = (phone, text = '') => { const base = `https://wa.me/${phone.replace(/\D/g, '')}`; return text ? `${base}?text=${encodeURIComponent(text)}` : base }

const DEFAULT_SERVICES = []
let SERVICES = []

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const TIME_SLOTS = []
for (let h = 7; h <= 19; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

// ─── Timezone-safe helpers (Brazil = UTC-3, no DST) ────────
function toSPDate(isoStr) { return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) }
function toSPTime(isoStr) { return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) }
function toSPFull(isoStr) { return new Date(isoStr).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }) }
function toISO_SP(dateStr, timeStr) { return `${dateStr}T${timeStr}:00-03:00` }

function fmt(date) {
    // Standardize to Brazil/Sao Paulo date string (YYYY-MM-DD)
    return new Date(date).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function isToday(date) { return fmt(date) === fmt(new Date()) }

function parseServices(s) {
    if (!s) return []
    try { const arr = JSON.parse(s); return Array.isArray(arr) ? arr : [s] } catch { return [s] }
}
function getServiceNames(svcs) {
    return svcs.map(idOrName => {
        const found = SERVICES.find(s => s.id === idOrName || s.name === idOrName)
        return found ? found.name : idOrName
    })
}
function calcTotal(svcs) { return svcs.reduce((sum, id) => sum + (SERVICES.find(s => s.id === id || s.name === id)?.price || 0), 0) }
function calcDuration(svcs) { return svcs.reduce((sum, id) => sum + (SERVICES.find(s => s.id === id || s.name === id)?.duration || 60), 0) }

function getWeekDates(base) {
    const d = new Date(base); const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const mon = new Date(d); mon.setDate(diff)
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x })
}

function getMonthDates(year, month) {
    const first = new Date(year, month, 1)
    const startDay = first.getDay()
    const start = new Date(first); start.setDate(1 - startDay)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
}

// ─── Main ──────────────────────────────────────────────────
// ─── Schedule Rule Modal (Periods) ────────────────────────
function ScheduleRuleModal({ onClose, onSave, rule = null }) {
    const [form, setForm] = useState(rule ? { ...rule } : {
        start_date: fmt(new Date()),
        end_date: fmt(new Date()),
        open_time: '07:00',
        close_time: '12:00',
        label: ''
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true); setError('')
        try {
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'rule', ...form })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            onSave()
        } catch (e) { setError(e.message) }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-purple-700 text-white">
                    <h3 className="text-base font-extrabold flex items-center gap-2"><CalendarClock size={18} /> {rule ? 'Editar' : 'Novo'} Período Especial</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Início</label>
                            <input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fim</label>
                            <input type="date" required value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Abertura</label>
                            <input type="time" required value={form.open_time} onChange={e => setForm({ ...form, open_time: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fechamento</label>
                            <input type="time" required value={form.close_time} onChange={e => setForm({ ...form, close_time: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Rótulo (ex: Férias)</label>
                        <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" placeholder="Ex: Horário de Verão..." />
                    </div>

                    {error && <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}

                    <button type="submit" disabled={saving}
                        className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 transition-all shadow-lg shadow-violet-200 active:scale-[0.99]">
                        {saving ? 'Salvando...' : 'Salvar Período'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default function AdminDashboard() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(fmt(new Date()))
    const [appointments, setAppointments] = useState([])
    const [blocks, setBlocks] = useState([])
    const [overrides, setOverrides] = useState([])
    const [scheduleRules, setScheduleRules] = useState([])
    const [globalServices, setGlobalServices] = useState(SERVICES)
    const [helpRequests, setHelpRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [showNewModal, setShowNewModal] = useState(false)
    const [showBlockModal, setShowBlockModal] = useState(false)
    const [viewMode, setViewMode] = useState('week')
    const [refreshKey, setRefreshKey] = useState(0)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [activePage, setActivePage] = useState('agenda')
    const [lastCount, setLastCount] = useState(0)
    const [newBadge, setNewBadge] = useState(0)
    const [showCancelled, setShowCancelled] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [darkMode, setDarkMode] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    // Detecção de Mobile e Dark Mode inicial
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)

        const saved = localStorage.getItem('darkMode') === 'true'
        setDarkMode(saved)
        if (saved) document.documentElement.classList.add('dark-mode')

        if (window.innerWidth < 768) setSidebarOpen(false)

        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const toggleDarkMode = () => {
        const newMode = !darkMode
        setDarkMode(newMode)
        localStorage.setItem('darkMode', String(newMode))
        if (newMode) document.documentElement.classList.add('dark-mode')
        else document.documentElement.classList.remove('dark-mode')
    }

    // Action modals
    const [actionApt, setActionApt] = useState(null) // appointment being acted on
    const [actionType, setActionType] = useState(null) // 'cancel' | 'reschedule' | 'view'

    const weekDates = getWeekDates(currentDate)

    const fetchAppointments = useCallback(async () => {
        setLoading(true)
        const s = new Date(currentDate); s.setDate(1); s.setMonth(s.getMonth() - 1)
        const e = new Date(currentDate); e.setMonth(e.getMonth() + 2)
        const cacheBuster = `t=${Date.now()}`
        try {
            const [aptRes, blkRes, schRes, rulesRes, helpRes] = await Promise.all([
                fetch(`/api/admin?start=${fmt(s)}&end=${fmt(e)}&${cacheBuster}`),
                fetch(`/api/admin?type=blocks&start=${fmt(s)}&end=${fmt(e)}&${cacheBuster}`),
                fetch(`/api/admin?type=schedule&${cacheBuster}`),
                fetch(`/api/admin?type=rules&${cacheBuster}`),
                fetch(`/api/admin?type=help_requests&${cacheBuster}`) // Fetch help requests
            ])
            const aptData = await aptRes.json()
            const blkData = await blkRes.json()
            const schData = await schRes.json()
            const rulesData = await rulesRes.json()
            const helpData = await helpRes.json() // Parse help data

            setAppointments(Array.isArray(aptData) ? aptData : [])
            setBlocks(Array.isArray(blkData) ? blkData : [])
            setOverrides(Array.isArray(schData) ? schData : [])
            setScheduleRules(Array.isArray(rulesData) ? rulesData : [])
            setHelpRequests(Array.isArray(helpData) ? helpData : []) // Set state

            try {
                const svcRes = await fetch(`/api/services?include_hidden=true&${cacheBuster}`)
                if (svcRes.ok) {
                    const svcData = await svcRes.json()
                    if (Array.isArray(svcData) && svcData.length > 0) {
                        const merged = [...DEFAULT_SERVICES]
                        svcData.forEach(dbSvc => {
                            const idx = merged.findIndex(s => s.id === dbSvc.id || s.name === dbSvc.name)
                            if (idx >= 0) {
                                merged[idx] = { ...merged[idx], ...dbSvc }
                            } else {
                                merged.push(dbSvc)
                            }
                        })
                        // Filtro final: remover duplicatas e garantir que OCULTOS sumam do sistema
                        const finalServices = []
                        const seenNames = new Set()
                        merged.forEach(s => {
                            if (s.is_hidden) return; // Se está escondido, ignora totalmente

                            if (!seenNames.has(s.name)) {
                                finalServices.push(s)
                                seenNames.add(s.name)
                            } else if (s.id.includes('-')) {
                                const existingIdx = finalServices.findIndex(fs => fs.name === s.name)
                                finalServices[existingIdx] = s
                            }
                        })
                        SERVICES = finalServices
                        setGlobalServices(finalServices)
                    } else {
                        setGlobalServices(SERVICES)
                    }
                } else {
                    setGlobalServices(SERVICES)
                }
            } catch (e) {
                console.warn(e)
                setGlobalServices(SERVICES)
            }

            const apts = Array.isArray(aptData) ? aptData : []
            setAppointments(apts)
            setBlocks(Array.isArray(blkData) ? blkData : [])
            setOverrides(Array.isArray(schData) ? schData : [])
            // Badge for new appointments
            const confirmedCount = apts.filter(a => a.status === 'CONFIRMED').length
            if (lastCount > 0 && confirmedCount > lastCount) {
                setNewBadge(confirmedCount - lastCount)
            }
            setLastCount(confirmedCount)
        } catch (err) { console.error(err) }
        setLoading(false)
    }, [currentDate, lastCount])

    useEffect(() => { fetchAppointments() }, [fetchAppointments, refreshKey])

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => setRefreshKey(k => k + 1), 30000)
        return () => clearInterval(interval)
    }, [])

    const nav = (dir) => {
        const d = new Date(currentDate)
        if (viewMode === 'month') d.setMonth(d.getMonth() + dir)
        else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7)
        else { const sd = new Date(selectedDate + 'T12:00:00'); sd.setDate(sd.getDate() + dir); setSelectedDate(fmt(sd)); return }
        setCurrentDate(d)
    }
    const goToday = () => {
        const now = new Date();
        setCurrentDate(now);
        setSelectedDate(fmt(now));
    }

    const openAction = (apt, type) => { setActionApt(apt); setActionType(type) }
    const closeAction = () => { setActionApt(null); setActionType(null) }

    const doCancelAppointment = async (id) => {
        await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'CANCELLED' }) })
        closeAction()
        setRefreshKey(k => k + 1)
    }

    const doReschedule = async (id, newDate, newTime, duration) => {
        const startsAt = toISO_SP(newDate, newTime)
        const endMs = new Date(startsAt).getTime() + duration * 60000
        const endsAt = new Date(endMs).toISOString()
        try {
            const res = await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, starts_at: startsAt, ends_at: endsAt }) })
            const data = await res.json()
            if (!res.ok || data.error) {
                alert(data.error || 'Erro ao reagendar.')
                return
            }
            closeAction()
            setRefreshKey(k => k + 1)
        } catch (e) {
            alert('Erro de conexão ou no servidor ao reagendar.')
        }
    }

    const confirmed = appointments.filter(a => a.status === 'CONFIRMED' || a.status === 'PENDING')
    const allDayApts = appointments.filter(a => toSPDate(a.starts_at) === selectedDate).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    const filteredDayApts = allDayApts.filter(a => {
        if (!showCancelled && a.status === 'CANCELLED') return false
        if (searchQuery && !a.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })
    const dayApts = confirmed.filter(a => toSPDate(a.starts_at) === selectedDate).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    const dayBlocks = blocks.filter(b => toSPDate(b.starts_at) === selectedDate)
    const getCount = (d) => appointments.filter(a => (a.status === 'CONFIRMED' || a.status === 'PENDING') && toSPDate(a.starts_at) === d).length
    const dayRevenue = dayApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0)

    const isDayOpen = (date) => {
        const dateStr = fmt(date)
        const override = overrides.find(o => o.date === dateStr)
        if (override) return override.is_open

        const rule = scheduleRules.find(r => dateStr >= r.start_date && dateStr <= r.end_date)
        if (rule) return true

        // Default: closed Sun (0) and Mon (1)
        return ![0, 1].includes(date.getDay())
    }

    // Monthly stats for summary cards
    const monthStart = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`
    const monthApts = confirmed.filter(a => a.starts_at >= monthStart)
    const monthRevenue = monthApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0)

    const headerLabel = viewMode === 'month'
        ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
        : viewMode === 'week'
            ? `${weekDates[0].getDate()} — ${weekDates[6].getDate()} de ${MONTH_NAMES[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`
            : new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

    return (
        <div className="min-h-screen bg-slate-50 flex overflow-hidden">
            {/* Sidebar Overlay (Mobile) */}
            {isMobile && sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`${isMobile ? 'sidebar-drawer' : sidebarOpen ? 'w-56' : 'w-16'} ${isMobile && sidebarOpen ? 'open' : ''} bg-gradient-to-b from-violet-700 to-purple-900 text-white transition-all duration-300 flex flex-col shrink-0 h-full`}>
                <div className="p-4 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-2">
                        {(sidebarOpen || isMobile) && (
                            <span className="font-black text-2xl tracking-tighter bg-gradient-to-br from-white via-white to-white/50 bg-clip-text text-transparent select-none">
                                AgendaÍ
                            </span>
                        )}
                    </div>
                    {isMobile && <button onClick={() => setSidebarOpen(false)} className="p-1 text-white/50 hover:text-white"><X size={20} /></button>}
                </div>
                <nav className="flex-1 py-3 space-y-0.5 px-2">
                    {[{ id: 'agenda', icon: Calendar, label: 'Agenda' }, { id: 'suporte', icon: Headset, label: 'Suporte' }, { id: 'horarios', icon: Clock, label: 'Horários' }, { id: 'clientes', icon: Users, label: 'Clientes' }, { id: 'servicos', icon: Scissors, label: 'Serviços' }, { id: 'relatorios', icon: BarChart3, label: 'Relatórios' }].map(item => (
                        <button key={item.id} onClick={() => { setActivePage(item.id); setNewBadge(0); if (isMobile) setSidebarOpen(false) }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${activePage === item.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                            <item.icon size={18} />{(sidebarOpen || isMobile) && item.label}
                            {item.id === 'agenda' && helpRequests.length > 0 && (
                                <span className="absolute left-7 top-2 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                                </span>
                            )}
                            {item.id === 'agenda' && newBadge > 0 && (sidebarOpen || isMobile) && <span className="ml-auto bg-green-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">+{newBadge}</span>}
                            {item.id === 'suporte' && helpRequests.length > 0 && (sidebarOpen || isMobile) && <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">{helpRequests.length}</span>}
                        </button>
                    ))}
                </nav>
                <div className="p-3 border-t border-white/10 space-y-3">
                    <button onClick={toggleDarkMode} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white transition-all text-left">
                        {darkMode ? <RefreshCw size={14} /> : <RefreshCw size={14} className="rotate-180" />}
                        {(sidebarOpen || isMobile) && (darkMode ? 'Modo Claro' : 'Modo Escuro')}
                    </button>
                    <div className="flex items-center gap-2 text-xs font-medium text-white/50 px-3">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span></span>
                        {(sidebarOpen || isMobile) && 'Bot Ativo'}
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {activePage === 'agenda' && (
                    <>
                        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-1 md:gap-2 overflow-hidden">
                                {isMobile && (
                                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-500">
                                        <LayoutGrid size={20} />
                                    </button>
                                )}
                                <div className="flex bg-slate-100 rounded-xl p-0.5 shrink-0">
                                    {['dia', 'semana', 'mês'].map((v, i) => {
                                        const mode = ['day', 'week', 'month'][i]
                                        return <button key={mode} onClick={() => setViewMode(mode)} className={`px-2 md:px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${viewMode === mode ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                                    })}
                                </div>
                                <div className="flex items-center shrink-0">
                                    <button onClick={() => nav(-1)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><ChevronLeft size={18} /></button>
                                    <button onClick={goToday} className="px-2 py-1 md:px-3 md:py-1.5 rounded-lg bg-violet-600 text-white text-[10px] md:text-xs font-bold hover:bg-violet-700 transition">HOJE</button>
                                    <button onClick={() => nav(1)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><ChevronRight size={18} /></button>
                                </div>
                                <span className="text-xs md:text-sm font-bold text-slate-700 ml-1 truncate">{headerLabel}</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2">
                                <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 mobile-hide"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
                                {viewMode === 'day' && (
                                    <>
                                        <div className="relative mobile-hide md:block">
                                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs w-24 md:w-40 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
                                        </div>
                                        <button onClick={() => setShowCancelled(!showCancelled)}
                                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all border-2 ${showCancelled ? 'border-slate-200 text-slate-500' : 'border-red-200 bg-red-50 text-red-600'}`}>
                                            {showCancelled ? <EyeOff size={13} /> : <Eye size={13} />}
                                            <span className="hidden md:inline">{showCancelled ? 'Ocultar' : 'Mostrar'} ✕</span>
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setShowBlockModal(true)} className="flex items-center gap-1 px-2 py-1.5 rounded-xl border-2 border-slate-200 text-slate-600 text-[10px] md:text-xs font-bold hover:bg-slate-50 transition active:scale-95 shrink-0">
                                    <Lock size={12} className="text-slate-400" />
                                    <span className="hidden md:inline">Bloquear</span>
                                </button>
                                <button onClick={() => setShowNewModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-[10px] md:text-xs font-bold hover:bg-violet-700 shadow-md shadow-violet-200 transition active:scale-95 shrink-0">
                                    <Plus size={16} />
                                    <span className="hidden md:inline">Novo</span>
                                </button>
                            </div>
                        </header>

                        {helpRequests.length > 0 && (
                            <div className="px-4 pt-4 shrink-0">
                                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-25"></div>
                                            <div className="relative w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                                <Headset className="text-red-600" size={24} />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-red-900 text-sm">ATENÇÃO: {helpRequests.length} Cliente{helpRequests.length > 1 ? 's' : ''} esperando ajuda!</h4>
                                            <p className="text-xs text-red-700 font-medium">Existem solicitações de suporte humano pendentes no sistema.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setActivePage('suporte')} className="w-full md:w-auto px-6 py-2.5 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-200 active:scale-95">
                                        VER SOLICITAÇÕES
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Summary Cards */}
                        {viewMode === 'day' && (
                            <div className="px-4 pt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-violet-100 flex items-center justify-center"><Calendar className="text-violet-600" size={16} /></div>
                                    <div><p className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Hoje</p><p className="text-lg md:text-xl font-black text-slate-800">{dayApts.length}</p></div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-100 flex items-center justify-center"><DollarSign className="text-green-600" size={16} /></div>
                                    <div><p className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Fatur. Dia</p><p className="text-lg md:text-xl font-black text-green-600">R$ {dayRevenue}</p></div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 mobile-hide md:flex">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><TrendingUp className="text-blue-600" size={18} /></div>
                                    <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mês</p><p className="text-xl font-black text-blue-600">{monthApts.length}</p></div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 mobile-hide md:flex">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><FileText className="text-amber-600" size={18} /></div>
                                    <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fatur. Mês</p><p className="text-xl font-black text-amber-600 truncate">R$ {monthRevenue}</p></div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto p-2 md:p-4">
                            {viewMode === 'month' && <MonthView currentDate={currentDate} selectedDate={selectedDate} setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }} getCount={getCount} isMobile={isMobile} isDayOpen={isDayOpen} />}
                            {viewMode === 'week' && <WeekView weekDates={weekDates} setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }} getCount={getCount} appointments={confirmed} isMobile={isMobile} isDayOpen={isDayOpen} />}
                            {viewMode === 'day' && <DayView selectedDate={selectedDate} appointments={filteredDayApts} blocks={dayBlocks} onAction={openAction} dayRevenue={dayRevenue} onDeleteBlock={async (id) => { await fetch(`/api/admin?id=${id}&type=block`, { method: 'DELETE' }); setRefreshKey(k => k + 1) }} isMobile={isMobile} scheduleRules={scheduleRules} helpRequests={helpRequests} />}
                        </div>
                    </>
                )}
                {activePage === 'suporte' && (
                    <SupportPage
                        helpRequests={helpRequests}
                        isMobile={isMobile}
                        onOpenMenu={() => setSidebarOpen(true)}
                        onResolve={async (customerId) => {
                            await fetch('/api/admin', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ customer_id: customerId, help_requested: false })
                            });
                            setRefreshKey(k => k + 1)
                        }}
                    />
                )}
                {activePage === 'clientes' && <ClientsPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} />}
                {activePage === 'servicos' && <ServicesPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} globalServices={globalServices} refreshGlobal={fetchAppointments} />}
                {activePage === 'relatorios' && <ReportsPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} />}
                {activePage === 'horarios' && <SchedulePage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} overrides={overrides} rules={scheduleRules} onRefresh={fetchAppointments} isDayOpen={isDayOpen} />}
            </main>

            {/* Modals */}
            {showNewModal && <NewAppointmentModal selectedDate={selectedDate} onClose={() => setShowNewModal(false)} onSave={() => { setShowNewModal(false); setRefreshKey(k => k + 1) }} scheduleRules={scheduleRules} />}
            {showBlockModal && <BlockModal selectedDate={selectedDate} onClose={() => setShowBlockModal(false)} onSave={() => { setShowBlockModal(false); setRefreshKey(k => k + 1) }} />}
            {actionApt && actionType === 'view' && <AppointmentDetailModal apt={actionApt} onClose={closeAction} onCancel={() => setActionType('cancel')} onReschedule={() => setActionType('reschedule')} onSaveNotes={async (id, notes) => { await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, notes }) }); setRefreshKey(k => k + 1) }} helpRequests={helpRequests} onResolveHelp={async (customerId) => { await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customerId, help_requested: false }) }); setRefreshKey(k => k + 1) }} />}
            {actionApt && actionType === 'cancel' && <CancelConfirmModal apt={actionApt} onClose={closeAction} onConfirm={() => doCancelAppointment(actionApt.id)} />}
            {actionApt && actionType === 'reschedule' && <RescheduleModal apt={actionApt} onClose={closeAction} onConfirm={doReschedule} scheduleRules={scheduleRules} />}
        </div >
    )
}

// ─── Month View ────────────────────────────────────────────
function MonthView({ currentDate, selectedDate, setSelectedDate, getCount, isMobile, isDayOpen }) {
    const dates = getMonthDates(currentDate.getFullYear(), currentDate.getMonth())
    const thisMonth = currentDate.getMonth()
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className={`grid grid-cols-7 ${isMobile ? 'text-[8px]' : ''}`}>
                {DAY_NAMES.map(d => <div key={d} className="py-2 md:py-3 text-center text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
                {dates.map((date, i) => {
                    const dateStr = fmt(date)
                    const isThisMonth = date.getMonth() === thisMonth
                    const isClosed = !isDayOpen(date)
                    const count = getCount(dateStr)
                    return (
                        <button key={i} onClick={() => !isClosed && isThisMonth && setSelectedDate(dateStr)} disabled={isClosed || !isThisMonth}
                            className={`relative h-16 md:h-24 p-1 md:p-2 border-b border-r border-slate-50 text-left transition-all ${!isThisMonth ? 'opacity-30' : isClosed ? 'bg-slate-50 opacity-40 cursor-not-allowed' : 'hover:bg-violet-50 cursor-pointer'}`}>
                            <span className={`text-[10px] md:text-sm font-bold ${isToday(date) ? 'bg-violet-600 text-white w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center today-pulse' : 'text-slate-700'}`}>{date.getDate()}</span>
                            {count > 0 && (
                                <div className="mt-0.5 md:mt-1 flex flex-col gap-0.5">
                                    <span className="bg-violet-100 text-violet-700 text-[8px] md:text-[10px] font-bold px-1 md:px-1.5 py-0.5 rounded shadow-sm">
                                        {count}{!isMobile && ' agend.'}
                                    </span>
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Week View ─────────────────────────────────────────────
function WeekView({ weekDates, setSelectedDate, getCount, appointments, isMobile, isDayOpen }) {
    if (isMobile) {
        return (
            <div className="space-y-3">
                {weekDates.map((date, i) => {
                    const dateStr = fmt(date)
                    const isClosed = !isDayOpen(date)
                    const dayApts = appointments.filter(a => toSPDate(a.starts_at) === dateStr)
                    return (
                        <div key={i} onClick={() => !isClosed && setSelectedDate(dateStr)} className={`bg-white rounded-xl border border-slate-200 p-3 shadow-sm ${isClosed ? 'opacity-50' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`text-lg font-black ${isToday(date) ? 'text-violet-600' : 'text-slate-700'}`}>{date.getDate()}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{DAY_NAMES[date.getDay()]}</span>
                                </div>
                                {isClosed ? <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase font-bold">Fechado</span> :
                                    dayApts.length > 0 ? <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">{dayApts.length} agendamentos</span> :
                                        <span className="text-[10px] text-slate-300">Livre</span>}
                            </div>
                            {!isClosed && dayApts.length > 0 && (
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    {dayApts.map(apt => (
                                        <div key={apt.id} className="shrink-0 w-24 p-2 bg-violet-50 rounded-lg border-l-2 border-violet-500">
                                            <p className="text-[9px] font-bold text-violet-700">{toSPTime(apt.starts_at)}</p>
                                            <p className="text-[9px] font-semibold text-slate-700 truncate">{apt.customer_name}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-100">
                {weekDates.map((date, i) => {
                    const dateStr = fmt(date)
                    const isClosed = !isDayOpen(date)
                    const count = getCount(dateStr)
                    return (
                        <button key={i} onClick={() => !isClosed && setSelectedDate(dateStr)} disabled={isClosed}
                            className={`py-4 text-center border-r border-slate-100 last:border-r-0 transition-all ${isClosed ? 'bg-slate-50 opacity-40 cursor-not-allowed' : 'hover:bg-violet-50 cursor-pointer'}`}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{DAY_NAMES[date.getDay()]}</p>
                            <p className={`text-2xl font-black mb-1 ${isToday(date) ? 'text-violet-600 today-pulse inline-block px-2' : 'text-slate-700'}`}>{date.getDate()}</p>
                            {count > 0 && <span className="inline-block mt-1 bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{count} agend.</span>}
                            {isClosed && <span className="block text-[10px] text-slate-400 mt-1">Fechado</span>}
                        </button>
                    )
                })}
            </div>
            <div className="grid grid-cols-7">
                {weekDates.map((date, dayIdx) => {
                    const dateStr = fmt(date)
                    const isClosed = date.getDay() === 0 || date.getDay() === 1
                    const dayApts = appointments.filter(a => (a.status === 'CONFIRMED' || a.status === 'PENDING') && toSPDate(a.starts_at) === dateStr)
                    return (
                        <div key={dayIdx} className={`border-r border-slate-100 last:border-r-0 min-h-[200px] p-1.5 ${isClosed ? 'bg-slate-50/50' : ''}`}>
                            {dayApts.slice(0, 5).map(apt => {
                                const svcs = parseServices(apt.service_id)
                                return (
                                    <div key={apt.id} onClick={() => setSelectedDate(dateStr)} className="mb-1 px-2 py-1.5 bg-violet-100 rounded-lg cursor-pointer hover:bg-violet-200 transition-colors" style={{ borderLeft: '3px solid rgb(139 92 246)' }}>
                                        <p className="text-[10px] font-bold text-violet-700">{toSPTime(apt.starts_at)}</p>
                                        <p className="text-[10px] font-semibold text-slate-700 truncate">{apt.customer_name}</p>
                                        <p className="text-[9px] text-slate-500 truncate">{getServiceNames(svcs).join(', ')}</p>
                                    </div>
                                )
                            })}
                            {dayApts.length > 5 && <p className="text-[9px] text-center text-slate-400 font-medium">+{dayApts.length - 5} mais</p>}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Day View (with blocks + status colors) ───────────────
function DayView({ selectedDate, appointments, blocks = [], onAction, dayRevenue, onDeleteBlock, isMobile, scheduleRules = [], helpRequests = [] }) {
    const SLOT_HEIGHT = 48
    const GRID_START = 7 * 60 // 07:00 in minutes

    const activeApts = appointments.filter(a => a.status === 'CONFIRMED' || a.status === 'PENDING')

    // Calculate which slots are occupied
    const occupiedSlots = new Set()
    activeApts.forEach(apt => {
        const time = toSPTime(apt.starts_at)
        const [h, m] = time.split(':').map(Number)
        const startMin = h * 60 + m
        const svcs = parseServices(apt.service_id)
        const dur = calcDuration(svcs)
        for (let t = startMin; t < startMin + dur; t += 30) {
            const slotH = String(Math.floor(t / 60)).padStart(2, '0')
            const slotM = String(t % 60).padStart(2, '0')
            occupiedSlots.add(`${slotH}:${slotM}`)
        }
    })

    // Which slots are blocked
    const blockedSlots = new Set()
    blocks.forEach(blk => {
        const time = toSPTime(blk.starts_at)
        const [h, m] = time.split(':').map(Number)
        const startMin = h * 60 + m
        const endTime = toSPTime(blk.ends_at)
        const [eh, em] = endTime.split(':').map(Number)
        const endMin = eh * 60 + em
        for (let t = startMin; t < endMin; t += 30) {
            const slotH = String(Math.floor(t / 60)).padStart(2, '0')
            const slotM = String(t % 60).padStart(2, '0')
            blockedSlots.add(`${slotH}:${slotM}`)
        }
    })

    const activeRule = (scheduleRules || []).find(r => selectedDate >= r.start_date && selectedDate <= r.end_date);
    const isRestricted = (slot) => {
        if (!activeRule) return false;
        const [h, m] = slot.split(':').map(Number);
        const slotMin = h * 60 + m;
        const [oh, om] = activeRule.open_time.split(':').map(Number);
        const openMin = oh * 60 + om;
        const [ch, cm] = activeRule.close_time.split(':').map(Number);
        const closeMin = ch * 60 + cm;
        return slotMin < openMin || slotMin >= closeMin;
    }

    const getStatusStyle = (status) => {
        switch (status) {
            case 'CONFIRMED': return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-100'
            case 'PENDING': return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-amber-100'
            case 'CANCELLED': return 'bg-gradient-to-r from-red-400 to-red-500 text-white opacity-50'
            default: return 'bg-gradient-to-r from-slate-400 to-slate-500 text-white opacity-60'
        }
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                    <Clock className="text-violet-500" size={18} />
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> {appointments.filter(a => a.status === 'CONFIRMED').length} confirmado(s)
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> {appointments.filter(a => a.status === 'PENDING').length} pendente(s)
                    </span>
                    {blocks.length > 0 && <span className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> {blocks.length} bloqueio{blocks.length !== 1 ? 's' : ''}
                    </span>}
                </div>
            </div>

            {/* Time grid */}
            <div className="relative" style={{ height: `${TIME_SLOTS.length * SLOT_HEIGHT}px` }}>
                {/* Background grid lines */}
                {TIME_SLOTS.map((slot, idx) => {
                    const isHour = slot.endsWith(':00')
                    const isOccupied = occupiedSlots.has(slot)
                    const isBlocked = blockedSlots.has(slot)
                    const restricted = isRestricted(slot)
                    return (
                        <div key={idx} className="absolute w-full flex" style={{ top: `${idx * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}>
                            <div className="w-16 shrink-0 flex items-start justify-end pr-3 pt-1">
                                {isHour && <span className="text-[11px] font-bold text-slate-400">{slot}</span>}
                            </div>
                            <div className={`flex-1 border-l border-slate-100 ${isHour ? 'border-t border-t-slate-200' : 'border-t border-t-slate-50'} 
                                ${restricted ? 'bg-slate-200/50 opacity-100 cursor-not-allowed' : isBlocked ? 'bg-slate-100' : isOccupied ? 'bg-violet-50/50' : ''}`}>
                                {restricted && !isOccupied && !isBlocked && (
                                    <div className="h-full flex items-center justify-center gap-1.5 grayscale opacity-60">
                                        <Ban size={14} className="text-slate-500" />
                                        <span className="text-[9px] font-black uppercase text-slate-500">Horário Restrito</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}

                {/* Block bars (gray) */}
                {blocks.map(blk => {
                    const time = toSPTime(blk.starts_at)
                    const [h, m] = time.split(':').map(Number)
                    const startMin = h * 60 + m
                    const endTime = toSPTime(blk.ends_at)
                    const [eh, em] = endTime.split(':').map(Number)
                    const endMin = eh * 60 + em
                    const dur = endMin - startMin
                    const topPx = ((startMin - GRID_START) / 30) * SLOT_HEIGHT
                    const heightPx = (dur / 30) * SLOT_HEIGHT - 4

                    return (
                        <div key={blk.id}
                            className="absolute bg-slate-300/80 rounded-xl px-3 py-2 z-10 overflow-hidden group border-2 border-dashed border-slate-400"
                            style={{ top: `${topPx + 2}px`, height: `${heightPx}px`, left: '68px', right: '8px' }}>
                            <div className="flex items-center justify-between h-full">
                                <div className="flex items-center gap-2">
                                    <Lock size={14} className="text-slate-600" />
                                    <span className="font-bold text-sm text-slate-700">{blk.title || 'Bloqueado'}</span>
                                    <span className="text-xs text-slate-500">{time} — {endTime.split(':').slice(0, 2).join(':')}</span>
                                </div>
                                <button onClick={() => onDeleteBlock(blk.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all" title="Remover bloqueio">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    )
                })}

                {/* Appointment blocks */}
                {appointments.map(apt => {
                    const time = toSPTime(apt.starts_at)
                    const [h, m] = time.split(':').map(Number)
                    const startMin = h * 60 + m
                    const svcs = parseServices(apt.service_id)
                    const dur = calcDuration(svcs)
                    const total = calcTotal(svcs)

                    const topPx = ((startMin - GRID_START) / 30) * SLOT_HEIGHT
                    const heightPx = (dur / 30) * SLOT_HEIGHT - 4

                    const endMin = startMin + dur
                    const endH = String(Math.floor(endMin / 60)).padStart(2, '0')
                    const endM = String(endMin % 60).padStart(2, '0')

                    const isCancelled = apt.status === 'CANCELLED'
                    const needsHelp = helpRequests?.some(h => h.phone === apt.customer_phone)

                    return (
                        <div key={apt.id}
                            onClick={() => !isCancelled && onAction(apt, 'view')}
                            className={`absolute ${getStatusStyle(apt.status)} rounded-xl px-3 py-2 shadow-md hover:shadow-lg transition-all ${isCancelled ? 'cursor-default' : 'cursor-pointer'} group z-10 overflow-hidden ${needsHelp ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                            style={{ top: `${topPx + 2}px`, height: `${heightPx}px`, left: '68px', right: '8px' }}>
                            <div className="flex items-start justify-between h-full">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={`font-bold text-sm ${isCancelled ? 'line-through' : ''}`}>{apt.customer_name}</p>
                                        {needsHelp && <span className="animate-pulse flex items-center gap-1 bg-red-600 text-[9px] font-black px-2 py-0.5 rounded-full text-white shadow-lg"><Headset size={10} /> SUPORTE</span>}
                                        {isCancelled && <span className="bg-white/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full">CANCELADO</span>}
                                        {apt.notes && <FileText size={12} className="text-white/70" title={apt.notes} />}
                                    </div>
                                    <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                                        <Phone size={10} />
                                        <a href={whatsappLink(apt.customer_phone)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="hover:underline">{apt.customer_phone}</a>
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {getServiceNames(svcs).map((s, i) => <span key={i} className="bg-white/20 text-[10px] font-semibold px-2 py-0.5 rounded-full">{s}</span>)}
                                    </div>
                                    <p className="text-white/70 text-[10px] mt-1">{time} — {endH}:{endM} ({dur}min) • R$ {total}</p>
                                </div>
                                {!isCancelled && (
                                    <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity ml-2">
                                        <button onClick={(e) => { e.stopPropagation(); onAction(apt, 'reschedule') }}
                                            className="p-1.5 rounded-lg bg-white/20 hover:bg-amber-500 transition-colors" title="Reagendar">
                                            <CalendarClock size={13} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onAction(apt, 'cancel') }}
                                            className="p-1.5 rounded-lg bg-white/20 hover:bg-red-500 transition-colors" title="Cancelar">
                                            <XCircle size={13} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Appointment Detail Modal ──────────────────────────────
function AppointmentDetailModal({ apt, onClose, onCancel, onReschedule, onSaveNotes, helpRequests = [], onResolveHelp }) {
    const svcs = parseServices(apt.service_id)
    const total = calcTotal(svcs)
    const dur = calcDuration(svcs)
    const [notes, setNotes] = useState(apt.notes || '')
    const [editingNotes, setEditingNotes] = useState(false)
    const [savingNotes, setSavingNotes] = useState(false)

    const handleSaveNotes = async () => {
        setSavingNotes(true)
        await onSaveNotes(apt.id, notes)
        setSavingNotes(false)
        setEditingNotes(false)
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-6 py-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-extrabold">Detalhes do Agendamento</h3>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition"><X size={18} /></button>
                    </div>
                    <p className="text-white/80 text-sm">{toSPFull(apt.starts_at)}</p>
                </div>

                {/* Details */}
                <div className="p-4 md:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-lg mx-auto md:mx-0">
                            {apt.customer_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="text-center md:text-left">
                            <p className="font-bold text-slate-800 text-lg">{apt.customer_name}</p>
                            <div className="text-sm text-slate-500 flex flex-col md:flex-row md:items-center gap-2 mt-2">
                                <span className="flex items-center justify-center md:justify-start gap-1"><Phone size={12} /> {apt.customer_phone}</span>
                                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                    <a href={whatsappLink(apt.customer_phone, `Olá ${apt.customer_name}, tudo bem? Passando para confirmar o seu agendamento de ${getServiceNames(svcs).join(' + ')}, dia ${new Date(apt.starts_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} às ${toSPTime(apt.starts_at)}. Podemos confirmar?`)} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-white bg-[#25D366] px-3 py-1.5 rounded-full shadow-sm hover:scale-105 transition-all">
                                        <MessageCircle size={10} /> Confirmar via WhatsApp
                                    </a>
                                    <a href={whatsappLink(apt.customer_phone)} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors">
                                        Chat <ExternalLink size={9} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horário</span>
                            <span className="text-sm font-bold text-slate-800">{toSPTime(apt.starts_at)} ({dur}min)</span>
                        </div>

                        {helpRequests?.find(h => h.phone === apt.customer_phone) && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-3">
                                    <Headset className="text-red-600" size={20} />
                                    <div>
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Solicitação de Ajuda Humana</p>
                                        <p className="text-xs text-red-700 font-medium">{helpRequests.find(h => h.phone === apt.customer_phone).help_notes || 'O cliente solicitou transbordo para atendente.'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onResolveHelp(helpRequests.find(h => h.phone === apt.customer_phone).id)}
                                    className="bg-red-600 text-white text-[10px] font-bold px-3 py-2 rounded-lg hover:bg-red-700 transition shadow-sm"
                                >
                                    MARCAR ATENDIDA
                                </button>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Serviços</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                                {getServiceNames(svcs).map((s, i) => <span key={i} className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{s}</span>)}
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
                            <span className="text-lg font-black text-green-600">R$ {total}</span>
                        </div>
                    </div>

                    {/* Notes Section */}
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1"><FileText size={12} /> Observações</span>
                            {!editingNotes && <button onClick={() => setEditingNotes(true)} className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"><Edit2 size={11} /> Editar</button>}
                        </div>
                        {editingNotes ? (
                            <div className="space-y-2">
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Ex: cliente alérgica a acetona, quer francesinha rosa..."
                                    className="w-full px-3 py-2 rounded-lg border border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm resize-none" />
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingNotes(false); setNotes(apt.notes || '') }} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                                    <button onClick={handleSaveNotes} disabled={savingNotes} className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1"><Save size={12} /> {savingNotes ? 'Salvando...' : 'Salvar'}</button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-amber-800">{notes || 'Nenhuma observação'}</p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        {apt.status === 'PENDING' && (
                            <button onClick={async () => { await onSaveNotes(apt.id, notes || ''); await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: apt.id, status: 'CONFIRMED' }) }); onClose() }}
                                className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-all active:scale-[0.98] shadow-lg shadow-green-200">
                                <CheckCircle2 size={16} /> Confirmar Agendamento
                            </button>
                        )}
                        <button onClick={onReschedule}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-700 font-bold text-sm hover:bg-amber-100 transition-all active:scale-[0.98]">
                            <CalendarClock size={16} /> Reagendar
                        </button>
                        <button onClick={onCancel}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 font-bold text-sm hover:bg-red-100 transition-all active:scale-[0.98]">
                            <XCircle size={16} /> Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Cancel Confirmation Modal ─────────────────────────────
function CancelConfirmModal({ apt, onClose, onConfirm }) {
    const [confirming, setConfirming] = useState(false)
    const svcs = parseServices(apt.service_id)
    const total = calcTotal(svcs)

    const handleConfirm = async () => {
        setConfirming(true)
        await onConfirm()
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Warning Header */}
                <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold">Confirmar Cancelamento</h3>
                            <p className="text-white/80 text-sm">Esta ação não pode ser desfeita</p>
                        </div>
                    </div>
                </div>

                {/* Appointment Summary */}
                <div className="p-6 space-y-4">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
                        <p className="text-sm text-slate-600">Você está prestes a cancelar:</p>
                        <div className="bg-white rounded-lg p-3 border border-red-100">
                            <p className="font-bold text-slate-800">{apt.customer_name}</p>
                            <p className="text-sm text-slate-500">{toSPFull(apt.starts_at)} às {toSPTime(apt.starts_at)}</p>
                            <p className="text-sm text-slate-500">{getServiceNames(svcs).join(' + ')}</p>
                            <p className="text-sm font-bold text-red-600 mt-1">Valor: R$ {total}</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]">
                            Voltar
                        </button>
                        <button onClick={handleConfirm} disabled={confirming}
                            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-red-200">
                            {confirming ? 'Cancelando...' : 'Sim, Cancelar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Reschedule Modal ──────────────────────────────────────
function RescheduleModal({ apt, onClose, onConfirm, scheduleRules = [] }) {
    const svcs = parseServices(apt.service_id)
    const total = calcTotal(svcs)
    const dur = calcDuration(svcs)

    const [newDate, setNewDate] = useState(toSPDate(apt.starts_at))
    const [newTime, setNewTime] = useState(toSPTime(apt.starts_at))
    const [step, setStep] = useState('select') // 'select' or 'confirm'
    const [saving, setSaving] = useState(false)

    const handleConfirm = async () => {
        const activeRule = (scheduleRules || []).find(r => newDate >= r.start_date && newDate <= r.end_date);
        if (activeRule) {
            const [h, m] = newTime.split(':').map(Number);
            const slotMin = h * 60 + m;
            const [oh, om] = activeRule.open_time.split(':').map(Number);
            const openMin = oh * 60 + om;
            const [ch, cm] = activeRule.close_time.split(':').map(Number);
            const closeMin = ch * 60 + cm;
            if (slotMin < openMin || slotMin >= closeMin) {
                alert(`Atenção: O horário ${newTime} está fora do expediente especial (abre ${activeRule.open_time.substring(0, 5)} - fecha ${activeRule.close_time.substring(0, 5)}). Deseja continuar mesmo assim?`);
            }
        }
        setSaving(true)
        await onConfirm(apt.id, newDate, newTime, dur)
    }

    if (step === 'confirm') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                <CalendarClock size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-extrabold">Confirmar Reagendamento</h3>
                                <p className="text-white/80 text-sm">Revise os dados antes de confirmar</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                            <p className="font-bold text-slate-800 text-sm">{apt.customer_name}</p>
                            <p className="text-sm text-slate-500 flex items-center gap-1"><Phone size={12} /> <a href={whatsappLink(apt.customer_phone)} target="_blank" rel="noopener" className="hover:text-green-600 hover:underline transition-colors">{apt.customer_phone}</a> <a href={whatsappLink(apt.customer_phone)} target="_blank" rel="noopener" className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors">WhatsApp <ExternalLink size={9} /></a></p>
                            <p className="text-sm text-slate-500">{getServiceNames(svcs).join(' + ')} — R$ {total}</p>

                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">De</p>
                                    <p className="text-sm font-semibold text-red-600 line-through">{toSPFull(apt.starts_at)}</p>
                                    <p className="text-sm font-semibold text-red-600 line-through">{toSPTime(apt.starts_at)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-green-500 mb-1">Para</p>
                                    <p className="text-sm font-bold text-green-600">{new Date(newDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                    <p className="text-sm font-bold text-green-600">{newTime}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep('select')}
                                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]">
                                Voltar
                            </button>
                            <button onClick={handleConfirm} disabled={saving}
                                className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-amber-200">
                                {saving ? 'Salvando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    <h3 className="text-base font-extrabold flex items-center gap-2"><CalendarClock size={18} /> Reagendar</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Current info */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Agendamento atual</p>
                        <p className="font-bold text-slate-800">{apt.customer_name}</p>
                        <p className="text-sm text-slate-500">{toSPFull(apt.starts_at)} às {toSPTime(apt.starts_at)}</p>
                        <p className="text-sm text-slate-500">{getServiceNames(svcs).join(' + ')} — R$ {total}</p>
                    </div>

                    {/* New date/time */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Nova data e horário</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Data</label>
                                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm font-medium" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Horário</label>
                                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none text-sm font-medium" />
                            </div>
                        </div>
                    </div>

                    <button onClick={() => setStep('confirm')}
                        className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 active:scale-[0.99]">
                        Revisar Reagendamento
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── New Appointment Modal ─────────────────────────────────
function NewAppointmentModal({ selectedDate, onClose, onSave, scheduleRules = [] }) {
    const [form, setForm] = useState({ customer_name: '', customer_phone: '', services: [], date: selectedDate, time: '09:00', notes: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const toggle = (id) => setForm(p => ({ ...p, services: p.services.includes(id) ? p.services.filter(s => s !== id) : [...p.services, id] }))
    const totalPrice = calcTotal(form.services)
    const totalDuration = calcDuration(form.services)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (form.services.length === 0) { setError('Selecione ao menos um serviço.'); return }
        setSaving(true); setError('')

        const startsAt = toISO_SP(form.date, form.time)
        const endMs = new Date(startsAt).getTime() + totalDuration * 60000
        const endsAt = new Date(endMs).toISOString()

        try {
            const activeRule = (scheduleRules || []).find(r => form.date >= r.start_date && form.date <= r.end_date);
            if (activeRule) {
                const [h, m] = form.time.split(':').map(Number);
                const slotMin = h * 60 + m;
                const [oh, om] = activeRule.open_time.split(':').map(Number);
                const openMin = oh * 60 + om;
                const [ch, cm] = activeRule.close_time.split(':').map(Number);
                const closeMin = ch * 60 + cm;
                if (slotMin < openMin || slotMin >= closeMin) {
                    if (!confirm(`Atenção: O horário ${form.time} está fora do expediente definido (${activeRule.open_time.substring(0, 5)} às ${activeRule.close_time.substring(0, 5)}). Registrar mesmo assim?`)) {
                        setSaving(false); return;
                    }
                }
            }

            const res = await fetch('/api/admin', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customer_name: form.customer_name, customer_phone: form.customer_phone, service_id: JSON.stringify(form.services), starts_at: startsAt, ends_at: endsAt, notes: form.notes || undefined })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            onSave()
        } catch (e) { setError(e.message) }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-purple-700 text-white">
                    <h3 className="text-base font-extrabold">Novo Agendamento</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 max-h-[75vh] md:max-h-[70vh] overflow-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Nome</label>
                            <input type="text" required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" placeholder="Maria Silva" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Telefone</label>
                            <input type="text" required value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" placeholder="5511999999999" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Serviços (selecione um ou mais)</label>
                        <div className="space-y-1.5">
                            {SERVICES.filter(s => s.active && !s.is_hidden).map(s => {
                                const sel = form.services.includes(s.id)
                                return (
                                    <button key={s.id} type="button" onClick={() => toggle(s.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm ${sel ? 'border-violet-500 bg-violet-50 text-violet-900' : 'border-slate-150 hover:border-violet-200 text-slate-700'}`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${sel ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                                                {sel && <CheckCircle2 size={12} className="text-white" />}
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
                    {form.services.length > 0 && (
                        <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center justify-between">
                            <div><span className="text-xs font-bold text-violet-600">{form.services.length} serviço{form.services.length > 1 ? 's' : ''}</span><span className="text-xs text-violet-400 ml-2">• {totalDuration}min</span></div>
                            <span className="text-lg font-black text-violet-700">R$ {totalPrice}</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Data</label>
                            <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Horário</label>
                            <input type="time" required value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm font-medium" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Observações (opcional)</label>
                        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Ex: alérgica a acetona, quer francesinha rosa..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm resize-none" />
                    </div>
                    {error && <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}
                    <button type="submit" disabled={saving}
                        className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 transition-all shadow-lg shadow-violet-200 active:scale-[0.99]">
                        {saving ? 'Salvando...' : `Confirmar — R$ ${totalPrice}`}
                    </button>
                </form>
            </div>
        </div>
    )
}

// ─── Clients Page ──────────────────────────────────────────
function ClientsPage({ isMobile, onOpenMenu }) {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [appointments, setAppointments] = useState([])
    const [historyPhone, setHistoryPhone] = useState(null) // phone to show history for

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const [custRes, aptRes] = await Promise.all([
                    fetch('/api/admin?type=customers'),
                    fetch('/api/admin?start=2020-01-01&end=2030-12-31')
                ])
                const custData = await custRes.json()
                const aptData = await aptRes.json()
                setCustomers(Array.isArray(custData) ? custData : [])
                setAppointments(Array.isArray(aptData) ? aptData : [])
            } catch (e) { console.error(e) }
            setLoading(false)
        }
        load()
    }, [])

    const getStats = (phone) => {
        const myApts = appointments.filter(a => a.customer_phone === phone && a.status === 'CONFIRMED')
        const totalSpent = myApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0)
        const lastVisit = myApts.length > 0
            ? myApts.sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0]
            : null
        const upcoming = myApts.filter(a => new Date(a.starts_at) > new Date()).length
        return { total: myApts.length, totalSpent, lastVisit, upcoming }
    }

    const getHistory = (phone) => appointments.filter(a => a.customer_phone === phone).sort((a, b) => b.starts_at.localeCompare(a.starts_at))

    const filtered = customers.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    )

    const historyCustomer = historyPhone ? customers.find(c => c.phone === historyPhone) : null
    const historyApts = historyPhone ? getHistory(historyPhone) : []

    return (
        <>
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><Users className="text-violet-500" size={20} /> Clientes</h2>
                </div>
                <div className="relative w-full md:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm w-full focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
                </div>
            </header>
            <div className="flex-1 overflow-auto p-2 md:p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <RefreshCw className="animate-spin text-violet-400" size={24} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <Users className="mx-auto text-slate-300 mb-3" size={48} />
                        <p className="text-slate-400 font-medium">Nenhum cliente encontrado</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 md:px-5 py-3">Cliente</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 md:px-5 py-3">Telefone</th>
                                        <th className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 md:px-5 py-3 mobile-hide">Agendamentos</th>
                                        <th className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 md:px-5 py-3 mobile-hide">Próximos</th>
                                        <th className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 md:px-5 py-3">Total Gasto</th>
                                        <th className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 md:px-5 py-3 mobile-hide">Última Visita</th>
                                        <th className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 md:px-5 py-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((c, i) => {
                                        const stats = getStats(c.phone)
                                        return (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-violet-50/30 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm">
                                                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <span className="font-semibold text-sm text-slate-800">{c.name || 'Sem nome'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <a href={whatsappLink(c.phone)} target="_blank" rel="noopener" className="text-sm text-slate-600 font-mono hover:text-green-600 hover:underline transition-colors">{c.phone}</a>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-lg">{stats.total}</span>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    {stats.upcoming > 0
                                                        ? <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-lg">{stats.upcoming}</span>
                                                        : <span className="text-xs text-slate-400">—</span>}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-sm font-bold text-green-600">R$ {stats.totalSpent.toFixed(0)}</span>
                                                </td>
                                                <td className="px-5 py-3 text-right text-sm text-slate-500">
                                                    {stats.lastVisit ? toSPDate(stats.lastVisit.starts_at).split('-').reverse().join('/') : '—'}
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <button onClick={() => setHistoryPhone(c.phone)} className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg hover:bg-violet-100 transition-colors">
                                                        <History size={12} /> Histórico
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                <div className="mt-4 text-center text-xs text-slate-400 font-medium">
                    {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* History Modal */}
            {historyPhone && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setHistoryPhone(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div>
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="text-violet-500" size={18} /> Histórico</h3>
                                <p className="text-sm text-slate-500">{historyCustomer?.name || 'Cliente'} • {historyPhone}</p>
                            </div>
                            <button onClick={() => setHistoryPhone(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18} /></button>
                        </div>
                        <div className="overflow-auto max-h-[60vh] p-4 space-y-2">
                            {historyApts.length === 0 ? (
                                <p className="text-center text-sm text-slate-400 py-8">Nenhum agendamento encontrado</p>
                            ) : historyApts.map(a => {
                                const svcs = parseServices(a.service_id)
                                const total = calcTotal(svcs)
                                const date = toSPDate(a.starts_at).split('-').reverse().join('/')
                                const time = new Date(a.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                                return (
                                    <div key={a.id} className={`flex items-center justify-between p-3 rounded-xl border ${a.status === 'CANCELLED' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
                                        }`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-700">{date}</span>
                                                <span className="text-xs text-slate-400">{time}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : a.status === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                                                    }`}>{a.status === 'CONFIRMED' ? 'Confirmado' : a.status === 'CANCELLED' ? 'Cancelado' : a.status}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">{getServiceNames(svcs).join(' + ')}</p>
                                        </div>
                                        <span className="text-sm font-bold text-green-600 ml-3">R$ {total}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

// ─── Support Page (New Center) ─────────────────────────────
function SupportPage({ helpRequests, isMobile, onOpenMenu, onResolve }) {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                            <Headset className="text-red-500" size={24} />
                            Centro de Suporte
                        </h2>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5 ml-8">Atendimento humano aos clientes em tempo real.</p>
                    </div>
                </div>
                <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                    {helpRequests.length} Chamado{helpRequests.length !== 1 ? 's' : ''}
                </div>
            </header>

            <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
                {helpRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 size={32} className="text-slate-200" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-400">Tudo em dia!</h3>
                        <p className="text-sm text-slate-300">Não há nenhum cliente precisando de ajuda no momento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {helpRequests.map(req => (
                            <div key={req.id} className="bg-white rounded-3xl border border-red-100 shadow-lg shadow-red-500/5 p-5 flex flex-col justify-between hover:border-red-300 transition-all animate-in zoom-in-95">
                                <div>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                                                {req.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{req.name || 'Cliente Novo'}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest mt-0.5">
                                                    <Clock size={10} /> Solicitado em {new Date(req.help_requested_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-red-50 rounded-2xl p-4 mb-4 border border-red-100">
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Motivo / Problema:</p>
                                        <p className="text-sm text-red-800 leading-relaxed italic">"{req.help_notes || 'O cliente solicitou falar com um atendente.'}"</p>
                                    </div>

                                    <div className="flex items-center gap-2 mb-4">
                                        <p className="text-white/80 text-xs flex items-center gap-1">
                                            <a href={whatsappLink(req.phone)} target="_blank" rel="noopener" className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-all shadow-md shadow-green-200 w-full justify-center">
                                                <MessageCircle size={16} /> CHAMAR NO WHATSAPP
                                            </a>
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onResolve(req.id)}
                                    className="w-full py-2.5 rounded-xl border-2 border-slate-100 text-slate-400 font-bold text-xs hover:border-green-200 hover:text-green-600 hover:bg-green-50 transition-all uppercase tracking-widest"
                                >
                                    Arquivar / Resolvida
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Services Page ─────────────────────────────────────────
function ServicesPage({ isMobile, onOpenMenu, globalServices, refreshGlobal }) {
    const [services, setServices] = useState(globalServices || [])
    const [editing, setEditing] = useState(null)
    const [editForm, setEditForm] = useState({ name: '', price: '', duration: '' })
    const [isAdding, setIsAdding] = useState(false)
    const [addForm, setAddForm] = useState({ name: '', price: '', duration: '', active: true })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setServices(globalServices || [])
    }, [globalServices])

    const startEdit = (svc) => {
        setEditing(svc.id)
        setEditForm({ name: svc.name, price: svc.price, duration: svc.duration })
    }

    const saveEdit = async (id) => {
        setLoading(true)
        try {
            const originalSvc = services.find(s => s.id === id);
            const isDefault = !id.includes('-');
            const nameChanged = originalSvc && originalSvc.name !== editForm.name;

            // Se for padrão e mudou o nome, precisamos "matar" o nome antigo no banco para não duplicar
            if (isDefault && nameChanged) {
                await fetch('/api/services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: originalSvc.name, price: originalSvc.price, duration: originalSvc.duration, is_hidden: true })
                });
            }

            const res = await fetch('/api/services', {
                method: isDefault ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...(isDefault ? {} : { id }), ...editForm, ...(isDefault && !nameChanged ? { is_hidden: false } : {}) })
            })

            if (!res.ok) {
                const err = await res.json()
                alert(`Erro ao salvar no banco de dados do Supabase.\nDetalhe: ${err.error || res.statusText}\nSua tabela 'services' pode estar ausente ou bloqueada por segurança RLS.`)
            } else {
                refreshGlobal()
                setEditing(null)
            }
        } catch (e) { alert(`Erro de Conexão: ${e.message}`) }
        setLoading(false)
    }

    const handleAdd = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/services', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addForm)
            })
            if (!res.ok) {
                const err = await res.json()
                alert(`Supabase recusou a inserção do serviço.\nErro: ${err.error || res.statusText}\nVocê executou o script SQL de criação da tabela 'services' e removeu o bloqueio RLS?`)
            } else {
                setIsAdding(false)
                setAddForm({ name: '', price: '', duration: '', active: true })
                refreshGlobal()
            }
        } catch (e) { alert(`Erro de Rede: ${e.message}`) }
        setLoading(false)
    }

    const toggleActive = async (svc) => {
        setLoading(true)
        try {
            const isDefault = !svc.id.includes('-');
            const body = isDefault
                ? { name: svc.name, price: svc.price, duration: svc.duration, active: !svc.active }
                : { id: svc.id, active: !svc.active }

            const res = await fetch('/api/services', {
                method: isDefault ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!res.ok) {
                const err = await res.json()
                alert(`Erro ao atualizar status!\nDB: ${err.error || res.statusText}`)
            } else {
                refreshGlobal()
            }
        } catch (e) { alert(`Problema de conexão: ${e.message}`) }
        setLoading(false)
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                            <Scissors className="text-violet-500" size={24} />
                            Serviços Dinâmicos
                        </h2>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5 ml-8">Gerencie o catálogo do bot e do sistema.</p>
                    </div>
                </div>
                <button onClick={() => setIsAdding(!isAdding)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-violet-500/30 transition-all active:scale-95">
                    {isAdding ? <X size={16} /> : <Plus size={16} />}
                    <span className="hidden sm:inline">{isAdding ? 'Cancelar' : 'Novo Serviço'}</span>
                </button>
            </header>

            <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
                {isAdding && (
                    <div className="bg-white rounded-2xl border border-violet-200 shadow-xl shadow-violet-500/5 p-5 md:p-6 mb-6 transform transition-all animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus className="text-violet-500" size={16} /> Adicionar Novo Serviço</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nome do Serviço</label>
                                <input type="text" required value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-sm font-medium transition-all" placeholder="Ex: Cílios Volume Russo" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Preço Base (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                                        <input type="number" required value={addForm.price} onChange={e => setAddForm({ ...addForm, price: e.target.value })} className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-sm font-bold transition-all" placeholder="0.00" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Duração (Minutos)</label>
                                    <div className="relative">
                                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="number" required value={addForm.duration} onChange={e => setAddForm({ ...addForm, duration: e.target.value })} className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-sm font-medium transition-all" placeholder="60" />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors disabled:opacity-50">
                                    {loading ? 'Salvando...' : 'Criar Serviço'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                    {services.length === 0 && !loading && (
                        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
                            <Scissors className="mx-auto text-slate-300 mb-3" size={32} />
                            <p className="text-slate-500 font-medium">Você ainda não tem serviços no Banco de Dados.</p>
                            <p className="text-xs text-slate-400 mt-1">Clique em "Novo Serviço" para começar a preencher o catálogo do Bot.</p>
                        </div>
                    )}

                    {services.filter(s => !s.is_hidden).map(svc => (
                        <div key={svc.id} className={`bg-white rounded-2xl border transition-all ${!svc.active ? 'border-red-100 opacity-60 bg-slate-50' : 'border-slate-200 hover:border-violet-300 hover:shadow-md'}`}>
                            {editing === svc.id ? (
                                <div className="p-4 md:p-5">
                                    <div className="flex flex-col md:flex-row gap-3">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nome</label>
                                            <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-violet-200 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-100" />
                                        </div>
                                        <div className="flex items-end gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">R$</label>
                                                <input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} className="w-20 px-3 py-2 rounded-lg border border-violet-200 font-bold text-center outline-none focus:ring-2 focus:ring-violet-100" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Min.</label>
                                                <input type="number" value={editForm.duration} onChange={e => setEditForm({ ...editForm, duration: e.target.value })} className="w-16 px-3 py-2 rounded-lg border border-violet-200 font-medium text-center outline-none focus:ring-2 focus:ring-violet-100" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => saveEdit(svc.id)} disabled={loading} className="bg-green-500 text-white p-2.5 rounded-lg hover:bg-green-600 transition-colors shadow-sm"><Save size={16} /></button>
                                                <button onClick={() => setEditing(null)} className="bg-slate-100 text-slate-500 p-2.5 rounded-lg hover:bg-slate-200 transition-colors"><X size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 md:p-5">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => toggleActive(svc)}
                                            disabled={loading}
                                            className={`w-10 h-6 rounded-full p-1 transition-colors ${svc.active ? 'bg-green-500' : 'bg-slate-300'}`}
                                            title={svc.active ? 'Desativar Serviço' : 'Ativar Serviço'}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${svc.active ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                        <div>
                                            <h4 className={`font-bold text-base md:text-lg ${svc.active ? 'text-slate-800' : 'text-slate-500 line-through'}`}>{svc.name}</h4>
                                            {svc.active ? (
                                                <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">Ativo no Bot</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">Oculto</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 md:gap-6">
                                        <div className="text-right hidden sm:block">
                                            <div className="text-lg font-black text-violet-600">R$ {svc.price}</div>
                                            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 justify-end"><Clock size={12} /> {svc.duration} min</div>
                                        </div>
                                        <div className="text-right sm:hidden">
                                            <div className="text-sm font-black text-violet-600">R$ {svc.price}</div>
                                            <div className="text-[10px] text-slate-500">{svc.duration}m</div>
                                        </div>

                                        <button onClick={() => startEdit(svc)} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-200 transition-all shadow-sm">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={async () => {
                                            if (confirm('Deseja realmente excluir este serviço da visão?')) {
                                                setLoading(true)
                                                try {
                                                    // Usamos ID se for UUID ou Nome se for Padrão
                                                    const res = await fetch(`/api/services?id=${svc.id}`, { method: 'DELETE' })
                                                    if (res.ok) refreshGlobal()
                                                    else alert('Erro ao ocultar serviço.')
                                                } catch (e) {
                                                    console.error('Delete error:', e);
                                                    alert('Falha na conexão ao excluir.')
                                                }
                                                setLoading(false)
                                            }
                                        }} className="p-2.5 rounded-xl border border-slate-200 text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─── Block Modal ───────────────────────────────────────────
function BlockModal({ selectedDate, onClose, onSave }) {
    const [form, setForm] = useState({ title: '', dates: [selectedDate], startTime: '12:00', endTime: '13:00' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const addNext5Days = () => {
        const d = new Date(selectedDate + 'T12:00:00')
        const newDates = []
        for (let i = 0; i < 5; i++) {
            const next = new Date(d)
            next.setDate(d.getDate() + i)
            newDates.push(fmt(next))
        }
        setForm({ ...form, dates: Array.from(new Set([...form.dates, ...newDates])) })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true); setError('')

        try {
            // Validate all dates
            for (const date of form.dates) {
                const startsAt = toISO_SP(date, form.startTime)
                const endsAt = toISO_SP(date, form.endTime)
                if (new Date(endsAt) <= new Date(startsAt)) throw new Error(`Horário inválido em ${date}`)
            }

            // Batch send
            const promises = form.dates.map(date => {
                const startsAt = toISO_SP(date, form.startTime)
                const endsAt = toISO_SP(date, form.endTime)
                return fetch('/api/admin', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'block', title: form.title || 'Bloqueado', starts_at: startsAt, ends_at: endsAt })
                })
            })

            const results = await Promise.all(promises)
            for (const res of results) {
                const data = await res.json()
                if (data.error) throw new Error(data.error)
            }
            onSave()
        } catch (e) { setError(e.message) }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-600 to-slate-700 text-white">
                    <h3 className="text-base font-extrabold flex items-center gap-2"><Lock size={16} /> Bloquear Horário</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Motivo (opcional)</label>
                        <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none text-sm font-medium" placeholder="Ex: Almoço, Consulta médica..." />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Datas Selecionadas ({form.dates.length})</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {form.dates.map(d => (
                                <span key={d} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                                    {d.split('-').reverse().slice(0, 2).join('/')}
                                    <button type="button" onClick={() => setForm({ ...form, dates: form.dates.filter(x => x !== d) })} className="hover:text-red-500"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="date" onChange={e => e.target.value && setForm({ ...form, dates: Array.from(new Set([...form.dates, e.target.value])) })}
                                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium outline-none" />
                            <button type="button" onClick={addNext5Days} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200 transition">+5 Dias</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Início</label>
                            <input type="time" required value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none text-sm font-medium" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fim</label>
                            <input type="time" required value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none text-sm font-medium" />
                        </div>
                    </div>
                    {error && <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}
                    <button type="submit" disabled={saving || form.dates.length === 0}
                        className="w-full py-3 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-200 active:scale-[0.99]">
                        {saving ? 'Bloqueando...' : `Bloquear em ${form.dates.length} dia${form.dates.length !== 1 ? 's' : ''}`}
                    </button>
                </form>
            </div>
        </div>
    )
}



// ─── SVG Donut Chart ───────────────────────────────────────
function DonutChart({ data }) {
    if (!data || data.length === 0) return <div className="text-center text-slate-400 py-10">Sem dados suficientes</div>;
    const total = data.reduce((sum, item) => sum + item.value, 0);
    // Colors for the slices
    const colors = ['#8b5cf6', '#c084fc', '#f472b6', '#38bdf8', '#34d399', '#fbbf24'];
    let currentOffset = 0;

    return (
        <div className="flex flex-col md:flex-row items-center gap-6 w-full">
            <div className="relative w-32 h-32 md:w-40 md:h-40 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                    {data.map((item, i) => {
                        const proportion = item.value / total;
                        const dashArray = `${proportion * 100} ${100 - (proportion * 100)}`;
                        const dashOffset = -currentOffset;
                        currentOffset += proportion * 100;
                        return (
                            <circle key={i} cx="18" cy="18" r="15.915" fill="transparent"
                                stroke={colors[i % colors.length]} strokeWidth="4"
                                strokeDasharray={dashArray} strokeDashoffset={dashOffset}
                                className="transition-all duration-1000 ease-out hover:stroke-[5px]" />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-slate-400">Total</span>
                    <span className="text-lg font-black text-slate-700">{total}</span>
                </div>
            </div>
            <div className="flex-1 space-y-2 w-full">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                            <span className="font-semibold text-slate-600 truncate">{item.label}</span>
                        </div>
                        <span className="font-bold text-slate-800 shrink-0 ml-2">{((item.value / total) * 100).toFixed(0)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Reports Page ──────────────────────────────────────────
function ReportsPage({ isMobile, onOpenMenu }) {
    const [period, setPeriod] = useState(7); // days
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [mounted, setMounted] = useState(false);
    const [allHistoricalApts, setAllHistoricalApts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('period'); // 'period' or 'custom'

    useEffect(() => {
        setMounted(true);
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin?type=stats&t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    setAllHistoricalApts(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error("Erro ao buscar historico financeiro", error);
            }
            setLoading(false);
        };
        fetchHistory();
    }, []);

    if (!mounted || loading) {
        return <div className="p-10 text-center text-slate-500 flex flex-col items-center justify-center h-full"><RefreshCw className="animate-spin mb-4 text-violet-500" /> Carregando relatórios avançados...</div>;
    }

    const today = new Date();

    // Filter appointments by selected period
    // If period is Infinity (Todo o período), just take all.
    const startPeriod = new Date();
    if (filterType === 'period') {
        startPeriod.setDate(today.getDate() - (period - 1));
    } else if (customRange.start) {
        const [y, m, d] = customRange.start.split('-').map(Number);
        startPeriod.setFullYear(y, m - 1, d);
    }
    startPeriod.setHours(0, 0, 0, 0);

    const endPeriod = new Date();
    if (filterType === 'custom' && customRange.end) {
        const [y, m, d] = customRange.end.split('-').map(Number);
        endPeriod.setFullYear(y, m - 1, d);
    }
    endPeriod.setHours(23, 59, 59, 999);

    const filteredApts = allHistoricalApts.filter(a => {
        const d = new Date(a.starts_at);
        return d >= startPeriod && d <= endPeriod;
    });

    const totalRevenue = filteredApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0);
    const totalApts = filteredApts.length;
    const ticketMedio = totalApts > 0 ? (totalRevenue / totalApts).toFixed(0) : 0;

    // Previous period for comparison
    const startPrevContext = new Date(startPeriod);
    startPrevContext.setDate(startPrevContext.getDate() - period);
    const prevApts = allHistoricalApts.filter(a => {
        if (period === 9999) return false; // Sem comparação
        const d = new Date(a.starts_at);
        return d >= startPrevContext && d < startPeriod;
    });
    const prevRevenue = prevApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0);
    const growth = period === 9999 ? 0 : (prevRevenue === 0 ? 100 : (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1));

    // Daily Chart Data (Aggregate by Date)
    const chartData = [];
    // Reset hours to compare dates strictly
    const sDate = new Date(startPeriod.getFullYear(), startPeriod.getMonth(), startPeriod.getDate());
    const eDate = new Date(endPeriod.getFullYear(), endPeriod.getMonth(), endPeriod.getDate());
    const diffDays = Math.round((eDate - sDate) / (1000 * 60 * 60 * 24));
    const iterations = Math.min(diffDays + 1, 31);

    for (let i = 0; i < iterations; i++) {
        const d = new Date(sDate);
        d.setDate(sDate.getDate() + i);
        const dStr = fmt(d);
        const dayApts = filteredApts.filter(a => toSPDate(a.starts_at) === dStr);
        chartData.push({
            revenue: dayApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0),
            count: dayApts.length,
            label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        });
    }
    const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

    // Top Services
    const serviceCounts = {};
    filteredApts.forEach(a => {
        const svcs = parseServices(a.service_id);
        svcs.forEach(s => { serviceCounts[s] = (serviceCounts[s] || 0) + 1; });
    });
    const topServicesData = Object.entries(serviceCounts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // Top Clients
    const clientStats = {};
    filteredApts.forEach(a => {
        const phoneKey = a.customer_phone || 'Sem Numero';
        if (!clientStats[phoneKey]) {
            clientStats[phoneKey] = { name: a.customer_name || 'Desconhecido', phone: phoneKey, visits: 0, spent: 0 };
        }
        clientStats[phoneKey].visits += 1;
        clientStats[phoneKey].spent += calcTotal(parseServices(a.service_id));
    });
    const topClients = Object.values(clientStats).sort((a, b) => b.spent - a.spent).slice(0, 5);

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2"><BarChart3 className="text-violet-600" size={24} /> Relatórios Avançados</h2>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5 ml-8 hidden sm:block">Inteligência de negócio e acompanhamento financeiro.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    {[{ label: '7 Dias', val: 7 }, { label: '15 Dias', val: 15 }].map(f => (
                        <button key={f.val} onClick={() => { setPeriod(f.val); setFilterType('period') }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterType === 'period' && period === f.val ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600'}`}>
                            {f.label}
                        </button>
                    ))}

                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 ml-2 shadow-sm">
                        <Calendar size={14} className="text-slate-400" />
                        <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })} className="text-[10px] md:text-xs font-bold bg-transparent outline-none text-slate-600" />
                        <span className="text-slate-300 font-bold">à</span>
                        <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })} className="text-[10px] md:text-xs font-bold bg-transparent outline-none text-slate-600" />
                        <button onClick={() => setFilterType('custom')} className="bg-violet-600 text-white text-[10px] font-black px-3 py-1 rounded-lg hover:bg-violet-700 transition-all uppercase tracking-widest active:scale-95 shadow-lg shadow-violet-200">OK</button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                {/* 1. Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-400/10 to-emerald-500/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Faturamento Real</p>
                            <DollarSign size={16} className="text-green-500" />
                        </div>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">R$ {totalRevenue}</p>
                        <div className="mt-2 flex items-center gap-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {growth >= 0 ? <TrendingUp size={10} /> : <TrendingUp size={10} className="rotate-180" />} {Math.abs(growth)}%
                            </span>
                            <span className="text-[9px] text-slate-400">vs período anterior</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-400/10 to-purple-500/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Atendimentos</p>
                            <Users size={16} className="text-violet-500" />
                        </div>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{totalApts}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Nos últimos {period} dias</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-400/10 to-cyan-500/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ticket Médio</p>
                            <Target size={16} className="text-blue-500" />
                        </div>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">R$ {ticketMedio}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Gasto médio por cliente</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-400/10 to-orange-500/10 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Serviços Feitos</p>
                            <Scissors size={16} className="text-amber-500" />
                        </div>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{Object.values(serviceCounts).reduce((a, b) => a + b, 0)}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Procedimentos concluídos</p>
                    </div>
                </div>

                {/* 2. Main Chart: Revenue Over Time */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2"><TrendingUp size={18} className="text-violet-600" /> Evolução do Faturamento</h3>
                        <span className="px-3 py-1 bg-violet-50 text-violet-700 text-[10px] font-bold rounded-lg border border-violet-100">Visão Histórica Dinâmica</span>
                    </div>
                    {/* Horizontal scrolling if period > 15 to fit bars nicely */}
                    <div className="overflow-x-auto scrollbar-hide">
                        <div className="flex items-end gap-1.5 min-w-full" style={{ height: '220px', paddingBottom: '20px' }}>
                            {chartData.map((day, i) => {
                                const heightPct = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                        {/* Tooltip on hover */}
                                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-lg pointer-events-none z-10 whitespace-nowrap shadow-xl">
                                            R$ {day.revenue} <span className="text-slate-400 font-normal ml-1">({day.count} agend.)</span>
                                        </div>
                                        {/* Bar */}
                                        <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden" style={{ height: '100%' }}>
                                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-violet-600 to-purple-400 transition-all duration-500 group-hover:from-violet-500 group-hover:to-purple-300"
                                                style={{ height: `${heightPct}%`, minHeight: day.revenue > 0 ? '4px' : '0' }} />
                                        </div>
                                        {/* X-axis Label */}
                                        <span className={`text-[9px] font-black text-slate-500 mt-2 absolute -bottom-6`}>
                                            {day.label.split('/')[0]}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 3. Donut Chart - Popular Services */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col">
                        <h3 className="font-extrabold text-sm text-slate-800 mb-6 flex items-center gap-2"><PieChart size={18} className="text-blue-500" /> Distribuição de Serviços</h3>
                        <div className="flex-1 flex items-center justify-center">
                            <DonutChart data={topServicesData} />
                        </div>
                    </div>

                    {/* 4. Top Clients Ranking */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2"><Crown size={18} className="text-amber-500" /> Top Clientes VIP</h3>
                            <button className="text-[10px] font-bold text-violet-600 hover:text-violet-700 bg-violet-50 px-2 py-1 rounded-lg transition-colors">Ver Todos</button>
                        </div>
                        <div className="flex-1 space-y-1">
                            {topClients.length === 0 && <p className="text-xs text-slate-400 text-center py-10">Não há dados suficientes.</p>}
                            {topClients.map((client, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-inner
                                            ${i === 0 ? 'bg-amber-100 text-amber-600 border border-amber-200' :
                                                i === 1 ? 'bg-slate-200 text-slate-600 border border-slate-300' :
                                                    i === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-500'}`}>
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800">{client.name?.split(' ')[0]} {client.name?.split(' ')[1] || ''}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">{client.visits} atendimento{client.visits > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-sm text-green-600">R$ {client.spent}</p>
                                        {client.phone !== 'Sem Numero' && (
                                            <a href={whatsappLink(client.phone)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-green-500 transition-colors mt-0.5">
                                                Lembrar <ArrowUpRight size={10} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 5. Feedback Banner */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl shadow-violet-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h4 className="font-black text-lg mb-1 flex items-center gap-2"><Award size={20} className="text-amber-300" /> Crescimento Constante</h4>
                        <p className="text-sm text-white/80 font-medium">Você faturou R$ {totalRevenue} no período selecionado. Continue acompanhando e promovendo seus serviços para aumentar ainda mais!</p>
                    </div>
                </div>

            </div >
        </div >
    )
}

// ─── Schedule Page ─────────────────────────────────────────
function SchedulePage({ isMobile, onOpenMenu, overrides, rules = [], onRefresh, isDayOpen }) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [saving, setSaving] = useState(null) // dateStr being saved
    const [showRuleModal, setShowRuleModal] = useState(false)
    const [editingRule, setEditingRule] = useState(null)

    const loadOverrides = async () => {
        await onRefresh()
    }

    const deleteRule = async (id) => {
        if (!confirm('Excluir este período especial?')) return
        await fetch(`/api/admin?id=${id}&type=rule`, { method: 'DELETE' })
        await onRefresh()
    }

    const dates = getMonthDates(currentMonth.getFullYear(), currentMonth.getMonth())
    const thisMonth = currentMonth.getMonth()

    const getOverride = (dateStr) => overrides.find(o => o.date === dateStr)

    const isDefaultOpen = (date) => ![0, 1].includes(date.getDay())

    const toggleDay = async (date) => {
        const dateStr = fmt(date)
        setSaving(dateStr)

        const override = getOverride(dateStr)
        const currentlyOpen = isDayOpen(date)

        if (override) {
            // If toggling back to default, remove the override
            const defaultState = isDefaultOpen(date)
            if (currentlyOpen !== defaultState) {
                // Currently overridden away from default — remove override to restore default
                await fetch(`/api/admin?id=${override.id}&type=schedule`, { method: 'DELETE' })
            } else {
                // Currently at default but has override — flip it
                await fetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'schedule', date: dateStr, is_open: !currentlyOpen, reason: '' })
                })
            }
        } else {
            // No override exists — create one (flip from default)
            const reason = !currentlyOpen
                ? 'Aberto por exceção'
                : 'Fechado por exceção'
            await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'schedule', date: dateStr, is_open: !currentlyOpen, reason })
            })
        }

        await loadOverrides()
        setSaving(null)
    }

    const navMonth = (dir) => {
        const d = new Date(currentMonth)
        d.setMonth(d.getMonth() + dir)
        setCurrentMonth(d)
    }

    // Count overrides this month
    const monthOverrides = overrides.filter(o => {
        const d = new Date(o.date + 'T12:00:00')
        return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()
    })

    return (
        <>
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><Clock className="text-violet-500" size={20} /> Horários</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingRule(null); setShowRuleModal(true) }} className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-violet-700 transition shadow-lg shadow-violet-200">
                        <CalendarClock size={16} /> Novo Período Especial
                    </button>
                </div>
            </header>
            <div className="flex-1 overflow-auto p-2 md:p-4 space-y-4">
                {/* Horizontal Periods List */}
                {Array.isArray(rules) && rules.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">Períodos Especiais Ativos</h3>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {rules.map(rule => (
                                <div key={rule.id} className="min-w-[280px] bg-slate-50 border border-slate-200 rounded-2xl p-4 relative group">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="bg-violet-100 text-violet-700 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider">{rule.label || 'Horário Especial'}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingRule(rule); setShowRuleModal(true) }} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-white rounded-lg transition-colors"><Edit2 size={14} /></button>
                                            <button onClick={() => deleteRule(rule.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">{new Date(rule.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                            <span className="text-lg font-black text-slate-700 leading-none mt-0.5">{rule.start_date.split('-')[2]}</span>
                                        </div>
                                        <ArrowRight size={14} className="text-slate-300" />
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">{new Date(rule.end_date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                            <span className="text-lg font-black text-slate-700 leading-none mt-0.5">{rule.end_date.split('-')[2]}</span>
                                        </div>
                                        <div className="ml-2 border-l border-slate-200 pl-4">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atendimento</div>
                                            <div className="text-sm font-black text-slate-800">{rule.open_time.substring(0, 5)} às {rule.close_time.substring(0, 5)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Legend & Month Navigation (same as before) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-green-100 border-2 border-green-400" />
                            <span className="text-[9px] md:text-xs font-semibold text-slate-600">Aberto (padrão)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-red-100 border-2 border-red-400" />
                            <span className="text-[9px] md:text-xs font-semibold text-slate-600">Fechado (padrão)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-green-100 border-2 border-amber-400 ring-2 ring-amber-200" />
                            <span className="text-[9px] md:text-xs font-semibold text-slate-600">Aberto (exceção)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-red-100 border-2 border-amber-400 ring-2 ring-amber-200" />
                            <span className="text-[9px] md:text-xs font-semibold text-slate-600">Fechado (exceção)</span>
                        </div>
                    </div>
                </div>

                {/* Month Navigation */}
                <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-1 md:p-2 shadow-sm">
                    <button onClick={() => navMonth(-1)} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 active:bg-slate-200 transition-colors"><ChevronLeft size={20} /></button>
                    <h3 className="text-sm md:text-lg font-extrabold text-slate-700 text-center">
                        {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        {monthOverrides.length > 0 && <div className="text-[10px] font-bold text-amber-500">{monthOverrides.length} exceção{monthOverrides.length > 1 ? 'ões' : ''}</div>}
                    </h3>
                    <button onClick={() => navMonth(1)} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 active:bg-slate-200 transition-colors"><ChevronRight size={20} /></button>
                </div>

                {/* Calendar Grid */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                        {DAY_NAMES.map(d => (
                            <div key={d} className="text-center py-2 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-slate-400">{d.substring(0, 3)}</div>
                        ))}
                    </div>
                    {/* Date Grid */}
                    <div className="grid grid-cols-7">
                        {dates.map((date, i) => {
                            const dateStr = fmt(date)
                            const inMonth = date.getMonth() === thisMonth
                            const open = isDayOpen(date)
                            const override = (overrides || []).find(o => o.date === dateStr)
                            const rule = (rules || []).find(r => dateStr >= r.start_date && dateStr <= r.end_date);
                            const isException = !!override
                            const isPast = date < new Date(fmt(new Date()) + 'T00:00:00')
                            const isSaving = saving === dateStr

                            return (
                                <button key={i}
                                    onClick={() => inMonth && !isPast && toggleDay(date)}
                                    disabled={!inMonth || isPast || isSaving}
                                    className={`
                                        relative py-2 md:py-4 px-1 md:px-2 border-b border-r border-slate-50 text-center transition-all
                                        ${!inMonth ? 'opacity-20 cursor-default' : isPast ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50 active:scale-95'}
                                        ${inMonth && open ? 'bg-green-50' : inMonth ? 'bg-red-50' : ''}
                                        ${isException && inMonth ? 'ring-1 md:ring-2 ring-amber-300 ring-inset' : ''}
                                        ${rule && inMonth ? 'border-2 border-violet-400' : ''}
                                    `}>
                                    <p className={`text-sm md:text-lg font-black ${inMonth ? (open ? 'text-green-700' : 'text-red-500') : 'text-slate-300'}`}>
                                        {date.getDate()}
                                    </p>
                                    <p className={`text-[7px] md:text-[10px] font-bold mt-0.5 ${open ? 'text-green-500' : 'text-red-400'}`}>
                                        {inMonth ? (open ? (rule ? rule.open_time.substring(0, 5) : 'Aberto') : 'Fechado') : ''}
                                    </p>
                                    {rule && inMonth && <span className="absolute top-0.5 left-0.5 text-[8px]">🕒</span>}
                                    {isException && inMonth && (
                                        <span className="absolute top-0.5 right-0.5 text-[8px]">⭐</span>
                                    )}
                                    {isSaving && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                                            <RefreshCw size={12} className="animate-spin text-violet-500" />
                                        </div>
                                    )}
                                    {isToday(date) && (
                                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-violet-500" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Overrides List */}
                {monthOverrides.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2">⭐ Exceções neste mês</h3>
                        <div className="space-y-2">
                            {monthOverrides.map(o => {
                                const d = new Date(o.date + 'T12:00:00')
                                return (
                                    <div key={o.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-amber-50 border border-amber-100">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-3 h-3 rounded-full ${o.is_open ? 'bg-green-400' : 'bg-red-400'}`} />
                                            <span className="text-sm font-bold text-slate-700">
                                                {d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${o.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                {o.is_open ? 'ABERTO' : 'FECHADO'}
                                            </span>
                                            {o.reason && <span className="text-xs text-slate-400 italic">{o.reason}</span>}
                                        </div>
                                        <button onClick={() => toggleDay(d)} className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
                                            Remover
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-violet-700 font-medium">
                        💡 Periodos Especiais sobressaem ao horário padrão. Exceções diárias (estrelas) sobressaem a tudo.
                    </p>
                </div>
            </div>
            {showRuleModal && <ScheduleRuleModal rule={editingRule} onClose={() => setShowRuleModal(false)} onSave={() => { setShowRuleModal(false); onRefresh() }} />}
        </>
    )
}
