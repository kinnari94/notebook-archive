import { NextResponse } from 'next/server'
import { fetchThumbnailBase64 } from '@/lib/picsio'

// Single-shot check for whether Pics.io has finished generating a thumbnail yet
// (asynchronous, ~20s after upload). The client polls this a few times after
// uploading, storing the returned data URI directly on the record once ready — so
// the Photo Log card grid can render instantly from Mongo instead of depending on a
// live Pics.io call (and its signed-URL expiry) every time.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await params
  try {
    const thumbnail = await fetchThumbnailBase64(assetId)
    return NextResponse.json({ thumbnail })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ thumbnail: null, error: msg }, { status: 200 })
  }
}
