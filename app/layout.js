import './globals.css'

export const metadata = {
    title: 'AgendaÃ â€” InteligÃªncia em Agendamentos',
    description: 'Sistema de Agendamento Inteligente para SalÃµes, Barbearias e ClÃ­nicas.',
    manifest: '/manifest.json',
    themeColor: '#7c3aed',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'AgendaÃ',
    },
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    },
}

export default function RootLayout({ children }) {
    return (
        <html lang="pt-BR">
            <head>
                <link rel="apple-touch-icon" href="/icon-192.png" />
                <meta name="mobile-web-app-capable" content="yes" />
            </head>
            <body className="bg-gray-100 min-h-screen p-4">{children}</body>
        </html>
    )
}
