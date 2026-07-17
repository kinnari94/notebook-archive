import clientPromise from './mongodb'
import { Db, ObjectId } from 'mongodb'

const DB_NAME = process.env.MONGODB_DB || 'bapaji_archive'

let indexesEnsured = false

export async function getDb(): Promise<Db> {
  const client = await clientPromise
  const db = client.db(DB_NAME)
  if (!indexesEnsured) {
    indexesEnsured = true
    db.collection('incidents').createIndex({ contentHash: 1 }, { unique: true, sparse: true }).catch(() => {})
    db.collection('bk_stories').createIndex({ contentHash: 1 }, { unique: true, sparse: true }).catch(() => {})
    // Query indexes
    db.collection('incidents').createIndex({ category: 1 }).catch(() => {})
    db.collection('incidents').createIndex({ people: 1 }).catch(() => {})
    db.collection('incidents').createIndex({ locations: 1 }).catch(() => {})
    db.collection('incidents').createIndex({ 'date.year': 1 }).catch(() => {})
    db.collection('bk_stories').createIndex({ categories: 1 }).catch(() => {})
    db.collection('bk_stories').createIndex({ person: 1 }).catch(() => {})
    db.collection('bk_stories').createIndex({ location: 1 }).catch(() => {})
    db.collection('bk_stories').createIndex({ extracted_at: -1 }).catch(() => {})
    // SRMD sheet unique fields (mirrors uniqueFields in lib/srmd-sheets.ts) — a real
    // unique index so a duplicate slips through even if a race beats the API's own
    // findOne check. A partial filter (not `sparse`) excludes both missing AND
    // blank-string values from the constraint — plain `sparse` only skips documents
    // missing the field entirely, so two legacy rows that both have e.g. Photo_ID: ""
    // would still collide and silently block index creation.
    // Note: srmd_condition_assess already has one legacy pair sharing an Object_ID
    // (re-assessment of the same object before this constraint existed), so that
    // specific index create will fail and log nothing (caught below) — the API's
    // findOne check still blocks any *new* Object_ID duplicates there regardless.
    const srmdUniqueIndexes: [string, string][] = [
      ['srmd_inventory_master', 'Object_ID'],
      ['srmd_condition_assess', 'Condition_ID'],
      ['srmd_condition_assess', 'Object_ID'],
      ['srmd_risk_priority', 'Risk_ID'],
      ['srmd_risk_priority', 'Object_ID'],
      ['srmd_location_storage', 'Location_ID'],
      ['srmd_photo_log', 'Photo_ID'],
      ['srmd_photo_log', 'Object_ID'],
      ['srmd_environment_summary', 'Env_ID'],
      ['srmd_treatment_recommendations', 'Treatment_ID'],
      ['srmd_treatment_recommendations', 'Object_ID'],
      ['srmd_change_log', 'Change_ID'],
    ]
    for (const [collection, field] of srmdUniqueIndexes) {
      // $gt: '' (not $ne — partial filter expressions don't support $ne/$not) reads as
      // "any non-empty string", which also implies existence, so no separate $exists needed.
      db.collection(collection).createIndex(
        { [field]: 1 },
        { unique: true, partialFilterExpression: { [field]: { $gt: '' } } }
      ).catch(() => {})
    }
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
  // SRMD Collection Assessment Workbook — see lib/srmd-sheets.ts and scripts/import-srmd-workbook.mjs
  srmd_readme: 'srmd_readme',
  srmd_lists_config: 'srmd_lists_config',
  srmd_inventory_master: 'srmd_inventory_master',
  srmd_condition_assess: 'srmd_condition_assess',
  srmd_risk_priority: 'srmd_risk_priority',
  srmd_location_storage: 'srmd_location_storage',
  srmd_photo_log: 'srmd_photo_log',
  srmd_environment_summary: 'srmd_environment_summary',
  srmd_treatment_recommendations: 'srmd_treatment_recommendations',
  srmd_change_log: 'srmd_change_log',
  srmd_custom_dropdown_options: 'srmd_custom_dropdown_options',
  srmd_picsio_url_cache: 'srmd_picsio_url_cache',
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

  // People don't live in the people collection — count the same (capped) list the browse dropdown uses
  try {
    stats.people = (await getAllPeople()).length
  } catch {
    stats.people = 0
  }

  // Seva projects live in incidents + bk_stories, not in the seva_projects collection
  try {
    const [sevaInc, sevaBk] = await Promise.all([
      db.collection(COLLECTIONS.incidents).countDocuments({ category: 'seva_projects' }),
      db.collection(COLLECTIONS.bk_stories).countDocuments({ categories: 'bk_compassion_seva' }),
    ])
    stats.seva_projects = sevaInc + sevaBk
  } catch {
    stats.seva_projects = 0
  }

  // Extractions count = total points saved across all jobs (meaningful output metric)
  try {
    const result = await db.collection(COLLECTIONS.extractions).aggregate([
      { $group: { _id: null, total: { $sum: '$points_saved' }, jobs: { $sum: 1 } } },
    ]).toArray()
    stats.extractions = result[0]?.total ?? 0
    stats.extraction_jobs = result[0]?.jobs ?? 0
  } catch {
    stats.extractions = 0
    stats.extraction_jobs = 0
  }

  return stats
}

export async function getCategoryBreakdown() {
  const db = await getDb()
  try {
    const [incRows, bkRows] = await Promise.all([
      db.collection(COLLECTIONS.incidents).aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]).toArray(),
      db.collection(COLLECTIONS.bk_stories).aggregate([
        { $unwind: '$categories' },
        { $group: { _id: '$categories', count: { $sum: 1 } } },
      ]).toArray(),
    ])

    const merged: Record<string, number> = {}
    for (const r of [...incRows, ...bkRows]) {
      if (r._id) merged[r._id] = (merged[r._id] || 0) + r.count
    }

    return Object.entries(merged)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  } catch {
    return []
  }
}

