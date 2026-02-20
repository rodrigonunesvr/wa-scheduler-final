import './globals.css'

export const metadata = {
    title: 'Espaço C.A. — Dashboard',
    description: 'Dashboard de Agendamentos - Espaço Camille Almeida',
    manifest: '/manifest.json',
    themeColor: '#7c3aed',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Espaço C.A.',
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
            <body className="bg-gray-100 min-h-screen">{children}</body>
        </html>
    )
}
