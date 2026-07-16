import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'
import { resolvePicsioUrl, type PicsioSize } from '@/lib/picsio'

const VALID_SIZES = new Set(['small', 'reduced', 'default', 'big'])
const REFRESH_BUFFER_MS = 60 * 1000

// Stable, permanent URL (this route) that stands in for a Pics.io asset — stored in
// Mongo instead of a raw Pics.io URL, since every URL Pics.io's API gives out expires.
// Resolves + caches a fresh signed S3 URL per (asset, revision, size) and 302s to it,
// re-resolving only once the cached one is close to expiring. This keeps normal photo
// views to zero Pics.io API calls (cache hit) and avoids hammering their rate limit.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string; revisionId: string }> }
) {
  const { assetId, revisionId } = await params
  const sizeParam = req.nextUrl.searchParams.get('size') || 'default'
  const size = (VALID_SIZES.has(sizeParam) ? sizeParam : 'default') as PicsioSize

  const db = await getDb()
  const col = db.collection(COLLECTIONS.srmd_picsio_url_cache)
  const cacheKey = { assetId, revisionId, size }

  // Explicit no-store: without it, a browser can cache a transient failure (or a
  // stale redirect target) against this exact URL and never retry it, even though a
  // fresh request here would now succeed.
  const noStore = { 'Cache-Control': 'no-store' }

  const cached = await col.findOne(cacheKey)
  if (cached && new Date(cached.expiresAt).getTime() - Date.now() > REFRESH_BUFFER_MS) {
    return NextResponse.redirect(cached.url as string, { status: 302, headers: noStore })
  }

  try {
    const { url, expiresAt } = await resolvePicsioUrl(assetId, revisionId, size)
    await col.updateOne(cacheKey, { $set: { url, expiresAt, updatedAt: new Date() } }, { upsert: true })
    return NextResponse.redirect(url, { status: 302, headers: noStore })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[picsio-image] resolve failed:', msg)
    return NextResponse.json({ error: msg }, { status: 502, headers: noStore })
  }
}
