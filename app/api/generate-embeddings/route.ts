import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'
import { getBatchEmbeddings } from '@/lib/embeddings'

export const maxDuration = 300

function incText(doc: Record<string, unknown>): string {
  return [
    doc.description,
    doc.category,
    Array.isArray(doc.people) ? (doc.people as string[]).join(' ') : doc.people,
    Array.isArray(doc.locations) ? (doc.locations as string[]).join(' ') : doc.locations,
    doc.source_chunk,
  ].filter(Boolean).join(' ')
}

function bkText(doc: Record<string, unknown>): string {
  const what = typeof doc.what_happened === 'string' ? (doc.what_happened as string).slice(0, 500) : ''
  return [
    doc.story_title,
    doc.summary,
    what,
    doc.person,
    doc.location,
    Array.isArray(doc.categories) ? (doc.categories as string[]).join(' ') : '',
  ].filter(Boolean).join(' ')
}

// GET — return how many records have/need embeddings
export async function GET() {
  const db = await getDb()
  const [incTotal, incEmbedded, bkTotal, bkEmbedded] = await Promise.all([
    db.collection(COLLECTIONS.incidents).countDocuments({}),
    db.collection(COLLECTIONS.incidents).countDocuments({ embedding: { $exists: true } }),
    db.collection(COLLECTIONS.bk_stories).countDocuments({}),
    db.collection(COLLECTIONS.bk_stories).countDocuments({ embedding: { $exists: true } }),
  ])
  return NextResponse.json({
    incidents:  { total: incTotal,  embedded: incEmbedded,  pending: incTotal - incEmbedded },
    bk_stories: { total: bkTotal,   embedded: bkEmbedded,   pending: bkTotal - bkEmbedded },
  })
}

// POST — process a batch of records for one collection
export async function POST(req: NextRequest) {
  const { col, batch = 40 } = await req.json() as { col: string; batch?: number }

  if (col !== COLLECTIONS.incidents && col !== COLLECTIONS.bk_stories) {
    return NextResponse.json({ error: 'col must be incidents or bk_stories' }, { status: 400 })
  }

  const db = await getDb()
  const coll = db.collection(col)
  const buildText = col === COLLECTIONS.incidents ? incText : bkText

  const docs = await coll
    .find({ embedding: { $exists: false } })
    .limit(batch)
    .toArray()

  if (docs.length === 0) {
    const remaining = await coll.countDocuments({ embedding: { $exists: false } })
    return NextResponse.json({ processed: 0, remaining, message: 'No records need embeddings' })
  }

  const CHUNK = 8
  let processed = 0
  const errors: string[] = []

  for (let i = 0; i < docs.length; i += CHUNK) {
    const chunk = docs.slice(i, i + CHUNK)
    const texts = chunk.map(d => buildText(d as Record<string, unknown>))

    try {
      const embeddings = await getBatchEmbeddings(texts)
      await Promise.all(
        chunk.map((doc, j) =>
          coll.updateOne(
            { _id: doc._id },
            { $set: { embedding: embeddings[j], embedding_model: 'all-MiniLM-L6-v2' } }
          )
        )
      )
      processed += chunk.length
    } catch (err) {
      errors.push(`chunk ${i}-${i + CHUNK}: ${String(err)}`)
    }
  }

  const remaining = await coll.countDocuments({ embedding: { $exists: false } })
  return NextResponse.json({ processed, remaining, errors: errors.length ? errors : undefined })
}
