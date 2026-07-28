'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, BookOpen, Search, Clock, FlaskConical, Archive, LogOut, Package, Users, Menu, X,
} from 'lucide-react'
import { hasViewAccess, type ViewPermissions } from '@/lib/permissions'

const nav = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard, viewKey: 'dashboard' },
  { href: '/browse',      label: 'Browse',       icon: BookOpen,        viewKey: 'browse' },
  { href: '/search',      label: 'Search',       icon: Search,          viewKey: 'search' },
  { href: '/timeline',    label: 'Timeline',     icon: Clock,           viewKey: 'timeline' },
  { href: '/collections', label: 'Collections',  icon: Package,         viewKey: 'collections' },
  { href: '/extract',     label: 'Extract',      icon: FlaskConical,    viewKey: 'extract' },
  { href: '/users',       label: 'Users',        icon: Users,           viewKey: 'users' },
]

interface User {
  email?: string | null
  role?: string | null
  permissions?: ViewPermissions | null
}

export default function Sidebar({ user }: { user?: User }) {
  const path = usePathname()
  const isAdmin = user?.role === 'admin'
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleNav = nav.filter(({ viewKey }) => {
    if (viewKey === 'users') return isAdmin
    return hasViewAccess(user?.role, user?.permissions, viewKey)
  })

  // Close the off-canvas menu on navigation, so switching pages doesn't leave it open.
  useEffect(() => { setMobileOpen(false) }, [path])

  return (
    <>
      {/* Mobile top bar — the sidebar itself is off-canvas below md, this is what's
          always visible on phones/tablets to reach the nav. */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-forest flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-ember flex items-center justify-center shrink-0">
            <Archive className="w-4 h-4 text-white" />
          </div>
          <p className="text-white font-serif font-bold text-sm leading-tight">Bapaji</p>
        </div>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="p-2 -mr-2 text-white hover:bg-forest-light rounded-lg transition-colors"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Backdrop — mobile/tablet only, dismisses the off-canvas menu */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-60 sm:w-64 md:w-60 bg-forest flex flex-col z-40 transition-transform duration-200 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Logo */}
        <div className="px-6 py-7 border-b border-forest-light shrink-0">
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
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {visibleNav.map(({ href, label, icon: Icon }) => {
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
          <div className="px-4 py-4 border-t border-forest-light shrink-0">
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
    </>
  )
}
