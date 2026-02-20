'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Plus, X, ChevronLeft, ChevronRight, Phone, CheckCircle2, XCircle, RefreshCw, LayoutGrid, Users, Scissors, AlertTriangle, CalendarClock, MoreVertical, Search, Edit2, Trash2, DollarSign, Save, Lock, BarChart3, TrendingUp, FileText, Ban, Download, Eye, EyeOff, ExternalLink, History } from 'lucide-react'

const whatsappLink = (phone) => `https://wa.me/${phone.replace(/\D/g, '')}`

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
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function isToday(date) { return fmt(date) === fmt(new Date()) }

function parseServices(s) {
    if (!s) return []
    try { const arr = JSON.parse(s); return Array.isArray(arr) ? arr : [s] } catch { return [s] }
}
function calcTotal(svcs) { return svcs.reduce((sum, id) => sum + (SERVICES.find(s => s.id === id)?.price || 0), 0) }
function calcDuration(svcs) { return svcs.reduce((sum, id) => sum + (SERVICES.find(s => s.id === id)?.duration || 60), 0) }

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
export default function AdminDashboard() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(fmt(new Date()))
    const [appointments, setAppointments] = useState([])
    const [blocks, setBlocks] = useState([])
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
        try {
            const [aptRes, blkRes] = await Promise.all([
                fetch(`/api/admin?start=${fmt(s)}&end=${fmt(e)}`),
                fetch(`/api/admin?type=blocks&start=${fmt(s)}&end=${fmt(e)}`)
            ])
            const aptData = await aptRes.json()
            const blkData = await blkRes.json()
            const apts = Array.isArray(aptData) ? aptData : []
            setAppointments(apts)
            setBlocks(Array.isArray(blkData) ? blkData : [])
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
    const goToday = () => { setCurrentDate(new Date()); setSelectedDate(fmt(new Date())) }

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
        await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, starts_at: startsAt, ends_at: endsAt }) })
        closeAction()
        setRefreshKey(k => k + 1)
    }

    const confirmed = appointments.filter(a => a.status === 'CONFIRMED')
    const allDayApts = appointments.filter(a => toSPDate(a.starts_at) === selectedDate).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    const filteredDayApts = allDayApts.filter(a => {
        if (!showCancelled && a.status === 'CANCELLED') return false
        if (searchQuery && !a.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })
    const dayApts = confirmed.filter(a => toSPDate(a.starts_at) === selectedDate).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    const dayBlocks = blocks.filter(b => toSPDate(b.starts_at) === selectedDate)
    const getCount = (d) => confirmed.filter(a => toSPDate(a.starts_at) === d).length
    const dayRevenue = dayApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0)

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
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-white/10 transition mobile-hide"><LayoutGrid size={20} /></button>
                        {(sidebarOpen || isMobile) && <span className="font-extrabold text-lg tracking-tight">Espaço C.A.</span>}
                    </div>
                    {isMobile && <button onClick={() => setSidebarOpen(false)} className="p-1 text-white/50 hover:text-white"><X size={20} /></button>}
                </div>
                <nav className="flex-1 py-3 space-y-0.5 px-2">
                    {[{ id: 'agenda', icon: Calendar, label: 'Agenda' }, { id: 'horarios', icon: Clock, label: 'Horários' }, { id: 'clientes', icon: Users, label: 'Clientes' }, { id: 'servicos', icon: Scissors, label: 'Serviços' }, { id: 'relatorios', icon: BarChart3, label: 'Relatórios' }].map(item => (
                        <button key={item.id} onClick={() => { setActivePage(item.id); setNewBadge(0); if (isMobile) setSidebarOpen(false) }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activePage === item.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                            <item.icon size={18} />{(sidebarOpen || isMobile) && item.label}
                            {item.id === 'agenda' && newBadge > 0 && (sidebarOpen || isMobile) && <span className="ml-auto bg-green-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">+{newBadge}</span>}
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
                            {viewMode === 'month' && <MonthView currentDate={currentDate} selectedDate={selectedDate} setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }} getCount={getCount} isMobile={isMobile} />}
                            {viewMode === 'week' && <WeekView weekDates={weekDates} setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }} getCount={getCount} appointments={confirmed} isMobile={isMobile} />}
                            {viewMode === 'day' && <DayView selectedDate={selectedDate} appointments={filteredDayApts} blocks={dayBlocks} onAction={openAction} dayRevenue={dayRevenue} onDeleteBlock={async (id) => { await fetch(`/api/admin?id=${id}&type=block`, { method: 'DELETE' }); setRefreshKey(k => k + 1) }} isMobile={isMobile} />}
                        </div>
                    </>
                )}
                {activePage === 'clientes' && <ClientsPage />}
                {activePage === 'servicos' && <ServicesPage />}
                {activePage === 'relatorios' && <ReportsPage appointments={confirmed} />}
                {activePage === 'horarios' && <SchedulePage />}
            </main>

            {/* Modals */}
            {showNewModal && <NewAppointmentModal selectedDate={selectedDate} onClose={() => setShowNewModal(false)} onSave={() => { setShowNewModal(false); setRefreshKey(k => k + 1) }} />}
            {showBlockModal && <BlockModal selectedDate={selectedDate} onClose={() => setShowBlockModal(false)} onSave={() => { setShowBlockModal(false); setRefreshKey(k => k + 1) }} />}
            {actionApt && actionType === 'view' && <AppointmentDetailModal apt={actionApt} onClose={closeAction} onCancel={() => setActionType('cancel')} onReschedule={() => setActionType('reschedule')} onSaveNotes={async (id, notes) => { await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, notes }) }); setRefreshKey(k => k + 1) }} />}
            {actionApt && actionType === 'cancel' && <CancelConfirmModal apt={actionApt} onClose={closeAction} onConfirm={() => doCancelAppointment(actionApt.id)} />}
            {actionApt && actionType === 'reschedule' && <RescheduleModal apt={actionApt} onClose={closeAction} onConfirm={doReschedule} />}
        </div >
    )
}

