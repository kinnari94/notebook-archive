import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams
  const db = await getDb()

  const filter: Record<string, unknown> = {}

  const category = s.get('category')
  if (category) filter.category = category

  const person = s.get('person')
  if (person) filter.person = { $regex: person, $options: 'i' }

  const themeBucket = s.get('theme_bucket')
  if (themeBucket) filter.themeBucket = { $regex: themeBucket, $options: 'i' }

  const storyType = s.get('story_type')
  if (storyType) filter.storyType = storyType

  const clipPotential = s.get('clip')
  if (clipPotential) filter.quoteClipPotential = clipPotential

  const q = s.get('q')
  if (q) {
    filter.$or = [
      { storyTitle: { $regex: q, $options: 'i' } },
      { summary: { $regex: q, $options: 'i' } },
      { whatHappened: { $regex: q, $options: 'i' } },
      { gurudevSaid: { $regex: q, $options: 'i' } },
      { satsangInsight: { $regex: q, $options: 'i' } },
      { transformation: { $regex: q, $options: 'i' } },
      { person: { $regex: q, $options: 'i' } },
    ]
  }

  const limit = Number(s.get('limit') || 20)
  const skip = Number(s.get('skip') || 0)

  try {
    const col = db.collection(COLLECTIONS.documentary_stories)
    const total = await col.countDocuments(filter)
    const stories = await col
      .find(filter)
      .sort({ extractedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    return NextResponse.json({
      total,
      stories: stories.map(d => ({ ...d, _id: d._id.toString() })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
