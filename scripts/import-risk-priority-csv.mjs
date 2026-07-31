/**
 * Import a 04_Risk_Priority CSV export into MongoDB srmd_risk_priority.
 *
 * Same row shape / upsert approach as scripts/import-condition-csv.mjs. Keyed
 * by Risk_ID when present, else by Object_ID directly — this collection
 * carries a unique index on Object_ID (see lib/db.ts), so that's the real
 * join key. A hash of Object_ID + Assessment_Date was tried here previously,
 * matching how the original xlsx-workbook import (scripts/import-srmd-workbook.mjs)
 * keyed this sheet, but that hash was computed from raw Excel Date objects
 * rather than normalized date strings — no CSV-recomputed hash can ever match
 * those existing keys again, so every re-import silently duplicated instead
 * of updating (same root cause fixed in import-condition-csv.mjs).
 *
 * Usage: node scripts/import-risk-priority-csv.mjs path/to/sheet.csv
 */

import { readFileSync } from 'fs'
import { MongoClient } from 'mongodb'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const CSV_PATH = process.argv[2]
if (!CSV_PATH) {
  console.error('❌  Usage: node scripts/import-risk-priority-csv.mjs path/to/sheet.csv')
  process.exit(1)
}

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

// Minimal RFC-4180 CSV parser — handles quoted fields with embedded commas
// (e.g. `"Karma, Akarma, Vikarma-7.1"`) and escaped `""` quotes.
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1]
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// Dates mostly arrive as DD-MM-YY (e.g. "21-07-26"), but handle a 4-digit-year
// variant too (seen in the sibling Condition_Assess export) — normalize both to
// YYYY-MM-DD, matching the plain date-string convention the app's own
// add/edit form writes.
function normalizeDate(v) {
  let m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(v)
  if (m) { const [, dd, mm, yy] = m; return `20${yy}-${mm}-${dd}` }
  m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v)
  if (m) { const [, dd, mm, yyyy] = m; return `${yyyy}-${mm}-${dd}` }
  return v
}

// This export's Priority_Band came through with a mojibake artifact — "–"
// (en dash) round-tripped through a bad encoding step became "â". Existing
// DB values (e.g. "D – Monitor") confirm the intended character.
function fixMojibake(v) {
  return v.replace(/\s*â\s*/g, ' – ')
}

// Fields that represent an actual assessment having been performed. A row
// missing all of these — even if Assessor (assigned but not yet done) or the
// formula-derived Priority_Score/Priority_Band happen to carry a value —
// hasn't really been risk-assessed yet (Priority_Score:0 / Priority_Band's
// lowest band are spreadsheet defaults, not real determinations).
const CORE_FIELDS = new Set([
  'Assessment_Date', 'Spiritual_Significance', 'Historical_Significance',
  'Research_Value', 'Display_Value', 'Significance_Total', 'Primary_Risk_Type',
  'Severity', 'Likelihood', 'Risk_Score',
])

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) { console.error('❌  MONGODB_URI not set in .env.local'); process.exit(1) }

  const raw = readFileSync(CSV_PATH, 'utf8')
  const grid = parseCsv(raw)

  const headerRow = grid.findIndex(r => r.includes('Risk_ID') && r.includes('Object_ID'))
  if (headerRow < 0) { console.error('❌  Could not find a header row containing "Risk_ID" and "Object_ID"'); process.exit(1) }
  const headers = grid[headerRow].map(h => h.trim().replace(/\s+/g, ''))
  const width = headers.length
  const objectIdCol = headers.indexOf('Object_ID')

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'bapaji_archive')
  const col = db.collection('srmd_risk_priority')
  const validObjectIds = new Set(
    (await db.collection('srmd_inventory_master').distinct('Object_ID'))
  )

  const docs = []
  let stubCount = 0, orphanCount = 0
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || []
    if (row.every(isBlank)) continue
    if (isBlank(row[objectIdCol])) continue // Object_ID is the required join key for this sheet

    const objectId = row[objectIdCol].trim()
    if (!validObjectIds.has(objectId)) { orphanCount++; continue } // no inventory item to attach to

    const doc = {}
    for (let c = 0; c < width; c++) {
      const field = headers[c]
      if (!field || isBlank(row[c])) continue
      let val = row[c].trim()
      if (field === 'Assessment_Date') val = normalizeDate(val)
      if (field === 'Priority_Band') val = fixMojibake(val)
      doc[field] = val
    }
    // A row with none of the real scoring inputs is a formula-artifact stub
    // (object not yet risk-assessed) — keep only Object_ID, same treatment as
    // scripts/import-condition-csv.mjs gives its blank rows.
    const isStub = !Object.keys(doc).some(k => CORE_FIELDS.has(k))
    if (isStub) {
      stubCount++
      for (const k of Object.keys(doc)) if (k !== 'Object_ID') delete doc[k]
    }
    // Month_Key is a derived field (=TEXT(Assessment_Date,"yyyy-mm")) — recompute
    // from the normalized date rather than trust the CSV's raw copy (which had
    // broken #REF! values for a few rows in this export).
    if (doc.Assessment_Date) doc.Month_Key = doc.Assessment_Date.slice(0, 7)
    else delete doc.Month_Key
    docs.push({ __isStub: isStub, ...doc })
  }
  if (stubCount > 0) console.log(`ℹ️  ${stubCount} row(s) have no real assessment inputs — imported as placeholders.`)
  if (orphanCount > 0) console.log(`⚠️  Skipped ${orphanCount} row(s) whose Object_ID has no matching inventory_master item.`)

  let inserted = 0, updated = 0
  try {
    for (const { __isStub, ...doc } of docs) {
      // Object_ID carries a unique index on this collection — that's the real
      // join key. Match on the real field itself (not _srmd_key) so this
      // self-heals any doc whose stored _srmd_key is a stale
      // pre-normalization hash from an earlier import.
      const usesRiskId = !isBlank(doc.Risk_ID)
      const key = usesRiskId ? String(doc.Risk_ID).trim() : String(doc.Object_ID).trim()
      const filter = usesRiskId ? { Risk_ID: key } : { Object_ID: key }
      const update = { $set: { ...doc, _srmd_key: key, updated_at: new Date() }, $setOnInsert: { imported_at: new Date() } }
      // A stub row only carries Object_ID — explicitly unset every other sheet
      // field so this self-heals a doc a previous (buggy) run over-populated.
      if (__isStub) {
        const unset = {}
        for (const h of headers) if (h && h !== 'Object_ID' && !(h in doc)) unset[h] = ''
        if (Object.keys(unset).length) update.$unset = unset
      }
      const result = await col.updateOne(filter, update, { upsert: true })
      if (result.upsertedCount > 0) inserted++
      else updated++
    }
    console.log(`✅  ${docs.length} rows processed → srmd_risk_priority (${inserted} new, ${updated} updated)`)
  } finally {
    await client.close()
  }
}

main().catch(e => {
  console.error('❌  Fatal error:', e)
  process.exit(1)
})
