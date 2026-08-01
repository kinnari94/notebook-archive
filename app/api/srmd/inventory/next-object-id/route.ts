import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const LOT_PATTERN = /^(\d{4})\.(\d+)-/

// Suggests the next Object_ID for a new Inventory Master entry.
//
// Textile/Paper Bound (Collection_Type TX/PB): Legacy_Type_ShortForm_0001, e.g.
// PPG_TX_SH_0001 (underscore-joined, matching Parent_ID's own format). The base
// number for a given Legacy+Type+ShortForm combo never changes once set — every
// later entry with that same combo becomes a decimal sub-item of it instead
// (0001.1, 0001.2, ...), mirroring the workbook's own multi-part-accession pattern
// (e.g. PKD 40.1/40.2, ARD0463.1-.6).
//
// Everything else: the workbook's NNNN.N-TITLE lot/sub-item scheme keyed off
// Object_Name — if this name already has entries, the next sub-item of that same
// lot; if it's a new name, a fresh lot.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const collectionType = (searchParams.get('collectionType') || '').trim().toUpperCase()
  const legacy = (searchParams.get('legacy') || '').trim().toUpperCase()
  const shortForm = (searchParams.get('shortForm') || '').trim().toUpperCase()
  const objectName = (searchParams.get('objectName') || '').trim()

  const db = await getDb()
  const col = db.collection(COLLECTIONS.srmd_inventory_master)

  if (collectionType === 'TX' || collectionType === 'PB') {
    if (!legacy || !shortForm) return NextResponse.json({ objectId: null })

    const prefix = `${legacy}_${collectionType}_${shortForm}`
    const base = `${prefix}_0001`
    const pattern = new RegExp(`^${escapeRegex(prefix)}_0001(?:\\.(\\d+))?$`, 'i')

    const docs = await col.find({ Object_ID: { $regex: pattern } }, { projection: { Object_ID: 1 } }).toArray()
    if (docs.length === 0) return NextResponse.json({ objectId: base })

    let maxSub = 0
    for (const doc of docs) {
      const m = String(doc.Object_ID).match(pattern)
      if (m && m[1]) maxSub = Math.max(maxSub, parseInt(m[1], 10))
    }
    return NextResponse.json({ objectId: `${base}.${maxSub + 1}` })
  }

  if (!objectName) return NextResponse.json({ objectId: null })

  const sameName = await col.find(
    { Object_Name: { $regex: `^${escapeRegex(objectName)}$`, $options: 'i' } },
    { projection: { Object_ID: 1 } }
  ).toArray()

  let bestLot = 0
  let bestSub = 0
  for (const doc of sameName) {
    const m = String(doc.Object_ID).match(LOT_PATTERN)
    if (!m) continue
    const lot = parseInt(m[1], 10)
    const sub = parseInt(m[2], 10)
    if (lot > bestLot || (lot === bestLot && sub > bestSub)) { bestLot = lot; bestSub = sub }
  }

  if (bestLot > 0) {
    return NextResponse.json({ objectId: `${String(bestLot).padStart(4, '0')}.${bestSub + 1}-${objectName.toUpperCase()}` })
  }

  const allDocs = await col.find({ Object_ID: { $regex: LOT_PATTERN } }, { projection: { Object_ID: 1 } }).toArray()
  let maxLot = 0
  for (const doc of allDocs) {
    const m = String(doc.Object_ID).match(LOT_PATTERN)
    if (m) maxLot = Math.max(maxLot, parseInt(m[1], 10))
  }
  return NextResponse.json({ objectId: `${String(maxLot + 1).padStart(4, '0')}.1-${objectName.toUpperCase()}` })
}
