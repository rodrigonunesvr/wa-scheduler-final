'use client'

import { Calendar, Users, BarChart3, Settings, ClipboardList, LogOut, Search, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminLayout({ children }) {
    const pathname = usePathname()

    const menuItems = [
        { icon: Calendar, label: 'Muro de Agendas', href: '/admin' },
        { icon: Users, label: 'Profissionais', href: '/admin/equipe' },
        { icon: ClipboardList, label: 'Clientes', href: '/admin/clientes' },
        { icon: BarChart3, label: 'Financeiro', href: '/admin/financeiro' },
        { icon: Settings, label: 'Configurações', href: '/admin/config' },
    ]

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden">
            {/* Sidebar Elite */}
            <aside className="w-72 bg-slate-900/50 backdrop-blur-xl border-r border-white/5 flex flex-col">
                <div className="p-8">
                    <h2 className="text-2xl font-black tracking-tighter">
                        AGENDA<span className="text-brand-400 font-bold">Í</span>
                        <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">Admin Dashboard</span>
                    </h2>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group ${pathname === item.href
                                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20 shadow-lg shadow-brand-500/5'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <item.icon size={20} className={pathname === item.href ? 'text-brand-400' : 'group-hover:text-white'} />
                            <span className="font-semibold text-sm">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-6 border-t border-white/5">
                    <button className="flex items-center gap-4 px-4 py-3 w-full text-slate-500 hover:text-red-400 transition-colors">
                        <LogOut size={20} />
                        <span className="font-bold text-sm">Sair</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/20 backdrop-blur-md">
                    <div className="relative w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar cliente, serviço ou profissional..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-sm focus:border-brand-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-brand-500 rounded-full border-2 border-black"></span>
                        </button>
                        <div className="flex items-center gap-3 border-l border-white/10 pl-6 cursor-pointer group">
                            <div className="text-right">
                                <p className="text-sm font-bold group-hover:text-brand-400 transition-colors">Rodrigo</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Proprietário</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center font-bold text-brand-400">
                                R
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dynamic Content */}
                <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-slate-900/50 to-transparent">
                    {children}
                </div>
            </main>
        </div>
    )
}
