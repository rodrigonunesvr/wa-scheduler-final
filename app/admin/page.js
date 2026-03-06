'use client'

import { motion } from 'framer-motion'
import { Plus, Users, TrendingUp, Calendar as CalendarIcon, DollarSign } from 'lucide-react'

const PROFESSIONALS = [
    { id: 1, name: 'Clara Nails', role: 'Manicure', color: 'border-pink-500' },
    { id: 2, name: 'Juliana', role: 'Esteticista', color: 'border-blue-500' },
    { id: 3, name: 'Marcos', role: 'Cabelereiro', color: 'border-amber-500' },
]

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8
    const minutes = (i % 2) * 30
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

export default function AdminDashboard() {
    return (
        <div className="p-8 space-y-8">
            {/* Welcome & Stats */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Muro de Agendas</h1>
                    <p className="text-slate-500 font-medium">Sexta-feira, 06 de Março de 2026</p>
                </div>
                <button className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-brand-600/20 transition-all active:scale-95">
                    <Plus size={20} />
                    Novo Agendamento
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Hoje" value="24" icon={<CalendarIcon size={16} />} color="text-brand-400" />
                <StatCard label="Faturamento" value="R$ 3.420" icon={<DollarSign size={16} />} color="text-emerald-400" />
                <StatCard label="Ocupação" value="82%" icon={<TrendingUp size={16} />} color="text-blue-400" />
                <StatCard label="Equipe" value="3 Ativos" icon={<Users size={16} />} color="text-amber-400" />
            </div>

            {/* The Grid (Muro de Agendas) */}
            <div className="glass rounded-[32px] overflow-hidden border border-white/5">
                <div className="flex border-b border-white/5 bg-white/5">
                    <div className="w-20 shrink-0 border-r border-white/5 flex items-center justify-center p-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hora</span>
                    </div>
                    {PROFESSIONALS.map(prof => (
                        <div key={prof.id} className="flex-1 min-w-[250px] p-6 border-r border-white/5 last:border-r-0">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl border-2 ${prof.color} bg-slate-800 flex items-center justify-center font-bold text-lg`}>
                                    {prof.name[0]}
                                </div>
                                <div>
                                    <p className="font-bold">{prof.name}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{prof.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="max-h-[600px] overflow-auto relative">
                    {TIME_SLOTS.map((slot, idx) => (
                        <div key={slot} className="flex border-b border-white/[0.03] group h-20">
                            <div className="w-20 shrink-0 border-r border-white/5 flex justify-center py-2 text-[11px] font-bold text-slate-500 bg-black/20">
                                {slot}
                            </div>
                            {PROFESSIONALS.map(prof => (
                                <div key={`${prof.id}-${slot}`} className="flex-1 min-w-[250px] border-r border-white/[0.03] last:border-r-0 p-1 relative">
                                    {/* Espaço para agendamentos */}
                                    <div className="absolute inset-0 hover:bg-white/[0.02] cursor-pointer transition-colors" />

                                    {/* Mock Agendamento (exemplo) */}
                                    {prof.id === 1 && slot === '10:00' && (
                                        <motion.div
                                            initial={{ scale: 0.95, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="absolute inset-x-2 top-2 h-[150px] z-10 p-4 rounded-2xl glass border-brand-500/30 bg-brand-500/10"
                                        >
                                            <p className="text-[10px] font-black uppercase text-brand-400 mb-1">Manutenção Fibra</p>
                                            <p className="text-sm font-bold">Maria Eduarda</p>
                                            <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-400">
                                                <span>10:00 - 11:30</span>
                                                <span className="px-2 py-0.5 rounded-full bg-brand-500 text-white">R$ 150</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon, color }) {
    return (
        <div className="p-6 rounded-[24px] glass-dark border-white/5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl glass flex items-center justify-center ${color}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                <p className="text-xl font-black tracking-tight">{value}</p>
            </div>
        </div>
    )
}
