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
