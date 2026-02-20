export default function Home() {
    return (
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-8">
            <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">Status do Sistema</div>
            <h1 className="block mt-1 text-lg leading-tight font-medium text-black">Cérebro IA Ativo 🤖</h1>
            <p className="mt-2 text-gray-500">Este projeto é uma API (Backend) para o WhatsApp.</p>

            <div className="mt-4 p-4 bg-gray-50 rounded text-sm font-mono text-gray-600">
                <p>Webhook URL: /api/webhook</p>
                <p className="mt-2">Status: 🟢 Aguardando mensagens...</p>
            </div>
        </div>
    )
}
