'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Users, Plus, Trash2, Loader2, CheckCircle, XCircle,
  ShieldCheck, ShieldOff, RefreshCw, UserPlus, ChevronDown, SlidersHorizontal,
  Eye, Pencil, EyeOff,
} from 'lucide-react'
import { DEFAULT_GUEST_PERMISSIONS, VIEW_KEYS, VIEW_LABELS } from '@/lib/permissions'
import type { Permission, ViewPermissions } from '@/lib/permissions'

type Role = 'admin' | 'guest'

interface AllowedUser {
  email: string
  addedAt: string
  role: Role
  permissions: ViewPermissions | null
}

const PERM_OPTIONS: { value: Permission; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'view',
    label: 'View Only',
    icon: <Eye className="w-3.5 h-3.5" />,
    color: 'text-blue-600',
  },
  {
    value: 'edit',
    label: 'Edit',
    icon: <Pencil className="w-3.5 h-3.5" />,
    color: 'text-emerald-600',
  },
  {
    value: 'no_access',
    label: 'No Access',
    icon: <EyeOff className="w-3.5 h-3.5" />,
    color: 'text-red-500',
  },
]

function permLabel(p: Permission) {
  return PERM_OPTIONS.find(o => o.value === p)?.label ?? p
}

function permColor(p: Permission) {
  return PERM_OPTIONS.find(o => o.value === p)?.color ?? 'text-muted'
}

