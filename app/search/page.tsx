import { requireViewAccess } from '@/lib/require-view'
import SearchClient from './SearchClient'

export default async function SearchPage() {
  await requireViewAccess('search')
  return <SearchClient />
}
