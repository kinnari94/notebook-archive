import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'
import { canEditCollections } from '@/lib/require-edit'

const NOTES_COL = 'srmd_monthly_report_notes'

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Mirrors "11_Monthly_Report_Print", extended so every section scopes to the
// selected Report Month, not just Coverage Summary's "entered this month" row.
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
  const [y, m] = month.split('-').map(Number)
  const monthStart = new Date(Date.UTC(y, m - 1, 1))
  const monthEnd   = new Date(Date.UTC(y, m, 1))

  // 'date' fields hold a mix of plain "yyyy-mm-dd..." strings (entered through the
  // form) and native BSON Date values (rows imported from the workbook with
  // cellDates:true) — $regex only ever matches the string-typed ones, so a
  // date-range clause is OR'd in to catch the rest.
  function monthMatch(field: string) {
    return { $or: [
      { [field]: { $regex: monthRe } },
      { [field]: { $type: 'date', $gte: monthStart, $lt: monthEnd } },
    ] }
  }

  const [
    totalRecords, recordsEnteredThisMonth, tx, pa, ph, ob,
    critical, poor, fair, stable, immediateNeeded, quarantineFlagged,
    aImmediate, bHigh, cModerate, dMonitor,
    proposed, approved, inProgress, doneThisMonth,
    photosLogged, missingConditionAgg, missingLocation, environmentalAlerts,
    noteDoc,
  ] = await Promise.all([
    // 1. Coverage Summary — mirrors the workbook's own formulas exactly: totals
    // and the collection-type breakdown are all-time COUNTA/COUNTIF (no month
    // condition); only "Records entered this month" filters on Entry_Date.
    inv.countDocuments({ Object_ID: { $exists: true, $ne: '' } }),
    inv.countDocuments(monthMatch('Entry_Date')),
    inv.countDocuments({ Collection_Type: 'TX' }),
    inv.countDocuments({ Collection_Type: 'PA' }),
    inv.countDocuments({ Collection_Type: 'PH' }),
    inv.countDocuments({ Collection_Type: 'OB' }),
    // 2. Condition Summary — scoped to assessments recorded in the selected month
    cond.countDocuments({ Overall_Condition: 'Critical', ...monthMatch('Assessment_Date') }),
    cond.countDocuments({ Overall_Condition: 'Poor', ...monthMatch('Assessment_Date') }),
    cond.countDocuments({ Overall_Condition: 'Fair', ...monthMatch('Assessment_Date') }),
    cond.countDocuments({ Overall_Condition: 'Stable', ...monthMatch('Assessment_Date') }),
    cond.countDocuments({ Immediate_Stabilization_Needed: 'Yes', ...monthMatch('Assessment_Date') }),
    cond.countDocuments({ Quarantine_Flag: 'Yes', ...monthMatch('Assessment_Date') }),
    // 3. Priority Summary — scoped to risk assessments recorded in the selected month
    risk.countDocuments({ Priority_Band: 'A – Immediate', ...monthMatch('Assessment_Date') }),
    risk.countDocuments({ Priority_Band: 'B – High', ...monthMatch('Assessment_Date') }),
    risk.countDocuments({ Priority_Band: 'C – Moderate', ...monthMatch('Assessment_Date') }),
    risk.countDocuments({ Priority_Band: 'D – Monitor', ...monthMatch('Assessment_Date') }),
    // 4. Treatment Activity — scoped to recommendations raised in the selected month
    treat.countDocuments({ Approval_Status: 'Proposed', ...monthMatch('Recommendation_Date') }),
    treat.countDocuments({ Approval_Status: 'Approved', ...monthMatch('Recommendation_Date') }),
    treat.countDocuments({ Approval_Status: 'In progress', ...monthMatch('Recommendation_Date') }),
    treat.countDocuments({ Approval_Status: 'Done', ...monthMatch('Recommendation_Date') }),
    // 5. Documentation QA — scoped to records/photos/alerts from the selected month
    photo.countDocuments(monthMatch('Photo_Date')),
    inv.aggregate([
      { $match: monthMatch('Entry_Date') },
      { $lookup: { from: COLLECTIONS.srmd_condition_assess, localField: 'Object_ID', foreignField: 'Object_ID', as: 'c' } },
      { $match: { c: { $size: 0 } } },
      { $count: 'n' },
    ]).toArray(),
    inv.countDocuments({ $and: [
      monthMatch('Entry_Date'),
      { $or: [{ Current_Location_ID: { $exists: false } }, { Current_Location_ID: '' }] },
    ] }),
    env.countDocuments({ Alert_Flag: 'Action', ...monthMatch('Summary_Period_Start') }),
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
