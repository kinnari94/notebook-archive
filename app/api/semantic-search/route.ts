import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

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
  return {
    $or: fields.map(f => ({ [f]: { $regex: q, $options: 'i' } })),
  }
}

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams
  const q = (s.get('q') || '').trim()
  const limit = Math.min(Number(s.get('limit') || PAGE_SIZE), 100)
  const skip = Number(s.get('skip') || 0)

  if (!q) return NextResponse.json({ total: 0, incidents: [], searchType: 'none' })

  const db = await getDb()

  // Multi-field regex search across both collections (always runs, no data saved)
  const incFilter = buildTextFilter(q, ['description', 'source_chunk', 'people', 'locations', 'category'])
  const bkFilter = buildTextFilter(q, ['story_title', 'summary', 'what_happened', 'person', 'location'])

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
