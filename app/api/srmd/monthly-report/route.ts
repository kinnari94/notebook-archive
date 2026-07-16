import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'
import { canEditCollections } from '@/lib/require-edit'

const NOTES_COL = 'srmd_monthly_report_notes'

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Mirrors "11_Monthly_Report_Print" exactly. Most rows are current-state snapshots
// (same value regardless of which month is selected) — only "Records entered this
// month" (Inventory!Entry_Date contains the month) and "Done this month" (Treatment
// Recommendations!Month_Key = month) actually filter by the Report Month input.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

  const db    = await getDb()
  const inv   = db.collection(COLLECTIONS.srmd_inventory_master)
  const cond  = db.collection(COLLECTIONS.srmd_condition_assess)
  const risk  = db.collection(COLLECTIONS.srmd_risk_priority)
  const treat = db.collection(COLLECTIONS.srmd_treatment_recommendations)
  const photo = db.collection(COLLECTIONS.srmd_photo_log)
  const env   = db.collection(COLLECTIONS.srmd_environment_summary)

  const monthRe = new RegExp(escapeRegExp(month))

  const [
    totalRecords, recordsEnteredThisMonth, tx, pa, ph, ob,
    critical, poor, fair, stable, immediateNeeded, quarantineFlagged,
    aImmediate, bHigh, cModerate, dMonitor,
    proposed, approved, inProgress, doneThisMonth,
    photosLogged, missingConditionAgg, missingLocation, environmentalAlerts,
    noteDoc,
  ] = await Promise.all([
    // 1. Coverage Summary
    inv.countDocuments({ Object_ID: { $exists: true, $ne: '' } }),
    inv.countDocuments({ Entry_Date: { $regex: monthRe } }),
    inv.countDocuments({ Collection_Type: 'TX' }),
    inv.countDocuments({ Collection_Type: 'PA' }),
    inv.countDocuments({ Collection_Type: 'PH' }),
    inv.countDocuments({ Collection_Type: 'OB' }),
    // 2. Condition Summary
    cond.countDocuments({ Overall_Condition: 'Critical' }),
    cond.countDocuments({ Overall_Condition: 'Poor' }),
    cond.countDocuments({ Overall_Condition: 'Fair' }),
    cond.countDocuments({ Overall_Condition: 'Stable' }),
    cond.countDocuments({ Immediate_Stabilization_Needed: 'Yes' }),
    cond.countDocuments({ Quarantine_Flag: 'Yes' }),
    // 3. Priority Summary
    risk.countDocuments({ Priority_Band: 'A – Immediate' }),
    risk.countDocuments({ Priority_Band: 'B – High' }),
    risk.countDocuments({ Priority_Band: 'C – Moderate' }),
    risk.countDocuments({ Priority_Band: 'D – Monitor' }),
    // 4. Treatment Activity
    treat.countDocuments({ Approval_Status: 'Proposed' }),
    treat.countDocuments({ Approval_Status: 'Approved' }),
    treat.countDocuments({ Approval_Status: 'In progress' }),
    treat.countDocuments({ Approval_Status: 'Done', Month_Key: month }),
    // 5. Documentation QA
    photo.countDocuments({ Photo_ID: { $exists: true, $ne: '' } }),
    inv.aggregate([
      { $lookup: { from: COLLECTIONS.srmd_condition_assess, localField: 'Object_ID', foreignField: 'Object_ID', as: 'c' } },
      { $match: { c: { $size: 0 } } },
      { $count: 'n' },
    ]).toArray(),
    inv.countDocuments({ $or: [{ Current_Location_ID: { $exists: false } }, { Current_Location_ID: '' }] }),
    env.countDocuments({ Alert_Flag: 'Action' }),
    db.collection(NOTES_COL).findOne({ month }),
  ])

  return NextResponse.json({
    month,
    sections: [
      {
        title: '1. Coverage Summary',
        rows: [
          { label: 'Total records in workbook', count: totalRecords },
          { label: 'Records entered this month', count: recordsEnteredThisMonth },
          { label: 'Total textiles', count: tx },
          { label: 'Total paper', count: pa },
          { label: 'Total photographs', count: ph },
          { label: 'Total objects', count: ob },
        ],
      },
      {
        title: '2. Condition Summary',
        rows: [
          { label: 'Critical items', count: critical },
          { label: 'Poor condition', count: poor },
          { label: 'Fair condition', count: fair },
          { label: 'Stable', count: stable },
          { label: 'Immediate stabilisation needed', count: immediateNeeded },
          { label: 'Quarantine flagged', count: quarantineFlagged },
        ],
      },
      {
        title: '3. Priority Summary',
        rows: [
          { label: 'A – Immediate', count: aImmediate },
          { label: 'B – High', count: bHigh },
          { label: 'C – Moderate', count: cModerate },
          { label: 'D – Monitor', count: dMonitor },
        ],
      },
      {
        title: '4. Treatment Activity',
        rows: [
          { label: 'Proposed', count: proposed },
          { label: 'Approved', count: approved },
          { label: 'In progress', count: inProgress },
          { label: 'Done this month', count: doneThisMonth },
        ],
      },
      {
        title: '5. Documentation QA',
        rows: [
          { label: 'Photos logged', count: photosLogged },
          { label: 'Records missing condition assessment', count: missingConditionAgg[0]?.n || 0 },
          { label: 'Records missing location', count: missingLocation },
          { label: 'Environmental alerts (Action)', count: environmentalAlerts },
        ],
      },
    ],
    notes: (noteDoc?.notes as string) || '',
  })
}

export async function PATCH(req: NextRequest) {
  if (!(await canEditCollections())) return NextResponse.json({ error: 'Access Denied' }, { status: 403 })
  const body = await req.json()
  const { month, notes } = body as { month?: string; notes?: string }
  if (!month) return NextResponse.json({ ok: false, error: 'month is required' }, { status: 400 })

  const db = await getDb()
  await db.collection(NOTES_COL).updateOne(
    { month },
    { $set: { month, notes: notes ?? '', updated_at: new Date() } },
    { upsert: true }
  )
  return NextResponse.json({ ok: true })
}
