'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, Mail, ArrowRight, Eye, EyeOff, UserPlus, KeyRound, ChevronLeft, Sparkles } from 'lucide-react'

export default function LoginPage() {
    const [mode, setMode] = useState('login') // 'login' | 'signup' | 'recovery'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleAuth = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
                router.push('/')
            }
            else if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: name }
                    }
                })
                if (error) throw error
                setSuccess('Cadastro realizado! Verifique seu e-mail para confirmar.')
                setTimeout(() => setMode('login'), 3000)
            }
            else if (mode === 'recovery') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/login?mode=update`,
                })
                if (error) throw error
                setSuccess('Link de recuperaÃ§Ã£o enviado para seu e-mail!')
            }
        } catch (err) {
            let msg = err.message
            if (msg === 'Invalid login credentials') msg = 'E-mail ou senha incorretos'
            if (msg === 'User already registered') msg = 'Este e-mail jÃ¡ possui cadastro'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const renderHeader = () => (
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-violet-200 rotate-3 hover:rotate-0 transition-transform duration-300">
                    <Sparkles className="text-white w-10 h-10 animate-pulse" />
                </div>
            </div>
            <h2 className="text-center text-4xl font-black text-slate-900 tracking-tight">
                AgendaÃ
            </h2>
            <p className="mt-3 text-center text-sm text-slate-500 font-medium">
                {mode === 'login' ? 'Agende o sucesso do seu negÃ³cio.' :
                    mode === 'signup' ? 'Crie sua conta profissional hoje.' :
                        'Recupere o acesso ao seu painel.'}
            </p>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
            {renderHeader()}

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-10 px-6 shadow-[0_20px_50px_rgba(124,58,237,0.08)] sm:rounded-[2rem] sm:px-12 border border-slate-100 relative overflow-hidden">

                    {/* Progress indicator (Subtle) */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
                        <div className={`h-full bg-violet-500 transition-all duration-500 ${loading ? 'w-full animate-pulse' : 'w-0'}`} />
                    </div>

                    <form className="space-y-5" onSubmit={handleAuth}>
                        {mode === 'signup' && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2 ml-1">Nome Completo</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-violet-500">
                                        <UserPlus size={18} />
                                    </div>
                                    <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Como gostaria de ser chamado?"
                                        className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all" />
                                </div>
                            </div>
                        )}

                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2 ml-1">E-mail Corporativo</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-violet-500">
                                    <Mail size={18} />
                                </div>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@exemplo.com"
                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all" />
                            </div>
                        </div>

                        {mode !== 'recovery' && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-2 ml-1">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Senha</label>
                                    {mode === 'login' && (
                                        <button type="button" onClick={() => setMode('recovery')} className="text-[10px] font-bold text-violet-500 hover:text-violet-600 transition-colors uppercase tracking-widest">Esqueci Senha</button>
                                    )}
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-violet-500">
                                        <Lock size={18} />
                                    </div>
                                    <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                        className="block w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-300 hover:text-violet-500 transition-colors">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-2xl bg-red-50 p-4 border border-red-100 animate-in zoom-in-95 duration-200">
                                <div className="flex items-center gap-2 text-xs text-red-600 font-bold">
                                    <AlertTriangle size={14} /> {error}
                                </div>
                            </div>
                        )}

                        {success && (
                            <div className="rounded-2xl bg-green-50 p-4 border border-green-100 animate-in zoom-in-95 duration-200">
                                <div className="flex items-center gap-2 text-xs text-green-600 font-bold">
                                    <CheckCircle2 size={14} /> {success}
                                </div>
                            </div>
                        )}

                        <div className="pt-2">
                            <button type="submit" disabled={loading}
                                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-[1.25rem] shadow-xl shadow-violet-500/10 text-xs font-black uppercase tracking-[0.2em] text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-500/20 disabled:opacity-50 transition-all active:scale-[0.98]">
                                {loading ? 'Processando...' :
                                    mode === 'login' ? 'Acessar Painel' :
                                        mode === 'signup' ? 'Finalizar Cadastro' :
                                            'Enviar Link'}
                                {!loading && <ArrowRight className="ml-3 h-4 w-4" />}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 text-center space-y-4">
                        {mode === 'login' ? (
                            <p className="text-xs text-slate-500 font-bold">
                                NÃ£o possui conta?
                                <button onClick={() => setMode('signup')} className="ml-2 text-violet-500 hover:text-violet-600 transition-colors uppercase tracking-widest text-[10px]">Cadastre seu negÃ³cio</button>
                            </p>
                        ) : (
                            <button onClick={() => setMode('login')} className="flex items-center justify-center gap-2 mx-auto text-xs font-bold text-slate-400 hover:text-violet-500 transition-all">
                                <ChevronLeft size={16} /> Voltar para o login
                            </button>
                        )}
                    </div>
                </div>

                <p className="mt-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                    &copy; {new Date().getFullYear()} AgendaÃ SaaS â€” SoluÃ§Ãµes Inteligentes
                </p>
            </div>
        </div>
    )
}

function AlertTriangle(props) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}

function CheckCircle2(props) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></svg>
}
