'use client'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function NoAccessClient({ email }: { email?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-forest text-white hover:bg-forest-light transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out{email ? ` (${email})` : ''}
      </button>
    </div>
  )
}
