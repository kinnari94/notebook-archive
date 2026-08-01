// Central registry of every dropdown's STATIC default options, keyed by a stable
// "option set key" (e.g. 'USERS', 'ACCESS_LEVEL'). Many fields across different
// sheets share the same key on purpose (e.g. Entered_By, Assessor, Photographer,
// Recommended_By, Assigned_To, and Change Log's User all share 'USERS') — adding a
// new team member anywhere updates it everywhere that key is used.
//
// This is the single source of truth for defaults, used by:
//   - lib/srmd-sheets.ts (field configs reference these arrays + their key)
//   - app/api/srmd/dropdown-options/route.ts (merges these with user-added custom
//     options stored in the srmd_custom_dropdown_options Mongo collection)

import {
  RECORD_LEVEL_OPTIONS, COLLECTION_TYPE_OPTIONS, ACCESS_LEVEL_OPTIONS, SURVEY_STATUS_OPTIONS,
  OVERALL_CONDITION_OPTIONS, RISK_TYPE_OPTIONS, PRIORITY_BAND_OPTIONS, YES_NO_OPTIONS,
  USER_OPTIONS, PHOTO_VIEW_OPTIONS, ALL_DAMAGE_TERMS, type Option,
} from '@/lib/srmdLists'
import { HANDOVER_STATUS_OPTIONS } from '@/lib/handover-checklist'

// Reference profile codes from the workbook's tblThresholds (01_Lists_Config) — small
// enough set that it isn't worth a shared export in lib/srmdLists.ts.
export const THRESHOLD_PROFILE_OPTIONS: Option[] = [
  { value: 'GENERAL',       label: 'General' },
  { value: 'PHOTO_GENERAL', label: 'Photo General' },
  { value: 'TEXTILE',       label: 'Textile' },
  { value: 'PAPER',         label: 'Paper' },
]

// Not in 01_Lists_Config as its own named table, but column E of 03_Condition_Assess
// has its own Excel data-validation dropdown with exactly these 3 values.
export const ASSESSMENT_TYPE_OPTIONS: Option[] = [
  { value: 'Baseline',           label: 'Baseline' },
  { value: 'Review',             label: 'Review' },
  { value: 'Post-Stabilization', label: 'Post-Stabilization' },
]

// Sub-classification under Record_Level_1 for paper-based series (e.g. Inventory
// Master's "SERIES" rows) — first seen in the 02_Inventory_Master re-import, no
// named lookup table for it in 01_Lists_Config, so kept user-extensible like the
// other combo fields below.
export const RECORD_LEVEL_2_OPTIONS: Option[] = [
  { value: 'HANDWRITTEN', label: 'Handwritten' },

  { value: 'PRINTED',     label: 'Printed' },
]

// None of these three have a named lookup table in 01_Lists_Config.
export const BACKGROUND_OPTIONS: Option[] = [
  { value: 'Black', label: 'Black' },
  { value: 'White', label: 'White' },
  { value: 'Grey',  label: 'Grey' },
  { value: 'Other', label: 'Other' },
]
export const SHOT_PURPOSE_OPTIONS: Option[] = [
  { value: 'Inventory', label: 'Inventory' },
  { value: 'Condition', label: 'Condition' },
  { value: 'Detail',    label: 'Detail' },
  { value: 'Markings',  label: 'Markings' },
  { value: 'Treatment', label: 'Treatment' },
]
export const PHOTO_RIGHTS_OPTIONS: Option[] = [
  { value: 'Internal',   label: 'Internal' },
  { value: 'Restricted', label: 'Restricted' },
  { value: 'Public',     label: 'Public' },
]