// ─── Month View ────────────────────────────────────────────
function MonthView({ currentDate, selectedDate, setSelectedDate, getCount, isMobile }) {
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
                    const isClosed = date.getDay() === 0 || date.getDay() === 1
                    const count = getCount(dateStr)
                    return (
                        <button key={i} onClick={() => !isClosed && isThisMonth && setSelectedDate(dateStr)} disabled={isClosed || !isThisMonth}
                            className={`relative h-16 md:h-24 p-1 md:p-2 border-b border-r border-slate-50 text-left transition-all ${!isThisMonth ? 'opacity-30' : isClosed ? 'bg-slate-50 opacity-40 cursor-not-allowed' : 'hover:bg-violet-50 cursor-pointer'}`}>
                            <span className={`text-[10px] md:text-sm font-bold ${isToday(date) ? 'bg-violet-600 text-white w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center today-pulse' : 'text-slate-700'}`}>{date.getDate()}</span>
                            {count > 0 && <div className="mt-0.5 md:mt-1"><span className="bg-violet-100 text-violet-700 text-[8px] md:text-[10px] font-bold px-1 md:px-1.5 py-0.5 rounded">{count}{!isMobile && ' agend.'}</span></div>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Week View ─────────────────────────────────────────────
function WeekView({ weekDates, setSelectedDate, getCount, appointments, isMobile }) {
    if (isMobile) {
        return (
            <div className="space-y-3">
                {weekDates.map((date, i) => {
                    const dateStr = fmt(date)
                    const isClosed = date.getDay() === 0 || date.getDay() === 1
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
                    const isClosed = date.getDay() === 0 || date.getDay() === 1
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
                    const dayApts = appointments.filter(a => toSPDate(a.starts_at) === dateStr)
                    return (
                        <div key={dayIdx} className={`border-r border-slate-100 last:border-r-0 min-h-[200px] p-1.5 ${isClosed ? 'bg-slate-50/50' : ''}`}>
                            {dayApts.slice(0, 5).map(apt => {
                                const svcs = parseServices(apt.service_id)
                                return (
                                    <div key={apt.id} onClick={() => setSelectedDate(dateStr)} className="mb-1 px-2 py-1.5 bg-violet-100 rounded-lg cursor-pointer hover:bg-violet-200 transition-colors" style={{ borderLeft: '3px solid rgb(139 92 246)' }}>
                                        <p className="text-[10px] font-bold text-violet-700">{toSPTime(apt.starts_at)}</p>
                                        <p className="text-[10px] font-semibold text-slate-700 truncate">{apt.customer_name}</p>
                                        <p className="text-[9px] text-slate-500 truncate">{svcs.join(', ')}</p>
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
function DayView({ selectedDate, appointments, blocks = [], onAction, dayRevenue, onDeleteBlock, isMobile }) {
    const SLOT_HEIGHT = 48
    const GRID_START = 7 * 60 // 07:00 in minutes

    const confirmedApts = appointments.filter(a => a.status === 'CONFIRMED')

    // Calculate which slots are occupied (only confirmed)
    const occupiedSlots = new Set()
    confirmedApts.forEach(apt => {
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

    const getStatusStyle = (status) => {
        switch (status) {
            case 'CONFIRMED': return 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
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
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> {confirmedApts.length} confirmado{confirmedApts.length !== 1 ? 's' : ''}
                    </span>
                    {blocks.length > 0 && <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
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
                    return (
                        <div key={idx} className="absolute w-full flex" style={{ top: `${idx * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}>
                            <div className="w-16 shrink-0 flex items-start justify-end pr-3 pt-1">
                                {isHour && <span className="text-[11px] font-bold text-slate-400">{slot}</span>}
                            </div>
                            <div className={`flex-1 border-l border-slate-100 ${isHour ? 'border-t border-t-slate-200' : 'border-t border-t-slate-50'} ${isBlocked ? 'bg-slate-100' : isOccupied ? 'bg-violet-50/50' : ''}`} />
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

                    return (
                        <div key={apt.id}
                            onClick={() => !isCancelled && onAction(apt, 'view')}
                            className={`absolute ${getStatusStyle(apt.status)} rounded-xl px-3 py-2 shadow-md hover:shadow-lg transition-all ${isCancelled ? 'cursor-default' : 'cursor-pointer'} group z-10 overflow-hidden`}
                            style={{ top: `${topPx + 2}px`, height: `${heightPx}px`, left: '68px', right: '8px' }}>
                            <div className="flex items-start justify-between h-full">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={`font-bold text-sm ${isCancelled ? 'line-through' : ''}`}>{apt.customer_name}</p>
                                        {isCancelled && <span className="bg-white/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full">CANCELADO</span>}
                                        {apt.notes && <FileText size={12} className="text-white/70" title={apt.notes} />}
                                    </div>
                                    <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                                        <Phone size={10} />
                                        <a href={whatsappLink(apt.customer_phone)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="hover:underline">{apt.customer_phone}</a>
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {svcs.map((s, i) => <span key={i} className="bg-white/20 text-[10px] font-semibold px-2 py-0.5 rounded-full">{s}</span>)}
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
function AppointmentDetailModal({ apt, onClose, onCancel, onReschedule, onSaveNotes }) {
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
                            <p className="text-sm text-slate-500 flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                                <span className="flex items-center justify-center md:justify-start gap-1"><Phone size={12} /> {apt.customer_phone}</span>
                                <a href={whatsappLink(apt.customer_phone)} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full hover:bg-green-100 transition-colors">Conversar no WhatsApp <ExternalLink size={9} /></a>
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horário</span>
                            <span className="text-sm font-bold text-slate-800">{toSPTime(apt.starts_at)} ({dur}min)</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Serviços</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                                {svcs.map((s, i) => <span key={i} className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{s}</span>)}
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
                            <p className="text-sm text-slate-500">{svcs.join(' + ')}</p>
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
function RescheduleModal({ apt, onClose, onConfirm }) {
    const svcs = parseServices(apt.service_id)
    const total = calcTotal(svcs)
    const dur = calcDuration(svcs)

    const [newDate, setNewDate] = useState(toSPDate(apt.starts_at))
    const [newTime, setNewTime] = useState(toSPTime(apt.starts_at))
    const [step, setStep] = useState('select') // 'select' or 'confirm'
    const [saving, setSaving] = useState(false)

    const handleConfirm = async () => {
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
                            <p className="text-sm text-slate-500">{svcs.join(' + ')} — R$ {total}</p>

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
                        <p className="text-sm text-slate-500">{svcs.join(' + ')} — R$ {total}</p>
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
function NewAppointmentModal({ selectedDate, onClose, onSave }) {
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
                            {SERVICES.map(s => {
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
function ClientsPage() {
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
                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><Users className="text-violet-500" size={20} /> Clientes</h2>
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
                                            <p className="text-xs text-slate-500 mt-0.5">{svcs.join(' + ')}</p>
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

// ─── Services Page ─────────────────────────────────────────
function ServicesPage() {
    const loadServices = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('services_overrides') || '{}')
            return SERVICES.map(s => ({
                ...s,
                price: saved[s.id]?.price ?? s.price,
                duration: saved[s.id]?.duration ?? s.duration
            }))
        } catch { return SERVICES.map(s => ({ ...s })) }
    }

    const [services, setServices] = useState(loadServices)
    const [editing, setEditing] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [saved, setSaved] = useState(false)

    const startEdit = (svc) => {
        setEditing(svc.id)
        setEditForm({ price: svc.price, duration: svc.duration })
    }

    const saveEdit = (id) => {
        const updated = services.map(s =>
            s.id === id ? { ...s, price: Number(editForm.price), duration: Number(editForm.duration) } : s
        )
        setServices(updated)
        // Save to localStorage
        const overrides = {}
        updated.forEach(s => {
            const original = SERVICES.find(o => o.id === s.id)
            if (s.price !== original.price || s.duration !== original.duration) {
                overrides[s.id] = { price: s.price, duration: s.duration }
            }
        })
        localStorage.setItem('services_overrides', JSON.stringify(overrides))
        setEditing(null)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const resetAll = () => {
        localStorage.removeItem('services_overrides')
        setServices(SERVICES.map(s => ({ ...s })))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const hasOverrides = services.some((s, i) => s.price !== SERVICES[i].price || s.duration !== SERVICES[i].duration)

    const categories = [
        { name: 'Unhas de Gel', emoji: '💎', ids: ['Fibra ou Molde F1', 'Banho de Gel', 'Manutenção', 'Manutenção (outra prof.)', 'Remoção'] },
        { name: 'Esmaltação em Gel', emoji: '💅', ids: ['Esmaltação Básica', 'Esmaltação Premium', 'Esm. ou Pó + Francesinha', 'Esm. + Francesinha + Pó'] },
    ]

    return (
        <>
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><Scissors className="text-violet-500" size={20} /> Serviços</h2>
                <div className="flex items-center gap-3">
                    {saved && <span className="text-xs font-bold text-green-600 animate-pulse">✅ Salvo!</span>}
                    {hasOverrides && (
                        <button onClick={resetAll} className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                            Resetar Padrão
                        </button>
                    )}
                    <span className="text-xs text-slate-400 font-medium">{services.length} serviços</span>
                </div>
            </header>
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {categories.map(cat => (
                    <div key={cat.name} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                                <span className="text-lg">{cat.emoji}</span> {cat.name}
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {services.filter(s => cat.ids.includes(s.id)).map(svc => {
                                const original = SERVICES.find(o => o.id === svc.id)
                                const isModified = svc.price !== original.price || svc.duration !== original.duration
                                return (
                                    <div key={svc.id} className={`flex flex-col md:flex-row md:items-center justify-between px-4 md:px-5 py-3 md:py-3 hover:bg-violet-50/30 transition-colors ${isModified ? 'bg-amber-50/30' : ''}`}>
                                        <div className="flex-1 flex items-center gap-2 mb-2 md:mb-0">
                                            <p className="font-semibold text-sm text-slate-800">{svc.name}</p>
                                            {isModified && <span className="text-[9px] font-bold text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded-full">editado</span>}
                                        </div>
                                        {editing === svc.id ? (
                                            <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                                <div className="flex items-center gap-1 bg-violet-50 md:bg-transparent p-1 px-2 rounded-lg md:p-0">
                                                    <span className="text-xs text-slate-400 font-bold">R$</span>
                                                    <input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                                                        className="w-16 md:w-20 px-2 py-1 md:py-1.5 rounded-lg border border-violet-300 text-sm font-bold text-center focus:ring-2 focus:ring-violet-100 outline-none" />
                                                </div>
                                                <div className="flex items-center gap-1 bg-violet-50 md:bg-transparent p-1 px-2 rounded-lg md:p-0">
                                                    <Clock size={12} className="text-slate-400" />
                                                    <input type="number" value={editForm.duration} onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                                                        className="w-14 md:w-16 px-2 py-1 md:py-1.5 rounded-lg border border-violet-300 text-sm font-medium text-center focus:ring-2 focus:ring-violet-100 outline-none" />
                                                    <span className="text-xs text-slate-400">min</span>
                                                </div>
                                                <div className="flex items-center gap-2 ml-auto md:ml-0">
                                                    <button onClick={() => saveEdit(svc.id)}
                                                        className="p-1.5 md:p-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors" title="Salvar">
                                                        <Save size={14} />
                                                    </button>
                                                    <button onClick={() => setEditing(null)}
                                                        className="p-1.5 md:p-2 rounded-lg bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors" title="Cancelar">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between md:justify-end gap-4">
                                                <div className="text-left md:text-right">
                                                    <p className="text-sm font-bold text-violet-600">R$ {svc.price}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 md:justify-end"><Clock size={10} /> {svc.duration}min</p>
                                                </div>
                                                <button onClick={() => startEdit(svc)}
                                                    className="p-2 md:p-1.5 rounded-lg bg-slate-50 md:bg-transparent border border-slate-100 md:border-0 hover:bg-slate-100 text-slate-400 hover:text-violet-600 transition-colors" title="Editar">
                                                    <Edit2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-green-700 font-medium">
                        💾 As alterações de preço e duração são salvas automaticamente e persistem entre sessões.
                    </p>
                </div>
            </div>
        </>
    )
}

// ─── Block Modal ───────────────────────────────────────────
function BlockModal({ selectedDate, onClose, onSave }) {
    const [form, setForm] = useState({ title: '', date: selectedDate, startTime: '12:00', endTime: '13:00' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true); setError('')
        const startsAt = toISO_SP(form.date, form.startTime)
        const endsAt = toISO_SP(form.date, form.endTime)

        if (new Date(endsAt) <= new Date(startsAt)) {
            setError('Horário final deve ser depois do inicial.')
            setSaving(false)
            return
        }

        try {
            const res = await fetch('/api/admin', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'block', title: form.title || 'Bloqueado', starts_at: startsAt, ends_at: endsAt })
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Data</label>
                        <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none text-sm font-medium" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <button type="submit" disabled={saving}
                        className="w-full py-3 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-200 active:scale-[0.99]">
                        {saving ? 'Bloqueando...' : 'Confirmar Bloqueio'}
                    </button>
                </form>
            </div>
        </div>
    )
}

// ─── Reports Page ──────────────────────────────────────────
function ReportsPage({ appointments }) {
    const today = new Date()
    const todayStr = fmt(today)

    // Last 7 days data
    const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (6 - i))
        const dateStr = fmt(d)
        const dayApts = appointments.filter(a => toSPDate(a.starts_at) === dateStr)
        const revenue = dayApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0)
        const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })
        return { date: dateStr, count: dayApts.length, revenue, label }
    })

    const maxRevenue = Math.max(...last7.map(d => d.revenue), 1)

    // This month stats
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const monthApts = appointments.filter(a => a.starts_at.startsWith(monthStr))
    const monthRevenue = monthApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0)
    const ticketMedio = monthApts.length > 0 ? (monthRevenue / monthApts.length).toFixed(0) : 0

    // Top services
    const serviceCounts = {}
    appointments.forEach(a => {
        const svcs = parseServices(a.service_id)
        svcs.forEach(s => { serviceCounts[s] = (serviceCounts[s] || 0) + 1 })
    })
    const topServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const maxServiceCount = topServices.length > 0 ? topServices[0][1] : 1

    // Last 4 weeks
    const last4Weeks = Array.from({ length: 4 }, (_, i) => {
        const weekEnd = new Date(today)
        weekEnd.setDate(weekEnd.getDate() - i * 7)
        const weekStart = new Date(weekEnd)
        weekStart.setDate(weekStart.getDate() - 6)
        const weekApts = appointments.filter(a => {
            const d = toSPDate(a.starts_at)
            return d >= fmt(weekStart) && d <= fmt(weekEnd)
        })
        const revenue = weekApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id)), 0)
        return {
            label: `${weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — ${weekEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`,
            count: weekApts.length,
            revenue
        }
    }).reverse()

    return (
        <>
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><BarChart3 className="text-violet-500" size={20} /> Relatórios</h2>
                <button onClick={() => {
                    const rows = [['Data', 'Cliente', 'Telefone', 'Serviço', 'Status', 'Valor']]
                    appointments.forEach(a => {
                        const svcs = parseServices(a.service_id)
                        const total = calcTotal(svcs)
                        rows.push([toSPDate(a.starts_at), a.customer_name, a.customer_phone, svcs.join(' + '), a.status, total])
                    })
                    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `relatorio_${fmt(new Date())}.csv`; a.click()
                    URL.revokeObjectURL(url)
                }} className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition active:scale-95">
                    <Download size={14} /> Exportar CSV
                </button>
            </header>
            <div className="flex-1 overflow-auto p-2 md:p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Faturamento Mensal</p>
                        <p className="text-2xl font-black text-green-600">R$ {monthRevenue}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{monthApts.length} agendamentos</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ticket Médio</p>
                        <p className="text-2xl font-black text-blue-600">R$ {ticketMedio}</p>
                        <p className="text-[10px] text-slate-400 mt-1">por atendimento</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Agend. Hoje</p>
                        <p className="text-2xl font-black text-violet-600">{appointments.filter(a => toSPDate(a.starts_at) === todayStr).length}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                    </div>
                </div>

                {/* Chart: Last 7 Days Revenue */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-green-500" /> Faturamento — Últimos 7 dias</h3>
                    <div className="flex items-end gap-2" style={{ height: '180px' }}>
                        {last7.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                                <p className="text-[10px] font-bold text-green-600 mb-1">
                                    {day.revenue > 0 ? `R$${day.revenue}` : ''}
                                </p>
                                <div className="w-full bg-gradient-to-t from-violet-500 to-purple-400 rounded-t-lg transition-all hover:from-violet-600 hover:to-purple-500"
                                    style={{ height: `${(day.revenue / maxRevenue) * 140}px`, minHeight: day.revenue > 0 ? '8px' : '2px' }}
                                    title={`${day.label}: R$ ${day.revenue} (${day.count} agend.)`} />
                                <p className="text-[10px] font-bold text-slate-400 mt-2">{day.label}</p>
                                <p className="text-[9px] text-slate-300">{day.count} agend.</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Top Services */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2"><Scissors size={16} className="text-violet-500" /> Serviços Mais Populares</h3>
                        <div className="space-y-3">
                            {topServices.map(([name, count], i) => (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-slate-700 truncate mr-2">{name}</span>
                                        <span className="text-xs font-bold text-violet-600 shrink-0">{count}x</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all"
                                            style={{ width: `${(count / maxServiceCount) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                            {topServices.length === 0 && <p className="text-xs text-slate-400">Nenhum dado disponível</p>}
                        </div>
                    </div>

                    {/* Weekly Breakdown */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2"><Calendar size={16} className="text-blue-500" /> Resumo Semanal</h3>
                        <div className="space-y-2">
                            {last4Weeks.map((week, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                    <span className="text-xs font-medium text-slate-600">{week.label}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-lg">{week.count} agend.</span>
                                        <span className="text-xs font-bold text-green-600 w-16 text-right">R$ {week.revenue}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

// ─── Schedule Page ─────────────────────────────────────────
function SchedulePage() {
    const [overrides, setOverrides] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [saving, setSaving] = useState(null) // dateStr being saved

    const DEFAULT_CLOSED = [0, 1] // Sunday, Monday

    const loadOverrides = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin?type=schedule')
            const data = await res.json()
            setOverrides(Array.isArray(data) ? data : [])
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    useEffect(() => { loadOverrides() }, [])

    const dates = getMonthDates(currentMonth.getFullYear(), currentMonth.getMonth())
    const thisMonth = currentMonth.getMonth()

    const isDefaultOpen = (date) => !DEFAULT_CLOSED.includes(date.getDay())

    const getOverride = (dateStr) => overrides.find(o => o.date === dateStr)

    const isDayOpen = (date) => {
        const dateStr = fmt(date)
        const override = getOverride(dateStr)
        if (override) return override.is_open
        return isDefaultOpen(date)
    }

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
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><Clock className="text-violet-500" size={20} /> Horários</h2>
                <span className="text-[10px] md:text-xs text-slate-400 font-medium whitespace-nowrap">Clique no dia para alternar aberto/fechado</span>
            </header>
            <div className="flex-1 overflow-auto p-2 md:p-4 space-y-4">
                {/* Legend */}
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
                            const override = getOverride(dateStr)
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
                                    `}>
                                    <p className={`text-sm md:text-lg font-black ${inMonth ? (open ? 'text-green-700' : 'text-red-500') : 'text-slate-300'}`}>
                                        {date.getDate()}
                                    </p>
                                    <p className={`text-[7px] md:text-[10px] font-bold mt-0.5 ${open ? 'text-green-500' : 'text-red-400'}`}>
                                        {inMonth ? (open ? 'Aberto' : 'Fechado') : ''}
                                    </p>
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
                        💡 As mudanças feitas aqui são aplicadas instantaneamente. O bot já saberá quais dias estão abertos ou fechados.
                    </p>
                </div>
            </div>
        </>
    )
}
