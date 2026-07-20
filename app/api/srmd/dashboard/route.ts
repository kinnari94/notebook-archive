import { NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'
import { SRMD_SHEETS } from '@/lib/srmd-sheets'

// Live aggregates over the srmd_* collections — mirrors the layout of 10_Dashboard
// in the original workbook (stat strip, 4 breakdown panels, data quality checks,
// environmental alerts), computed on read instead of stored (that sheet has no
// cached rows of its own to import, and this way the numbers stay current as
// records are added/edited through the sub-views rather than frozen at import time).

const COLLECTION_TYPES = [
  { code: 'TX', label: 'Textile' },
  { code: 'PA', label: 'Paper' },
  { code: 'PB', label: 'Paper Bound' },
  { code: 'OB', label: 'Object' },
]
const PRIORITY_BANDS = ['A – Immediate', 'B – High', 'C – Moderate', 'D – Monitor']
const CONDITIONS = ['Critical', 'Poor', 'Fair', 'Good', 'Stable']
const TREATMENT_STATUSES = ['Proposed', 'Approved', 'In progress', 'Done', 'Deferred']

function fillOrder(agg: { _id: string; count: number }[], order: string[]) {
  const map = new Map(agg.map(r => [r._id, r.count]))
  return order.map(label => ({ label, count: map.get(label) || 0 }))
}

export async function GET() {
  const db = await getDb()
  const inv   = db.collection(COLLECTIONS.srmd_inventory_master)
  const cond  = db.collection(COLLECTIONS.srmd_condition_assess)
  const risk  = db.collection(COLLECTIONS.srmd_risk_priority)
  const photo = db.collection(COLLECTIONS.srmd_photo_log)
  const env   = db.collection(COLLECTIONS.srmd_environment_summary)
  const treat = db.collection(COLLECTIONS.srmd_treatment_recommendations)

  const [
    totalRecords, photosLogged,
    conditionAgg, priorityAgg, collectionTypeAgg, treatmentStatusAgg,
    conditionsDoneCount, criticalObjects, completeCount, envAlertsCount, immediateActions, treatmentsPending,
    missingObjectName, missingLocation,
    objectsWithoutConditionAgg, photosMissingObjectId,
    environmentalAlertRows,
    sheetCounts,
  ] = await Promise.all([
    // Total Records         =COUNTA('02_Inventory_Master'!$A$3:$A$93)
    inv.countDocuments({ Object_ID: { $exists: true, $ne: '' } }),
    // Photos Logged         =COUNTA('06_Photo_Log'!$A$3:$A$97) — counts the Photo_ID column,
    // not just any row; the workbook's Photo_ID column is frequently left blank.
    photo.countDocuments({ Photo_ID: { $exists: true, $ne: '' } }),
    cond.aggregate([{ $group: { _id: '$Overall_Condition', count: { $sum: 1 } } }]).toArray() as Promise<{ _id: string; count: number }[]>,
    risk.aggregate([{ $group: { _id: '$Priority_Band', count: { $sum: 1 } } }]).toArray() as Promise<{ _id: string; count: number }[]>,
    inv.aggregate([{ $group: { _id: '$Collection_Type', count: { $sum: 1 } } }]).toArray() as Promise<{ _id: string; count: number }[]>,
    treat.aggregate([{ $group: { _id: '$Approval_Status', count: { $sum: 1 } } }]).toArray() as Promise<{ _id: string; count: number }[]>,
    // % Conditions Done     =COUNTIF('02_Inventory_Master'!$W$3:$W$93,"Condition Done")/COUNTA(...)
    inv.countDocuments({ Survey_Status: 'Condition Done' }),
    // Critical Objects      =COUNTIF('03_Condition_Assess'!$P$3:$P$97,"Critical")
    cond.countDocuments({ Overall_Condition: 'Critical' }),
    // % Complete            =COUNTIF('02_Inventory_Master'!$W$3:$W$93,"Complete")/COUNTA(...)
    inv.countDocuments({ Survey_Status: 'Complete' }),
    // Env Alerts            =COUNTIF('07_Environment_Summary'!$Q$3:$Q$52,"Action")
    env.countDocuments({ Alert_Flag: 'Action' }),
    // Immediate Actions     =COUNTIFS('08_Treatment_Recommendations'!$F$3:$F$102,"Immediate",$J$3:$J$102,"<>Done")
    treat.countDocuments({ Action_Level: 'Immediate', Approval_Status: { $ne: 'Done' } }),
    // Treatments Pending    =COUNTIF('08_Treatment_Recommendations'!$J$3:$J$102,"Proposed")
    treat.countDocuments({ Approval_Status: 'Proposed' }),
    inv.countDocuments({ $or: [{ Object_Name: { $exists: false } }, { Object_Name: '' }] }),
    inv.countDocuments({ $or: [{ Current_Location_ID: { $exists: false } }, { Current_Location_ID: '' }] }),
    // Objects without any condition record
    //   =SUMPRODUCT((COUNTIF(Condition!$B$3:$B$97, Inventory!$A$3:$A$93)=0)*1)
    // — inventory objects whose Object_ID never appears in Condition_Assess's Object_ID column.
    inv.aggregate([
      { $lookup: { from: COLLECTIONS.srmd_condition_assess, localField: 'Object_ID', foreignField: 'Object_ID', as: 'c' } },
      { $match: { c: { $size: 0 } } },
      { $count: 'n' },
    ]).toArray(),
    // Photos without Object_ID match  =COUNTIF('06_Photo_Log'!$B$3:$B$97,"")
    // — blank Object_ID cells in Photo_Log itself, not a cross-sheet lookup.
    photo.countDocuments({ $or: [{ Object_ID: { $exists: false } }, { Object_ID: '' }] }),
    // Environmental Alerts — the workbook uses INDEX/MATCH("Action", Alert_Flag, 0), which
    // returns only the first matching row, not a filtered list of every alert.
    env.findOne({ Alert_Flag: 'Action' }, {
      projection: { _id: 0, Location_ID: 1, Summary_Period_Start: 1, Threshold_Profile: 1, RH_Max: 1, Alert_Flag: 1 },
    }),
    Promise.all(SRMD_SHEETS.map(async s => ({
      slug: s.slug, label: s.label, sheetTab: s.sheetTab,
      count: await db.collection(s.collection).countDocuments(),
    }))),
  ])

  const collectionTypeBreakdown = COLLECTION_TYPES.map(t => ({
    label: t.label,
    count: collectionTypeAgg.find(r => r._id === t.code)?.count || 0,
  }))
  const priorityBandBreakdown  = fillOrder(priorityAgg, PRIORITY_BANDS)
  const conditionBreakdown     = fillOrder(conditionAgg, CONDITIONS)
  const treatmentStatusBreakdown = fillOrder(treatmentStatusAgg, TREATMENT_STATUSES)

  const pct = (n: number) => totalRecords ? Math.round((n / totalRecords) * 100) : 0

  return NextResponse.json({
    stats: {
      totalRecords,
      pctConditionsDone: pct(conditionsDoneCount),
      pctComplete: pct(completeCount),
      immediateActions,
      criticalObjects,
      envAlerts: envAlertsCount,
      photosLogged,
      treatmentsPending,
    },
    collectionTypeBreakdown,
    priorityBandBreakdown,
    conditionBreakdown,
    treatmentStatusBreakdown,
    dataQualityChecks: [
      { label: 'Records missing Object_Name',        count: missingObjectName,                       status: missingObjectName === 0 ? 'ok' : 'review' },
      { label: 'Records missing Location',            count: missingLocation,                         status: missingLocation === 0 ? 'ok' : 'review' },
      { label: 'Objects without any condition record', count: objectsWithoutConditionAgg[0]?.n || 0,   status: (objectsWithoutConditionAgg[0]?.n || 0) === 0 ? 'ok' : 'review' },
      { label: 'Photos without Object_ID match',       count: photosMissingObjectId,                   status: photosMissingObjectId === 0 ? 'ok' : 'review' },
      { label: 'Treatments Immediate & not Done',      count: immediateActions,                        status: immediateActions === 0 ? 'ok' : 'review' },
    ],
    environmentalAlerts: environmentalAlertRows ? [environmentalAlertRows] : [],
    sheets: sheetCounts,
  })
}
