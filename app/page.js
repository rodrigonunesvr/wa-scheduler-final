import { supabase } from '@/lib/supabase'
import moment from 'moment-timezone'
import { Calendar, Clock, User, CheckCircle2, Phone, Briefcase } from 'lucide-react'

const TIMEZONE = 'America/Sao_Paulo'

export const dynamic = 'force-dynamic'

export default async function Home() {
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD')

    // Fetch today's confirmed appointments
    const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'CONFIRMED')
        .gte('starts_at', today + 'T00:00:00')
        .lte('starts_at', today + 'T23:59:59')
        .order('starts_at', { ascending: true })

    if (error) console.error('Supabase Error:', error)

    return (
        <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased text-slate-900">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Espaço C.A.</h1>
                        <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium">
                            <Calendar size={18} className="text-indigo-500" />
                            {moment().tz(TIMEZONE).format('DD [de] MMMM, YYYY')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-green-50 text-green-700 px-5 py-2.5 rounded-full text-sm font-semibold border border-green-100 self-start md:self-center">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        Cérebro IA Ativo
                    </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                    {/* Summary Cards */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Total Hoje</h3>
                        <p className="text-4xl font-black text-indigo-600 tracking-tight">{appointments?.length || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Próximo Horário</h3>
                        <p className="text-xl font-bold text-slate-800">
                            {appointments?.[0]
                                ? moment(appointments[0].starts_at).tz(TIMEZONE).format('HH:mm')
                                : '--:--'}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl shadow-lg border border-indigo-500 text-white">
                        <h3 className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-2 leading-none">Status WhatsApp</h3>
                        <p className="text-xl font-bold flex items-center gap-2">
                            <CheckCircle2 size={20} /> Conectado
                        </p>
                    </div>
                </div>

                {/* Appointments List */}
                <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-extrabold flex items-center gap-2 tracking-tight">
                            <Clock className="text-indigo-500" /> Agenda do Dia
                        </h2>
                        <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-tighter">
                            Atualizado agora
                        </span>
                    </div>

                    <div className="space-y-4">
                        {!appointments || appointments.length === 0 ? (
                            <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                                    <Calendar className="text-slate-300" size={32} />
                                </div>
                                <p className="text-slate-500 font-medium">Nenhum agendamento confirmado para hoje.</p>
                                <p className="text-slate-400 text-sm mt-1">As mensagens via WhatsApp aparecerão aqui automaticamente.</p>
                            </div>
                        ) : (
                            appointments.map((apt) => (
                                <div key={apt.id} className="group relative flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-xl transition-all duration-300 active:scale-[0.98]">
                                    <div className="flex items-center gap-5">
                                        <div className="bg-slate-900 text-white h-16 w-16 rounded-2xl flex flex-col items-center justify-center shadow-lg group-hover:bg-indigo-600 transition-colors">
                                            <span className="text-lg font-black leading-none">{moment(apt.starts_at).tz(TIMEZONE).format('HH:mm')}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                                {apt.customer_name}
                                            </p>
                                            <div className="flex flex-wrap gap-3 mt-1.5">
                                                <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium whitespace-nowrap">
                                                    <Briefcase size={14} className="text-indigo-400" /> {apt.service_id}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-sm text-slate-400 font-medium whitespace-nowrap">
                                                    <Phone size={14} className="text-slate-300" /> {apt.customer_phone}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hidden sm:block">
                                        <div className="bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-green-100 group-hover:bg-green-600 group-hover:text-white transition-all">
                                            Confirmado
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                        }
                    </div>
                </section>

                <footer className="mt-12 text-center text-slate-400 text-sm font-medium">
                    <div className="flex items-center justify-center gap-4 mb-4 opacity-50">
                        <span className="w-12 h-px bg-slate-300"></span>
                        <p>Plataforma Inteligente Espaço C.A.</p>
                        <span className="w-12 h-px bg-slate-300"></span>
                    </div>
                    <p>Webhook URL: <code className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">/api/webhook</code></p>
                </footer>
            </div>
        </main>
    )
}
