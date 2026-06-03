import type { Metadata, Viewport } from 'next'
import { Outfit, JetBrains_Mono } from 'next/font/google'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { DataProvider } from '@/lib/DataStore'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'MaintaFood — GMAO',
  description: 'Gestion de maintenance industrielle · Industrie alimentaire · IFS BRC ISO 22000',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MaintaFood' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
}

export const viewport: Viewport = {
  themeColor: '#22c55e', width: 'device-width',
  initialScale: 1, maximumScale: 1, userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <AuthProvider>
          <DataProvider>
            <ServiceWorkerRegister />
            {children}
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
