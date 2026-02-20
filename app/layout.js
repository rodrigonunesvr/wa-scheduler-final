import './globals.css'

export const metadata = {
    title: 'WA Scheduler Bot',
    description: 'AI Auto-Attendant Brain',
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="bg-gray-100 min-h-screen p-4">{children}</body>
        </html>
    )
}
