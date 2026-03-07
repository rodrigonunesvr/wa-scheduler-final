const fs = require('fs')
const path = require('path')

const targetPath = 'c:/ANTIGRAVITY PROJETOS/Espaço C.A. — WhatsApp Scheduler (n8n + Z-API + Supabase)/wa-scheduler-v5-V32/app/page.js'
let content = fs.readFileSync(targetPath, 'utf8')

// 1. Remove hardcoded SERVICES
content = content.replace(/const SERVICES = \[[\s\S]*?\]\n/, 'let SERVICES = []\n')

// 2. Add global services fetcher inside AdminDashboard (or as a hook)
// Let's add the state inside AdminDashboard
content = content.replace(
    /const \[currentDate, setCurrentDate\] = useState\(new Date\(\)\)/,
    `const [globalServices, setGlobalServices] = useState([])\n    const [currentDate, setCurrentDate] = useState(new Date())`
)

content = content.replace(
    /fetch\(\`\/api\/admin\?type=schedule\`\)\n            \]\)/,
    `fetch(\`/api/admin?type=schedule\`),
                fetch('/api/services')
            ])`
)

content = content.replace(
    /const schData = await schRes\.json\(\)\n            const apts = Array\.isArray\(aptData\) \? aptData : \[\]/,
    `const schData = await schRes.json()
            const svcRes = await arguments[0][3] // The 4th element in promise.all is the services Response. Wait, let's fix Promise.all
            `
)
// Actually, it's safer to just rewrite the fetchAppointments function completely to include services
const fetchReplacer = `const fetchAppointments = useCallback(async () => {
        setLoading(true)
        const s = new Date(currentDate); s.setDate(1); s.setMonth(s.getMonth() - 1)
        const e = new Date(currentDate); e.setMonth(e.getMonth() + 2)
        try {
            const [aptRes, blkRes, schRes, svcRes] = await Promise.all([
                fetch(\`/api/admin?start=\${fmt(s)}&end=\${fmt(e)}\`),
                fetch(\`/api/admin?type=blocks&start=\${fmt(s)}&end=\${fmt(e)}\`),
                fetch(\`/api/admin?type=schedule\`),
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
            
            if (Array.isArray(svcData)) {
                SERVICES = svcData
                setGlobalServices(svcData)
            }
            
            // Badge for new appointments
            const confirmedCount = apts.filter(a => a.status === 'CONFIRMED').length
            if (lastCount > 0 && confirmedCount > lastCount) {
                setNewBadge(confirmedCount - lastCount)
            }
            setLastCount(confirmedCount)
        } catch (err) { console.error(err) }
        setLoading(false)
    }, [currentDate, lastCount])`

// Replace the old fetchAppointments
content = content.replace(/const fetchAppointments = useCallback[\s\S]*?setLoading\(false\)\n    \}, \[currentDate, lastCount\]\)/, fetchReplacer)

