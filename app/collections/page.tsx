import { requireViewAccess } from '@/lib/require-view'
import CollectionsVaultView from './CollectionsVaultView'

export default async function CollectionsPage() {
  await requireViewAccess('collections')
  return <CollectionsVaultView />
}
