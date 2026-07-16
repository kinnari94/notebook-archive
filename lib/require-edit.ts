import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { hasEditAccess, type ViewPermissions } from '@/lib/permissions'

// Server-side gate for mutating API routes under the Collections area (main vault +
// all SRMD sub-views + reports) — they all share the single 'collections' permission
// key, so a guest with collections: 'edit' can add/edit/delete everywhere under it,
// while 'view' (or 'no_access', though that already hides the nav entirely) cannot.
export async function canEditCollections(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return false
  const u = session.user as { role?: string; permissions?: ViewPermissions | null }
  return hasEditAccess(u.role, u.permissions, 'collections')
}
