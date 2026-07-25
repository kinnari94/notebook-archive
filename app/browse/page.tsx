import { requireViewAccess } from '@/lib/require-view'
import BrowseClient from './BrowseClient'

export default async function BrowsePage() {
  await requireViewAccess('browse')
  return <BrowseClient />
}
