/**
 * Import Excel into MongoDB physical_collections
 *
 * Usage:
 *   node scripts/import-collections.mjs path/to/file.xlsx
 *   node scripts/import-collections.mjs path/to/file.xlsx --dry-run   (preview only, no insert)
 *   node scripts/import-collections.mjs path/to/file.xlsx --sheet "Sheet2"
 *
 * The script auto-maps Excel column headers (case-insensitive, flexible names)
 * to the physical_collections schema fields. Print the mapping first so you
 * can verify before any data is written.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MongoClient } from 'mongodb'
import XLSX from 'xlsx'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

// ── Column name → schema field mapping ──────────────────────────────────────
// Keys are lowercased / normalised Excel header variations.
// Values are the MongoDB document field names.
const HEADER_MAP = {
  // identity
  'accession code':        'accessionCode',
  'accession no':          'accessionCode',
  'accession number':      'accessionCode',
  'acc code':              'accessionCode',
  'acc no':                'accessionCode',
  'acc. no':               'accessionCode',
  'acc. no.':              'accessionCode',
  'new accession code':    'newaccessionCode',
  'legacy':                'legacy',

  // material
  'material':              'material',

  // core
  'title':                 'title',
  'object title':          'title',
  'name':                  'title',
  'object name':           'title',
  'artifact name':         'title',
  'item name':             'title',
  'description':           'description',
  'object basic description': 'description',
  'desc':                  'description',
  'brief description':     'description',
  'summary':               'description',
  'category':              'material',
  'type':                  'material',
  'object type':           'material',
  'artifact type':         'material',
  'class':                 'material',
  'status':                'status',
  'holding status':        'status',
  'catalog status':        'status',

  // physical
  'qty':                   'qty',
  'quantity':              'qty',
  'object qty':            'qty',
  'count':                 'qty',
  'no. of pieces':         'qty',
  'pieces':                'qty',
  'dimensions':            'dimensions',
  'object dimensions (cm)': 'dimensions',
  'size':                  'dimensions',
  'measurement':           'dimensions',
  'measurements':          'dimensions',
  'package description':   'packageDescription',
  'package details':       'packageDescription',

  // location — 'storage location' maps to location field (not storageWarehouse)
  'storage location':      'location',
  'location':              'location',
  'storage warehouse':     'storageWarehouse',
  'storage cupboard no':   'storageCupboard',
  'storage cupboard':      'storageCupboard',
  'vault':                 'storageWarehouse',
  'vault room':            'storageWarehouse',
  'warehouse':             'storageWarehouse',
  'room':                  'storageWarehouse',
  'storage room':          'storageWarehouse',
  'cabinet':               'storageCupboard',
  'cupboard':              'storageCupboard',
  'cabinet / drawer':      'storageCupboard',
  'shelf':                 'storageCupboard',

  // provenance
  'given by':                'givenBy',
  'given by (organisation)': 'givenBy',
  'donor':                   'givenBy',
  'donated by':              'givenBy',
  'owner':                   'givenBy',
  'original owner':          'givenBy',
  'source':                  'givenBy',
  'received from':           'givenBy',
  'contact details':         'contactDetails',
  'received on':             'receivedOn',
  'date received':           'receivedOn',
  'acquisition date':        'receivedOn',
  'entry date':              'receivedOn',
  'remarks':                 'remarks',
  'notes':                   'remarks',
  'provenance':              'remarks',
  'history':                 'remarks',
  'provenance notes':        'remarks',
  'comments':                'remarks',

  // digitalization
  'digitalization status':   'digitalizationStatus',
  'digitization status':     'digitalizationStatus',
  'digitalized':             'digitalizationStatus',
  'digitization':            'digitalizationStatus',
  'digitalization done by (sevak name)': 'digitalizationSewak',
  'digitalization sewak':    'digitalizationSewak',
  'digitization sewak':      'digitalizationSewak',
  'sewak':                   'digitalizationSewak',
  'digitalization - object condition images (folder link)': 'digitalizationFolderLink',
  'folder link':             'digitalizationFolderLink',
  'digital folder':          'digitalizationFolderLink',
  'digitalization folder':   'digitalizationFolderLink',
  'digital assets folder':   'digitalizationFolderLink',

  // conservation
  'c - basic condition':     'conditionCategory',
  'condition':               'conditionCategory',
  'condition category':      'conditionCategory',
  'condition cat':           'conditionCategory',
  'conservation status':     'conservationStatus',
  'conservation deadline':   'conservationDeadline',
  'c - inspection frequency': 'inspectionFrequency',
  'inspection frequency':    'inspectionFrequency',
  'inspection freq':         'inspectionFrequency',
  'c - treatment category':  'treatmentCategory',
  'treatment':               'treatmentCategory',
  'treatment category':      'treatmentCategory',
  'c - treatment decision authority': 'treatmentAuthority',
  'treatment authority':     'treatmentAuthority',
  'c - treatment details':   'treatmentDetails',
  'treatment details':       'treatmentDetails',
  'c - condition report link treatment details': 'conditionReportLink',
  'condition report':        'conditionReportLink',
  'condition report link':   'conditionReportLink',
  'c - sewak incharge':      'conservationSewak',
  'omkar sir guidance':      'omkarGuidance',
  'omkar guidance':          'omkarGuidance',
  'guidance':                'omkarGuidance',

  // preservation
  'p - preservation category': 'preservationCategory',
  'preservation category':     'preservationCategory',
  'p - storage solutions (storage type to be purchased)': 'preservationSolutions',
  'p - storage solutions':     'preservationSolutions',
  'preservation solutions':    'preservationSolutions',
  'preservation deadline':     'preservationDeadline',
  'preservation status':       'preservationStatus',
  'p - sewak incharge':        'preservationSewak',
  'preservation sewak':        'preservationSewak',

  // photo
  'photo':                 'photoUrl',
  'photo url':             'photoUrl',
  'image':                 'photoUrl',
  'image url':             'photoUrl',
  'photo link':            'photoUrl',
}

const STATUS_MAP = {
  'checked in':    'checked_in',  'checked_in':   'checked_in',  'checkedin': 'checked_in',
  'cataloged':     'cataloged',   'catalogued':   'cataloged',
  'conservation':  'conservation',
  'displayed':     'displayed',   'on display':   'displayed',   'display': 'displayed',
  'digitized':     'digitized',   'digitised':    'digitized',
  'on loan':       'on_loan',     'on_loan':      'on_loan',     'loaned': 'on_loan',
}

function normalise(raw, map, fallback) {
  if (!raw) return fallback
  const key = String(raw).toLowerCase().trim()
  return map[key] || fallback
}

function cleanHeader(h) {
  return String(h ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function toCamelCase(h) {
  return String(h ?? '').trim()
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

function excelDateToISO(value) {
  if (!value) return ''
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value)
    if (!d) return String(value)
    const mm = String(d.m).padStart(2, '0')
    const dd = String(d.d).padStart(2, '0')
    return `${d.y}-${mm}-${dd}`
  }
  return String(value).trim()
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args[0] === '--help') {
    console.log('Usage: node scripts/import-collections.mjs <file.xlsx> [--dry-run] [--sheet "SheetName"]')
    process.exit(0)
  }

  const filePath  = resolve(args[0])
  const isDryRun  = args.includes('--dry-run')
  const sheetIdx  = args.indexOf('--sheet')
  const sheetName = sheetIdx !== -1 ? args[sheetIdx + 1] : null

  console.log(`\n📂  File     : ${filePath}`)
  console.log(`🔍  Dry run  : ${isDryRun ? 'YES (no writes)' : 'NO (will insert)'}`)

  // Read workbook
  let wb
  try {
    wb = XLSX.readFile(filePath)
  } catch (e) {
    console.error('❌  Could not read file:', e.message)
    process.exit(1)
  }

  const targetSheet = sheetName || wb.SheetNames[0]
  if (!wb.Sheets[targetSheet]) {
    console.error(`❌  Sheet "${targetSheet}" not found. Available: ${wb.SheetNames.join(', ')}`)
    process.exit(1)
  }
  console.log(`📋  Sheet    : ${targetSheet}  (available: ${wb.SheetNames.join(', ')})`)

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[targetSheet], { defval: '' })
  if (!rows.length) {
    console.error('❌  Sheet is empty or has no data rows.')
    process.exit(1)
  }

  // Build column mapping from first row's keys — unmapped columns are skipped entirely
  const excelHeaders = Object.keys(rows[0])
  const mapping  = {}   // excelHeader → schemaField (known fields only)
  const skipped  = []   // columns not in HEADER_MAP (logged but not stored)

  for (const h of excelHeaders) {
    const field = HEADER_MAP[cleanHeader(h)]
    if (field) mapping[h] = field
    else skipped.push(h)
  }

  console.log('\n✅  Mapped columns:')
  Object.entries(mapping).forEach(([col, field]) => console.log(`     "${col}"  →  ${field}`))

  if (skipped.length) {
    console.log(`\n⏭️   Skipped columns (${skipped.length} — not stored):`)
    skipped.forEach(h => console.log(`     "${h}"`))
  }

  if (!Object.values(mapping).includes('title')) {
    console.log('\n⚠️   No "title" column found — all rows will get auto-assigned temp titles.')
  }

  // Transform rows — only mapped fields are stored
  const docs = rows.map((row, i) => {
    const doc = { createdAt: new Date(), updatedAt: new Date() }

    for (const [col, field] of Object.entries(mapping)) {
      let val = row[col]
      if (val === null || val === undefined || val === '') continue

      if (field === 'receivedOn' || field === 'conservationDeadline' || field === 'preservationDeadline') {
        val = excelDateToISO(val)
      } else if (field === 'status') {
        val = normalise(val, STATUS_MAP, 'checked_in')
      } else if (field === 'conditionCategory') {
        val = String(val).trim().toUpperCase()
        if (!['A', 'B', 'C', 'D'].includes(val)) val = 'D'
      } else {
        val = String(val).trim()
      }

      doc[field] = val
    }

    // Defaults for required fields
    if (!doc.title) {
      doc.title = `Untitled Item ${i + 1}`
      console.warn(`⚠️   Row ${i + 2} has no title — assigned "${doc.title}"`)
    }
    if (!doc.status) doc.status = 'checked_in'

    return doc
  })

  console.log(`\n📊  Rows in sheet : ${rows.length}`)
  console.log(`📊  Valid docs     : ${docs.length}`)

  if (isDryRun) {
    console.log('\n🔎  Dry-run preview (first 3 docs):')
    docs.slice(0, 3).forEach((d, i) => console.log(`\n  Doc ${i + 1}:`, JSON.stringify(d, null, 2)))
    console.log('\n✅  Dry run complete. Re-run without --dry-run to insert.')
    process.exit(0)
  }

  // Connect and insert
  const uri = process.env.MONGODB_URI
  if (!uri) { console.error('❌  MONGODB_URI not set in .env.local'); process.exit(1) }

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db  = client.db(process.env.MONGODB_DB || 'bapaji_archive')
    const col = db.collection('physical_collections')

    const result = await col.insertMany(docs, { ordered: false })
    console.log(`\n✅  Inserted ${result.insertedCount} / ${docs.length} documents into physical_collections.`)
  } catch (e) {
    if (e.code === 11000) {
      console.warn('⚠️   Some duplicates skipped (unique key conflict).')
      console.log(`    Inserted: ${e.result?.insertedCount ?? '?'}`)
    } else {
      console.error('❌  Insert error:', e.message)
    }
  } finally {
    await client.close()
  }
}

main()
