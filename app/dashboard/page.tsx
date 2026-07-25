import { requireViewAccess } from '@/lib/require-view'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  await requireViewAccess('dashboard')
  return <DashboardClient />
}
