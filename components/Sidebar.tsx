'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, BookOpen, Search, Clock, FlaskConical, Settings, Archive, LogOut, Package } from 'lucide-react'


const nav = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/browse',      label: 'Browse',       icon: BookOpen },
  { href: '/search',      label: 'Search',       icon: Search },
  { href: '/timeline',    label: 'Timeline',     icon: Clock },
  { href: '/collections', label: 'Collections',  icon: Package },
  { href: '/extract',     label: 'Extract',      icon: FlaskConical },
  { href: '/settings',    label: 'Settings',     icon: Settings },
]

interface User { email?: string | null }

export default function Sidebar({ user }: { user?: User }) {
  const path = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-forest flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-forest-light">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-ember flex items-center justify-center">
            <Archive className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-serif font-bold text-base leading-tight">Bapaji</p>
            <p className="text-green-400 text-xs">Life Archive</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active ? 'bg-forest-light text-white' : 'text-green-200 hover:bg-forest-light hover:text-white'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-4 py-4 border-t border-forest-light">
          <p className="text-green-400 text-xs truncate px-1 mb-2">{user.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-green-300 hover:bg-forest-light hover:text-white transition-all"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
