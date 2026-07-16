import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

function strip(doc: Record<string, unknown> | null) {
  if (!doc) return null
  return { ...doc, _id: String(doc._id) }
}

// Mirrors "12_Treatment_Sheet_Print": select a Treatment_ID, look up its row in
// Treatment Recommendations, then join to Inventory Master and Condition Assess
// via that treatment's Object_ID — same chain as the workbook's INDEX/MATCH formulas.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ treatmentId: string }> }) {
  const { treatmentId } = await params
  const tid = decodeURIComponent(treatmentId)

  const db    = await getDb()
  const treat = db.collection(COLLECTIONS.srmd_treatment_recommendations)
  const inv   = db.collection(COLLECTIONS.srmd_inventory_master)
  const cond  = db.collection(COLLECTIONS.srmd_condition_assess)

  const treatment = await treat.findOne({ Treatment_ID: tid })
  if (!treatment) return NextResponse.json({ error: `Treatment "${tid}" not found` }, { status: 404 })

  const objectId = treatment.Object_ID as string | undefined
  const [inventory, condition] = await Promise.all([
    objectId ? inv.findOne({ Object_ID: objectId }) : Promise.resolve(null),
    objectId ? cond.findOne({ Object_ID: objectId }) : Promise.resolve(null),
  ])

  return NextResponse.json({
    treatment: strip(treatment),
    inventory: strip(inventory),
    condition: strip(condition),
  })
}