// Treatment Recommendations — no named lookup table in 01_Lists_Config for any of
// these, but Action_Type and Action_Level each have their own Excel data-validation
// dropdown on the sheet; Approval_Status matches the workbook's Dashboard "Treatment
// Status" panel exactly.
export const APPROVAL_STATUS_OPTIONS: Option[] = [
  { value: 'Proposed',    label: 'Proposed' },
  { value: 'Approved',    label: 'Approved' },
  { value: 'In progress', label: 'In progress' },
  { value: 'Done',        label: 'Done' },
  { value: 'Deferred',    label: 'Deferred' },
]
export const APPROVAL_STATUS_META: Record<string, { badge: string }> = {
  Proposed:      { badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  Approved:      { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'In progress': { badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  Done:          { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Deferred:      { badge: 'bg-gray-50 text-gray-600 border-gray-200' },
}
export const ACTION_LEVEL_OPTIONS: Option[] = [
  { value: 'Immediate',  label: 'Immediate' },
  { value: 'Near-term',  label: 'Near-term' },
  { value: 'Deferred',   label: 'Deferred' },
]
export const ACTION_LEVEL_META: Record<string, { badge: string }> = {
  Immediate:    { badge: 'bg-red-50 text-red-700 border-red-200' },
  'Near-term':  { badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  Deferred:     { badge: 'bg-gray-50 text-gray-600 border-gray-200' },
}
export const ACTION_TYPE_OPTIONS: Option[] = [
  { value: 'Stabilize',             label: 'Stabilize' },
  { value: 'Rehouse',               label: 'Rehouse' },
  { value: 'Surface clean',         label: 'Surface clean' },
  { value: 'Further study',         label: 'Further study' },
  { value: 'Cold storage',          label: 'Cold storage' },
  { value: 'Conservation treatment', label: 'Conservation treatment' },
]

// Change Log
export const CHANGE_LOG_ACTION_TYPE_OPTIONS: Option[] = [
  { value: 'create',      label: 'create' },
  { value: 'Edit',        label: 'Edit' },
  { value: 'Merge',       label: 'Merge' },
  { value: 'Split',       label: 'Split' },
  { value: 'Delete',      label: 'Delete' },
  { value: 'Batchupdate', label: 'Batchupdate' },
]
export const CHANGE_LOG_ACTION_TYPE_META: Record<string, { badge: string }> = {
  create:      { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Edit:        { badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  Merge:       { badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  Split:       { badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  Delete:      { badge: 'bg-red-50 text-red-700 border-red-200' },
  Batchupdate: { badge: 'bg-amber-50 text-amber-700 border-amber-200' },
}
// The workbook's own sheet tabs — which sheet a logged change was made in.
export const SHEET_NAME_OPTIONS: Option[] = [
  '00_Read_Me', '01_Lists_Config', '02_Inventory_Master', '03_Condition_Assess',
  '04_Risk_Priority', '05_Location_Storage', '06_Photo_Log', '07_Environment_Summary',
  '08_Treatment_Recommendations', '09_Change_Log',
].map(v => ({ value: v, label: v }))

export const DAMAGE_TERM_OPTIONS: Option[] = ALL_DAMAGE_TERMS.map(v => ({ value: v, label: v }))

// Source/donor collection code — the first segment of Inventory Master's
// GROUP-Type-Subtype-NNNN Object_ID scheme for Textile/Paper Bound items (e.g.
// "PPG" in PPG-TX-SH-0001). Seeded from the values seen in the wider Archival
// Dept database's own "Legacy" column; extensible like every other dropdown here.
export const LEGACY_OPTIONS: Option[] = [
  { value: 'PKD', label: 'PKD' },
  { value: 'PPG', label: 'PPG' },
  { value: 'SRMD', label: 'SRMD' },
  { value: 'Misc', label: 'Misc' },
  { value: 'History', label: 'History' },
  { value: 'Atmarpit', label: 'Atmarpit' },
]

// Category Code (the third segment of the same Object_ID scheme, e.g. "SH" for
// Shawl in PPG_TX_SH_0001) isn't a static/curated list — its options are queried
// live per Collection_Type from the codes already in use across Inventory Master
// (see app/api/srmd/inventory/category-codes/route.ts), since that's a more
// reliable source of truth than a hand-maintained list.

// The full registry — every optionSetKey any SrmdField (or other dropdown, e.g. the
// Handover Checklist's Status field) can reference.
export const STATIC_OPTION_SETS: Record<string, Option[]> = {
  RECORD_LEVEL: RECORD_LEVEL_OPTIONS,
  RECORD_LEVEL_2: RECORD_LEVEL_2_OPTIONS,
  COLLECTION_TYPE: COLLECTION_TYPE_OPTIONS,
  ACCESS_LEVEL: ACCESS_LEVEL_OPTIONS,
  SURVEY_STATUS: SURVEY_STATUS_OPTIONS,
  OVERALL_CONDITION: OVERALL_CONDITION_OPTIONS,
  RISK_TYPE: RISK_TYPE_OPTIONS,
  PRIORITY_BAND: PRIORITY_BAND_OPTIONS,
  PHOTO_VIEW: PHOTO_VIEW_OPTIONS,
  USERS: USER_OPTIONS,
  YES_NO: YES_NO_OPTIONS,
  ASSESSMENT_TYPE: ASSESSMENT_TYPE_OPTIONS,
  BACKGROUND: BACKGROUND_OPTIONS,
  SHOT_PURPOSE: SHOT_PURPOSE_OPTIONS,
  PHOTO_RIGHTS: PHOTO_RIGHTS_OPTIONS,
  APPROVAL_STATUS: APPROVAL_STATUS_OPTIONS,
  ACTION_LEVEL: ACTION_LEVEL_OPTIONS,
  ACTION_TYPE: ACTION_TYPE_OPTIONS,
  CHANGE_LOG_ACTION_TYPE: CHANGE_LOG_ACTION_TYPE_OPTIONS,
  SHEET_NAME: SHEET_NAME_OPTIONS,
  THRESHOLD_PROFILE: THRESHOLD_PROFILE_OPTIONS,
  DAMAGE_TERMS: DAMAGE_TERM_OPTIONS,
  HANDOVER_STATUS: HANDOVER_STATUS_OPTIONS,
  LEGACY: LEGACY_OPTIONS,
}

export type { Option }