function UserAvatar({ email }: { email: string }) {
  const initials = email.split('@')[0].slice(0, 2).toUpperCase()
  const palette = [
    'bg-emerald-100 text-emerald-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ]
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${palette[email.charCodeAt(0) % palette.length]}`}>
      {initials}
    </div>
  )
}

function RoleBadge({ role, loading, onChange }: { role: Role; loading: boolean; onChange: (r: Role) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={loading}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
          role === 'admin'
            ? 'bg-forest/10 text-forest hover:bg-forest/20'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
        {role}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-32 bg-white border border-border rounded-xl shadow-lg z-20 overflow-hidden">
          {(['admin', 'guest'] as Role[]).map(r => (
            <button
              key={r}
              onClick={() => { onChange(r); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-cream transition-colors ${r === role ? 'text-forest font-semibold' : 'text-ink'}`}
            >
              {r === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
              {r}
              {r === role && <CheckCircle className="w-3 h-3 ml-auto text-forest" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PermissionsPanel({
  email,
  permissions,
  saving,
  onUpdate,
}: {
  email: string
  permissions: ViewPermissions
  saving: Set<string>
  onUpdate: (email: string, view: string, perm: Permission) => void
}) {
  return (
    <div className="border-t border-border bg-cream/50 px-5 py-4">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">View Permissions</p>
      <div className="grid gap-2">
        {VIEW_KEYS.map(view => {
          const current: Permission = permissions[view] ?? 'view'
          const key = `${email}:${view}`
          const isSaving = saving.has(key)
          return (
            <div key={view} className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink font-medium w-28 shrink-0">{VIEW_LABELS[view]}</span>
              <div className="relative flex-1 max-w-[180px]">
                <select
                  value={current}
                  disabled={isSaving}
                  onChange={e => onUpdate(email, view, e.target.value as Permission)}
                  className={`w-full appearance-none pl-7 pr-7 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ember/20 ${
                    current === 'no_access'
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : current === 'edit'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700'
                  }`}
                >
                  {PERM_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {/* Left icon */}
                <span className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${permColor(current)}`}>
                  {isSaving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : PERM_OPTIONS.find(o => o.value === current)?.icon}
                </span>
                {/* Right chevron */}
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-current opacity-50 pointer-events-none" />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted mt-3 italic">
        &quot;No Access&quot; hides the view from the sidebar. Changes take effect on next sign-in.
      </p>
    </div>
  )
}

function Toast({ msg, onDismiss }: { msg: { ok: boolean; text: string }; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium z-50 ${msg.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {msg.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {msg.text}
    </div>
  )
}

export default function UsersClient({ currentEmail }: { currentEmail: string }) {
  const [users, setUsers] = useState<AllowedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('guest')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [savingPerms, setSavingPerms] = useState<Set<string>>(new Set())
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/allowed-users')
      const d = await r.json()
      setUsers(d.users ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function addUser() {
    const email = newEmail.trim().toLowerCase()
    if (!email.includes('@')) return
    setAdding(true)
    try {
      const r = await fetch('/api/allowed-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: newRole }),
      })
      if (r.ok) {
        setNewEmail('')
        setNewRole('guest')
        await load()
        setToast({ ok: true, text: `${email} added as ${newRole}` })
        inputRef.current?.focus()
      } else {
        setToast({ ok: false, text: 'Failed to add user' })
      }
    } finally {
      setAdding(false)
    }
  }

  async function changeRole(email: string, role: Role) {
    setUpdatingRole(email)
    try {
      const r = await fetch('/api/allowed-users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      if (r.ok) {
        setUsers(prev => prev.map(u =>
          u.email === email
            ? { ...u, role, permissions: role === 'admin' ? null : (u.permissions ?? DEFAULT_GUEST_PERMISSIONS) }
            : u
        ))
        if (role === 'admin' && expandedUser === email) setExpandedUser(null)
        setToast({ ok: true, text: `${email} is now ${role}` })
      }
    } finally {
      setUpdatingRole(null)
    }
  }

  async function updatePermission(email: string, view: string, perm: Permission) {
    const key = `${email}:${view}`
    const user = users.find(u => u.email === email)
    const newPerms = { ...(user?.permissions ?? DEFAULT_GUEST_PERMISSIONS), [view]: perm }

    // Optimistic update
    setUsers(prev => prev.map(u => u.email === email ? { ...u, permissions: newPerms } : u))
    setSavingPerms(prev => new Set([...prev, key]))

    try {
      const r = await fetch('/api/allowed-users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, permissions: newPerms }),
      })
      if (!r.ok) {
        // Revert
        setUsers(prev => prev.map(u =>
          u.email === email ? { ...u, permissions: user?.permissions ?? DEFAULT_GUEST_PERMISSIONS } : u
        ))
        setToast({ ok: false, text: 'Failed to update permission' })
      }
    } finally {
      setSavingPerms(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  async function removeUser(email: string) {
    setRemoving(email)
    setConfirmRemove(null)
    if (expandedUser === email) setExpandedUser(null)
    try {
      await fetch('/api/allowed-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      await load()
      setToast({ ok: true, text: `${email} removed` })
    } finally {
      setRemoving(null)
    }
  }

  useEffect(() => { load() }, [])

  const isRestricted = users.length > 0
  const emailValid = newEmail.includes('@') && newEmail.includes('.')

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-serif text-3xl font-bold text-[#1C3D27]">User Access</h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isRestricted ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isRestricted
              ? <><ShieldCheck className="w-3 h-3" /> Restricted</>
              : <><ShieldOff className="w-3 h-3" /> Open access</>}
          </span>
        </div>
        <p className="text-muted text-sm">
          {isRestricted
            ? `${users.length} allowed account${users.length !== 1 ? 's' : ''} — only these Google emails can sign in.`
            : 'No allowlist set — any Google account can sign in.'}
        </p>
      </div>

      {/* Add user */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-forest/10 rounded-xl flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-forest" />
          </div>
          <div>
            <h2 className="font-semibold text-ink">Add user</h2>
            <p className="text-xs text-muted">Grant access and assign a role</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && emailValid && !adding && addUser()}
            placeholder="name@gmail.com"
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-ember/30 placeholder:text-muted/60"
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as Role)}
            className="px-3 py-2.5 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-ember/30 cursor-pointer"
          >
            <option value="guest">Guest</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={addUser}
            disabled={adding || !emailValid}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-forest text-white rounded-xl text-sm font-semibold hover:bg-forest-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-forest" />
            <strong className="text-ink">Admin</strong> — full access, manages users
          </span>
          <span className="flex items-center gap-1">
            <ShieldOff className="w-3.5 h-3.5" />
            <strong className="text-ink">Guest</strong> — access controlled per view
          </span>
        </div>
      </div>

      {/* User list */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted" />
            <span className="font-semibold text-sm text-ink">Allowed accounts</span>
            {!loading && (
              <span className="bg-cream text-muted text-xs font-medium px-2 py-0.5 rounded-full border border-border">{users.length}</span>
            )}
          </div>
          <button onClick={load} disabled={loading} className="p-1.5 text-muted hover:text-ink hover:bg-cream rounded-lg transition-colors disabled:opacity-40" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-10 flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border">
              <ShieldOff className="w-7 h-7 text-muted" />
            </div>
            <p className="font-medium text-ink mb-1">Open access mode</p>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Anyone with a Google account can sign in. Add an email above to switch to restricted mode.
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
          <ul>
            {users.map((u, i) => {
              const isGuest = u.role !== 'admin'
              const isExpanded = expandedUser === u.email
              const perms = u.permissions ?? DEFAULT_GUEST_PERMISSIONS

              // Summary: count no_access views for guests
              const blockedCount = isGuest
                ? VIEW_KEYS.filter(v => perms[v] === 'no_access').length
                : 0

              return (
                <li key={u.email} className={i < users.length - 1 ? 'border-b border-border' : ''}>
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-cream/30 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar email={u.email} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-ink truncate">{u.email}</p>
                          {u.email === currentEmail && (
                            <span className="text-xs bg-ember/10 text-ember font-semibold px-1.5 py-0.5 rounded-md shrink-0">You</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted">
                            Added {new Date(u.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {isGuest && blockedCount > 0 && (
                            <span className="text-xs text-red-500 font-medium">
                              · {blockedCount} view{blockedCount > 1 ? 's' : ''} hidden
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {/* Permissions expand button — guests only */}
                      {isGuest && (
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : u.email)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            isExpanded
                              ? 'bg-forest/10 text-forest border-forest/20'
                              : 'bg-cream text-muted border-border hover:text-ink hover:border-muted'
                          }`}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Permissions
                          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      <RoleBadge
                        role={u.role ?? 'guest'}
                        loading={updatingRole === u.email}
                        onChange={r => changeRole(u.email, r)}
                      />

                      {confirmRemove === u.email ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeUser(u.email)}
                            disabled={removing === u.email}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {removing === u.email && <Loader2 className="w-3 h-3 animate-spin" />}
                            Remove
                          </button>
                          <button onClick={() => setConfirmRemove(null)} className="px-2.5 py-1.5 rounded-lg text-xs text-muted hover:bg-cream transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemove(u.email)}
                          disabled={removing === u.email}
                          className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Remove user"
                        >
                          {removing === u.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Permissions panel */}
                  {isExpanded && isGuest && (
                    <PermissionsPanel
                      email={u.email}
                      permissions={perms}
                      saving={savingPerms}
                      onUpdate={updatePermission}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-5 px-5 py-4 bg-cream border border-border rounded-2xl">
        <p className="text-xs text-muted leading-relaxed">
          <span className="font-semibold text-ink">How permissions work:</span>{' '}
          <span className="inline-flex items-center gap-1 mx-0.5"><Eye className="w-3 h-3 text-blue-500" /><strong className="text-ink">View Only</strong></span> — read access.{' '}
          <span className="inline-flex items-center gap-1 mx-0.5"><Pencil className="w-3 h-3 text-emerald-600" /><strong className="text-ink">Edit</strong></span> — full interaction.{' '}
          <span className="inline-flex items-center gap-1 mx-0.5"><EyeOff className="w-3 h-3 text-red-500" /><strong className="text-ink">No Access</strong></span> — hides the view from the sidebar entirely.
          Changes take effect on the user&apos;s next sign-in.
        </p>
      </div>

      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
