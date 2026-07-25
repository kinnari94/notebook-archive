import { requireViewAccess } from '@/lib/require-view'
import ExtractClient from './ExtractClient'

export default async function ExtractPage() {
  await requireViewAccess('extract')
  return <ExtractClient />
}
