/**
 * Import a 03_Condition_Assess CSV export into MongoDB srmd_condition_assess.
 *
 * Same row shape / upsert approach as scripts/import-inventory-csv.mjs, but keyed
 * the way scripts/import-srmd-workbook.mjs keys this sheet: primary key is
 * Condition_ID, falling back to a stable hash of Object_ID + Assessment_Date +
 * Assessor when Condition_ID is blank (the common case for freshly-entered rows
 * that haven't been assigned a Condition_ID yet).
 *
 * Usage: node scripts/import-condition-csv.mjs path/to/sheet.csv
 */

import { readFileSync } from 'fs'
import { MongoClient } from 'mongodb'
import { config } from 'dotenv'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const CSV_PATH = process.argv[2]
if (!CSV_PATH) {
  console.error('❌  Usage: node scripts/import-condition-csv.mjs path/to/sheet.csv')
  process.exit(1)
}

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

// Minimal RFC-4180 CSV parser — handles quoted fields with embedded commas/newlines
// (e.g. multi-line Condition_Summary cells) and escaped `""` quotes.
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

// Dates arrive as DD-MM-YY (e.g. "21-07-26"); normalize to YYYY-MM-DD, matching
// the plain date-string convention the app's own add/edit form writes.
function normalizeDate(v) {
  const m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return v
  const [, dd, mm, yy] = m
  return `20${yy}-${mm}-${dd}`
}

function hashKey(parts) {
  return createHash('sha1').update(parts.join('|')).digest('hex')
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) { console.error('❌  MONGODB_URI not set in .env.local'); process.exit(1) }

  const raw = readFileSync(CSV_PATH, 'utf8')
  const grid = parseCsv(raw)

  const headerRow = grid.findIndex(r => r.includes('Condition_ID') && r.includes('Object_ID'))
  if (headerRow < 0) { console.error('❌  Could not find a header row containing "Condition_ID" and "Object_ID"'); process.exit(1) }
  const headers = grid[headerRow].map(h => h.trim().replace(/\s+/g, ''))
  const width = headers.length
  const objectIdCol = headers.indexOf('Object_ID')

  const docs = []
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || []
    if (row.every(isBlank)) continue
    if (isBlank(row[objectIdCol])) continue // Object_ID is the required join key for this sheet

    const doc = {}
    for (let c = 0; c < width; c++) {
      const field = headers[c]
      if (!field || isBlank(row[c])) continue
      let val = row[c].trim()
      if (field === 'Assessment_Date' || field === 'Next_Review_Date') val = normalizeDate(val)
      // Checkbox fields: normalize stray casing (e.g. a lone "no") to match the
      // 'Yes'/'No' convention already used across every other row in this sheet.
      if ((field === 'Immediate_Stabilization_Needed' || field === 'Quarantine_Flag') && /^(yes|no)$/i.test(val)) {
        val = val[0].toUpperCase() + val.slice(1).toLowerCase()
      }
      doc[field] = val
    }
    // Month_Key is a derived field (=TEXT(Assessment_Date,"yyyy-mm")) — recompute
    // from the normalized date rather than trust the CSV's raw copy of the date.
    if (doc.Assessment_Date) doc.Month_Key = doc.Assessment_Date.slice(0, 7)
    else delete doc.Month_Key
    docs.push(doc)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'bapaji_archive')
  const col = db.collection('srmd_condition_assess')

  let inserted = 0, updated = 0
  try {
    for (const doc of docs) {
      const key = !isBlank(doc.Condition_ID)
        ? String(doc.Condition_ID).trim()
        : hashKey([doc.Object_ID ?? '', doc.Assessment_Date ?? '', doc.Assessor ?? ''])
      const result = await col.updateOne(
        { _srmd_key: key },
        { $set: { ...doc, _srmd_key: key, updated_at: new Date() }, $setOnInsert: { imported_at: new Date() } },
        { upsert: true }
      )
      if (result.upsertedCount > 0) inserted++
      else updated++
    }
    console.log(`✅  ${docs.length} rows processed → srmd_condition_assess (${inserted} new, ${updated} updated)`)
  } finally {
    await client.close()
  }
}

main().catch(e => {
  console.error('❌  Fatal error:', e)
  process.exit(1)
})
