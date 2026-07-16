import { NextRequest, NextResponse } from 'next/server'
import { uploadToPicsio } from '@/lib/picsio'

// Uploads to Pics.io and returns a stable same-origin URL through the picsio-image
// proxy route (app/api/picsio-image/[assetId]/[revisionId]/route.ts) instead of a raw
// Pics.io URL — Pics.io's API never gives out a permanent public file URL, so the
// proxy resolves + caches a fresh signed one on every view instead.
export async function POST(req: NextRequest) {
  if (!process.env.PICSIO_API_KEY || !process.env.PICSIO_COLLECTION_ID) {
    return NextResponse.json({ error: 'PICSIO_API_KEY / PICSIO_COLLECTION_ID not set in .env.local' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e) {
    return NextResponse.json({ error: 'Could not parse form data', detail: String(e) }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file in request' }, { status: 400 })

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { assetId, revisionId } = await uploadToPicsio(buffer, fileName, file.type || 'image/jpeg')

    const url = `/api/picsio-image/${assetId}/${revisionId}`
    return NextResponse.json({ url, fileId: assetId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload] Pics.io error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
