/**
 * Re-import the "Object Dimensions (cm)" column from collections.xlsx
 * and overwrite the dimensions field in every matching MongoDB document.
 *
 * Matches by accessionCode (case-insensitive, trimmed).
 *
 * Usage:
 *   node scripts/fix-dimensions.mjs                  (live run)
 *   node scripts/fix-dimensions.mjs --dry-run        (preview only)
 */

import { readFileSync } from 'fs'
import { MongoClient } from 'mongodb'
import XLSX from 'xlsx'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const DIM_COL = 'Object Dimensions\n(cm)'
const ACC_COL = 'Accession Code'
const XLSX_PATH = join(__dirname, '..', 'collections.xlsx')

const isDryRun = process.argv.includes('--dry-run')

function cleanDim(v) {
  if (v == null || v === '') return ''
  return String(v).trim().replace(/\s*\n\s*/g, ' ')
}

async function main() {
  const wb = XLSX.readFile(XLSX_PATH)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })

  // Build map: accessionCode (lower) → cleaned dimension string
  const excelMap = new Map()
  for (const row of rows) {
    const acc = String(row[ACC_COL] ?? '').trim()
    const dim = cleanDim(row[DIM_COL])
    if (acc && dim) excelMap.set(acc.toLowerCase(), dim)
  }
  console.log(`\n📊  Excel rows with acc + dimension : ${excelMap.size}`)
  console.log(`🔍  Dry run : ${isDryRun ? 'YES (no writes)' : 'NO (will update)'}`)

  const uri = process.env.MONGODB_URI
  if (!uri) { console.error('❌  MONGODB_URI not set'); process.exit(1) }
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const col = client.db(process.env.MONGODB_DB || 'bapaji_archive').collection('physical_collections')

    const docs = await col.find({ accessionCode: { $exists: true } }).toArray()
    console.log(`📋  MongoDB documents with accessionCode : ${docs.length}`)

    let updated = 0, skipped = 0, noMatch = 0

    for (const doc of docs) {
      const acc = String(doc.accessionCode ?? '').trim().toLowerCase()
      const newDim = excelMap.get(acc)

      if (!newDim) { noMatch++; continue }

      const oldDim = String(doc.dimensions ?? '').trim()
      if (oldDim === newDim) { skipped++; continue }

      if (!isDryRun) {
        await col.updateOne(
          { _id: doc._id },
          { $set: { dimensions: newDim, updatedAt: new Date() } }
        )
      } else {
        console.log(`  ${doc.accessionCode}  |  "${oldDim}"  →  "${newDim}"`)
      }
      updated++
    }

    console.log(`\n✅  Updated   : ${updated}`)
    console.log(`⏭️   Unchanged : ${skipped}`)
    console.log(`❓  No match  : ${noMatch}`)
    if (isDryRun) console.log('\n⚠️   Dry run — no writes made. Re-run without --dry-run to apply.')
    else console.log('\n✅  Done.')
  } finally {
    await client.close()
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
