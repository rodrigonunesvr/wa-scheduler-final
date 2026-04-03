'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    Calendar, Clock, Plus, X, ChevronLeft, ChevronRight,
    RefreshCw, LayoutGrid, Users, Scissors,
    Search, BarChart3, TrendingUp, DollarSign,
    LogOut, Settings, FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Modular Imports
import {
    fmt,
    toSPDate,
    getWeekDates,
    parseServices,
    calcTotal,
    PROFESSIONALS
} from '@/lib/dashboard_utils'

import { MonthView, WeekView, DayView } from '@/components/DashboardViews'
import {
    ClientsPage,
    ServicesPage,
    ReportsPage,
    SchedulePage,
    SettingsPage
} from '@/components/SubPages'
import {
    AppointmentDetailModal,
    CancelConfirmModal,
    NewAppointmentModal,
    BlockModal,
    RescheduleModal
} from '@/components/DashboardModals'

export default function AdminDashboard() {
    const router = useRouter()
    const [session, setSession] = useState(null)
    const [sessionLoading, setSessionLoading] = useState(true)

    const [globalServices, setGlobalServices] = useState([])
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
    const [darkMode, setDarkMode] = useState(true)
    const [isMobile, setIsMobile] = useState(false)

    const [businessName, setBusinessName] = useState('AgendaÍ')
    const [botPrompt, setBotPrompt] = useState('')

    const [actionApt, setActionApt] = useState(null)
    const [actionType, setActionType] = useState(null)

    // Auth & Settings
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (!currentSession) router.push('/login')
            else { setSession(currentSession); fetchSettings() }
            setSessionLoading(false)
        }
        checkAuth()
    }, [router])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings')
            const data = await res.json()
            if (data && data.business_name) {
                setBusinessName(data.business_name)
                setBotPrompt(data.bot_prompt || '')
            }
        } catch (err) { console.error(err) }
    }

    // Lifecycle
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        if (window.innerWidth < 768) setSidebarOpen(false)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const toggleDarkMode = () => setDarkMode(!darkMode) // Simplified toggle for now
    const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

    const fetchAppointments = useCallback(async () => {
        if (!session) return
        setLoading(true)
        const s = new Date(currentDate); s.setDate(1); s.setMonth(s.getMonth() - 1)
        const e = new Date(currentDate); e.setMonth(e.getMonth() + 2)
        try {
            const [aptRes, blkRes, schRes, svcRes] = await Promise.all([
                fetch(`/api/admin?start=${fmt(s)}&end=${fmt(e)}`),
                fetch(`/api/admin?type=blocks&start=${fmt(s)}&end=${fmt(e)}`),
                fetch(`/api/admin?type=schedule`),
                fetch('/api/services')
            ])
            const aptData = await aptRes.json()
            const blkData = await blkRes.json()
            const schData = await schRes.json()
            const svcData = await svcRes.json()

            const apts = Array.isArray(aptData) ? aptData : []
            setAppointments(apts)
            setBlocks(Array.isArray(blkData) ? blkData : [])
            setOverrides(Array.isArray(schData) ? schData : [])
            if (Array.isArray(svcData)) setGlobalServices(svcData)

            const confirmedCount = apts.filter(a => a.status === 'CONFIRMED').length
            if (lastCount > 0 && confirmedCount > lastCount) setNewBadge(confirmedCount - lastCount)
            setLastCount(confirmedCount)
        } catch (err) { console.error(err) }
        setLoading(false)
    }, [currentDate, lastCount, session])

    useEffect(() => { fetchAppointments() }, [fetchAppointments, refreshKey])

    // Navigation Utils
    const nav = (dir) => {
        const d = new Date(currentDate)
        if (viewMode === 'month') d.setMonth(d.getMonth() + dir)
        else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7)
        else { const sd = new Date(selectedDate + 'T12:00:00'); sd.setDate(sd.getDate() + dir); setSelectedDate(fmt(sd)); return }
        setCurrentDate(d)
    }
    const goToday = () => { const now = new Date(); setCurrentDate(now); setSelectedDate(fmt(now)) }

    // Derived States
    const confirmed = appointments.filter(a => a.status === 'CONFIRMED')
    const dayApts = confirmed.filter(a => toSPDate(a.starts_at) === selectedDate).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    const dayBlocks = blocks.filter(b => toSPDate(b.starts_at) === selectedDate)
    const filteredDayApts = appointments.filter(a => toSPDate(a.starts_at) === selectedDate && (showCancelled || a.status !== 'CANCELLED') && (!searchQuery || a.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())))

    const dayRevenue = dayApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id, globalServices), globalServices), 0)
    const monthApts = confirmed.filter(a => a.starts_at >= `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`)
    const monthRevenue = monthApts.reduce((sum, a) => sum + calcTotal(parseServices(a.service_id, globalServices), globalServices), 0)

    const isDayOpen = (date) => {
        const dateStr = fmt(date)
        const override = overrides.find(o => o.date === dateStr)
        if (override) return override.is_open
        return ![0, 1].includes(date.getDay())
    }

    if (sessionLoading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
            <RefreshCw className="animate-spin text-violet-500 mb-4" size={48} />
            <span className="font-black uppercase tracking-widest text-sm">Autenticando...</span>
        </div>
    )

    return (
        <div className="min-h-screen bg-transparent flex overflow-hidden font-sans">
            {isMobile && sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />}

            <aside className={`${isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : (sidebarOpen ? 'w-64' : 'w-20')} fixed md:relative h-full glass border-r border-white/5 backdrop-blur-3xl transition-all duration-500 flex flex-col shrink-0 z-50`}>
                <div className="p-6 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-400 rotate-12 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0"><Scissors className="text-white -rotate-12" size={16} /></div>
                        {(sidebarOpen || isMobile) && <span className="font-black text-xl tracking-tight text-white">{businessName}<span className="text-violet-500">.</span></span>}
                    </div>
                </div>

                <nav className="flex-1 py-6 space-y-1 px-3 overflow-y-auto custom-scrollbar">
                    {[
                        { id: 'agenda', icon: Calendar, label: 'Agenda' },
                        { id: 'horarios', icon: Clock, label: 'Horários' },
                        { id: 'clientes', icon: Users, label: 'Clientes' },
                        { id: 'servicos', icon: Scissors, label: 'Serviços' },
                        { id: 'relatorios', icon: BarChart3, label: 'Relatórios' },
                        { id: 'configuracoes', icon: Settings, label: 'Configurações' }
                    ].map(item => (
                        <button key={item.id} onClick={() => { setActivePage(item.id); setNewBadge(0); if (isMobile) setSidebarOpen(false) }}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all group ${activePage === item.id ? 'bg-white/10 text-white shadow-xl shadow-black/20 border border-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                            <item.icon size={18} className={`${activePage === item.id ? 'text-violet-500' : 'group-hover:text-white'}`} />
                            {(sidebarOpen || isMobile) && item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 mt-auto">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-all">
                        <LogOut size={14} /> {(sidebarOpen || isMobile) && 'SAIR DO SISTEMA'}
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-slate-950">
                {activePage === 'agenda' && (
                    <>
                        <header className="glass-dark border-b border-white/5 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-30">
                            <div className="flex items-center gap-4 overflow-hidden">
                                {isMobile && <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-white/60"><LayoutGrid size={20} /></button>}
                                <div className="flex glass-dark rounded-2xl p-1 shrink-0 border border-white/10">
                                    {['day', 'week', 'month'].map(mode => (
                                        <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${viewMode === mode ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-500 hover:text-white'}`}>
                                            {mode === 'day' ? 'dia' : mode === 'week' ? 'semana' : 'mês'}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => nav(-1)} className="p-2 text-slate-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                                    <button onClick={goToday} className="px-4 py-2 rounded-xl bg-white/5 text-white text-[11px] font-black uppercase border border-white/10">Hoje</button>
                                    <button onClick={() => nav(1)} className="p-2 text-slate-400 hover:text-white transition-colors"><ChevronRight size={20} /></button>
                                </div>
                            </div>
                            <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] shadow-xl shadow-violet-600/20 transition-all"><Plus size={18} /> Novo</button>
                        </header>

                        {viewMode === 'day' && (
                            <div className="px-6 pt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="glass-dark rounded-[30px] border border-white/5 p-5 flex flex-col gap-4 relative overflow-hidden">
                                    <div className="flex items-center justify-between"><div className="w-10 h-10 rounded-2xl bg-violet-600/10 flex items-center justify-center border border-violet-600/20"><Calendar className="text-violet-500" size={18} /></div></div>
                                    <div><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Hoje</p><p className="text-3xl font-black text-white">{dayApts.length}</p></div>
                                </div>
                                <div className="glass-dark rounded-[30px] border border-white/5 p-5 flex flex-col gap-4 relative overflow-hidden">
                                    <div className="flex items-center justify-between"><div className="w-10 h-10 rounded-2xl bg-green-600/10 flex items-center justify-center border border-green-600/20"><DollarSign className="text-green-500" size={18} /></div></div>
                                    <div><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Caixa</p><p className="text-3xl font-black text-green-400">R$ {dayRevenue}</p></div>
                                </div>
                                <div className="glass-dark rounded-[30px] border border-white/5 p-5 flex flex-col gap-4 relative overflow-hidden hidden lg:flex">
                                    <div className="flex items-center justify-between"><div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20"><TrendingUp className="text-blue-500" size={18} /></div></div>
                                    <div><p className="text-[10px] font-black uppercase text-slate-500 mb-1">No Mês</p><p className="text-3xl font-black text-white">{monthApts.length}</p></div>
                                </div>
                                <div className="glass-dark rounded-[30px] border border-white/5 p-5 flex flex-col gap-4 relative overflow-hidden hidden lg:flex">
                                    <div className="flex items-center justify-between"><div className="w-10 h-10 rounded-2xl bg-purple-600/10 flex items-center justify-center border border-purple-600/20"><FileText className="text-purple-500" size={18} /></div></div>
                                    <div><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Faturamento Mês</p><p className="text-2xl font-black text-purple-400">R$ {monthRevenue}</p></div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto p-2 md:p-6 custom-scrollbar">
                            {viewMode === 'month' && <MonthView currentDate={currentDate} selectedDate={selectedDate} setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }} getCount={(d) => confirmed.filter(a => toSPDate(a.starts_at) === d).length} isMobile={isMobile} isDayOpen={isDayOpen} />}
                            {viewMode === 'week' && <WeekView weekDates={getWeekDates(currentDate)} setSelectedDate={(d) => { setSelectedDate(d); setViewMode('day') }} getCount={(d) => confirmed.filter(a => toSPDate(a.starts_at) === d).length} appointments={confirmed} isMobile={isMobile} isDayOpen={isDayOpen} servicesList={globalServices} />}
                            {viewMode === 'day' && <DayView selectedDate={selectedDate} appointments={filteredDayApts} blocks={dayBlocks} onAction={(apt, type) => { setActionApt(apt); setActionType(type) }} dayRevenue={dayRevenue} onDeleteBlock={async (id) => { await fetch(`/api/admin?id=${id}&type=block`, { method: 'DELETE' }); setRefreshKey(k => k + 1) }} servicesList={globalServices} />}
                        </div>
                    </>
                )}
                {activePage === 'clientes' && <ClientsPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} />}
                {activePage === 'servicos' && <ServicesPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} globalServices={globalServices} refreshGlobal={() => setRefreshKey(k => k + 1)} />}
                {activePage === 'relatorios' && <ReportsPage appointments={confirmed} isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} />}
                {activePage === 'horarios' && <SchedulePage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} overrides={overrides} onRefresh={fetchAppointments} isDayOpen={isDayOpen} />}
                {activePage === 'configuracoes' && <SettingsPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} initialBusinessName={businessName} initialBotPrompt={botPrompt} onSave={() => { fetchSettings(); setRefreshKey(k => k + 1) }} />}
            </main>

            {actionApt && (
                <>
                    {actionType === 'view' && <AppointmentDetailModal apt={actionApt} onClose={() => setActionApt(null)} onCancel={() => setActionType('cancel')} onReschedule={() => setActionType('reschedule')} onSaveNotes={async (id, notes) => { await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, notes }) }); setRefreshKey(k => k + 1) }} />}
                    {actionType === 'cancel' && <CancelConfirmModal apt={actionApt} onClose={() => setActionApt(null)} onConfirm={async () => { await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: actionApt.id, status: 'CANCELLED' }) }); setActionApt(null); setRefreshKey(k => k + 1) }} />}
                </>
            )}
        </div>
    )
}
