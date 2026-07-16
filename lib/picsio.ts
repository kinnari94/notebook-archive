// Pics.io REST API integration for Photo Log uploads. Unlike Google Drive, Pics.io's
// API never hands back a permanent public file URL — every link it issues (thumbnail
// or raw download) is a temporary signed S3 URL (thumbnails last ~5h, raw downloads
// only ~5min; verified directly against the live API). So instead of storing a URL,
// we store the Pics.io asset id and resolve a fresh signed URL on each view through
// app/api/picsio-image/[assetId]/route.ts, which caches it in Mongo until it's close
// to expiring (see getPicsioImageUrl below).

const BASE = 'https://api.pics.io'

function apiKey(): string {
  const key = process.env.PICSIO_API_KEY
  if (!key) throw new Error('PICSIO_API_KEY not set in .env.local')
  return key
}

function collectionId(): string {
  const id = process.env.PICSIO_COLLECTION_ID
  if (!id) throw new Error('PICSIO_COLLECTION_ID not set in .env.local')
  return id
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

async function picsioJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers(), ...(init?.headers || {}) } })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = (json && (json.msg || json.message)) || `Pics.io request failed (${res.status})`
    throw new Error(msg)
  }
  return json as T
}

interface BuildUploadLinkResponse {
  uploadId: string
  storageId: string
  revisionId: string
  chunkNums: number
  urls: { partNum: number; url: string }[]
}

interface PicsioAsset {
  _id: string
  headRevisionId: string
}

export interface PicsioUploadResult {
  assetId: string
  revisionId: string
}

// Uploads a file to the configured Pics.io collection via its 3-step S3 multipart
// flow (request upload URLs -> PUT bytes -> complete multipart), then registers the
// result as an asset. Splits into multiple parts if Pics.io says the file needs it —
// chunk boundaries are ours to choose, only the count (chunkNums) is dictated back.
export async function uploadToPicsio(buffer: Buffer, fileName: string, mimeType: string): Promise<PicsioUploadResult> {
  const build = await picsioJson<BuildUploadLinkResponse>('/images/buildS3UploadLink', {
    method: 'POST',
    body: JSON.stringify({ fileName, fileSize: buffer.length, mimeType, collectionId: collectionId() }),
  })

  const { uploadId, storageId, urls } = build
  const chunkCount = urls.length
  const chunkSize = Math.ceil(buffer.length / chunkCount)
  const parts: { ETag: string; PartNumber: number }[] = []

  for (const { partNum, url } of urls) {
    const start = (partNum - 1) * chunkSize
    const chunk = buffer.subarray(start, start + chunkSize)
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { 'content-disposition': 'attachment' },
      body: new Uint8Array(chunk),
    })
    if (!putRes.ok) throw new Error(`Pics.io chunk upload failed (part ${partNum}, ${putRes.status})`)
    const etag = putRes.headers.get('etag')
    if (!etag) throw new Error(`Pics.io chunk upload returned no ETag (part ${partNum})`)
    parts.push({ ETag: etag, PartNumber: partNum })
  }

  await picsioJson('/images/completeS3Multipart', {
    method: 'POST',
    body: JSON.stringify({ parts, uploadId, storageId }),
  })

  const asset = await picsioJson<PicsioAsset>('/images', {
    method: 'POST',
    body: JSON.stringify({
      assetData: { storageId, name: fileName, fileSize: buffer.length, tags: [{ _id: collectionId() }] },
      additionalFields: { assigneeIds: [], keywordsIds: [], title: '', description: '' },
    }),
  })

  return { assetId: asset._id, revisionId: asset.headRevisionId }
}

interface FetchThumbnailsResponseItem {
  _id: string
  thumbnail?: { small: string; reduced: string; default: string; big: string }
  expiresAt?: string
}

export type PicsioSize = 'small' | 'reduced' | 'default' | 'big'

export interface ResolvedPicsioUrl {
  url: string
  expiresAt: Date
}

// Resolves a fresh, viewable URL for an asset. Prefers the thumbnail set (lasts ~5h,
// one call gets all 4 sizes) — but thumbnailing is asynchronous, so a just-uploaded
// asset won't have one yet (confirmed live: right after upload, fetchThumbnails
// returns no `thumbnail` field at all). In that case we fall back to the raw download
// link for the known revision, which is available immediately but only lasts ~5min,
// so callers should treat that as a short, one-time-use cache window rather than the
// normal ~5h one.
export async function resolvePicsioUrl(assetId: string, revisionId: string, size: PicsioSize = 'default'): Promise<ResolvedPicsioUrl> {
  const [thumbs] = await picsioJson<FetchThumbnailsResponseItem[]>('/images/fetchThumbnails', {
    method: 'POST',
    body: JSON.stringify({ assetIds: [assetId] }),
  })

  if (thumbs?.thumbnail?.[size]) {
    return { url: thumbs.thumbnail[size], expiresAt: thumbs.expiresAt ? new Date(thumbs.expiresAt) : new Date(Date.now() + 5 * 60 * 60 * 1000) }
  }

  // Thumbnail not generated yet — fall back to the raw file via its download link.
  const url = await picsioJson<string>(`/images/buildDownloadLink/${assetId}/${revisionId}`, { method: 'GET' })
  return { url, expiresAt: new Date(Date.now() + 4 * 60 * 1000) }
}

// Fetches the (small, ~500px) thumbnail and returns it as a base64 data URI, for
// storing directly on the Mongo document — so card grids can render a photo instantly
// without depending on a live Pics.io resolution at all. Returns null if Pics.io
// hasn't finished generating the thumbnail yet (asynchronous, ~20s after upload);
// callers should retry after a few seconds rather than treat null as a permanent miss.
export async function fetchThumbnailBase64(assetId: string): Promise<string | null> {
  const [thumbs] = await picsioJson<FetchThumbnailsResponseItem[]>('/images/fetchThumbnails', {
    method: 'POST',
    body: JSON.stringify({ assetIds: [assetId] }),
  })
  const url = thumbs?.thumbnail?.small
  if (!url) return null

  const res = await fetch(url)
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') || 'image/png'
  const buffer = Buffer.from(await res.arrayBuffer())
  return `data:${contentType};base64,${buffer.toString('base64')}`
}
