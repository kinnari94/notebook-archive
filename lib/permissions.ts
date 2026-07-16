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
