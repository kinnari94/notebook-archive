/**
 * Dropdown reference lists extracted from the SRMD Collection Assessment
 * Workbook's "01_Lists_Config" sheet. Shared by lib/srmd-sheets.ts (field/column
 * config for the per-sheet sub-views) to drive <select> options and badge styling.
 */

export interface Option { value: string; label: string }

export const RECORD_LEVEL_OPTIONS: Option[] = [
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'SERIES',     label: 'Series' },
  { value: 'FILE',       label: 'File' },
  { value: 'ITEM',       label: 'Item' },
  { value: 'GROUP',      label: 'Group' },
]

export const COLLECTION_TYPE_OPTIONS: Option[] = [
  { value: 'TX', label: 'Textile' },
  { value: 'PA', label: 'Paper' },
  { value: 'PB', label: 'Paper Bound' },
  { value: 'OB', label: 'Object' },
]

export const ACCESS_LEVEL_OPTIONS: Option[] = [
  { value: 'OPEN',       label: 'Open' },
  { value: 'INTERNAL',   label: 'Internal' },
  { value: 'RESTRICTED', label: 'Restricted' },
  { value: 'SENSITIVE',  label: 'Sensitive' },
]

export const ACCESS_LEVEL_META: Record<string, { badge: string }> = {
  OPEN:       { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INTERNAL:   { badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  RESTRICTED: { badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  SENSITIVE:  { badge: 'bg-red-50 text-red-700 border-red-200' },
}

export const SURVEY_STATUS_OPTIONS: Option[] = [
  { value: 'Not Started',    label: 'Not Started' },
  { value: 'Inventory Only', label: 'Inventory Only' },
  { value: 'CA Done',        label: 'CA Done' },
  { value: 'Complete',       label: 'Complete' },
]

export const SURVEY_STATUS_META: Record<string, { badge: string }> = {
  'Not Started':    { badge: 'bg-gray-50 text-gray-600 border-gray-200' },
  'Inventory Only': { badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  'CA Done':        { badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  'Complete':       { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export const OVERALL_CONDITION_OPTIONS: Option[] = [
  { value: 'Stable',   label: 'Stable' },
  { value: 'Good',     label: 'Good' },
  { value: 'Fair',     label: 'Fair' },
  { value: 'Poor',     label: 'Poor' },
  { value: 'Critical', label: 'Critical' },
]

export const OVERALL_CONDITION_META: Record<string, { badge: string; dot: string }> = {
  Stable:   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  Good:     { badge: 'bg-teal-50 text-teal-700 border-teal-200',         dot: 'bg-teal-400' },
  Fair:     { badge: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-400' },
  Poor:     { badge: 'bg-orange-50 text-orange-700 border-orange-200',   dot: 'bg-orange-400' },
  Critical: { badge: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-500' },
}

export const RISK_TYPE_OPTIONS: Option[] = [
  { value: 'ENV',            label: 'Environmental fluctuation' },
  { value: 'PEST',           label: 'Pest activity' },
  { value: 'HANDLING',       label: 'Handling damage' },
  { value: 'WATER',          label: 'Water / flood risk' },
  { value: 'LIGHT',          label: 'Light exposure' },
  { value: 'CORROSION',      label: 'Corrosion / metal decay' },
  { value: 'MOLD',           label: 'Mould / biological' },
  { value: 'BREAKAGE',       label: 'Physical breakage' },
  { value: 'OVERCROWDING',   label: 'Overcrowding / compression' },
  { value: 'RH_FLUCTUATION', label: 'RH fluctuation' },
]

export const PRIORITY_BAND_OPTIONS: Option[] = [
  { value: 'A – Immediate', label: 'A – Immediate (4.5–5.0)' },
  { value: 'B – High',      label: 'B – High (3.5–4.4)' },
  { value: 'C – Moderate',  label: 'C – Moderate (2.5–3.4)' },
  { value: 'D – Monitor',   label: 'D – Monitor (0–2.4)' },
]

export const PRIORITY_BAND_META: Record<string, { badge: string }> = {
  'A – Immediate': { badge: 'bg-red-50 text-red-700 border-red-200' },
  'B – High':      { badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  'C – Moderate':  { badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  'D – Monitor':   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export const YES_NO_OPTIONS: Option[] = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No',  label: 'No' },
]

// Photo "View_Type" lookup (tblPhotoView)
export const PHOTO_VIEW_OPTIONS: Option[] = [
  { value: 'REF',    label: 'Reference overall' },
  { value: 'REV',    label: 'Reverse' },
  { value: 'DETAIL', label: 'Detail area' },
  { value: 'MARK',   label: 'Markings/inscription' },
  { value: 'COND',   label: 'Condition documentation' },
]

// Purely categorical (not a severity scale like the METAs above) — just gives each
// view type its own color so Photo Log cards aren't a wall of identical gray badges.
export const PHOTO_VIEW_META: Record<string, { badge: string }> = {
  REF:    { badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  REV:    { badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  DETAIL: { badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  MARK:   { badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  COND:   { badge: 'bg-rose-50 text-rose-700 border-rose-200' },
}

// Damage terms (tblDamageTerms), grouped by Collection_Type code
export const DAMAGE_TERMS_BY_TYPE: Record<string, string[]> = {
  TX: ['Tear', 'Fold crease', 'Thread loss', 'Insect grazing', 'Stain', 'Fading', 'Hole', 'Metallic thread tarnish', 'Split seam'],
  PA: ['Tear', 'Foxing', 'Cockling', 'Acid yellowing', 'Mould', 'Surface dust', 'Fold weakness', 'Edge crumbling', 'Ink corrosion'],
  PB: ['Yellowing', 'Brittle', 'Sewing open', 'Hard cover damaged', 'Spine Damage', 'Corner damage'],
  OB: ['Active corrosion', 'Flaking surface', 'Crack', 'Old break/repair', 'Dust ingress', 'Joint movement'],
}

export const ALL_DAMAGE_TERMS: string[] = [...new Set(Object.values(DAMAGE_TERMS_BY_TYPE).flat())].sort()

// Team members (tblUsers) — used for Entered_By / Assessor / Photographer dropdowns
export const USER_OPTIONS: Option[] = [
  { value: 'HPA Conservator', label: 'HPA Conservator' },
  { value: 'Field Assistant', label: 'Field Assistant' },
  { value: 'Admin',           label: 'Admin' },
  { value: 'SRMD Lead',       label: 'SRMD Lead' },
]

function labelOf(options: Option[], value?: string | null): string {
  if (!value) return ''
  return options.find(o => o.value === value)?.label || value
}

export const collectionTypeLabel = (v?: string | null) => labelOf(COLLECTION_TYPE_OPTIONS, v)
export const recordLevelLabel    = (v?: string | null) => labelOf(RECORD_LEVEL_OPTIONS, v)
export const accessLevelLabel    = (v?: string | null) => labelOf(ACCESS_LEVEL_OPTIONS, v)
