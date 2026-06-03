import clientPromise from './mongodb'
import { Db, ObjectId } from 'mongodb'

const DB_NAME = process.env.MONGODB_DB || 'bapaji_archive'

let indexesEnsured = false

export async function getDb(): Promise<Db> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  if (!indexesEnsured) {
    indexesEnsured = true
    // Unique index prevents duplicate incidents even under concurrent runs
    db.collection('incidents').createIndex({ contentHash: 1 }, { unique: true, sparse: true }).catch(() => {})
    db.collection('bk_stories').createIndex({ contentHash: 1 }, { unique: true, sparse: true }).catch(() => {})
  }
  return db
}

export const COLLECTIONS = {
  incidents: 'incidents',
  bk_stories: 'bk_stories',
  documentary_stories: 'documentary_stories',
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
  search_text?: string
  limit?: number
  skip?: number
  source?: 'standard' | 'bapa_katha' | 'all'
}

function normalizeBKStory(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    ...doc,
    _id: String(doc._id),
    source_type: 'bapa_katha',
    description: (doc.summary as string) || (doc.story_title as string) || '',
    date: { period: (doc.time_life_stage as string) || 'not specified' },
    people: (doc.person as string) ? [doc.person as string] : [],
    locations: (doc.location as string) && (doc.location as string) !== 'not specified'
      ? [doc.location as string] : [],
  }
}

export async function queryIncidents(q: IncidentQuery) {
  const db = await getDb()
  const source = q.source || 'all'
  const limit = q.limit ?? 20
  const skip  = q.skip  ?? 0

  // Build filter for incidents collection (skip bk_ categories)
  const incFilter: Record<string, unknown> = {}
  if (q.category && !q.category.startsWith('bk_')) incFilter.category = q.category
  if (q.category?.startsWith('bk_') && source !== 'bapa_katha') {
    // category is a BK category but we're in standard/all mode — no standard incidents match
    if (source === 'standard') return { total: 0, incidents: [] }
  }
  if (q.person)   incFilter.people    = { $regex: q.person,   $options: 'i' }
  if (q.location) incFilter.locations = { $regex: q.location, $options: 'i' }
  if (q.year_from || q.year_to) {
    const yr: Record<string, number> = {}
    if (q.year_from) yr.$gte = q.year_from
    if (q.year_to)   yr.$lte = q.year_to
    incFilter['date.year'] = yr
  }
  if (q.search_text) incFilter.$text = { $search: q.search_text }

  // Build filter for bk_stories collection
  const bkFilter: Record<string, unknown> = {}
  if (q.category?.startsWith('bk_')) bkFilter.category = q.category
  if (q.person) {
    bkFilter.$or = [
      { person:       { $regex: q.person, $options: 'i' } },
      { what_happened:{ $regex: q.person, $options: 'i' } },
    ]
  }
  if (q.location) bkFilter.location = { $regex: q.location, $options: 'i' }
  if (q.year_from === q.year_to && q.year_from) {
    // Exact year — filter BK stories whose time_life_stage contains that year
    bkFilter.time_life_stage = { $regex: `\\b${q.year_from}\\b` }
  }
  if (q.search_text) {
    bkFilter.$or = [
      { story_title:  { $regex: q.search_text, $options: 'i' } },
      { summary:      { $regex: q.search_text, $options: 'i' } },
      { what_happened:{ $regex: q.search_text, $options: 'i' } },
    ]
  }

  try {
    if (source === 'standard') {
      const total = await db.collection(COLLECTIONS.incidents).countDocuments(incFilter)
      const docs  = await db.collection(COLLECTIONS.incidents)
        .find(incFilter).sort({ 'date.year': 1 }).skip(skip).limit(limit).toArray()
      return { total, incidents: docs.map(d => ({ ...d, _id: d._id.toString() })) }
    }

    if (source === 'bapa_katha') {
      const total = await db.collection(COLLECTIONS.bk_stories).countDocuments(bkFilter)
      const docs  = await db.collection(COLLECTIONS.bk_stories)
        .find(bkFilter).sort({ extracted_at: -1 }).skip(skip).limit(limit).toArray()
      return { total, incidents: docs.map(d => normalizeBKStory(d as Record<string, unknown>)) }
    }

    // source === 'all'
    const [incTotal, bkTotal] = await Promise.all([
      db.collection(COLLECTIONS.incidents).countDocuments(incFilter),
      db.collection(COLLECTIONS.bk_stories).countDocuments(bkFilter),
    ])
    const total = incTotal + bkTotal
    const incidents: unknown[] = []

    if (skip < incTotal) {
      const incDocs = await db.collection(COLLECTIONS.incidents)
        .find(incFilter).sort({ 'date.year': 1 }).skip(skip).limit(limit).toArray()
      incidents.push(...incDocs.map(d => ({ ...d, _id: d._id.toString() })))
    }

    const bkSkip  = Math.max(0, skip - incTotal)
    const bkLimit = limit - incidents.length
    if (bkLimit > 0) {
      const bkDocs = await db.collection(COLLECTIONS.bk_stories)
        .find(bkFilter).sort({ extracted_at: -1 }).skip(bkSkip).limit(bkLimit).toArray()
      incidents.push(...bkDocs.map(d => normalizeBKStory(d as Record<string, unknown>)))
    }

    return { total, incidents }
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

export async function getTimelineData(source: 'standard' | 'bapa_katha' | 'all' = 'all') {
  const db = await getDb()

  function extractYear(s: string): number | null {
    if (!s) return null
    const m = s.match(/\b(1[89]\d{2}|20[012]\d)\b/)
    return m ? parseInt(m[1]) : null
  }

  const byYear: Record<number, { count: number; cats: Set<string>; items: unknown[] }> = {}

  if (source !== 'bapa_katha') {
    const rows = await db.collection(COLLECTIONS.incidents).aggregate([
      { $match: { 'date.year': { $exists: true, $ne: null } } },
      { $group: {
        _id: '$date.year',
        count: { $sum: 1 },
        categories: { $addToSet: '$category' },
        incidents: { $push: { desc: '$description', cat: '$category', id: { $toString: '$_id' } } },
      }},
      { $sort: { _id: 1 } },
    ]).toArray()
    for (const r of rows) {
      byYear[r._id] = { count: r.count, cats: new Set(r.categories), items: r.incidents }
    }
  }

  if (source !== 'standard') {
    const bkDocs = await db.collection(COLLECTIONS.bk_stories).find({}).toArray()
    for (const doc of bkDocs) {
      const year = extractYear((doc.time_life_stage as string) || '')
      if (!year) continue
      if (!byYear[year]) byYear[year] = { count: 0, cats: new Set(), items: [] }
      byYear[year].count++
      byYear[year].cats.add((doc.category as string) || 'bk_devotion')
      byYear[year].items.push({
        desc: (doc.summary as string) || (doc.story_title as string),
        cat: doc.category,
        id: doc._id.toString(),
        source_type: 'bapa_katha',
      })
    }
  }

  return Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, d]) => ({
      _id: Number(year),
      count: d.count,
      categories: [...d.cats],
      incidents: d.items,
    }))
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
