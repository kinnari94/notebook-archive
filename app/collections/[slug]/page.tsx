import { notFound } from 'next/navigation'
import { getSrmdSheet } from '@/lib/srmd-sheets'
import SrmdSheetView from './SrmdSheetView'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const config = getSrmdSheet(slug)
  if (!config) notFound()
  return <SrmdSheetView slug={slug} />
}
