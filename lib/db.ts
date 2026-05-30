import clientPromise from './mongodb'
import { Db, ObjectId } from 'mongodb'

const DB_NAME = process.env.MONGODB_DB || 'bapaji_archive'

export async function getDb(): Promise<Db> {
  const client = await clientPromise
  return client.db(DB_NAME)
}

export const COLLECTIONS = {
  incidents: 'incidents',
  people: 'people',
  locations: 'locations',
  sources: 'sources',
  extractions: 'extraction_jobs',
  daily_dateline: 'daily_dateline',
  health: 'health_aahar_discipline',
  spiritual_exp: 'spiritual_exp',
  institutional: 'institutional_timeline',
  wings: 'wings',
  physical_spaces: 'physical_spaces',
  seva_projects: 'seva_projects',
  awards: 'awards_accreds',
  artifacts: 'artifacts',
  social_contextual: 'social_contextual',
  counts: 'counts',
} as const

export async function getArchiveStats() {
  const db = await getDb()
  const stats: Record<string, number> = {}
  for (const [key, col] of Object.entries(COLLECTIONS)) {
    try {
      stats[key] = await db.collection(col).countDocuments()
    } catch {
      stats[key] = 0
    }
  }
  return stats
}

export async function getCategoryBreakdown() {
  const db = await getDb()
  try {
    const result = await db.collection(COLLECTIONS.incidents).aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray()
    return result.map(r => ({ category: r._id, count: r.count }))
  } catch {
    return []
  }
}

export async function getRecentExtractions(limit = 8) {
  const db = await getDb()
  try {
    return await db.collection(COLLECTIONS.extractions)
      .find({}, { projection: { _id: 0 } })
      .sort({ started_at: -1 })
      .limit(limit)
      .toArray()
  } catch {
    return []
  }
}

export interface IncidentQuery {
  category?: string
  person?: string
  location?: string
  year_from?: number
  year_to?: number
  access_tier_max?: number
  search_text?: string
  limit?: number
  skip?: number
}

export async function queryIncidents(q: IncidentQuery) {
  const db = await getDb()
  const filter: Record<string, unknown> = {
    access_tier: { $lte: q.access_tier_max ?? 3 },
  }
  if (q.category) filter.category = q.category
  if (q.person) filter.people = { $regex: q.person, $options: 'i' }
  if (q.location) filter.locations = { $regex: q.location, $options: 'i' }
  if (q.year_from || q.year_to) {
    const yr: Record<string, number> = {}
    if (q.year_from) yr.$gte = q.year_from
    if (q.year_to) yr.$lte = q.year_to
    filter['date.year'] = yr
  }
  if (q.search_text) {
    filter.$text = { $search: q.search_text }
  }

  try {
    const total = await db.collection(COLLECTIONS.incidents).countDocuments(filter)
    const docs = await db.collection(COLLECTIONS.incidents)
      .find(filter)
      .sort({ 'date.year': 1 })
      .skip(q.skip ?? 0)
      .limit(q.limit ?? 20)
      .toArray()
    return {
      total,
      incidents: docs.map(d => ({ ...d, _id: d._id.toString() })),
    }
  } catch {
    return { total: 0, incidents: [] }
  }
}

export async function getIncidentById(id: string) {
  const db = await getDb()
  try {
    const doc = await db.collection(COLLECTIONS.incidents).findOne({ _id: new ObjectId(id) })
    if (!doc) return null
    return { ...doc, _id: doc._id.toString() }
  } catch {
    return null
  }
}

export async function getAllPeople(limit = 200) {
  const db = await getDb()
  try {
    const result = await db.collection(COLLECTIONS.incidents).distinct('people')
    const flat: string[] = []
    for (const item of result) {
      if (Array.isArray(item)) flat.push(...item)
      else if (typeof item === 'string' && item.trim()) flat.push(item.trim())
    }
    return [...new Set(flat)].sort().slice(0, limit)
  } catch {
    return []
  }
}

export async function getAllLocations(limit = 200) {
  const db = await getDb()
  try {
    const result = await db.collection(COLLECTIONS.incidents).distinct('locations')
    const flat: string[] = []
    for (const item of result) {
      if (Array.isArray(item)) flat.push(...item)
      else if (typeof item === 'string' && item.trim()) flat.push(item.trim())
    }
    return [...new Set(flat)].sort().slice(0, limit)
  } catch {
    return []
  }
}

export async function getTimelineData() {
  const db = await getDb()
  try {
    return await db.collection(COLLECTIONS.incidents).aggregate([
      { $match: { 'date.year': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$date.year',
          count: { $sum: 1 },
          categories: { $addToSet: '$category' },
          incidents: {
            $push: {
              desc: '$description',
              cat: '$category',
              id: { $toString: '$_id' },
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray()
  } catch {
    return []
  }
}

export async function testConnection(uri: string) {
  const { MongoClient } = await import('mongodb')
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    await client.close()
    return { ok: true, message: 'Connection successful' }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

export async function rebuildTextIndex() {
  const db = await getDb()
  try {
    await db.collection(COLLECTIONS.incidents).createIndex(
      [{ description: 'text' }, { source_chunk: 'text' }, { people: 'text' }],
      { name: 'full_text_search', default_language: 'english' }
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}
