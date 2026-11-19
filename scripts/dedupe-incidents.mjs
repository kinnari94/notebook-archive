/**
 * Remove duplicate incidents that were saved once per category query.
 *
 * Within each source notebook, incidents whose descriptions are near-identical
 * (same logic as lib/incident-dedupe.ts) are grouped; the earliest-extracted one
 * is kept and the others' categories are recorded on it as also_matched_categories.
 *
 * Usage:
 *   node scripts/dedupe-incidents.mjs           (preview only — nothing deleted)
 *   node scripts/dedupe-incidents.mjs --apply   (delete duplicates)
 */

import { MongoClient } from 'mongodb'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const APPLY = process.argv.includes('--apply')

// ── keep in sync with lib/incident-dedupe.ts ──────────────────────────────
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'was', 'were', 'his', 'her', 'him',
  'their', 'they', 'into', 'onto', 'upon', 'at', 'in', 'on', 'of', 'to', 'a', 'an', 'by',
  'as', 'is', 'are', 'be', 'been', 'he', 'she', 'it', 'its', 'who', 'which', 'during',
  'after', 'before', 'where', 'when', 'while', 'also', 'had', 'has', 'have', 'there',
  'pujya', 'gurudevshri', 'gurudev', 'param', 'krupalu', 'dev', 'shrimad', 'rajchandra',
])
const normalizeText = s => (s || '').toLowerCase().normalize('NFKD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
function tokenize(s) {
  const out = new Set()
  for (const w of normalizeText(s).split(' ')) {
    if (w.length < 3 || STOPWORDS.has(w)) continue
    out.add(w.replace(/(ing|ed|es|s)$/, ''))
  }
  return out
}
function dice(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return (2 * inter) / (a.size + b.size)
}
const THRESHOLD = 0.6
function isDup(e, o) {
  if (dice(e.tokens, o.tokens) >= 0.85) return true // near-identical, ignore year
  if (e.year && o.year && e.year !== o.year) return false
  if (e.chunk.length >= 25 && e.chunk === o.chunk) return true
  const sameCat = e.d.category && e.d.category === o.d.category
  return dice(e.tokens, o.tokens) >= (sameCat ? 0.55 : THRESHOLD)
}
// ──────────────────────────────────────────────────────────────────────────

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const col = client.db(process.env.MONGODB_DB || 'bapaji_archive').collection('incidents')

const docs = await col.find({}, {
  projection: { description: 1, category: 1, 'date.year': 1, source_chunk: 1, source_notebook: 1, extracted_at: 1 },
}).sort({ extracted_at: 1, _id: 1 }).toArray()

const byNotebook = new Map()
for (const d of docs) {
  const k = d.source_notebook || '__none__'
  if (!byNotebook.has(k)) byNotebook.set(k, [])
  byNotebook.get(k).push(d)
}

let totalDupes = 0
const toDelete = []
const mergeCats = new Map() // keptId -> Set(categories)

for (const [nb, list] of byNotebook) {
  const kept = []
  for (const d of list) {
    const e = { d, year: d.date?.year, tokens: tokenize(d.description), chunk: normalizeText(d.source_chunk) }
    const match = kept.find(o => isDup(e, o))
    if (!match) { kept.push(e); continue }
    totalDupes++
    toDelete.push(d._id)
    const id = match.d._id.toString()
    if (!mergeCats.has(id)) mergeCats.set(id, { _id: match.d._id, cats: new Set() })
    if (d.category && d.category !== match.d.category) mergeCats.get(id).cats.add(d.category)
    console.log(`DUP [${d.category}] "${d.description}"\n  ↳ keeps [${match.d.category}] "${match.d.description}"\n`)
  }
  const nbDupes = list.length - kept.length
  if (nbDupes) console.log(`Notebook ${nb}: ${list.length} incidents → ${kept.length} unique (${nbDupes} duplicates)`)
}

console.log(`\nTotal: ${docs.length} incidents, ${totalDupes} duplicates`)

if (!APPLY) {
  console.log('\nPreview only. Re-run with --apply to delete duplicates.')
} else if (toDelete.length) {
  for (const { _id, cats } of mergeCats.values()) {
    if (cats.size) await col.updateOne({ _id }, { $addToSet: { also_matched_categories: { $each: [...cats] } } })
  }
  const r = await col.deleteMany({ _id: { $in: toDelete } })
  console.log(`Deleted ${r.deletedCount} duplicate incidents.`)
}

await client.close()
