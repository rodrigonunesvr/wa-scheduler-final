'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, Mail, ArrowRight } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) {
            setError(error.message === 'Invalid login credentials' ? 'Credenciais inválidas' : error.message)
            setLoading(false)
        } else {
            router.push('/')
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-200">
                        <Lock className="text-white w-8 h-8" />
                    </div>
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900">
                    Acesso Exclusivo
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500 font-medium">
                    Painel Administrativo do Estabelecimento
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-100">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">E-mail</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl shadow-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 sm:text-sm font-medium transition-all" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Senha</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl shadow-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 sm:text-sm font-medium transition-all" />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl bg-red-50 p-4 border border-red-100">
                                <div className="text-sm text-red-700 font-medium text-center">{error}</div>
                            </div>
                        )}

                        <div className="pt-2">
                            <button type="submit" disabled={loading}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-violet-200 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 transition-all active:scale-95">
                                {loading ? 'Entrando...' : 'Acessar Painel'} {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
