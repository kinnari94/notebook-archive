import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { COLLECTIONS } from '@/lib/db'

function strip(doc: Record<string, unknown> | null) {
  if (!doc) return null
  return { ...doc, _id: String(doc._id) }
}

// Joined bundle for one Object_ID across every sheet that references it —
// used by the print/report views and for cross-linking between sheet views.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ objectId: string }> }) {
  const { objectId } = await params
  const db = await getDb()
  const oid = decodeURIComponent(objectId)

  const [inventory, conditions, risks, photos, treatments] = await Promise.all([
    db.collection(COLLECTIONS.srmd_inventory_master).findOne({ Object_ID: oid }),
    db.collection(COLLECTIONS.srmd_condition_assess).find({ Object_ID: oid }).sort({ Assessment_Date: -1 }).toArray(),
    db.collection(COLLECTIONS.srmd_risk_priority).find({ Object_ID: oid }).sort({ Priority_Score: -1 }).toArray(),
    db.collection(COLLECTIONS.srmd_photo_log).find({ Object_ID: oid }).sort({ Photo_Date: -1 }).toArray(),
    db.collection(COLLECTIONS.srmd_treatment_recommendations).find({ Object_ID: oid }).sort({ Recommendation_Date: -1 }).toArray(),
  ])

  if (!inventory) return NextResponse.json({ error: `Object "${oid}" not found` }, { status: 404 })

  return NextResponse.json({
    inventory: strip(inventory),
    conditions: conditions.map(d => strip(d)),
    risks: risks.map(d => strip(d)),
    photos: photos.map(d => strip(d)),
    treatments: treatments.map(d => strip(d)),
  })
}
