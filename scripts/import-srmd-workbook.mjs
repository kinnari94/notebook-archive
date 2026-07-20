/**
 * One-time import of the SRMD Collection Assessment Workbook into MongoDB.
 *
 * Reads the 8 row-based data tabs (02–09), the 01_Lists_Config lookup tables,
 * and the 00_Read_Me content into their own srmd_* collections, keyed for
 * idempotent re-runs (upsert, never duplicate).
 *
 * Usage: node scripts/import-srmd-workbook.mjs [path/to/workbook.xlsx]
 */

import { MongoClient } from 'mongodb'
import XLSX from 'xlsx'
import { config } from 'dotenv'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const WORKBOOK_PATH = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : join(__dirname, '..', '1_SRMD_Collection_Assessment_Workbook_1_edited (version 2) (3).xlsx')

// sheet → { collection, keyFields (primary key columns), fallbackFields (used to
// derive a stable hash key when the primary key column is blank in the sheet) }
// requiredField marks the join/identity column that must be present for a row to
// count as real data — Excel keeps formula-driven columns "non-blank" (0s, defaults)
// far past the last real entry, so blank cells alone can't signal end-of-data.
const DATA_SHEETS = [
  { sheet: '02_Inventory_Master',          collection: 'srmd_inventory_master',          keyFields: ['Object_ID'],    requiredField: 'Object_ID' },
  { sheet: '03_Condition_Assess',          collection: 'srmd_condition_assess',          keyFields: ['Condition_ID'], fallbackFields: ['Object_ID', 'Assessment_Date', 'Assessor'], requiredField: 'Object_ID' },
  { sheet: '04_Risk_Priority',             collection: 'srmd_risk_priority',             keyFields: ['Risk_ID'],      fallbackFields: ['Object_ID', 'Assessment_Date'],              requiredField: 'Object_ID' },
  { sheet: '05_Location_Storage',          collection: 'srmd_location_storage',          keyFields: ['Location_ID'], requiredField: 'Location_ID' },
  { sheet: '06_Photo_Log',                 collection: 'srmd_photo_log',                 keyFields: ['Photo_ID'],     fallbackFields: ['Object_ID', 'Photo_Date', 'Master_File_Name'], requiredField: 'Object_ID' },
  { sheet: '07_Environment_Summary',       collection: 'srmd_environment_summary',       keyFields: ['Env_ID'],       requiredField: 'Env_ID' },
  { sheet: '08_Treatment_Recommendations', collection: 'srmd_treatment_recommendations', keyFields: ['Treatment_ID'], fallbackFields: ['Object_ID', 'Recommendation_Date'], requiredField: 'Object_ID' },
  { sheet: '09_Change_Log',                collection: 'srmd_change_log',                keyFields: ['Change_ID'],    requiredField: 'Change_ID' },
]

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

function rowIsEmpty(row, width) {
  for (let i = 0; i < width; i++) {
    if (!isBlank(row[i])) return false
  }
  return true
}

function hashKey(parts) {
  return createHash('sha1').update(parts.join('|')).digest('hex')
}

function decodeXmlEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

// Some ID cells carry two runs of rich text in one string: an old ID with
// strikethrough (superseded), followed by the current ID with no formatting —
// e.g. "0001-SH-TX-PPG" (struck) + "  PPG-TX-SH-0001" (plain), which XLSX's
// flattened cell.v concatenates into one garbled string. SheetJS exposes the
// original run-level XML via cell.r, which lets us drop the struck run and
// keep only the current, un-struck text.
function destrikeCellValue(cell) {
  if (!cell || cell.t !== 's' || typeof cell.r !== 'string' || !cell.r.includes('<strike')) {
    return cell ? cell.v : null
  }
  const kept = [...cell.r.matchAll(/<r>([\s\S]*?)<\/r>/g)]
    .filter(([, body]) => !/<strike\s*\/?>/.test(body))
    .map(([, body]) => {
      const m = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)
      return m ? decodeXmlEntities(m[1]) : ''
    })
    .join('')
    .trim()
  return kept || cell.v // everything struck (shouldn't happen given the pattern seen) — fall back to the raw value
}

