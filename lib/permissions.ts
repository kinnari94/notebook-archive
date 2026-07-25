export type Permission = 'view' | 'edit' | 'no_access'

export type ViewPermissions = {
  dashboard: Permission
  browse: Permission
  search: Permission
  timeline: Permission
  collections: Permission
  extract: Permission
  settings: Permission
  [key: string]: Permission
}

export const VIEW_KEYS = [
  'dashboard', 'browse', 'search', 'timeline', 'collections', 'extract', 'settings',
] as const

export const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  browse: 'Browse',
  search: 'Search',
  timeline: 'Timeline',
  collections: 'Collections',
  extract: 'Extract',
  settings: 'Settings',
}

// Defaults applied to new guest accounts
export const DEFAULT_GUEST_PERMISSIONS: ViewPermissions = {
  dashboard: 'view',
  browse: 'view',
  search: 'view',
  timeline: 'view',
  collections: 'no_access',
  extract: 'no_access',
  settings: 'no_access',
}

// Pure check usable from both client components (after useSession()) and server
// route handlers (after getServerSession()) — no next-auth import here, so it can't
// create a circular import with lib/auth-options.ts (which imports from this file).
// `permissions == null` covers open-access mode (no allowed_users configured yet),
// where the jwt callback also sets role to 'admin', but this is checked independently
// as a defensive fallback.
export function hasEditAccess(
  role: string | null | undefined,
  permissions: ViewPermissions | null | undefined,
  viewKey: string
): boolean {
  if (role === 'admin') return true
  if (permissions == null) return true
  return permissions[viewKey] === 'edit'
}

// Same shape as hasEditAccess, but for read access to a whole view/page — 'view' or
// 'edit' both count, only 'no_access' (or an explicit no_access default for a key
// missing from an older/partial permissions record) shuts a view out.
export function hasViewAccess(
  role: string | null | undefined,
  permissions: ViewPermissions | null | undefined,
  viewKey: string
): boolean {
  if (role === 'admin') return true
  if (permissions == null) return true
  return permissions[viewKey] !== 'no_access'
}

// Nav routes in Sidebar order — used to pick a sensible landing page for a guest
// whose account can't see /dashboard (login always sends there first). 'settings'
// is a permission key but has no page of its own, so it's excluded here.
const ROUTABLE_VIEWS = ['dashboard', 'collections', 'browse', 'search', 'timeline', 'extract'] as const

export function firstAccessibleView(
  role: string | null | undefined,
  permissions: ViewPermissions | null | undefined
): string | null {
  for (const key of ROUTABLE_VIEWS) {
    if (hasViewAccess(role, permissions, key)) return key
  }
  return null
}
