'use client'

import { Calendar, Clock, Scissors, Ban, Trash2 } from 'lucide-react'
import {
    DAY_NAMES,
    fmt,
    isToday,
    toSPDate,
    toSPTime,
    parseServices,
    calcTotal,
    calcDuration,
    getMonthDates,
    PROFESSIONALS,
    TIME_SLOTS
} from '@/lib/dashboard_utils'

// ─── Month View ────────────────────────────────────────────
export function MonthView({ currentDate, selectedDate, setSelectedDate, getCount, isMobile, isDayOpen }) {
    const dates = getMonthDates(currentDate.getFullYear(), currentDate.getMonth())
    const thisMonth = currentDate.getMonth()
    return (
        <div className="glass-dark rounded-3xl border border-white/5 shadow-2xl overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in duration-500">
            <div className={`grid grid-cols-7 ${isMobile ? 'text-[8px]' : ''} bg-white/5 border-b border-white/5`}>
                {DAY_NAMES.map(d => <div key={d} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 relative">
                {dates.map((date, i) => {
                    const dateStr = fmt(date)
                    const isThisMonth = date.getMonth() === thisMonth
                    const isClosed = !isDayOpen(date)
                    const count = getCount(dateStr)
                    return (
                        <button key={i} onClick={() => !isClosed && isThisMonth && setSelectedDate(dateStr)} disabled={isClosed || !isThisMonth}
                            className={`relative h-20 md:h-32 p-3 border-b border-r border-white/5 text-left transition-all group overflow-hidden ${!isThisMonth ? 'opacity-10' : isClosed ? 'bg-red-500/5 opacity-40 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'}`}>
                            <span className={`text-xs md:text-sm font-black ${isToday(date) ? 'bg-violet-600 text-white w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/40 relative z-10' : 'text-slate-400 group-hover:text-white'}`}>{date.getDate()}</span>
                            {count > 0 && <div className="mt-2"><span className="bg-violet-500/20 text-violet-400 text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded-lg border border-violet-500/20">{count}{!isMobile && ' AGEND.'}</span></div>}
                            {isClosed && isThisMonth && <div className="mt-2"><span className="bg-red-500/10 text-red-400/60 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-red-500/10 uppercase font-sans">Fechado</span></div>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Week View ─────────────────────────────────────────────
export function WeekView({ weekDates, setSelectedDate, getCount, appointments, isMobile, isDayOpen, servicesList }) {
    if (isMobile) {
        return (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-10 duration-500">
                {weekDates.map((date, i) => {
                    const dateStr = fmt(date)
                    const isClosed = !isDayOpen(date)
                    const dayApts = appointments.filter(a => toSPDate(a.starts_at) === dateStr)
                    return (
                        <div key={i} onClick={() => !isClosed && setSelectedDate(dateStr)} className={`glass border border-white/5 p-4 rounded-3xl shadow-xl transition-all active:scale-95 ${isClosed ? 'opacity-50' : ''}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className={`text-xl font-black ${isToday(date) ? 'text-violet-500' : 'text-white'}`}>{date.getDate()}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{DAY_NAMES[date.getDay()]}</span>
                                </div>
                                {isClosed ? <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-1 rounded-lg uppercase font-black border border-red-500/10">Fechado</span> :
                                    dayApts.length > 0 ? <span className="text-[9px] bg-violet-600 text-white px-2 py-1 rounded-lg font-black shadow-lg shadow-violet-600/20">{dayApts.length} AGEND.</span> :
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Disponível</span>}
                            </div>
                            {!isClosed && dayApts.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                    {dayApts.slice(0, 3).map(apt => (
                                        <div key={apt.id} className="shrink-0 w-28 p-2.5 bg-white/5 rounded-2xl border-l-2 border-violet-500">
                                            <p className="text-[10px] font-black text-violet-400">{toSPTime(apt.starts_at)}</p>
                                            <p className="text-[10px] font-bold text-white truncate">{apt.customer_name}</p>
                                        </div>
                                    ))}
                                    {dayApts.length > 3 && <div className="shrink-0 flex items-center px-2 text-[10px] text-slate-500">+{dayApts.length - 3}</div>}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }
    return (
        <div className="glass-dark rounded-[40px] border border-white/5 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-500 backdrop-blur-3xl">
            <div className="grid grid-cols-7 border-b border-white/5 bg-white/5">
                {weekDates.map((date, i) => {
                    const dateStr = fmt(date)
                    const isClosed = !isDayOpen(date)
                    const count = getCount(dateStr)
                    return (
                        <button key={i} onClick={() => !isClosed && setSelectedDate(dateStr)} disabled={isClosed}
                            className={`py-8 text-center border-r border-white/5 last:border-r-0 transition-all ${isClosed ? 'bg-red-500/5 opacity-40 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer group'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 group-hover:text-white transition-colors">{DAY_NAMES[date.getDay()]}</p>
                            <p className={`text-3xl font-black mb-2 transition-all group-hover:scale-110 ${isToday(date) ? 'text-violet-500' : 'text-slate-400 group-hover:text-white'}`}>{date.getDate()}</p>
                            {count > 0 && <span className="inline-block mt-2 bg-violet-600 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-lg shadow-violet-600/20">{count} AGEND.</span>}
                            {isClosed && <span className="block text-[9px] text-red-400/60 font-black tracking-widest uppercase mt-2">Fechado</span>}
                        </button>
                    )
                })}
            </div>
            <div className="grid grid-cols-7 min-h-[400px]">
                {weekDates.map((date, dayIdx) => {
                    const dateStr = fmt(date)
                    const isClosed = !isDayOpen(date)
                    const dayApts = appointments.filter(a => toSPDate(a.starts_at) === dateStr)
                    return (
                        <div key={dayIdx} className={`border-r border-white/5 last:border-r-0 p-3 space-y-2 ${isClosed ? 'bg-red-500/[0.02]' : ''}`}>
                            {dayApts.slice(0, 6).map(apt => {
                                const svcs = parseServices(apt.service_id, servicesList)
                                return (
                                    <div key={apt.id} onClick={() => setSelectedDate(dateStr)} className="group relative p-3 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/10 hover:border-violet-500/30 transition-all">
                                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-violet-600 rounded-r-full group-hover:w-1.5 transition-all" />
                                        <p className="text-[10px] font-black text-violet-400 mb-0.5">{toSPTime(apt.starts_at)}</p>
                                        <p className="text-[11px] font-black text-white truncate">{apt.customer_name}</p>
                                        <p className="text-[9px] text-slate-500 font-bold truncate mt-1 uppercase tracking-tight">{svcs.join(', ')}</p>
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

// ─── Day View ──────────────────────────────────────────────
export function DayView({ selectedDate, appointments, blocks = [], onAction, dayRevenue, onDeleteBlock, servicesList }) {
    const SLOT_HEIGHT = 64
    const GRID_START = 8 * 60

    const confirmedApts = appointments.filter(a => a.status === 'CONFIRMED')

    return (
        <div className="glass-dark rounded-[40px] overflow-hidden border border-white/5 shadow-2xl backdrop-blur-3xl animate-in fade-in zoom-in duration-500">
            <div className="flex border-b border-white/10 bg-white/5 sticky top-0 z-30">
                <div className="w-20 shrink-0 border-r border-white/10 flex items-center justify-center p-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Horário</span>
                </div>
                {PROFESSIONALS.map(prof => (
                    <div key={prof.id} className="flex-1 min-w-[220px] p-5 border-r border-white/10 last:border-r-0">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl border-2 ${prof.color} bg-slate-900 flex items-center justify-center font-black text-lg shadow-xl text-white`}>
                                {prof.initial}
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-black text-sm text-white truncate tracking-tight">{prof.name}</p>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{prof.role}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="relative flex overflow-auto max-h-[750px] custom-scrollbar">
                <div className="w-20 shrink-0 border-r border-white/10 sticky left-0 z-20 bg-slate-950/80">
                    {TIME_SLOTS.map((slot, idx) => (
                        <div key={idx} className="h-16 border-b border-white/[0.03] flex items-center justify-center text-[11px] font-black text-slate-500 bg-black/20">
                            {slot}
                        </div>
                    ))}
                </div>

                {PROFESSIONALS.map(prof => {
                    const profApts = confirmedApts.filter(a => a.professional_id === prof.id || (!a.professional_id && prof.id === PROFESSIONALS[0].id))

                    return (
                        <div key={prof.id} className="flex-1 min-w-[220px] border-r border-white/[0.03] last:border-r-0 relative">
                            {TIME_SLOTS.map((_, idx) => (
                                <div key={idx} className="h-16 border-b border-white/[0.03] w-full" />
                            ))}

                            {profApts.map(apt => {
                                const time = toSPTime(apt.starts_at)
                                const [h, m] = time.split(':').map(Number)
                                const startMin = h * 60 + m
                                const svcs = parseServices(apt.service_id, servicesList)
                                const dur = calcDuration(svcs, servicesList)
                                const total = calcTotal(svcs, servicesList)

                                const topPx = ((startMin - GRID_START) / 30) * SLOT_HEIGHT
                                const heightPx = (dur / 30) * SLOT_HEIGHT - 4

                                return (
                                    <div key={apt.id}
                                        onClick={() => onAction(apt, 'view')}
                                        className="absolute inset-x-3 glass-dark border-violet-500/40 bg-violet-600/10 rounded-[20px] p-4 shadow-2xl z-10 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all group overflow-hidden border-2"
                                        style={{ top: `${topPx + 2}px`, height: `${heightPx}px` }}>
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-all">
                                            <Scissors className="text-white" size={32} />
                                        </div>
                                        <div className="flex flex-col h-full relative z-10">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black tracking-widest text-violet-400 uppercase truncate max-w-[70%]">{svcs[0]}</span>
                                                <span className="text-[11px] font-black text-white/40">{time}</span>
                                            </div>
                                            <p className="font-black text-[13px] text-white truncate mb-1">{apt.customer_name}</p>
                                            <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={10} className="text-slate-500" />
                                                    <span className="text-[10px] font-bold text-slate-400">{dur}min</span>
                                                </div>
                                                <span className="text-sm font-black text-violet-400">R$ {total}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            {blocks.filter(b => b.professional_id === prof.id || !b.professional_id).map(blk => {
                                const sTime = toSPTime(blk.starts_at)
                                const eTime = toSPTime(blk.ends_at)
                                const [sh, sm] = sTime.split(':').map(Number)
                                const [eh, em] = eTime.split(':').map(Number)
                                const startMin = sh * 60 + sm
                                const endMin = eh * 60 + em
                                const dur = endMin - startMin

                                const topPx = ((startMin - GRID_START) / 30) * SLOT_HEIGHT
                                const heightPx = (dur / 30) * SLOT_HEIGHT - 4

                                return (
                                    <div key={blk.id} className="absolute inset-x-4 bg-red-500/10 border-2 border-red-500/30 rounded-2xl flex flex-col items-center justify-center p-2 z-0 overflow-hidden" style={{ top: `${topPx + 2}px`, height: `${heightPx}px` }}>
                                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, transparent 10px, transparent 20px)' }} />
                                        {dur >= 30 && (
                                            <>
                                                <Ban size={20} className="text-red-500/40 mb-1" />
                                                <p className="text-[10px] font-black text-red-500/70 uppercase tracking-widest text-center">{blk.title || 'Indisponível'}</p>
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteBlock(blk.id) }} className="mt-1 p-1 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/40 transition-all"><Trash2 size={12} /></button>
                                            </>
                                        )}
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