// ── 02–09: row-based data tabs ───────────────────────────────────────────────

function parseDataSheet(wb, { sheet, requiredField }) {
  const ws = wb.Sheets[sheet]
  if (!ws) throw new Error(`Sheet "${sheet}" not found`)
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  const headers = grid[1] || []
  const width = headers.length
  const requiredCol = headers.indexOf(requiredField)

  const docs = []
  for (let r = 2; r < grid.length; r++) {
    const row = grid[r] || []
    if (rowIsEmpty(row, width)) break // fully blank row — end of sheet
    if (requiredCol >= 0 && isBlank(row[requiredCol])) break // no join key — rest is formula/template artifacts, not real rows

    const doc = {}
    for (let c = 0; c < width; c++) {
      const field = headers[c]
      if (!field) continue
      let val = row[c]
      if (isBlank(val)) continue
      if (typeof val === 'string') val = destrikeCellValue(ws[XLSX.utils.encode_cell({ r, c })])
      doc[field] = val
    }
    if (!Object.keys(doc).length) continue
    docs.push(doc)
  }
  return docs
}

function keyFor(doc, keyFields, fallbackFields) {
  for (const f of keyFields) {
    if (!isBlank(doc[f])) return String(doc[f]).trim()
  }
  if (fallbackFields) {
    const parts = fallbackFields.map(f => String(doc[f] ?? '').trim())
    if (parts.some(p => p)) return hashKey(parts)
  }
  return hashKey([JSON.stringify(doc)])
}

// ── 01_Lists_Config: side-by-side lookup tables ──────────────────────────────
//
// The tables are packed tightly (some only 4-8 rows tall) with a mix of spacer
// columns, instructional text rows, and blank template rows interleaved between
// them — a generic "scan until blank" pass bleeds across table boundaries (e.g.
// picks up the next table's title as a data value). These boundaries were
// confirmed by hand against the actual file, so they're hardcoded rather than
// inferred at import time.
// dataCount is fixed rather than "read until blank" — some tables sit directly
// above instructional text or the next table's header with no blank separator
// row, so a blank-scan would silently swallow unrelated rows into this table.
const LISTS_CONFIG_TABLES = [
  { name: 'tblCollectionType',   headerRow: 1,  cols: [0, 1, 2, 3],    dataStart: 2,  dataCount: 4 },
  { name: 'tblRecordLevel',      headerRow: 1,  cols: [5, 6, 7],       dataStart: 2,  dataCount: 5 },
  { name: 'tblAccessLevel',      headerRow: 1,  cols: [9, 10],         dataStart: 2,  dataCount: 4 },
  { name: 'tblConditionScale',   headerRow: 9,  cols: [0, 1, 2],       dataStart: 10, dataCount: 5 },
  { name: 'tblRiskType',         headerRow: 9,  cols: [4, 5],          dataStart: 10, dataCount: 10 },
  { name: 'tblDamageTerms',      headerRow: 9,  cols: [7, 8, 9],       dataStart: 10, dataCount: 30 },
  { name: 'tblPhotoView',        headerRow: 9,  cols: [11, 12],        dataStart: 10, dataCount: 5 },
  { name: 'tblPriorityBand',     headerRow: 45, cols: [0, 1, 2, 3],    dataStart: 46, dataCount: 4 },
  { name: 'tblThresholds',       headerRow: 45, cols: [5, 6, 7, 8, 9], dataStart: 46, dataCount: 8 },
  { name: 'tblUsers',            headerRow: 53, cols: [0, 1, 2],       dataStart: 54, dataCount: 4 },
  { name: 'tblOverallCondition', headerRow: 53, cols: [4],             dataStart: 54, dataCount: 5 },
  { name: 'tblSurveyStatus',     headerRow: 59, cols: [6],             dataStart: 60, dataCount: 4 },
]

function parseListsConfig(wb) {
  const ws = wb.Sheets['01_Lists_Config']
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  const docs = []
  for (const { name, headerRow, cols, dataStart, dataCount } of LISTS_CONFIG_TABLES) {
    const headers = cols.map(c => grid[headerRow]?.[c])

    for (let r = dataStart; r < dataStart + dataCount; r++) {
      const row = grid[r] || []
      const doc = { table: name }
      cols.forEach((c, i) => {
        const h = headers[i]
        if (h && !isBlank(row[c])) doc[h] = row[c]
      })
      if (Object.keys(doc).length > 1) docs.push(doc)
    }
  }
  return docs
}

