import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import Link from 'next/link'
import { ShieldOff } from 'lucide-react'
import { firstAccessibleView, VIEW_LABELS, type ViewPermissions } from '@/lib/permissions'
import NoAccessClient from './NoAccessClient'

export default async function NoAccessPage() {
  const session = await getServerSession(authOptions)
  const u = session?.user as { role?: string; permissions?: ViewPermissions | null; email?: string | null } | undefined
  const fallback = u ? firstAccessibleView(u.role, u.permissions) : null

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldOff className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">No Access</h1>
          <p className="text-muted text-sm mt-1">
            Your account doesn&apos;t have permission to view this page. Contact an admin if you think this is a mistake.
          </p>
        </div>

        {fallback && (
          <Link
            href={`/${fallback}`}
            className="block w-full py-3 px-4 bg-white border border-border rounded-xl text-sm font-medium text-ink hover:bg-cream transition-colors"
          >
            Go to {VIEW_LABELS[fallback] ?? fallback}
          </Link>
        )}

        <NoAccessClient email={u?.email} />
      </div>
    </div>
  )
}