// 3. Rewrite ServicesPage Component
const newServicesPage = `// ─── Services Page ─────────────────────────────────────────
function ServicesPage({ isMobile, onOpenMenu, globalServices, refreshGlobal }) {
    const [services, setServices] = useState(globalServices || [])
    const [editing, setEditing] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [isAdding, setIsAdding] = useState(false)
    const [addForm, setAddForm] = useState({ name: '', price: '', duration: '', active: true })
    const [loading, setLoading] = useState(false)
    
    useEffect(() => {
        setServices(globalServices || [])
    }, [globalServices])

    const startEdit = (svc) => {
        setEditing(svc.id)
        setEditForm({ name: svc.name, price: svc.price, duration: svc.duration, active: svc.active })
    }

    const saveEdit = async (id) => {
        setLoading(true)
        try {
            await fetch('/api/services', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...editForm })
            })
            refreshGlobal()
            setEditing(null)
        } catch(e) {}
        setLoading(false)
    }
    
    const handleAdd = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            await fetch('/api/services', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addForm)
            })
            setIsAdding(false)
            setAddForm({ name: '', price: '', duration: '', active: true })
            refreshGlobal()
        } catch (e) {}
        setLoading(false)
    }

    const toggleActive = async (svc) => {
        setLoading(true)
        try {
            await fetch('/api/services', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: svc.id, active: !svc.active })
            })
            refreshGlobal()
        } catch(e) {}
        setLoading(false)
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                            <Scissors className="text-violet-500" size={24} /> 
                            Serviços
                        </h2>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5 ml-8">Gerencie o catálogo do bot e do sistema.</p>
                    </div>
                </div>
                <button onClick={() => setIsAdding(!isAdding)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-violet-500/30 transition-all active:scale-95">
                    {isAdding ? <X size={16} /> : <Plus size={16} />}
                    <span className="hidden sm:inline">{isAdding ? 'Cancelar' : 'Novo Serviço'}</span>
                </button>
            </header>
            
            <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
                {isAdding && (
                    <div className="bg-white rounded-2xl border border-violet-200 shadow-xl shadow-violet-500/5 p-5 md:p-6 mb-6 transform transition-all">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus className="text-violet-500" size={16}/> Adicionar Novo Serviço</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nome do Serviço</label>
                                <input type="text" required value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-sm font-medium transition-all" placeholder="Ex: Blindagem de Unhas" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Preço (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                                        <input type="number" required value={addForm.price} onChange={e => setAddForm({...addForm, price: e.target.value})} className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-sm font-bold transition-all" placeholder="0.00" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Duração (Min)</label>
                                    <div className="relative">
                                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="number" required value={addForm.duration} onChange={e => setAddForm({...addForm, duration: e.target.value})} className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none text-sm font-medium transition-all" placeholder="60" />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors disabled:opacity-50">
                                    {loading ? 'Salvando...' : 'Salvar Serviço'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                    {services.length === 0 && !loading && (
                        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
                            <Scissors className="mx-auto text-slate-300 mb-3" size={32} />
                            <p className="text-slate-500 font-medium">Nenhum serviço cadastrado ainda.</p>
                            <p className="text-xs text-slate-400 mt-1">Clique em "Novo Serviço" para começar.</p>
                        </div>
                    )}
                    {services.map(svc => (
                        <div key={svc.id} className={\`bg-white rounded-2xl border transition-all \${!svc.active ? 'border-red-100 opacity-60 bg-slate-50' : 'border-slate-200 hover:border-violet-300 hover:shadow-md'}\`}>
                            {editing === svc.id ? (
                                <div className="p-4 md:p-5">
                                    <div className="flex flex-col md:flex-row gap-3">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nome</label>
                                            <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-violet-200 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-100" />
                                        </div>
                                        <div className="flex items-end gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">R$</label>
                                                <input type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} className="w-20 px-3 py-2 rounded-lg border border-violet-200 font-bold text-center outline-none focus:ring-2 focus:ring-violet-100" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Min.</label>
                                                <input type="number" value={editForm.duration} onChange={e => setEditForm({...editForm, duration: e.target.value})} className="w-16 px-3 py-2 rounded-lg border border-violet-200 font-medium text-center outline-none focus:ring-2 focus:ring-violet-100" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => saveEdit(svc.id)} disabled={loading} className="bg-green-500 text-white p-2.5 rounded-lg hover:bg-green-600 transition-colors shadow-sm"><Save size={16} /></button>
                                                <button onClick={() => setEditing(null)} className="bg-slate-100 text-slate-500 p-2.5 rounded-lg hover:bg-slate-200 transition-colors"><X size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 md:p-5">
                                    <div className="flex items-center gap-4">
                                        <button 
                                            onClick={() => toggleActive(svc)} 
                                            disabled={loading}
                                            className={\`w-10 h-6 rounded-full p-1 transition-colors \${svc.active ? 'bg-green-500' : 'bg-slate-300'}\`}
                                            title={svc.active ? 'Desativar Serviço' : 'Ativar Serviço'}
                                        >
                                            <div className={\`w-4 h-4 rounded-full bg-white transition-transform \${svc.active ? 'translate-x-4' : 'translate-x-0'}\`} />
                                        </button>
                                        <div>
                                            <h4 className={\`font-bold text-base md:text-lg \${svc.active ? 'text-slate-800' : 'text-slate-500 line-through'}\`}>{svc.name}</h4>
                                            {svc.active ? (
                                                <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">Ativo no Bot</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">Oculto</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 md:gap-6">
                                        <div className="text-right hidden sm:block">
                                            <div className="text-lg font-black text-violet-600">R$ {svc.price}</div>
                                            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 justify-end"><Clock size={12}/> {svc.duration} min</div>
                                        </div>
                                        <div className="text-right sm:hidden">
                                            <div className="text-sm font-black text-violet-600">R$ {svc.price}</div>
                                            <div className="text-[10px] text-slate-500">{svc.duration}m</div>
                                        </div>
                                        
                                        <button onClick={() => startEdit(svc)} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-200 transition-all shadow-sm">
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}`
content = content.replace(/\/\/ ─── Services Page [\s\S]*?function ServicesPage\(\{ isMobile, onOpenMenu \}\) \{[\s\S]*?\n\}/, newServicesPage)

// Pass globalServices to ServicesPage call
content = content.replace(
    /activePage === 'servicos' && <ServicesPage isMobile={isMobile} onOpenMenu={\(\) => setSidebarOpen\(true\)} \/>/,
    `activePage === 'servicos' && <ServicesPage isMobile={isMobile} onOpenMenu={() => setSidebarOpen(true)} globalServices={globalServices} refreshGlobal={() => setRefreshKey(k => k + 1)} />`
)

fs.writeFileSync(targetPath, content, 'utf8')
console.log('Patch complete.')