// ── 00_Read_Me: docs content ──────────────────────────────────────────────────

function parseReadMe(wb) {
  const ws = wb.Sheets['00_Read_Me']
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  const cell = (r, c) => grid[r]?.[c] ?? null

  const projectInfo = []
  for (let r = 4; r <= 10; r++) {
    const field = cell(r, 0)
    if (isBlank(field)) continue
    projectInfo.push({ field, notes: cell(r, 1) })
  }

  const sheetGuide = []
  for (let r = 21; r <= 33; r++) {
    const sheet = cell(r, 0)
    if (isBlank(sheet)) continue
    sheetGuide.push({ sheet, primary_user: cell(r, 1) })
  }

  return [
    { section: 'header', order: 0, title: cell(0, 0), subtitle: cell(1, 0) },
    { section: 'project_info', order: 1, fields: projectInfo },
    { section: 'sheet_guide', order: 2, rows: sheetGuide },
    { section: 'key_rules', order: 3, text: cell(36, 0) },
  ]
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📂  Workbook: ${WORKBOOK_PATH}`)

  const uri = process.env.MONGODB_URI
  if (!uri) { console.error('❌  MONGODB_URI not set in .env.local'); process.exit(1) }

  let wb
  try {
    wb = XLSX.readFile(WORKBOOK_PATH, { cellDates: true })
  } catch (e) {
    console.error('❌  Could not read workbook:', e.message)
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'bapaji_archive')

  console.log('\n📊  Import summary:')

  try {
    for (const spec of DATA_SHEETS) {
      const docs = parseDataSheet(wb, spec)
      const col = db.collection(spec.collection)
      let inserted = 0, updated = 0
      for (const doc of docs) {
        const key = keyFor(doc, spec.keyFields, spec.fallbackFields)
        const result = await col.updateOne(
          { _srmd_key: key },
          { $set: { ...doc, _srmd_key: key, updated_at: new Date() }, $setOnInsert: { imported_at: new Date() } },
          { upsert: true }
        )
        if (result.upsertedCount > 0) inserted++
        else updated++
      }
      console.log(`  ${spec.sheet.padEnd(30)} → ${spec.collection.padEnd(32)} ${docs.length} rows (${inserted} new, ${updated} updated)`)
    }

    // Lists config
    {
      const docs = parseListsConfig(wb)
      const col = db.collection('srmd_lists_config')
      let inserted = 0, updated = 0
      for (const doc of docs) {
        const key = `${doc.table}:${doc.Code ?? hashKey([JSON.stringify(doc)])}`
        const result = await col.updateOne(
          { _srmd_key: key },
          { $set: { ...doc, _srmd_key: key, updated_at: new Date() }, $setOnInsert: { imported_at: new Date() } },
          { upsert: true }
        )
        if (result.upsertedCount > 0) inserted++
        else updated++
      }
      console.log(`  01_Lists_Config${' '.repeat(15)} → srmd_lists_config${' '.repeat(14)} ${docs.length} rows (${inserted} new, ${updated} updated)`)
    }

    // Read Me
    {
      const docs = parseReadMe(wb)
      const col = db.collection('srmd_readme')
      let inserted = 0, updated = 0
      for (const doc of docs) {
        const result = await col.updateOne(
          { section: doc.section },
          { $set: { ...doc, updated_at: new Date() }, $setOnInsert: { imported_at: new Date() } },
          { upsert: true }
        )
        if (result.upsertedCount > 0) inserted++
        else updated++
      }
      console.log(`  00_Read_Me${' '.repeat(21)} → srmd_readme${' '.repeat(21)} ${docs.length} rows (${inserted} new, ${updated} updated)`)
    }

    console.log('\n✅  Import complete. Safe to re-run — rows are upserted by natural key.')
  } finally {
    await client.close()
  }
}

main().catch(e => {
  console.error('❌  Fatal error:', e)
  process.exit(1)
})
