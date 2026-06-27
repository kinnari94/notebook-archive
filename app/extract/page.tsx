import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect } from 'next/navigation'
import ExtractClient from './ExtractClient'

export default async function ExtractPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const role = (session.user as any).role
  const permissions = (session.user as any).permissions

  if (role !== 'admin') {
    const perm = permissions?.extract ?? 'no_access'
    if (perm === 'no_access') redirect('/dashboard')
  }

  return <ExtractClient />
}
