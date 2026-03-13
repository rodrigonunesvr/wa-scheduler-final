'use client'

import { useState } from 'react'
import {
    X, Save, Trash2, Calendar, Clock, ArrowRight,
    AlertTriangle, CheckCircle2, Phone, MessageCircle
} from 'lucide-react'
import {
    toSPTime,
    toSPDate,
    fmt,
    whatsappLink,
    parseServices
} from '@/lib/dashboard_utils'

export function AppointmentDetailModal({ apt, onClose, onCancel, onReschedule, onSaveNotes }) {
    const [notes, setNotes] = useState(apt.notes || '')
    const [saving, setSaving] = useState(false)
    const svcs = parseServices(apt.service_id)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="glass-dark border border-white/10 w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                <header className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">Detalhes do Agendamento</h3>
                        <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mt-1">Status: {apt.status}</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={24} /></button>
                </header>

                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</span>
                            <p className="text-lg font-black text-white">{apt.customer_name}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Telefone</span>
                            <a href={whatsappLink(apt.customer_phone)} target="_blank" className="text-lg font-black text-violet-400 flex items-center gap-2 hover:underline">
                                <Phone size={16} /> {apt.customer_phone}
                            </a>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</span>
                            <p className="text-lg font-black text-white">{toSPDate(apt.starts_at)}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Horário</span>
                            <p className="text-lg font-black text-white">{toSPTime(apt.starts_at)}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Serviços Selecionados</span>
                        <div className="flex flex-wrap gap-2">
                            {svcs.map(s => <span key={s} className="bg-violet-500/10 text-violet-400 text-[11px] font-black px-4 py-2 rounded-xl border border-violet-500/20">{s}</span>)}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Anotações Internas</span>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                            className="w-full glass-dark border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-violet-500 transition-all resize-none" />
                    </div>
                </div>

                <footer className="p-8 bg-black/20 border-t border-white/5 grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <button onClick={async () => { setSaving(true); await onSaveNotes(apt.id, notes); setSaving(false) }}
                        className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/5 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all">
                        {saving ? 'SALVANDO...' : <><Save size={16} /> Salvar Notas</>}
                    </button>
                    <button onClick={onReschedule} className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/5 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:bg-violet-600/10 hover:text-violet-400 transition-all border border-transparent hover:border-violet-600/20">
                        <Calendar size={16} /> Reagendar
                    </button>
                    <button onClick={onCancel} className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-red-500/10 text-red-500 font-black text-[11px] uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/20 col-span-2 lg:col-span-1">
                        <Trash2 size={16} /> Cancelar
                    </button>
                </footer>
            </div>
        </div>
    )
}

export function CancelConfirmModal({ apt, onClose, onConfirm }) {
    const [loading, setLoading] = useState(false)
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-dark border border-red-500/20 w-full max-w-md rounded-[40px] p-10 text-center shadow-2xl animate-in zoom-in duration-300">
                <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20 text-red-500">
                    <AlertTriangle size={40} />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Confirmar Cancelamento?</h3>
                <p className="text-slate-500 text-sm font-bold mb-8">Esta ação não pode ser desfeita. O cliente será notificado via WhatsApp sobre o cancelamento.</p>

                <div className="flex flex-col gap-3">
                    <button onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }} disabled={loading}
                        className="w-full py-5 rounded-2xl bg-red-600 text-white font-black text-sm uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 shadow-xl shadow-red-600/20">
                        {loading ? 'CANCELANDO...' : 'SIM, CANCELAR AGENDAMENTO'}
                    </button>
                    <button onClick={onClose} className="w-full py-5 rounded-2xl bg-white/5 text-slate-400 font-black text-sm uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all">
                        MANTER AGENDAMENTO
                    </button>
                </div>
            </div>
        </div>
    )
}

export function NewAppointmentModal({ selectedDate, onClose, onSave }) { return null }
export function BlockModal({ selectedDate, onClose, onSave }) { return null }
export function RescheduleModal({ apt, onClose, onConfirm }) { return null }