export async function getRecentExtractions(limit = 8) {
  const db = await getDb()
  try {
    const docs = await db.collection(COLLECTIONS.extractions)
      .find({}, { projection: { _id: 0 } })
      .sort({ started_at: -1 })
      .limit(limit)
      .toArray()

    // Backfill notebook_title for old records that predate the title field
    return await Promise.all(docs.map(async (doc) => {
      if (doc.notebook_title) return doc
      const col = doc.notebook_type === 'bapa_katha' ? COLLECTIONS.bk_stories : COLLECTIONS.incidents
      const sample = await db.collection(col).findOne(
        { source_notebook: doc.notebook_id },
        { projection: { source_notebook_title: 1 } }
      )
      return { ...doc, notebook_title: sample?.source_notebook_title ?? null }
    }))
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
  tags?: string[]
  sort?: 'asc' | 'desc'
  limit?: number
  skip?: number
  source?: 'standard' | 'bapa_katha' | 'all'
}

function buildIncFilter(q: Omit<IncidentQuery, 'limit' | 'skip'>): Record<string, unknown> {
  const incFilter: Record<string, unknown> = {}
  if (q.category && !q.category.startsWith('bk_')) incFilter.category = q.category
  if (q.person)   incFilter.people    = { $regex: q.person,   $options: 'i' }
  if (q.location) incFilter.locations = { $regex: q.location, $options: 'i' }
  if (q.year_from || q.year_to) {
    const yr: Record<string, number> = {}
    if (q.year_from) yr.$gte = q.year_from
    if (q.year_to)   yr.$lte = q.year_to
    incFilter['date.year'] = yr
  }
  if (q.tags?.length) incFilter.tags = { $all: q.tags }
  if (q.search_text) incFilter.$text = { $search: q.search_text }
  return incFilter
}

function buildBkFilter(q: Omit<IncidentQuery, 'limit' | 'skip'>): Record<string, unknown> {
  // BK stories store their category as either a single `category` string (legacy docs)
  // or a `categories` array (newer docs) — match both. Each condition is pushed into
  // $and rather than reusing the $or key directly, since person + search_text both
  // need their own $or clause and a shared key would silently overwrite the first one.
  const and: Record<string, unknown>[] = []
  if (q.category?.startsWith('bk_')) {
    and.push({ $or: [{ category: q.category }, { categories: q.category }] })
  }
  if (q.person) {
    and.push({ $or: [
      { person:        { $regex: q.person, $options: 'i' } },
      { what_happened: { $regex: q.person, $options: 'i' } },
    ] })
  }
  if (q.location) and.push({ location: { $regex: q.location, $options: 'i' } })
  if (q.year_from || q.year_to) {
    // time_life_stage is free text (e.g. "1995-1996", "Early 1980s") — match any year in range
    const from = q.year_from ?? 1800
    const to   = q.year_to   ?? new Date().getFullYear()
    const years: number[] = []
    for (let y = from; y <= to; y++) years.push(y)
    and.push({ time_life_stage: { $regex: `\\b(${years.join('|')})\\b` } })
  }
  if (q.tags?.length) and.push({ tags: { $all: q.tags } })
  if (q.search_text) {
    and.push({ $or: [
      { story_title:   { $regex: q.search_text, $options: 'i' } },
      { summary:       { $regex: q.search_text, $options: 'i' } },
      { what_happened: { $regex: q.search_text, $options: 'i' } },
    ] })
  }
  return and.length ? { $and: and } : {}
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
  const incSortDir = q.sort === 'desc' ? -1 : 1
  const bkSortDir  = q.sort === 'asc'  ? 1  : -1

  if (q.category?.startsWith('bk_') && source === 'standard') {
    // category is a BK category but we're in standard mode — no standard incidents match
    return { total: 0, incidents: [] }
  }

  const incFilter = buildIncFilter(q)
  const bkFilter  = buildBkFilter(q)

  try {
    if (source === 'standard') {
      const total = await db.collection(COLLECTIONS.incidents).countDocuments(incFilter)
      const docs  = await db.collection(COLLECTIONS.incidents)
        .find(incFilter).sort({ 'date.year': incSortDir }).skip(skip).limit(limit).toArray()
      return { total, incidents: docs.map(d => ({ ...d, _id: d._id.toString() })) }
    }

    if (source === 'bapa_katha') {
      const total = await db.collection(COLLECTIONS.bk_stories).countDocuments(bkFilter)
      const docs  = await db.collection(COLLECTIONS.bk_stories)
        .find(bkFilter).sort({ extracted_at: bkSortDir }).skip(skip).limit(limit).toArray()
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
        .find(incFilter).sort({ 'date.year': incSortDir }).skip(skip).limit(limit).toArray()
      incidents.push(...incDocs.map(d => ({ ...d, _id: d._id.toString() })))
    }

    const bkSkip  = Math.max(0, skip - incTotal)
    const bkLimit = limit - incidents.length
    if (bkLimit > 0) {
      const bkDocs = await db.collection(COLLECTIONS.bk_stories)
        .find(bkFilter).sort({ extracted_at: bkSortDir }).skip(bkSkip).limit(bkLimit).toArray()
      incidents.push(...bkDocs.map(d => normalizeBKStory(d as Record<string, unknown>)))
    }

    return { total, incidents }
  } catch {
    return { total: 0, incidents: [] }
  }
}

// Category counts for the current filter set (category itself excluded), used to keep
// the browse page's category pills accurate without downloading every matching record.
export async function getCategoryCounts(q: Omit<IncidentQuery, 'category' | 'limit' | 'skip'>) {
  const db = await getDb()
  const source = q.source || 'standard'
  const filterQuery = { ...q, category: undefined }

  try {
    if (source === 'bapa_katha') {
      const bkFilter = buildBkFilter(filterQuery)
      const rows = await db.collection(COLLECTIONS.bk_stories).aggregate([
        { $match: bkFilter },
        { $project: { cat: { $ifNull: [{ $arrayElemAt: ['$categories', 0] }, '$category'] } } },
        { $group: { _id: '$cat', count: { $sum: 1 } } },
      ]).toArray()
      const categories = rows.filter(r => r._id).map(r => ({ category: r._id as string, count: r.count as number }))
      return { total: categories.reduce((s, c) => s + c.count, 0), categories }
    }

    const incFilter = buildIncFilter(filterQuery)
    const rows = await db.collection(COLLECTIONS.incidents).aggregate([
      { $match: incFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]).toArray()
    const categories = rows.filter(r => r._id).map(r => ({ category: r._id as string, count: r.count as number }))
    return { total: categories.reduce((s, c) => s + c.count, 0), categories }
  } catch {
    return { total: 0, categories: [] as { category: string; count: number }[] }
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

function flattenDistinct(items: unknown[]): string[] {
  const out: string[] = []
  for (const item of items) {
    const vals = Array.isArray(item) ? item : [item]
    for (const v of vals) {
      if (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'not specified')
        out.push(v.trim())
    }
  }
  return out
}

export async function getAllPeople(limit = 200) {
  const db = await getDb()
  const [incPeople, bkPerson, bkOtherPeople] = await Promise.all([
    db.collection(COLLECTIONS.incidents).distinct('people'),
    db.collection(COLLECTIONS.bk_stories).distinct('person'),
    db.collection(COLLECTIONS.bk_stories).distinct('other_people'),
  ])
  const flat = flattenDistinct([...incPeople, ...bkPerson, ...bkOtherPeople])
  return [...new Set(flat)].sort().slice(0, limit)
}

export async function getAllLocations(limit = 200) {
  const db = await getDb()
  const [incLocations, bkLocation] = await Promise.all([
    db.collection(COLLECTIONS.incidents).distinct('locations'),
    db.collection(COLLECTIONS.bk_stories).distinct('location'),
  ])
  const flat = flattenDistinct([...incLocations, ...bkLocation])
  return [...new Set(flat)].sort().slice(0, limit)
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
      const docCats = (doc.categories as string[]) || []
      docCats.forEach(c => byYear[year].cats.add(c))
      byYear[year].items.push({
        desc: (doc.summary as string) || (doc.story_title as string),
        cat: docCats[0] || 'bapa_katha',
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
