import { NextRequest, NextResponse } from 'next/server'
import type { Db } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db'
import { getEmbedding } from '@/lib/embeddings'

const PAGE_SIZE = 30

function normalizeBKStory(d: Record<string, unknown>): Record<string, unknown> {
  return {
    ...d,
    _id: String(d._id),
    source_type: 'bapa_katha',
    description: (d.summary as string) || (d.story_title as string) || '',
    date: { period: (d.time_life_stage as string) || 'not specified' },
    people: (d.person as string) ? [d.person as string] : [],
    locations:
      (d.location as string) && (d.location as string) !== 'not specified'
        ? [d.location as string]
        : [],
  }
}

function buildTextFilter(q: string, fields: string[]) {
  return { $or: fields.map(f => ({ [f]: { $regex: q, $options: 'i' } })) }
}

async function doVectorSearch(db: Db, col: string, queryVector: number[], limit: number) {
  const pipeline = [
    {
      $vectorSearch: {
        index: 'vector_index',
        path: 'embedding',
        queryVector,
        numCandidates: limit * 5,
        limit,
      },
    },
    { $addFields: { _score: { $meta: 'vectorSearchScore' } } },
    { $project: { embedding: 0 } },
  ]
  return db.collection(col).aggregate(pipeline).toArray() as Promise<Record<string, unknown>[]>
}

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams
  const q = (s.get('q') || '').trim()
  const limit = Math.min(Number(s.get('limit') || PAGE_SIZE), 100)
  const skip = Number(s.get('skip') || 0)

  if (!q) return NextResponse.json({ total: 0, incidents: [], searchType: 'none' })

  const db = await getDb()

  // --- Try vector search if API key is configured ---
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const queryVector = await getEmbedding(q)

      const [incRaw, bkRaw] = await Promise.all([
        doVectorSearch(db, COLLECTIONS.incidents, queryVector, 60),
        doVectorSearch(db, COLLECTIONS.bk_stories, queryVector, 60),
      ])

      // Only use vector results if we got something back (embeddings exist)
      if (incRaw.length > 0 || bkRaw.length > 0) {
        const incNorm = incRaw.map(d => ({ ...d, _id: String(d._id) }))
        const bkNorm  = bkRaw.map(d => normalizeBKStory(d))

        const merged = [...incNorm, ...bkNorm].sort((a, b) => {
          const sa = ((a as Record<string, unknown>)._score as number) ?? 0
          const sb = ((b as Record<string, unknown>)._score as number) ?? 0
          return sb - sa
        })

        const total = merged.length
        const incidents = merged.slice(skip, skip + limit)
        return NextResponse.json({ total, incidents, searchType: 'vector' })
      }
      // No embeddings in DB yet — fall through to regex
    } catch {
      // Vector index not created or model unavailable — fall through to regex
    }
  }

  // --- Regex fallback (always works, no setup needed) ---
  const incFilter = buildTextFilter(q, ['description', 'source_chunk', 'people', 'locations', 'category'])
  const bkFilter  = buildTextFilter(q, ['story_title', 'summary', 'what_happened', 'person', 'location'])

  try {
    const [incTotal, bkTotal] = await Promise.all([
      db.collection(COLLECTIONS.incidents).countDocuments(incFilter),
      db.collection(COLLECTIONS.bk_stories).countDocuments(bkFilter),
    ])
    const total = incTotal + bkTotal
    const incidents: unknown[] = []

    if (skip < incTotal) {
      const incDocs = await db
        .collection(COLLECTIONS.incidents)
        .find(incFilter)
        .sort({ 'date.year': 1 })
        .skip(skip)
        .limit(limit)
        .toArray()
      incidents.push(...incDocs.map(d => ({ ...d, _id: String(d._id) })))
    }

    if (incidents.length < limit) {
      const bkSkip = Math.max(0, skip - incTotal)
      const bkDocs = await db
        .collection(COLLECTIONS.bk_stories)
        .find(bkFilter)
        .sort({ extracted_at: -1 })
        .skip(bkSkip)
        .limit(limit - incidents.length)
        .toArray()
      incidents.push(...bkDocs.map(d => normalizeBKStory(d as Record<string, unknown>)))
    }

    return NextResponse.json({ total, incidents, searchType: 'text' })
  } catch (err) {
    console.error('[semantic-search]', err)
    return NextResponse.json({ total: 0, incidents: [], searchType: 'error' }, { status: 500 })
  }
}
