import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect } from 'next/navigation'
import { hasViewAccess, firstAccessibleView, type ViewPermissions } from '@/lib/permissions'

// Server-side gate for a whole page — call at the top of a view's page.tsx before
// rendering its client component. Redirects to /login if unauthenticated, or to
// /no-access if the account's permissions record has this view set to 'no_access'.
//
// /dashboard is special-cased: it's every login's hardcoded landing page
// (app/login/page.tsx's callbackUrl), so a guest without dashboard access would
// otherwise bounce straight to a "no access" wall right after signing in. Instead,
// send them on to the first view they *can* see, matching Sidebar's nav order.
export async function requireViewAccess(viewKey: string): Promise<void> {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const u = session.user as { role?: string; permissions?: ViewPermissions | null }
  if (hasViewAccess(u.role, u.permissions, viewKey)) return

  if (viewKey === 'dashboard') {
    const fallback = firstAccessibleView(u.role, u.permissions)
    if (fallback && fallback !== 'dashboard') redirect(`/${fallback}`)
  }
  redirect('/no-access')
}
