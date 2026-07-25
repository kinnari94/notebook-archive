import { requireViewAccess } from '@/lib/require-view'
import TimelineClient from './TimelineClient'

export default async function TimelinePage() {
  await requireViewAccess('timeline')
  return <TimelineClient />
}
