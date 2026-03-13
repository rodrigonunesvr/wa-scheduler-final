'use client'

import { useState } from 'react'
import {
    Settings, Award, Bot, CheckCircle2, LayoutGrid, Users,
    Scissors, BarChart3, Clock, Lock, Search, Filter,
    Download, FileText, ChevronRight, MoreVertical
} from 'lucide-react'

// ─── Settings Page (SaaS Logic) ───────────────────────────
export function SettingsPage({ initialBusinessName, initialBotPrompt, onSave, isMobile, onOpenMenu }) {
    const [name, setName] = useState(initialBusinessName)
    const [prompt, setPrompt] = useState(initialBotPrompt)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_name: name, bot_prompt: prompt })
            })
            if (res.ok) {
                setSuccess(true)
                onSave()
                setTimeout(() => setSuccess(false), 3000)
            }
        } catch (e) { console.error(e) }
        setSaving(false)
    }

    return (
        <div className="flex flex-col h-full bg-slate-950 text-white p-6 md:p-8 animate-in fade-in slide-in-from-bottom-5 custom-scrollbar overflow-y-auto">
            <header className="flex items-center gap-4 mb-10">
                {isMobile && <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500"><LayoutGrid size={24} /></button>}
                <div>
                    <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Settings className="text-violet-500" size={32} /> Configurações Gerais
                    </h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px] mt-1 ml-1">Personalize a identidade e o comportamento do robô.</p>
                </div>
            </header>

            <div className="max-w-3xl space-y-10">
                <section className="glass-dark border border-white/5 rounded-[40px] p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Award className="text-violet-500" size={24} />
                        <h3 className="text-xl font-black">Identidade do Estabelecimento</h3>
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 px-1">Nome da Empresa</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            className="w-full glass-dark border border-white/10 rounded-2xl px-6 py-4 text-white text-lg font-bold outline-none focus:border-violet-500 transition-all placeholder:text-slate-800" placeholder="Ex: Barber Shop Premium" />
                    </div>
                </section>

                <section className="glass-dark border border-white/5 rounded-[40px] p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Bot className="text-violet-500" size={24} />
                        <h3 className="text-xl font-black">Inteligência da Clara (Bot)</h3>
                    </div>
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 px-1">Instruções de Personalidade</label>
                        <p className="text-[11px] text-slate-500 mb-4 px-1 leading-relaxed">Defina como a Clara deve falar, quais serviços enfatizar ou promoções vigentes.</p>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={8}
                            className="w-full glass-dark border border-white/10 rounded-3xl px-6 py-5 text-white text-sm font-medium outline-none focus:border-violet-500 transition-all resize-none leading-relaxed custom-scrollbar"
                            placeholder="Ex: Você é a Clara, assistente da Barber Shop..." />
                    </div>
                </section>

                <div className="flex items-center gap-6 pt-6 mb-10">
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 md:flex-none px-12 py-5 rounded-[28px] bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black text-sm uppercase tracking-widest hover:scale-[1.05] shadow-2xl shadow-violet-600/30 transition-all active:scale-[0.98] disabled:opacity-50">
                        {saving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}
                    </button>
                    {success && <div className="flex items-center gap-2 text-green-400 font-black text-xs uppercase animate-in fade-in zoom-in"><CheckCircle2 size={18} /> Salvo com sucesso!</div>}
                </div>
            </div>
        </div>
    )
}

// ─── Placeholder Sections (Keep simple for now) ───────────
export function ClientsPage({ isMobile, onOpenMenu }) {
    return (
        <div className="p-8 h-full bg-slate-950">
            <header className="flex items-center gap-4 mb-10">
                {isMobile && <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500"><LayoutGrid size={24} /></button>}
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3"><Users className="text-violet-500" size={32} /> Clientes</h2>
            </header>
            <div className="glass-dark rounded-[40px] p-10 text-center border border-white/5">
                <Users className="mx-auto text-slate-800 mb-4" size={64} />
                <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Lista de Clientes em breve.</p>
            </div>
        </div>
    )
}

export function ServicesPage({ isMobile, onOpenMenu, globalServices, refreshGlobal }) {
    // Basic implementation to avoid blank screen
    return (
        <div className="p-8 h-full bg-slate-950">
            <header className="flex items-center gap-4 mb-10">
                {isMobile && <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500"><LayoutGrid size={24} /></button>}
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3"><Scissors className="text-violet-500" size={32} /> Serviços</h2>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {globalServices.map(svc => (
                    <div key={svc.id} className="glass-dark border border-white/5 rounded-3xl p-6 hover:border-violet-500/30 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-black text-lg text-white">{svc.name}</h3>
                            <span className="bg-violet-500/10 text-violet-400 text-xs font-black px-3 py-1 rounded-xl">R$ {svc.price}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                            <Clock size={14} /> {svc.duration} minutos
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function ReportsPage({ appointments, isMobile, onOpenMenu }) {
    return (
        <div className="p-8 h-full bg-slate-950">
            <header className="flex items-center gap-4 mb-10">
                {isMobile && <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500"><LayoutGrid size={24} /></button>}
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3"><BarChart3 className="text-violet-500" size={32} /> Relatórios</h2>
            </header>
            <div className="glass-dark rounded-[40px] p-10 text-center border border-white/5">
                <BarChart3 className="mx-auto text-slate-800 mb-4" size={64} />
                <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Módulo de faturamento consolidado.</p>
            </div>
        </div>
    )
}

export function SchedulePage({ isMobile, onOpenMenu, overrides, onRefresh, isDayOpen }) {
    return (
        <div className="p-8 h-full bg-slate-950">
            <header className="flex items-center gap-4 mb-10">
                {isMobile && <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500"><LayoutGrid size={24} /></button>}
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3"><Clock className="text-violet-500" size={32} /> Horários Exceção</h2>
            </header>
            <div className="glass-dark rounded-[40px] p-10 text-center border border-white/5">
                <Clock className="mx-auto text-slate-800 mb-4" size={64} />
                <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Bloqueio de horários e feriados.</p>
            </div>
        </div>
    )
}
