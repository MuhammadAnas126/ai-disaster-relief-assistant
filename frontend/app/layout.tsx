import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'AI Disaster Relief',
  description: 'Real-time platform connecting affected people, relief organizations, and dispatch teams during emergencies in Pakistan.',
}

export const viewport = {
  themeColor: '#120D0D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-bg font-sans text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
