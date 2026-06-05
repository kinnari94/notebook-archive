import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { getServerSession } from 'next-auth'
import SessionProvider from '@/components/SessionProvider'
import { ExtractionProvider } from '@/components/ExtractionContext'
import ExtractionBar from '@/components/ExtractionBar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'Bapaji Life Archive',
  description: 'SRMD Spiritual Biography Archive',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()

  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        <SessionProvider session={session}>
          <ExtractionProvider>
            {session?.user && (
              <Sidebar user={{ email: session.user.email }} />
            )}
            <main className={session?.user ? 'ml-60 min-h-screen' : 'min-h-screen'}>
              {children}
            </main>
            <ExtractionBar />
          </ExtractionProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
