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

const PROFESSIONALS = [
    { id: 'camille', name: 'Camille Almeida', role: 'Especialista', color: 'border-violet-500', initial: 'C' },
    { id: 'clara', name: 'Clara Nails', role: 'Manicure', color: 'border-pink-500', initial: 'L' },
    { id: 'juliana', name: 'Juliana', role: 'Estética', color: 'border-blue-500', initial: 'J' },
]

const TIME_SLOTS = []
for (let h = 8; h <= 19; h++) {
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
    const [overrides, setOverrides] = useState([])
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
            const [aptRes, blkRes, schRes] = await Promise.all([
                fetch(`/api/admin?start=${fmt(s)}&end=${fmt(e)}`),
                fetch(`/api/admin?type=blocks&start=${fmt(s)}&end=${fmt(e)}`),
                fetch(`/api/admin?type=schedule`)
            ])
            const aptData = await aptRes.json()
            const blkData = await blkRes.json()
            const schData = await schRes.json()
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

    const isDayOpen = (date) => {
        const dateStr = fmt(date)
        const override = overrides.find(o => o.date === dateStr)
        if (override) return override.is_open
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
        <div className="min-h-screen bg-transparent flex overflow-hidden">
            {/* Sidebar Overlay (Mobile) */}
            {isMobile && sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`${isMobile ? 'sidebar-drawer' : sidebarOpen ? 'w-64' : 'w-20'} ${isMobile && sidebarOpen ? 'open' : ''} glass border-r border-white/5 backdrop-blur-3xl transition-all duration-500 flex flex-col shrink-0 h-full relative z-40`}>
                <div className="p-6 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-400 rotate-12 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Scissors className="text-white -rotate-12" size={16} />
                        </div>
                        {(sidebarOpen || isMobile) && <span className="font-black text-xl tracking-tight text-white">AGENDAÍ<span className="text-brand-violet">.</span></span>}
                    </div>
                    {isMobile && <button onClick={() => setSidebarOpen(false)} className="p-1 text-white/50 hover:text-white transition-colors"><X size={20} /></button>}
                </div>

                <nav className="flex-1 py-6 space-y-1 px-3">
                    {[{ id: 'agenda', icon: Calendar, label: 'Agenda' }, { id: 'horarios', icon: Clock, label: 'Horários' }, { id: 'clientes', icon: Users, label: 'Clientes' }, { id: 'servicos', icon: Scissors, label: 'Serviços' }, { id: 'relatorios', icon: BarChart3, label: 'Relatórios' }].map(item => (
                        <button key={item.id} onClick={() => { setActivePage(item.id); setNewBadge(0); if (isMobile) setSidebarOpen(false) }}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all group ${activePage === item.id ? 'bg-white/10 text-white shadow-xl shadow-black/20 border border-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                            <item.icon size={18} className={`${activePage === item.id ? 'text-brand-violet' : 'group-hover:text-white'} transition-colors`} />
                            {(sidebarOpen || isMobile) && item.label}
                            {item.id === 'agenda' && newBadge > 0 && (sidebarOpen || isMobile) && <span className="ml-auto bg-violet-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg">NEW</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 mt-auto space-y-4">
                    <div className="glass-dark rounded-2xl p-4 border border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </div>
                            <span className="text-[10px] font-black uppercase text-slate-400">Bot Ativo</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">Clara está gerenciando as conversas.</p>
                    </div>

                    <button onClick={toggleDarkMode} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-bold text-slate-500 hover:bg-white/5 hover:text-white transition-all">
                        <RefreshCw size={14} className={darkMode ? 'rotate-180 transition-transform duration-500' : 'transition-transform duration-500'} />
                        {(sidebarOpen || isMobile) && (darkMode ? 'MODO CLARO' : 'MODO ESCURO')}
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {activePage === 'agenda' && (
                    <>
                        {/* Header */}
                        <header className="glass-dark border-b border-white/5 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-30">
                            <div className="flex items-center gap-4 overflow-hidden">
                                {isMobile && (
                                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-white/60 hover:text-white">
                                        <LayoutGrid size={20} />
                                    </button>
                                )}
                                <div className="flex glass-dark rounded-2xl p-1 shrink-0 border border-white/10">
                                    {['dia', 'semana', 'mês'].map((v, i) => {
                                        const mode = ['day', 'week', 'month'][i]
                                        return (
                                            <button key={mode} onClick={() => setViewMode(mode)}
                                                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${viewMode === mode ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-500 hover:text-white'}`}>
                                                {v}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => nav(-1)} className="p-2 rounded-xl hover:bg-white/5 text-slate-400 transition-colors"><ChevronLeft size={20} /></button>
                                    <button onClick={goToday} className="px-4 py-2 rounded-xl bg-white/5 text-white text-[11px] font-black uppercase tracking-widest hover:bg-white/10 border border-white/10 transition-all">Hoje</button>
                                    <button onClick={() => nav(1)} className="p-2 rounded-xl hover:bg-white/5 text-slate-400 transition-colors"><ChevronRight size={20} /></button>
                                </div>
                                <span className="text-sm font-black text-white ml-2 truncate capitalize tracking-tight hidden lg:block">{headerLabel}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={() => setRefreshKey(k => k + 1)} className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 transition-all active:rotate-180 hidden sm:block"><RefreshCw size={18} className={loading ? 'animate-spin text-brand-violet' : ''} /></button>
                                {viewMode === 'day' && (
                                    <div className="relative hidden xl:block">
                                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input type="text" placeholder="Pesquisar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                            className="pl-10 pr-4 py-2 rounded-xl glass-dark border border-white/10 text-xs w-48 focus:border-brand-violet outline-none text-white transition-all font-medium" />
                                    </div>
                                )}
                                <button onClick={() => setShowNewModal(true)}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] shadow-xl shadow-violet-600/20 transition-all active:scale-[0.98] shrink-0">
                                    <Plus size={18} /> Novo
                                </button>
                            </div>
                        </header>

                        {/* Summary Cards */}
                        {viewMode === 'day' && (
                            <div className="px-6 pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="glass-dark rounded-[30px] border border-white/5 p-5 flex flex-col gap-4 group hover:bg-white/[0.04] transition-all cursor-default">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-2xl bg-violet-600/10 flex items-center justify-center border border-violet-600/20"><Calendar className="text-violet-500" size={18} /></div>
                                        <span className="text-[10px] font-black text-violet-500 bg-violet-500/10 px-2 py-1 rounded-lg uppercase tracking-wider">Confirmed</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Agendamentos Hoje</p>
                                        <p className="text-3xl font-black text-white tracking-tight">{dayApts.length}</p>
                                    </div>
                                </div>
                                <div className="glass-dark rounded-[30px] border border-white/5 p-5 flex flex-col gap-4 group hover:bg-white/[0.04] transition-all cursor-default">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-2xl bg-green-600/10 flex items-center justify-center border border-green-600/20"><DollarSign className="text-green-500" size={18} /></div>
                                        <span className="text-[10px] font-black text-green-500 bg-green-500/10 px-2 py-1 rounded-lg uppercase tracking-wider">Revenue</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Faturamento Estimado</p>
                                        <p className="text-3xl font-black text-green-400 tracking-tight">R$ {dayRevenue}</p>
                                    </div>
                                </div>
                                <div className="glass-dark rounded-[30px] border border-white/5 p-5 flex flex-col gap-4 group hover:bg-white/[0.04] transition-all cursor-default hidden md:flex">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20"><TrendingUp className="text-blue-500" size={18} /></div>
                                        <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg uppercase tracking-wider">Monthly</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total do Mês</p>
                                        <p className="text-3xl font-black text-white tracking-tight">{monthApts.length}</p>
                                    </div>
                                </div>
                                <div className="glass-dark rounded-[30px] border border-white/5 p-5 flex flex-col gap-4 group hover:bg-white/[0.04] transition-all cursor-default hidden md:flex">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-2xl bg-brand-violet/10 flex items-center justify-center border border-brand-violet/20"><FileText className="text-brand-violet" size={18} /></div>
                                        <span className="text-[10px] font-black text-brand-violet bg-brand-violet/10 px-2 py-1 rounded-lg uppercase tracking-wider">Projection</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Proj. Mensal</p>
                                        <p className="text-2xl font-black text-brand-violet tracking-tight truncate">R$ {monthRevenue}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto p-2 md:p-4">
                            {viewMode === 'month' && <MonthView currentDate={currentDate} selectedDate={selectedDate} setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }} getCount={getCount} isMobile={isMobile} isDayOpen={isDayOpen} />}
                            {viewMode === 'week' && <WeekView weekDates={weekDates} setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }} getCount={getCount} appointments={confirmed} isMobile={isMobile} isDayOpen={isDayOpen} />}
                            {viewMode === 'day' && <DayView selectedDate={selectedDate} appointments={filteredDayApts} blocks={dayBlocks} onAction={openAction} dayRevenue={dayRevenue} onDeleteBlock={async (id) => { await fetch(`/api/admin?id=${id}&type=block`, { method: 'DELETE' }); setRefreshKey(k => k + 1) }} isMobile={isMobile} />}
                        </div>
                    </>
                )}
                {activePage === 'clientes' && <ClientsPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} />}
                {activePage === 'servicos' && <ServicesPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} />}
                {activePage === 'relatorios' && <ReportsPage appointments={confirmed} isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} />}
                {activePage === 'horarios' && <SchedulePage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} overrides={overrides} onRefresh={fetchAppointments} isDayOpen={isDayOpen} />}
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
                            {count > 0 && <div className="mt-0.5 md:mt-1"><span className="bg-violet-100 text-violet-700 text-[8px] md:text-[10px] font-bold px-1 md:px-1.5 py-0.5 rounded">{count}{!isMobile && ' agend.'}</span></div>}
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
    const SLOT_HEIGHT = 64
    const GRID_START = 8 * 60 // 08:00 in minutes

    const confirmedApts = appointments.filter(a => a.status === 'CONFIRMED')

    const getAptsForProfessional = (profId, allApts) => {
        return allApts.filter((apt, idx) => {
            const assignedId = apt.professional_id || PROFESSIONALS[idx % PROFESSIONALS.length].id
            return assignedId === profId
        })
    }

    return (
        <div className="glass rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
            {/* Header com Profissionais */}
            <div className="flex border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-30">
                <div className="w-20 shrink-0 border-r border-white/10 flex items-center justify-center p-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Horário</span>
                </div>
                {PROFESSIONALS.map(prof => (
                    <div key={prof.id} className="flex-1 min-w-[200px] p-4 border-r border-white/10 last:border-r-0">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl border-2 ${prof.color} bg-slate-900 flex items-center justify-center font-bold text-sm shadow-lg text-white`}>
                                {prof.initial}
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-bold text-sm text-white truncate">{prof.name}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{prof.role}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Grid de Horários e Agendamentos */}
            <div className="relative flex overflow-auto max-h-[700px]">
                {/* Coluna de Horas */}
                <div className="w-20 shrink-0 border-r border-white/10 sticky left-0 z-20 bg-slate-950">
                    {TIME_SLOTS.map((slot, idx) => (
                        <div key={idx} className="h-16 border-b border-white/[0.03] flex items-center justify-center text-[11px] font-bold text-slate-500 bg-black/20">
                            {slot}
                        </div>
                    ))}
                </div>

                {/* Colunas dos Profissionais */}
                {PROFESSIONALS.map(prof => {
                    const profApts = getAptsForProfessional(prof.id, confirmedApts)
                    const profBlocks = blocks.filter(b => b.professional_id === prof.id || !b.professional_id)

                    return (
                        <div key={prof.id} className="flex-1 min-w-[200px] border-r border-white/[0.03] last:border-r-0 relative">
                            {/* Grid Lines Background */}
                            {TIME_SLOTS.map((_, idx) => (
                                <div key={idx} className="h-16 border-b border-white/[0.03] w-full" />
                            ))}

                            {/* Agendamentos do Profissional */}
                            {profApts.map(apt => {
                                const time = toSPTime(apt.starts_at)
                                const [h, m] = time.split(':').map(Number)
                                const startMin = h * 60 + m
                                const svcs = parseServices(apt.service_id)
                                const dur = calcDuration(svcs)
                                const total = calcTotal(svcs)

                                const topPx = ((startMin - GRID_START) / 30) * SLOT_HEIGHT
                                const heightPx = (dur / 30) * SLOT_HEIGHT - 4

                                return (
                                    <div key={apt.id}
                                        onClick={() => onAction(apt, 'view')}
                                        className="absolute inset-x-2 glass border-violet-500/30 bg-violet-500/10 rounded-2xl p-3 shadow-lg z-10 cursor-pointer hover:scale-[1.02] transition-all group overflow-hidden"
                                        style={{ top: `${topPx + 2}px`, height: `${heightPx}px` }}>
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-black uppercase text-violet-400 tracking-wider truncate">{svcs[0]}</span>
                                                <span className="text-[9px] font-bold text-white/50">{time}</span>
                                            </div>
                                            <p className="font-bold text-xs text-white truncate">{apt.customer_name}</p>
                                            <div className="mt-auto flex items-center justify-between">
                                                <span className="text-[9px] font-medium text-slate-400">{dur}min</span>
                                                <span className="text-[10px] font-black text-violet-400">R$ {total}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="glass-dark rounded-[40px] border border-white/10 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 shadow-[0_0_50px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-br from-violet-600 to-purple-800 p-8 text-white relative">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-2xl bg-black/20 hover:bg-black/40 transition-colors"><X size={18} /></button>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-[32px] bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-3xl font-black mb-4 shadow-2xl">
                            {apt.customer_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <h3 className="text-2xl font-black tracking-tight mb-1">{apt.customer_name}</h3>
                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{toSPFull(apt.starts_at)}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-dark border border-white/5 rounded-3xl p-4">
                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Horário</p>
                            <p className="text-sm font-bold text-white tracking-tight">{toSPTime(apt.starts_at)} <span className="text-slate-500 font-medium">({dur}m)</span></p>
                        </div>
                        <div className="glass-dark border border-white/5 rounded-3xl p-4">
                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Total</p>
                            <p className="text-sm font-black text-brand-violet tracking-tight">R$ {total}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Serviços</p>
                        <div className="flex flex-wrap gap-2">
                            {svcs.map((s, i) => <span key={i} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider">{s}</span>)}
                        </div>
                    </div>

                    <div className="glass-dark border border-white/5 rounded-3xl p-5">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2">
                                <FileText size={14} className="text-brand-violet" />
                                <span className="text-[10px] font-black uppercase text-white/50 tracking-wider">Notas</span>
                            </div>
                            <button onClick={() => setEditingNotes(!editingNotes)} className="text-[10px] font-black text-brand-violet hover:underline">EDITAR</button>
                        </div>
                        {editingNotes ? (
                            <div className="space-y-3">
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white text-xs outline-none focus:border-brand-violet transition-all resize-none" />
                                <div className="flex gap-2">
                                    <button onClick={handleSaveNotes} disabled={savingNotes} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-violet-600/20 active:scale-95 transition-all">
                                        {savingNotes ? 'Salvando...' : 'Salvar Notas'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 font-medium leading-relaxed italic">"{notes || 'Sem observações adicionais.'}"</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                        <a href={whatsappLink(apt.customer_phone)} target="_blank" rel="noopener" className="w-full py-4 rounded-3xl bg-[#25D366] text-white font-black text-xs uppercase tracking-widest text-center shadow-xl shadow-green-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            <Phone size={16} /> Contatar Cliente
                        </a>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={onReschedule} className="py-4 rounded-3xl glass text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10">Reagendar</button>
                            <button onClick={onCancel} className="py-4 rounded-3xl bg-red-500/10 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20 shadow-xl shadow-red-500/5">Cancelar</button>
                        </div>
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
    const [form, setForm] = useState({ customer_name: '', customer_phone: '', services: [], date: selectedDate, time: '09:00', notes: '', professional_id: PROFESSIONALS[0].id })
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
                body: JSON.stringify({
                    customer_name: form.customer_name,
                    customer_phone: form.customer_phone,
                    service_id: JSON.stringify(form.services),
                    starts_at: startsAt,
                    ends_at: endsAt,
                    notes: form.notes || undefined,
                    professional_id: form.professional_id
                })
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            onSave()
        } catch (e) { setError(e.message) }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="glass-dark rounded-[40px] border border-white/10 w-full max-w-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-10 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-violet-600/20 to-purple-600/20">
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">Novo Agendamento</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Reserve um horário de elite</p>
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Dados do Cliente</p>
                                <div className="space-y-3">
                                    <input type="text" required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
                                        className="w-full glass-dark border border-white/10 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-brand-violet transition-all font-medium" placeholder="Nome completo" />
                                    <input type="text" required value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                                        className="w-full glass-dark border border-white/10 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-brand-violet transition-all font-medium" placeholder="WhatsApp (DDD + Número)" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Profissional Responsável</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {PROFESSIONALS.map(p => (
                                        <button key={p.id} type="button" onClick={() => setForm({ ...form, professional_id: p.id })}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${form.professional_id === p.id ? 'bg-violet-600/10 border-violet-600 scale-[1.05]' : 'bg-white/5 border-white/5 grayscale opacity-50 hover:opacity-100 hover:grayscale-0'}`}>
                                            <div className={`w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center font-bold text-xs text-white`}>{p.initial}</div>
                                            <span className="text-[9px] font-black text-white uppercase">{p.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Data & Horário</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[13px] outline-none" />
                                    <input type="time" required value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                                        className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[13px] outline-none" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Serviços Disponíveis</p>
                                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-1">
                                    {SERVICES.map(s => {
                                        const sel = form.services.includes(s.id)
                                        return (
                                            <button key={s.id} type="button" onClick={() => toggle(s.id)}
                                                className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${sel ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}>
                                                {s.name} <span className="text-[10px] ml-1 opacity-50">R${s.price}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                        {form.services.length > 0 && (
                            <div className="flex items-center gap-6">
                                <div><p className="text-[10px] font-black uppercase text-slate-500">Total Previsto</p><p className="text-2xl font-black text-brand-violet tracking-tight">R$ {totalPrice}</p></div>
                                <div><p className="text-[10px] font-black uppercase text-slate-500">Duração</p><p className="text-2xl font-black text-white tracking-tight">{totalDuration}m</p></div>
                            </div>
                        )}
                        <button type="submit" disabled={saving}
                            className="w-full md:w-auto px-12 py-4 rounded-[28px] bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black text-sm uppercase tracking-widest hover:scale-[1.02] shadow-2xl shadow-violet-600/30 transition-all active:scale-[0.98] disabled:opacity-50">
                            {saving ? 'PROCESSANDO...' : 'FINALIZAR RESERVA'}
                        </button>
                    </div>
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
            <header className="glass-dark border-b border-white/5 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-white/50">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <h2 className="text-lg font-black text-white flex items-center gap-2"><Users className="text-violet-500" size={20} /> Clientes</h2>
                </div>
                <div className="relative w-full md:w-64 flex items-center">
                    <Search size={14} className="absolute left-3 text-white/40" />
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 rounded-xl glass-dark border border-white/10 text-sm w-full focus:border-violet-500 text-white outline-none placeholder:text-white/30 transition-colors" />
                </div>
            </header>
            <div className="flex-1 overflow-auto p-2 md:p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <RefreshCw className="animate-spin text-violet-500" size={24} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <Users className="mx-auto text-white/20 mb-3" size={48} />
                        <p className="text-white/50 font-medium">Nenhum cliente encontrado</p>
                    </div>
                ) : (
                    <div className="glass-dark rounded-2xl border border-white/10 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/5">
                                        <th className="text-left text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 md:px-5 py-3">Cliente</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 md:px-5 py-3">Telefone</th>
                                        <th className="text-center text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 md:px-5 py-3 mobile-hide">Agendamentos</th>
                                        <th className="text-center text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 md:px-5 py-3 mobile-hide">Próximos</th>
                                        <th className="text-right text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 md:px-5 py-3">Total Gasto</th>
                                        <th className="text-right text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 md:px-5 py-3 mobile-hide">Última Visita</th>
                                        <th className="text-center text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 md:px-5 py-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((c, i) => {
                                        const stats = getStats(c.phone)
                                        return (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-black text-sm">
                                                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <span className="font-bold text-sm text-white">{c.name || 'Sem nome'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <a href={whatsappLink(c.phone)} target="_blank" rel="noopener" className="text-sm text-white/60 font-mono hover:text-green-400 transition-colors">{c.phone}</a>
                                                </td>
                                                <td className="px-5 py-3 text-center mobile-hide">
                                                    <span className="bg-white/10 text-white/70 text-[10px] font-black px-2 py-1 rounded-lg">{stats.total}</span>
                                                </td>
                                                <td className="px-5 py-3 text-center mobile-hide">
                                                    {stats.upcoming > 0
                                                        ? <span className="bg-green-500/20 text-green-400 text-[10px] font-black px-2 py-1 rounded-lg border border-green-500/30">{stats.upcoming}</span>
                                                        : <span className="text-xs text-white/20">—</span>}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-sm font-black text-green-400">R$ {stats.totalSpent.toFixed(0)}</span>
                                                </td>
                                                <td className="px-5 py-3 text-right text-xs text-white/50 mobile-hide font-medium">
                                                    {stats.lastVisit ? toSPDate(stats.lastVisit.starts_at).split('-').reverse().join('/') : '—'}
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <button onClick={() => setHistoryPhone(c.phone)} className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-400 hover:text-white glass-dark border border-white/10 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors">
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
                <div className="mt-4 text-center text-[10px] uppercase font-bold tracking-widest text-white/40">
                    {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* History Modal */}
            {historyPhone && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setHistoryPhone(null)}>
                    <div className="glass-dark rounded-3xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-white/10 glass">
                            <div>
                                <h3 className="font-black text-white flex items-center gap-2 text-lg"><History className="text-violet-500" size={20} /> Histórico</h3>
                                <p className="text-sm text-white/50 font-medium mt-1">{historyCustomer?.name || 'Cliente'} • {historyPhone}</p>
                            </div>
                            <button onClick={() => setHistoryPhone(null)} className="p-2 rounded-xl glass-dark border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition"><X size={18} /></button>
                        </div>
                        <div className="overflow-auto max-h-[60vh] p-6 space-y-3">
                            {historyApts.length === 0 ? (
                                <p className="text-center text-sm text-white/40 py-8 font-medium">Nenhum agendamento encontrado</p>
                            ) : historyApts.map(a => {
                                const svcs = parseServices(a.service_id)
                                const total = calcTotal(svcs)
                                const date = toSPDate(a.starts_at).split('-').reverse().join('/')
                                const time = new Date(a.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                                return (
                                    <div key={a.id} className={`flex items-center justify-between p-4 rounded-2xl border ${a.status === 'CANCELLED' ? 'bg-red-500/5 border-red-500/20' : 'glass-dark border-white/10'
                                        }`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-sm font-black text-white">{date}</span>
                                                <span className="text-xs text-white/50 font-medium">{time}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${a.status === 'CONFIRMED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : a.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/10 text-white/50 border-white/10'
                                                    }`}>{a.status === 'CONFIRMED' ? 'Confirmado' : a.status === 'CANCELLED' ? 'Cancelado' : a.status}</span>
                                            </div>
                                            <p className="text-xs text-white/60 font-medium truncate">{svcs.join(' + ')}</p>
                                        </div>
                                        <span className="text-sm font-black text-green-400 ml-4">R$ {total}</span>
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
function ServicesPage({ isMobile, onOpenMenu }) {
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [saved, setSaved] = useState(false)
    const [showNew, setShowNew] = useState(false)

    useEffect(() => { loadServices() }, [])

    const loadServices = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/services')
            const data = await res.json()
            setServices(data || [])
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const startEdit = (svc) => {
        setEditing(svc.id)
        setEditForm({ name: svc.name, price: svc.price, duration: svc.duration })
    }

    const saveEdit = async (id) => {
        try {
            await fetch('/api/services', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...editForm })
            })
            await loadServices()
            setEditing(null)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (e) { console.error(e) }
    }

    const handleDelete = async (id) => {
        if (!confirm('Deseja excluir este serviço?')) return
        try {
            await fetch(`/api/services?id=${id}`, { method: 'DELETE' })
            await loadServices()
        } catch (e) { console.error(e) }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        try {
            await fetch('/api/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            })
            setShowNew(false)
            setEditForm({})
            await loadServices()
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (e) { console.error(e) }
    }

    return (
        <>
            <header className="glass-dark border-b border-white/5 px-4 md:px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-white/60">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <h2 className="text-lg font-black text-white flex items-center gap-2"><Scissors className="text-violet-500" size={20} /> Serviços</h2>
                </div>
                <div className="flex items-center gap-3">
                    {saved && <span className="text-xs font-bold text-green-400 animate-pulse">✅ Salvo!</span>}
                    <button onClick={() => { setShowNew(true); setEditForm({ name: '', price: 0, duration: 60 }) }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition shadow-lg shadow-violet-600/20 active:scale-95">
                        <Plus size={16} /> Novo Serviço
                    </button>
                </div>
            </header>
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {showNew && (
                    <form onSubmit={handleCreate} className="glass-dark rounded-2xl border border-white/10 shadow-lg p-5">
                        <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">Adicionar Novo Serviço</h3>
                        <div className="flex flex-col md:flex-row gap-4">
                            <input type="text" required placeholder="Nome do Serviço" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="flex-1 px-4 py-2 rounded-xl glass-dark border border-white/10 focus:border-violet-500 outline-none text-sm text-white" />
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <span className="text-white/50 font-bold">R$</span>
                                <input type="number" required placeholder="Preço" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} className="w-24 px-4 py-2 rounded-xl glass-dark border border-white/10 focus:border-violet-500 outline-none text-sm text-white text-center" />
                            </div>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <Clock size={16} className="text-white/50" />
                                <input type="number" required placeholder="Duração" value={editForm.duration} onChange={e => setEditForm({ ...editForm, duration: e.target.value })} className="w-24 px-4 py-2 rounded-xl glass-dark border border-white/10 focus:border-violet-500 outline-none text-sm text-white text-center" />
                                <span className="text-white/50 font-bold text-sm">min</span>
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="p-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition border border-green-500/30"><Save size={18} /></button>
                                <button type="button" onClick={() => setShowNew(false)} className="p-2 rounded-xl glass-dark border border-white/10 text-white/50 hover:text-white transition"><X size={18} /></button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="glass-dark rounded-2xl border border-white/10 shadow-sm overflow-hidden">
                    <div className="divide-y divide-white/5">
                        {loading ? (
                            <div className="p-8 flex justify-center"><RefreshCw className="animate-spin text-violet-500" /></div>
                        ) : services.length === 0 ? (
                            <div className="p-8 text-center text-white/50">Nenhum serviço cadastrado. Pressione "Novo Serviço".</div>
                        ) : services.map(svc => (
                            <div key={svc.id} className="flex flex-col md:flex-row md:items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors">
                                {editing === svc.id ? (
                                    <div className="flex flex-col md:flex-row gap-4 w-full">
                                        <input type="text" required placeholder="Nome do Serviço" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="flex-1 px-4 py-2 rounded-xl glass-dark border border-white/10 focus:border-violet-500 outline-none text-sm text-white" />
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white/50 font-bold">R$</span>
                                                <input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} className="w-20 px-3 py-2 rounded-xl glass-dark border border-white/10 focus:border-violet-500 outline-none text-sm text-white text-center" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} className="text-white/50" />
                                                <input type="number" value={editForm.duration} onChange={e => setEditForm({ ...editForm, duration: e.target.value })} className="w-20 px-3 py-2 rounded-xl glass-dark border border-white/10 focus:border-violet-500 outline-none text-sm text-white text-center" />
                                            </div>
                                            <div className="flex items-center gap-2 ml-auto">
                                                <button onClick={() => saveEdit(svc.id)} className="p-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition border border-green-500/30"><Save size={16} /></button>
                                                <button onClick={() => setEditing(null)} className="p-2 rounded-xl glass-dark border border-white/10 text-white/50 hover:text-white transition"><X size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 flex items-center gap-3 mb-2 md:mb-0">
                                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                                                <Scissors size={14} className="text-violet-400" />
                                            </div>
                                            <p className="font-bold text-sm text-white">{svc.name}</p>
                                        </div>
                                        <div className="flex items-center justify-between md:justify-end gap-5">
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Valor</p>
                                                    <p className="text-sm font-black text-green-400">R$ {svc.price}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Duração</p>
                                                    <p className="text-sm font-black text-white/80">{svc.duration}min</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                                                <button onClick={() => startEdit(svc)} className="p-2 rounded-xl glass-dark border border-white/10 hover:bg-white/10 text-white/50 hover:text-violet-400 transition-colors" title="Editar">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(svc.id)} className="p-2 rounded-xl glass-dark border border-white/10 hover:bg-red-500/20 text-white/50 hover:text-red-400 border-transparent hover:border-red-500/30 transition-colors" title="Excluir">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
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

// ─── Reports Page ──────────────────────────────────────────
function ReportsPage({ appointments, isMobile, onOpenMenu }) {
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
            <header className="glass-dark border-b border-white/5 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-white/50">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <h2 className="text-lg font-black text-white flex items-center gap-2"><BarChart3 className="text-violet-500" size={20} /> Relatórios</h2>
                </div>
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
                }} className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 shadow-[0_0_20px_rgba(139,92,246,0.3)] transition active:scale-95">
                    <Download size={14} /> Exportar CSV
                </button>
            </header>
            <div className="flex-1 overflow-auto p-2 md:p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="glass-dark rounded-3xl border border-white/10 p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-green-500/20 rounded-full blur-2xl pointer-events-none" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Faturamento Mensal</p>
                        <p className="text-3xl font-black text-green-400">R$ {monthRevenue}</p>
                        <p className="text-[10px] text-white/40 mt-1 font-medium">{monthApts.length} agendamentos</p>
                    </div>
                    <div className="glass-dark rounded-3xl border border-white/10 p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Ticket Médio</p>
                        <p className="text-3xl font-black text-white">R$ {ticketMedio}</p>
                        <p className="text-[10px] text-white/40 mt-1 font-medium">por atendimento</p>
                    </div>
                    <div className="glass-dark rounded-3xl border border-white/10 p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-violet-500/20 rounded-full blur-2xl pointer-events-none" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Agend. Hoje</p>
                        <p className="text-3xl font-black text-violet-400">{appointments.filter(a => toSPDate(a.starts_at) === todayStr).length}</p>
                        <p className="text-[10px] text-white/40 mt-1 font-medium uppercase">{new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                    </div>
                </div>

                {/* Chart: Last 7 Days Revenue */}
                <div className="glass-dark rounded-3xl border border-white/10 shadow-sm p-6 pt-5 relative">
                    <h3 className="font-black text-sm text-white mb-6 flex items-center gap-2 tracking-wide"><TrendingUp size={18} className="text-green-400" /> Curva de Faturamento</h3>
                    <div className="flex items-end gap-2" style={{ height: '180px' }}>
                        {last7.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                                <p className="text-[10px] font-bold text-green-400 mb-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                    {day.revenue > 0 ? `R$${day.revenue}` : ''}
                                </p>
                                <div className="w-full max-w-[40px] bg-gradient-to-t from-violet-600/50 to-purple-400/80 rounded-t-lg transition-all hover:brightness-125 border border-white/5 border-b-0 shadow-[0_0_15px_rgba(167,139,250,0.2)]"
                                    style={{ height: `${(day.revenue / maxRevenue) * 140}px`, minHeight: day.revenue > 0 ? '8px' : '2px' }}
                                    title={`${day.label}: R$ ${day.revenue} (${day.count} agend.)`} />
                                <p className="text-[9px] font-bold text-white/50 mt-3 truncate w-full text-center uppercase tracking-wider">{day.label.split(',')[0]}</p>
                                <p className="text-[8px] text-white/30 truncate mt-0.5">{day.count} agend.</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top Services */}
                    <div className="glass-dark rounded-3xl border border-white/10 shadow-sm p-5">
                        <h3 className="font-black text-sm text-white mb-4 tracking-wide flex items-center gap-2"><Scissors size={16} className="text-violet-400" /> Serviços Populares no Mês</h3>
                        <div className="space-y-4">
                            {topServices.length === 0 ? <p className="text-sm text-white/30 text-center py-4">Sem dados</p> : topServices.map(([name, count], i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-xs font-bold text-white mb-1.5">
                                        <span className="truncate mr-2">{i + 1}. {name}</span>
                                        <span className="text-violet-400 shrink-0">{count}x</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-violet-600 to-purple-400 rounded-full transition-all" style={{ width: `${(count / maxServiceCount) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Weekly breakdown */}
                    <div className="glass-dark rounded-3xl border border-white/10 shadow-sm p-5">
                        <h3 className="font-black text-sm text-white mb-4 tracking-wide flex items-center gap-2"><Calendar size={16} className="text-blue-400" /> Resumo Semanal</h3>
                        <div className="space-y-3">
                            {last4Weeks.map((wk, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-black text-[10px] flex items-center justify-center border border-blue-500/30">
                                            S{4 - i}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{wk.label}</p>
                                            <p className="text-[10px] text-white/50 font-medium mt-0.5">{wk.count} atendimentos</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-green-400">R$ {wk.revenue}</span>
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
function SchedulePage({ isMobile, onOpenMenu, overrides, onRefresh, isDayOpen }) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [saving, setSaving] = useState(null) // dateStr being saved

    const loadOverrides = async () => {
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
            <header className="glass-dark border-b border-white/5 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-white/50">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <h2 className="text-lg font-black text-white flex items-center gap-2"><Clock className="text-violet-500" size={20} /> Horários</h2>
                </div>
                <span className="text-[10px] md:text-xs text-white/40 font-medium whitespace-nowrap">Clique no dia para alternar aberto/fechado</span>
            </header>
            <div className="flex-1 overflow-auto p-2 md:p-4 space-y-4">
                {/* Legend */}
                <div className="glass-dark rounded-3xl border border-white/10 p-3 md:p-4 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-green-500/20 border-2 border-green-500/50" />
                            <span className="text-[9px] md:text-xs font-bold text-white/60">Aberto (padrão)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-red-500/20 border-2 border-red-500/50" />
                            <span className="text-[9px] md:text-xs font-bold text-white/60">Fechado (padrão)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-green-500/20 border-2 border-amber-400/50 ring-2 ring-amber-400/20" />
                            <span className="text-[9px] md:text-xs font-bold text-white/60">Aberto (exceção)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-red-500/20 border-2 border-amber-400/50 ring-2 ring-amber-400/20" />
                            <span className="text-[9px] md:text-xs font-bold text-white/60">Fechado (exceção)</span>
                        </div>
                    </div>
                </div>

                {/* Month Navigation */}
                <div className="flex items-center justify-between glass-dark rounded-2xl border border-white/10 p-1 md:p-2 shadow-sm">
                    <button onClick={() => navMonth(-1)} className="p-2.5 rounded-xl hover:bg-white/10 text-white/50 transition-colors"><ChevronLeft size={20} /></button>
                    <h3 className="text-sm md:text-lg font-black text-white text-center">
                        {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        {monthOverrides.length > 0 && <div className="text-[10px] font-bold text-amber-400 mt-0.5">{monthOverrides.length} exceção{monthOverrides.length > 1 ? 'ões' : ''}</div>}
                    </h3>
                    <button onClick={() => navMonth(1)} className="p-2.5 rounded-xl hover:bg-white/10 text-white/50 transition-colors"><ChevronRight size={20} /></button>
                </div>

                {/* Calendar Grid */}
                <div className="glass-dark rounded-3xl border border-white/10 shadow-sm overflow-hidden">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 border-b border-white/5 bg-white/5">
                        {DAY_NAMES.map(d => (
                            <div key={d} className="text-center py-3 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-white/40">{d.substring(0, 3)}</div>
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
                                        relative py-3 md:py-5 px-1 md:px-2 border-b border-r border-white/5 text-center transition-all
                                        ${!inMonth ? 'opacity-10 cursor-default' : isPast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5 active:scale-95'}
                                        ${inMonth && open ? 'bg-green-500/5 hover:bg-green-500/10' : inMonth ? 'bg-red-500/5 hover:bg-red-500/10' : ''}
                                        ${isException && inMonth ? 'ring-1 md:ring-2 ring-amber-400/50 ring-inset' : ''}
                                    `}>
                                    <p className={`text-sm md:text-lg font-black ${inMonth ? (open ? 'text-green-400' : 'text-red-400') : 'text-white/20'}`}>
                                        {date.getDate()}
                                    </p>
                                    <p className={`text-[7px] md:text-[9px] font-bold mt-1 uppercase tracking-wider ${open ? 'text-green-500' : 'text-red-400'}`}>
                                        {inMonth ? (open ? 'Aberto' : 'Fechado') : ''}
                                    </p>
                                    {isException && inMonth && (
                                        <span className="absolute top-1 right-1 text-[10px] drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]">⭐</span>
                                    )}
                                    {isSaving && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg m-1">
                                            <RefreshCw size={14} className="animate-spin text-violet-400" />
                                        </div>
                                    )}
                                    {isToday(date) && (
                                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Overrides List */}
                {monthOverrides.length > 0 && (
                    <div className="glass-dark rounded-3xl border border-white/10 shadow-sm p-6">
                        <h3 className="font-black text-sm text-white mb-4 flex items-center gap-2">⭐ Exceções neste mês</h3>
                        <div className="space-y-3">
                            {monthOverrides.map(o => {
                                const d = new Date(o.date + 'T12:00:00')
                                return (
                                    <div key={o.id} className="flex items-center justify-between py-3 px-4 rounded-xl glass-dark border border-white/10 hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <span className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${o.is_open ? 'bg-green-400 text-green-400' : 'bg-red-400 text-red-400'}`} />
                                            <div>
                                                <span className="text-sm font-bold text-white block">
                                                    {d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                </span>
                                                {o.reason && <span className="text-[10px] text-white/40 font-medium block mt-0.5">{o.reason}</span>}
                                            </div>
                                            <span className={`hidden md:inline-block text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg border ${o.is_open ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                                {o.is_open ? 'ABERTO' : 'FECHADO'}
                                            </span>
                                        </div>
                                        <button onClick={() => toggleDay(d)} className="text-[10px] uppercase font-bold text-red-400 hover:text-white glass-dark border border-white/10 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors tracking-widest">
                                            Remover
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="glass-dark border border-violet-500/30 rounded-2xl p-5 text-center shadow-[0_0_30px_rgba(139,92,246,0.05)]">
                    <p className="text-sm text-violet-400 font-medium">
                        💡 As mudanças feitas aqui são aplicadas instantaneamente. O bot já saberá quais dias estão abertos ou fechados.
                    </p>
                </div>
            </div>
        </>
    )
}
