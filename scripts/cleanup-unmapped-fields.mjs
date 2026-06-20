/**
 * Migrate camelCase variants → canonical field names, then remove all
 * remaining unmapped fields from physical_collections.
 *
 * Usage:
 *   node scripts/cleanup-unmapped-fields.mjs            (live run)
 *   node scripts/cleanup-unmapped-fields.mjs --dry-run  (preview only)
 */

import { MongoClient } from 'mongodb'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

// Fields that belong in the schema — anything else gets removed
const KNOWN_FIELDS = new Set([
  '_id', 'id', 'material', 'accessionCode', 'newaccessionCode', 'legacy',
  'title', 'description', 'status',
  'qty', 'dimensions', 'packageDescription', 'location', 'conditionCategory',
  'storageWarehouse', 'storageCupboard', 'receivedOn', 'givenBy', 'contactDetails', 'remarks',
  'photoUrl',
  'digitalizationStatus', 'digitalizationSewak', 'digitalizationFolderLink',
  'conditionReportLink', 'treatmentDetails', 'treatmentAuthority', 'treatmentCategory',
  'conservationStatus', 'conservationDeadline', 'conservationSewak',
  'preservationCategory', 'preservationSolutions', 'preservationDeadline',
  'preservationStatus', 'preservationSewak',
  'omkarGuidance', 'inspectionFrequency',
  'createdAt', 'updatedAt',
])

// Migrate old camelCase variants → canonical field names.
// Only applied when the canonical field is empty / missing in the document.
const MIGRATE = {
  objectBasicDescription:                    'description',
  objectDimensionscm:                        'dimensions',
  packagingDimensionscm:                     'dimensions',
  objectQty:                                 'qty',
  givenByOrganisation:                       'givenBy',
  digitalizationDoneBySevakName:             'digitalizationSewak',
  digitalizationObjectConditionImagesfolderLink: 'digitalizationFolderLink',
  omkarSirGuidance:                          'omkarGuidance',
  storageCupboardNo:                         'storageCupboard',
  pPreservationCategory:                     'preservationCategory',
  pSewakIncharge:                            'preservationSewak',
  pStorageSolutionsstorageTypeToBePurchased: 'preservationSolutions',
  cBasicCondition:                           'conditionCategory',
  cInspectionFrequency:                      'inspectionFrequency',
  cTreatmentCategory:                        'treatmentCategory',
  cTreatmentDecisionAuthority:               'treatmentAuthority',
  cTreatmentDetails:                         'treatmentDetails',
  cConditionReportLinktreatmentDetails:      'conditionReportLink',
  cSewakIncharge:                            'conservationSewak',
  packageDetails:                            'packageDescription',
}

const BLANK = new Set(['', 'na', 'n/a', 'not recorded', 'none', 'nil'])
const isEmpty = v => v == null || BLANK.has(String(v).trim().toLowerCase())

const isDryRun = process.argv.includes('--dry-run')

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) { console.error('❌  MONGODB_URI not set in .env.local'); process.exit(1) }

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db  = client.db(process.env.MONGODB_DB || 'bapaji_archive')
    const col = db.collection('physical_collections')

    const allDocs = await col.find({}).toArray()
    console.log(`\n📊  Total documents : ${allDocs.length}`)
    console.log(`🔍  Dry run         : ${isDryRun ? 'YES (no writes)' : 'NO (will update)'}`)

    let migratedCount = 0
    let cleanedCount = 0
    const migratedFields = new Set()
    const deletedFields  = new Set()

    for (const doc of allDocs) {
      const $set   = {}
      const $unset = {}

      // 1. Migrate camelCase variants to canonical names (only if canonical is empty)
      for (const [oldKey, newKey] of Object.entries(MIGRATE)) {
        if (!(oldKey in doc)) continue
        const oldVal = doc[oldKey]
        if (isEmpty(oldVal)) { $unset[oldKey] = ''; continue }  // old value is blank → just delete
        if (!isEmpty(doc[newKey])) { $unset[oldKey] = ''; continue }  // canonical already has data → drop old
        $set[newKey] = oldVal
        $unset[oldKey] = ''
        migratedFields.add(`${oldKey} → ${newKey}`)
      }

      // 2. Remove any remaining unknown field (numeric keys, unrecognised columns, etc.)
      for (const key of Object.keys(doc)) {
        if (!key) continue  // skip empty-string field names — MongoDB can't unset them
        if (!KNOWN_FIELDS.has(key) && !(key in $set)) {
          $unset[key] = ''
          deletedFields.add(key)
        }
      }

      const hasSet   = Object.keys($set).length > 0
      const hasUnset = Object.keys($unset).length > 0
      if (!hasSet && !hasUnset) continue

      if (hasSet)   migratedCount++
      if (hasUnset) cleanedCount++

      if (!isDryRun) {
        const update = {}
        if (hasSet)   update.$set   = { ...$set, updatedAt: new Date() }
        if (hasUnset) update.$unset = $unset
        await col.updateOne({ _id: doc._id }, update)
      }
    }

    if (migratedFields.size) {
      console.log(`\n✅  Migrated field names (${migratedFields.size}):`)
      ;[...migratedFields].sort().forEach(f => console.log(`     ${f}`))
      console.log(`   Documents with migrations: ${migratedCount}`)
    }

    if (deletedFields.size) {
      console.log(`\n🗑️   Deleted field names (${deletedFields.size}):`)
      ;[...deletedFields].sort().forEach(f => console.log(`     ${f}`))
      console.log(`   Documents cleaned: ${cleanedCount}`)
    }

    if (!migratedFields.size && !deletedFields.size) {
      console.log('\n✅  Nothing to do — all documents are already clean.')
    } else if (isDryRun) {
      console.log('\n⚠️   Dry run complete — no changes made. Re-run without --dry-run to apply.')
    } else {
      console.log('\n✅  Done.')
    }
  } finally {
    await client.close()
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
