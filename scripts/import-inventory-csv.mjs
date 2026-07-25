/**
 * Import a 02_Inventory_Master CSV export into MongoDB srmd_inventory_master.
 *
 * Mirrors scripts/import-srmd-workbook.mjs's row shape (title row, header row,
 * then data) and upsert-by-Object_ID key, so this collection stays consistent
 * whether rows arrive via the full workbook re-import or a one-off CSV like
 * this one.
 *
 * Usage: node scripts/import-inventory-csv.mjs path/to/sheet.csv
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
  console.error('❌  Usage: node scripts/import-inventory-csv.mjs path/to/sheet.csv')
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

// Entry_Date arrives as DD-MM-YY (e.g. "21-07-26"); normalize to the
// YYYY-MM-DD format already used across existing srmd_inventory_master rows.
function normalizeDate(v) {
  const m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return v
  const [, dd, mm, yy] = m
  return `20${yy}-${mm}-${dd}`
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) { console.error('❌  MONGODB_URI not set in .env.local'); process.exit(1) }

  const raw = readFileSync(CSV_PATH, 'utf8')
  const grid = parseCsv(raw)

  const headerRow = grid.findIndex(r => r.includes('Object_ID'))
  if (headerRow < 0) { console.error('❌  Could not find a header row containing "Object_ID"'); process.exit(1) }
  // Source headers are stray-space-prone (e.g. "Record_Level _2") — real schema
  // keys are always underscore-joined with no internal whitespace, so strip all
  // whitespace rather than just trimming the ends.
  const headers = grid[headerRow].map(h => h.trim().replace(/\s+/g, ''))
  const width = headers.length
  const objectIdCol = headers.indexOf('Object_ID')

  const docs = []
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || []
    if (row.every(isBlank)) continue
    if (isBlank(row[objectIdCol])) continue

    const doc = {}
    for (let c = 0; c < width; c++) {
      const field = headers[c]
      if (!field || isBlank(row[c])) continue
      let val = row[c].trim()
      if (field === 'Entry_Date') val = normalizeDate(val)
      doc[field] = val
    }
    docs.push(doc)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'bapaji_archive')
  const col = db.collection('srmd_inventory_master')

  let inserted = 0, updated = 0
  try {
    for (const doc of docs) {
      const key = String(doc.Object_ID).trim()
      const result = await col.updateOne(
        { _srmd_key: key },
        { $set: { ...doc, Object_ID: key, _srmd_key: key, updated_at: new Date() }, $setOnInsert: { imported_at: new Date() } },
        { upsert: true }
      )
      if (result.upsertedCount > 0) inserted++
      else updated++
    }
    console.log(`✅  ${docs.length} rows processed → srmd_inventory_master (${inserted} new, ${updated} updated)`)
  } finally {
    await client.close()
  }
}

main().catch(e => {
  console.error('❌  Fatal error:', e)
  process.exit(1)
})
