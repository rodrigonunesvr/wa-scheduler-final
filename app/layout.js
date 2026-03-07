import './globals.css'

export const metadata = {
    title: 'AGENDAÍ | SaaS de Agendamento Elite',
    description: 'A plataforma de agendamento mais sofisticada para o mercado de estética.',
    manifest: '/manifest.json',
    themeColor: '#7c3aed',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'AGENDAÍ',
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
            <body className="min-h-screen">
                <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-900/20 via-slate-900 to-black"></div>
                {children}
            </body>
        </html>
    )
}
