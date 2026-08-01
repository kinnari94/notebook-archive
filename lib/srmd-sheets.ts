// Shared config for the SRMD Collection Assessment Workbook views — one entry per
// sheet that's backed by its own Mongo collection (see scripts/import-srmd-workbook.mjs).
// Imported by both the API route (app/api/srmd/[sheet]/route.ts) and the generic
// card-based list page (app/collections/[slug]/SrmdSheetView.tsx), so column/label/
// dropdown changes stay in sync across the API, the card grid, and the add/edit form.

import {
  RECORD_LEVEL_OPTIONS, COLLECTION_TYPE_OPTIONS, ACCESS_LEVEL_OPTIONS, SURVEY_STATUS_OPTIONS,
  OVERALL_CONDITION_OPTIONS, RISK_TYPE_OPTIONS,
  USER_OPTIONS, PHOTO_VIEW_OPTIONS, ALL_DAMAGE_TERMS, type Option,
} from '@/lib/srmdLists'
import {
  THRESHOLD_PROFILE_OPTIONS, ASSESSMENT_TYPE_OPTIONS, BACKGROUND_OPTIONS, SHOT_PURPOSE_OPTIONS,
  PHOTO_RIGHTS_OPTIONS, APPROVAL_STATUS_OPTIONS, ACTION_LEVEL_OPTIONS, ACTION_TYPE_OPTIONS,
  CHANGE_LOG_ACTION_TYPE_OPTIONS, SHEET_NAME_OPTIONS, RECORD_LEVEL_2_OPTIONS,
  LEGACY_OPTIONS,
} from '@/lib/dropdown-option-sets'

export interface SrmdColumn {
  key: string
  label: string
}

// 'select'  → rigid <select> from a closed option list
// 'combo'   → free-text input with a <datalist> of suggestions (workbook explicitly
//             allows free text in these — e.g. "type any name, dropdowns don't block it")
// 'object-lookup' → rigid <select> of every Object_ID that exists in Inventory Master
//             (fetched live, not a fixed list) — used by sheets that reference an
//             inventory object by ID (Condition Assessment, Risk & Priority) so the
//             user picks an existing object instead of retyping its ID by hand.
//             Inventory Master's own Object_ID field stays plain 'text', since that's
//             where the ID is created.
// 'category-code' → <select> of Category Codes already in use for the currently
//             selected Collection_Type, parsed live from existing Object_ID values
//             (see app/api/srmd/inventory/category-codes/route.ts) rather than a
//             hand-maintained list — Textile and Paper Bound don't share a subtype
//             vocabulary, so the list re-fetches whenever Collection_Type changes.
// 'year' → year-only picker (a decade grid, not a full day/month/year calendar) —
//          for fields like Inventory Master's Date_or_Period where only the year
//          matters
// 'textarea', 'date', 'number', 'text' → plain inputs
export interface SrmdField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'year' | 'number' | 'select' | 'combo' | 'image' | 'hidden' | 'checkbox' | 'object-lookup' | 'category-code'
  options?: Option[]
  // For 'select'/'combo' fields backed by a shared, user-extensible option list —
  // see lib/dropdown-option-sets.ts. Fields without this key show a fixed list only.
  optionSetKey?: string
  // For 'date' fields — pre-fills with today's date when opening the Add form
  // (edit mode always shows the record's own stored value, never today's date).
  defaultToday?: boolean
  // For 'text' fields named Month_Key — mirrors the workbook's own formula
  // =IF(C3="","",TEXT(C3,"yyyy-mm")): auto-derived as the "yyyy-mm" of the named
  // date field, blank when that date is blank. Read-only in the form since it's
  // computed, not entered.
  deriveMonthFrom?: string
  // For 'number' fields on a fixed rating scale (e.g. Condition Assessment's 1–5
  // severity scores) — enforced both in the form input and server-side in the API,
  // since the input's own min/max attributes only guide the browser's spinner/native
  // validation and don't block a value typed or pasted in directly.
  min?: number
  max?: number
  // For 'number' fields computed as a weighted sum of other number fields — mirrors
  // the workbook's own formula (e.g. Risk & Priority's Significance_Total:
  // =IF(COUNTA(E3:H3)=4,ROUND((E3*0.4)+(F3*0.25)+(G3*0.2)+(H3*0.15),1),"")). Blank
  // unless every contributing field has a value, rounded to `deriveRound` decimals.
  // Read-only in the form since it's computed, not entered.
  deriveWeightedFrom?: { key: string; weight: number }[]
  deriveRound?: number
  // For 'number' fields computed as the product of other number fields — mirrors
  // the workbook's own formula (e.g. Risk & Priority's Risk_Score:
  // =IF(OR(K3="",L3=""),"",K3*L3)). Blank unless every contributing field has a value.
  deriveProductFrom?: string[]
  // For fields computed by one of a small set of named, sheet-specific formulas that
  // don't fit the generic shapes above (e.g. Risk & Priority's Priority_Score and
  // Priority_Band, each with their own workbook formula). `deriveCustomFrom` lists the
  // source field keys in the order each named formula expects them.
  deriveCustom?: 'priorityScore' | 'priorityBand'
  deriveCustomFrom?: string[]
  // For 'text' fields computed by joining other fields with a separator — mirrors
  // the workbook's own Parent_ID convention (Legacy_Collection_Type_Short_Form, e.g.
  // "PPG_TX_SH"). Blank unless every contributing field has a value. Read-only in
  // the form since it's computed, not entered.
  deriveConcat?: { fields: string[]; separator: string }
  // Hides this field entirely (not just disables it) unless the named field's
  // current value is one of `values` — e.g. Legacy/Short_Form only make sense once
  // Collection_Type is Textile or Paper Bound.
  showWhen?: { field: string; values: string[] }
}

export interface SrmdSheetConfig {
  slug: string
  label: string
  sheetTab: string
  collection: string
  searchFields: string[]
  sortField: string
  sortDir: 1 | -1
  objectIdField?: string
  // Field(s) that must each individually hold a unique value within this sheet's
  // collection — enforced unique by the API on create/update. Usually just the
  // sheet's own primary ID (e.g. 'Condition_ID'), but some sheets also require
  // Object_ID itself to be unique (i.e. only one record per object, ever).
  uniqueFields?: string[]
  groupBy?: string
  // Enables the card grid's "Group by" control, offering every one of this sheet's
  // add-form fields (anything not 'hidden') as a way to cluster the grid into
  // collapsible sections instead of always showing a flat list. Distinct from
  // `groupBy` above, which is a fixed sort-order grouping the user can't change.
  groupable?: boolean
  columns: SrmdColumn[]
  fields: SrmdField[]
  titleField: string
  subtitleField?: string
  badgeField?: string
  imageField?: string
}

const t = (key: string, label: string, opts?: { deriveMonthFrom?: string }): SrmdField => ({ key, label, type: 'text', ...opts })
const ta = (key: string, label: string): SrmdField => ({ key, label, type: 'textarea' })
const d = (key: string, label: string, opts?: { defaultToday?: boolean }): SrmdField => ({ key, label, type: 'date', ...opts })
const year = (key: string, label: string): SrmdField => ({ key, label, type: 'year' })
const n = (key: string, label: string): SrmdField => ({ key, label, type: 'number' })
const score = (key: string, label: string, min: number, max: number): SrmdField =>
  ({ key, label: `${label} (${min}–${max})`, type: 'number', min, max })
const weightedTotal = (key: string, label: string, from: { key: string; weight: number }[], round = 1): SrmdField =>
  ({ key, label, type: 'number', deriveWeightedFrom: from, deriveRound: round })
const productOf = (key: string, label: string, from: string[]): SrmdField =>
  ({ key, label, type: 'number', deriveProductFrom: from })
// Priority_Score = ROUND(ROUNDUP(Risk_Score / 5, 0) * 0.4 + Significance_Total * 0.6, 1)
const priorityScoreFrom = (key: string, label: string, riskScoreKey: string, significanceTotalKey: string): SrmdField =>
  ({ key, label, type: 'number', deriveCustom: 'priorityScore', deriveCustomFrom: [riskScoreKey, significanceTotalKey] })
// Priority_Band = A/B/C/D band name for a Priority_Score value
const priorityBandFrom = (key: string, label: string, priorityScoreKey: string): SrmdField =>
  ({ key, label, type: 'text', deriveCustom: 'priorityBand', deriveCustomFrom: [priorityScoreKey] })
const sel = (key: string, label: string, options: Option[], optionSetKey?: string): SrmdField =>
  ({ key, label, type: 'select', options, optionSetKey })
// A 'select' field hidden unless another field's current value matches — e.g.
// Legacy/Short_Form only make sense once Collection_Type is Textile/Paper Bound.
const selWhen = (
  key: string, label: string, options: Option[], optionSetKey: string, showWhen: { field: string; values: string[] }
): SrmdField => ({ key, label, type: 'select', options, optionSetKey, showWhen })
// Parent_ID = Legacy_Collection_Type_Short_Form, joined only once every contributing
// field has a value (see deriveConcat on SrmdField above).
const concatOf = (key: string, label: string, fields: string[], separator = '-'): SrmdField =>
  ({ key, label, type: 'text', deriveConcat: { fields, separator } })
const yesNo = (key: string, label: string): SrmdField => ({ key, label, type: 'checkbox' })
const objectLookup = (key: string, label: string): SrmdField => ({ key, label, type: 'object-lookup' })
const image = (key: string, label: string): SrmdField => ({ key, label, type: 'image' })
// Tracked in formData/saved like any other field, but never rendered in the add/edit
// form or shown in the detail drawer — used for the Photo Log's cached thumbnail.
const hidden = (key: string, label: string): SrmdField => ({ key, label, type: 'hidden' })

export const SRMD_SHEETS: SrmdSheetConfig[] = [
  {
    slug: 'inventory', label: 'Inventory Master', sheetTab: '02_Inventory_Master',
    collection: 'srmd_inventory_master',
    searchFields: ['Object_ID', 'Object_Name', 'Alternate_Title', 'Material_Primary', 'Existing_Accession_No'],
    sortField: 'Object_ID', sortDir: 1, objectIdField: 'Object_ID', uniqueFields: ['Object_ID'],
    titleField: 'Object_Name', subtitleField: 'Object_ID',
    groupable: true,
    columns: [
      { key: 'Object_ID', label: 'Object ID' },
      { key: 'Object_Name', label: 'Object Name' },
      { key: 'Collection_Type', label: 'Type' },
      { key: 'Material_Primary', label: 'Material' },
      { key: 'Date_or_Period', label: 'Date/Period' },
      { key: 'Current_Location_ID', label: 'Location' },
      { key: 'Access_Level', label: 'Access' },
    ],
    fields: [
      sel('Collection_Type', 'Collection Type', COLLECTION_TYPE_OPTIONS, 'COLLECTION_TYPE'),
      // Only meaningful for Textile/Paper Bound — hidden for any other Collection
      // Type. Together with Collection_Type they build Parent_ID and (via the
      // inventory-only auto-suggest effect in SrmdSheetView) Object_ID.
      selWhen('Legacy', 'Legacy', LEGACY_OPTIONS, 'LEGACY', { field: 'Collection_Type', values: ['TX', 'PB'] }),
      // Options fetched live from existing Inventory Master Object_IDs for whichever
      // Collection_Type is currently selected — see the 'category-code' type note above.
      { key: 'Short_Form', label: 'Category Code', type: 'category-code', showWhen: { field: 'Collection_Type', values: ['TX', 'PB'] } },
      // Auto-suggested (see SrmdSheetView's inventory-only effect): for Textile/Paper
      // Bound, Legacy_Collection_Type_Short_Form_NNNN[.N]; otherwise the workbook's
      // NNNN.N-TITLE lot/sub-item scheme keyed off Object_Name. Still a plain editable
      // field so it can be corrected or overridden by hand.
      t('Object_ID', 'Object ID'),
      concatOf('Parent_ID', 'Parent ID', ['Legacy', 'Collection_Type', 'Short_Form'], '_'),
      sel('Record_Level_1', 'Archival Level', RECORD_LEVEL_OPTIONS, 'RECORD_LEVEL'),
      sel('Record_Level_2', 'Document Type', RECORD_LEVEL_2_OPTIONS, 'RECORD_LEVEL_2'),
      t('Object_Name', 'Object Name'), t('Alternate_Title', 'Alternate Title'),
      ta('Brief_Description', 'Brief Description'),
      t('Material_Primary', 'Material (Primary)'), t('Material_Secondary', 'Material (Secondary)'),
      t('Technique_or_Process', 'Technique / Process'), year('Date_or_Period', 'Date / Period'),
      t('Existing_Accession_No', 'Existing Accession No.'), t('Legacy_or_Previous_No', 'Previous No.'),
      n('Quantity', 'Quantity'), n('Part_Count', 'Part/Page Count'),
      n('Dimensions_L_cm', 'Length (cm)'), n('Dimensions_W_cm', 'Width (cm)'), n('Dimensions_H_or_D_cm', 'Height/Depth (cm)'),
      ta('Inscription_or_Markings', 'Inscription / Markings'), ta('Cultural_or_Associative_Note', 'Cultural / Associative Note'),
      t('Current_Location_ID', 'Current Location ID'),
      sel('Access_Level', 'Access Level', ACCESS_LEVEL_OPTIONS, 'ACCESS_LEVEL'),
      sel('Survey_Status', 'Survey Status', SURVEY_STATUS_OPTIONS, 'SURVEY_STATUS'),
      d('Entry_Date', 'Entry Date', { defaultToday: true }), sel('Entered_By', 'Entered By', USER_OPTIONS, 'USERS'),
      ta('Notes', 'Notes'),
    ],
  },
  {
    slug: 'condition', label: 'Condition Assessment', sheetTab: '03_Condition_Assess',
    collection: 'srmd_condition_assess',
    searchFields: ['Condition_ID', 'Object_ID', 'Assessor', 'Condition_Summary'],
    sortField: 'Assessment_Date', sortDir: -1, objectIdField: 'Object_ID', uniqueFields: ['Condition_ID', 'Object_ID'],
    titleField: 'Object_ID', subtitleField: 'Assessment_Date', badgeField: 'Overall_Condition',
    groupable: true,
    columns: [
      { key: 'Condition_ID', label: 'Condition ID' },
      { key: 'Object_ID', label: 'Object ID' },
      { key: 'Assessment_Date', label: 'Date' },
      { key: 'Assessor', label: 'Assessor' },
      { key: 'Overall_Condition', label: 'Overall' },
      { key: 'Immediate_Stabilization_Needed', label: 'Urgent?' },
    ],
    fields: [
      t('Condition_ID', 'Condition ID'), objectLookup('Object_ID', 'Object ID'),
      d('Assessment_Date', 'Assessment Date', { defaultToday: true }), sel('Assessor', 'Assessor', USER_OPTIONS, 'USERS'),
      sel('Assessment_Type', 'Assessment Type', ASSESSMENT_TYPE_OPTIONS, 'ASSESSMENT_TYPE'),
      score('Support_Structure_Score', 'Support Structure Score', 1, 5), score('Surface_Soil_Score', 'Surface Soil Score', 1, 5),
      score('Tear_Split_Loss_Score', 'Tear/Split/Loss Score', 1, 5), score('Discoloration_Stain_Score', 'Discoloration/Stain Score', 1, 5),
      score('Biological_Activity_Score', 'Biological Activity Score', 1, 5), score('Chemical_Deterioration_Score', 'Chemical Deterioration Score', 1, 5),
      score('Handling_Vulnerability_Score', 'Handling Vulnerability Score', 1, 5),
      sel('Primary_Damage_Term_1', 'Primary Damage Term 1', ALL_DAMAGE_TERMS.map(v => ({ value: v, label: v })), 'DAMAGE_TERMS'),
      sel('Primary_Damage_Term_2', 'Primary Damage Term 2', ALL_DAMAGE_TERMS.map(v => ({ value: v, label: v })), 'DAMAGE_TERMS'),
      sel('Primary_Damage_Term_3', 'Primary Damage Term 3', ALL_DAMAGE_TERMS.map(v => ({ value: v, label: v })), 'DAMAGE_TERMS'),
      sel('Overall_Condition', 'Overall Condition', OVERALL_CONDITION_OPTIONS, 'OVERALL_CONDITION'),
      yesNo('Immediate_Stabilization_Needed', 'Immediate Stabilization Needed'),
      yesNo('Quarantine_Flag', 'Quarantine Flag'),
      ta('Condition_Summary', 'Condition Summary'), d('Next_Review_Date', 'Next Review Date'),
      t('Photo_Reference_Note', 'Photo Reference Note'), t('Month_Key', 'Month Key', { deriveMonthFrom: 'Assessment_Date' }),
    ],
  },
  {
    slug: 'risk-priority', label: 'Risk & Priority', sheetTab: '04_Risk_Priority',
    collection: 'srmd_risk_priority',
    searchFields: ['Object_ID', 'Assessor', 'Primary_Risk_Type', 'Recommended_Action'],
    sortField: 'Priority_Score', sortDir: -1, objectIdField: 'Object_ID', uniqueFields: ['Risk_ID', 'Object_ID'],
    titleField: 'Object_ID', subtitleField: 'Primary_Risk_Type', badgeField: 'Priority_Band',
    groupable: true,
    columns: [
      { key: 'Object_ID', label: 'Object ID' },
      { key: 'Primary_Risk_Type', label: 'Risk Type' },
      { key: 'Risk_Score', label: 'Risk Score' },
      { key: 'Priority_Score', label: 'Priority Score' },
      { key: 'Priority_Band', label: 'Priority Band' },
      { key: 'Recommended_Action_Window', label: 'Action Window' },
    ],
    fields: [
      t('Risk_ID', 'Risk ID'), objectLookup('Object_ID', 'Object ID'),
      d('Assessment_Date', 'Assessment Date', { defaultToday: true }), sel('Assessor', 'Assessor', USER_OPTIONS, 'USERS'),
      score('Spiritual_Significance', 'Spiritual Significance', 1, 5), score('Historical_Significance', 'Historical Significance', 1, 5),
      score('Research_Value', 'Research Value', 1, 5), score('Display_Value', 'Display Value', 1, 5),
      weightedTotal('Significance_Total', 'Significance Total', [
        { key: 'Spiritual_Significance', weight: 0.4 },
        { key: 'Historical_Significance', weight: 0.25 },
        { key: 'Research_Value', weight: 0.2 },
        { key: 'Display_Value', weight: 0.15 },
      ]),
      sel('Primary_Risk_Type', 'Primary Risk Type', RISK_TYPE_OPTIONS, 'RISK_TYPE'),
      score('Severity', 'Severity', 1, 5), score('Likelihood', 'Likelihood', 1, 5),
      productOf('Risk_Score', 'Risk Score', ['Severity', 'Likelihood']),
      priorityScoreFrom('Priority_Score', 'Priority Score', 'Risk_Score', 'Significance_Total'),
      priorityBandFrom('Priority_Band', 'Priority Band', 'Priority_Score'),
      t('Recommended_Action_Window', 'Recommended Action Window'),
      ta('Recommended_Action', 'Recommended Action'), t('Month_Key', 'Month Key', { deriveMonthFrom: 'Assessment_Date' }),
    ],
  },
  {
    slug: 'location-storage', label: 'Location & Storage', sheetTab: '05_Location_Storage',
    collection: 'srmd_location_storage',
    searchFields: ['Location_ID', 'Building_or_Area', 'Room'],
    sortField: 'Location_ID', sortDir: 1, uniqueFields: ['Location_ID'],
    titleField: 'Location_ID', subtitleField: 'Building_or_Area',
    columns: [
      { key: 'Location_ID', label: 'Location ID' },
      { key: 'Building_or_Area', label: 'Building/Area' },
      { key: 'Room', label: 'Room' },
      { key: 'Storage_Furniture_Type', label: 'Furniture' },
      { key: 'Light_Exposure_Level', label: 'Light' },
      { key: 'Security_Concern', label: 'Security' },
    ],
    fields: [
      t('Location_ID', 'Location ID'), t('Building_or_Area', 'Building / Area'), t('Room', 'Room'),
      t('Zone_or_Wall', 'Zone / Wall'), t('Furniture_Unit', 'Furniture Unit'), t('Shelf_Drawer_Box', 'Shelf / Drawer / Box'),
      t('Location_Type', 'Location Type'), t('Storage_Furniture_Type', 'Storage Furniture Type'),
      t('Housing_Type', 'Housing Type'), t('Support_Type', 'Support Type'),
      t('Light_Exposure_Level', 'Light Exposure Level'), t('Dust_Level', 'Dust Level'),
      t('Pest_Evidence', 'Pest Evidence'), t('Water_Risk_Level', 'Water Risk Level'),
      t('Security_Concern', 'Security Concern'), ta('Access_Note', 'Access Note'), ta('Location_Notes', 'Location Notes'),
    ],
  },
  {
    slug: 'photo-log', label: 'Photo Log', sheetTab: '06_Photo_Log',
    collection: 'srmd_photo_log',
    searchFields: ['Object_ID', 'Photographer', 'Master_File_Name'],
    sortField: 'Object_ID', sortDir: 1, objectIdField: 'Object_ID', uniqueFields: ['Photo_ID', 'Object_ID'],
    titleField: 'Object_ID', subtitleField: 'Photo_Date', badgeField: 'View_Type', imageField: 'Photo_URL',
    columns: [
      { key: 'Object_ID', label: 'Object ID' },
      { key: 'Photo_Date', label: 'Date' },
      { key: 'Photographer', label: 'Photographer' },
      { key: 'View_Type', label: 'View' },
      { key: 'Shot_Purpose', label: 'Purpose' },
      { key: 'Master_File_Name', label: 'File' },
    ],
    fields: [
      t('Photo_ID', 'Photo ID'), t('Object_ID', 'Object ID'),
      image('Photo_URL', 'Photo'),
      hidden('Photo_Thumbnail', 'Photo Thumbnail'),
      d('Photo_Date', 'Photo Date', { defaultToday: true }), sel('Photographer', 'Photographer', USER_OPTIONS, 'USERS'), t('Camera_or_Device', 'Camera / Device'),
      sel('View_Type', 'View Type', PHOTO_VIEW_OPTIONS, 'PHOTO_VIEW'), sel('Shot_Purpose', 'Shot Purpose', SHOT_PURPOSE_OPTIONS, 'SHOT_PURPOSE'),
      t('Master_File_Name', 'Master File Name'), t('Access_File_Name', 'Access File Name'),
      yesNo('Scale_Present', 'Scale Present'), yesNo('Color_Target_Present', 'Color Target Present'),
      sel('Background', 'Background', BACKGROUND_OPTIONS, 'BACKGROUND'), yesNo('Focus_Checked', 'Focus Checked'),
      t('File_Path_or_Folder', 'File Path / Folder'), ta('Editing_Note', 'Editing Note'),
      sel('Rights_or_Restriction', 'Rights / Restriction', PHOTO_RIGHTS_OPTIONS, 'PHOTO_RIGHTS'), t('Month_Key', 'Month Key', { deriveMonthFrom: 'Photo_Date' }),
    ],
  },
  {
    slug: 'environment', label: 'Environment Summary', sheetTab: '07_Environment_Summary',
    collection: 'srmd_environment_summary',
    searchFields: ['Env_ID', 'Location_ID', 'Logger_ID'],
    sortField: 'Summary_Period_Start', sortDir: -1, uniqueFields: ['Env_ID'],
    titleField: 'Env_ID', subtitleField: 'Location_ID',
    columns: [
      { key: 'Env_ID', label: 'Env ID' },
      { key: 'Location_ID', label: 'Location ID' },
      { key: 'Summary_Period_Start', label: 'Period Start' },
      { key: 'Temp_Avg_C', label: 'Avg Temp (C)' },
      { key: 'RH_Avg', label: 'Avg RH' },
      { key: 'Alert_Flag', label: 'Alert' },
    ],
    fields: [
      t('Env_ID', 'Env ID'), t('Logger_ID', 'Logger ID'), t('Location_ID', 'Location ID'),
      d('Summary_Period_Start', 'Period Start'), d('Summary_Period_End', 'Period End'),
      sel('Threshold_Profile', 'Threshold Profile', THRESHOLD_PROFILE_OPTIONS, 'THRESHOLD_PROFILE'),
      n('Temp_Min_C', 'Min Temp (°C)'), n('Temp_Max_C', 'Max Temp (°C)'), n('Temp_Avg_C', 'Avg Temp (°C)'),
      n('RH_Min', 'Min RH (%)'), n('RH_Max', 'Max RH (%)'), n('RH_Avg', 'Avg RH (%)'),
      n('Lux_Max', 'Max Lux'), n('UV_Max', 'Max UV'),
      n('Pct_Time_Outside_RH', '% Time Outside RH'), n('Pct_Time_Outside_Temp', '% Time Outside Temp'),
      yesNo('Alert_Flag', 'Alert Flag'), t('Raw_CSV_File', 'Raw CSV File'), ta('Notes', 'Notes'),
    ],
  },
  {
    slug: 'treatments', label: 'Treatment Recommendations', sheetTab: '08_Treatment_Recommendations',
    collection: 'srmd_treatment_recommendations',
    searchFields: ['Treatment_ID', 'Object_ID', 'Recommended_By', 'Action_Type'],
    sortField: 'Recommendation_Date', sortDir: -1, objectIdField: 'Object_ID', uniqueFields: ['Treatment_ID', 'Object_ID'],
    titleField: 'Object_ID', subtitleField: 'Action_Type', badgeField: 'Approval_Status',
    columns: [
      { key: 'Treatment_ID', label: 'Treatment ID' },
      { key: 'Object_ID', label: 'Object ID' },
      { key: 'Action_Type', label: 'Action' },
      { key: 'Approval_Status', label: 'Approval' },
      { key: 'Assigned_To', label: 'Assigned To' },
      { key: 'Completion_Date', label: 'Completed' },
    ],
    fields: [
      t('Treatment_ID', 'Treatment ID'), t('Object_ID', 'Object ID'),
      d('Recommendation_Date', 'Recommendation Date'), sel('Recommended_By', 'Recommended By', USER_OPTIONS, 'USERS'),
      sel('Action_Type', 'Action Type', ACTION_TYPE_OPTIONS, 'ACTION_TYPE'), sel('Action_Level', 'Action Level', ACTION_LEVEL_OPTIONS, 'ACTION_LEVEL'),
      ta('Reason_for_Action', 'Reason for Action'), n('Estimated_Hours', 'Estimated Hours'),
      t('Materials_or_Supplies', 'Materials / Supplies'), sel('Approval_Status', 'Approval Status', APPROVAL_STATUS_OPTIONS, 'APPROVAL_STATUS'),
      sel('Assigned_To', 'Assigned To', USER_OPTIONS, 'USERS'), d('Completion_Date', 'Completion Date'),
      ta('Outcome_Summary', 'Outcome Summary'), t('Treatment_Report_File', 'Treatment Report File'),
      d('Post_Treatment_Review_Date', 'Post-Treatment Review Date'), t('Month_Key', 'Month Key', { deriveMonthFrom: 'Recommendation_Date' }),
    ],
  },
  {
    slug: 'change-log', label: 'Change Log', sheetTab: '09_Change_Log',
    collection: 'srmd_change_log',
    searchFields: ['Change_ID', 'User', 'Sheet_Name', 'Record_Key'],
    sortField: 'Timestamp', sortDir: -1, uniqueFields: ['Change_ID'],
    titleField: 'Record_Key', subtitleField: 'Timestamp',
    columns: [
      { key: 'Timestamp', label: 'When' },
      { key: 'User', label: 'User' },
      { key: 'Sheet_Name', label: 'Sheet' },
      { key: 'Record_Key', label: 'Record' },
      { key: 'Action_Type', label: 'Action' },
    ],
    fields: [
      t('Change_ID', 'Change ID'), d('Timestamp', 'Timestamp', { defaultToday: true }), sel('User', 'User', USER_OPTIONS, 'USERS'),
      sel('Sheet_Name', 'Sheet Name', SHEET_NAME_OPTIONS, 'SHEET_NAME'), t('Record_Key', 'Record Key'),
      sel('Action_Type', 'Action Type', CHANGE_LOG_ACTION_TYPE_OPTIONS, 'CHANGE_LOG_ACTION_TYPE'),
      ta('Old_Value_Summary', 'Old Value Summary'), ta('New_Value_Summary', 'New Value Summary'),
      ta('Reason_or_Comment', 'Reason / Comment'),
    ],
  },
  {
    slug: 'lists-config', label: 'Lists & Config', sheetTab: '01_Lists_Config',
    collection: 'srmd_lists_config',
    searchFields: ['table', 'Code', 'Label'],
    sortField: 'table', sortDir: 1, groupBy: 'table',
    titleField: 'Label', subtitleField: 'table',
    columns: [
      { key: 'Code', label: 'Code' },
      { key: 'Label', label: 'Label' },
    ],
    fields: [
      sel('table', 'Reference Table', [
        'tblCollectionType', 'tblRecordLevel', 'tblAccessLevel', 'tblConditionScale', 'tblRiskType',
        'tblDamageTerms', 'tblPhotoView', 'tblPriorityBand', 'tblThresholds', 'tblUsers',
        'tblOverallCondition', 'tblSurveyStatus',
      ].map(v => ({ value: v, label: v }))),
      t('Code', 'Code'), t('Label', 'Label'), n('Sort_Order', 'Sort Order'),
      yesNo('Active', 'Active'), t('Meaning', 'Meaning'),
      n('Min_Score', 'Min Score'), n('Max_Score', 'Max Score'),
      sel('Collection_Type', 'Collection Type (for damage terms)', COLLECTION_TYPE_OPTIONS, 'COLLECTION_TYPE'),
      t('Damage_Term', 'Damage Term'),
      sel('Profile', 'Threshold Profile', THRESHOLD_PROFILE_OPTIONS, 'THRESHOLD_PROFILE'), t('Metric', 'Metric'),
      n('Low_Caution', 'Low Caution'), n('High_Caution', 'High Caution'), t('Units', 'Units'),
      t('User_Name', 'User Name'), t('Role', 'Role'), yesNo('Can_Edit_Config', 'Can Edit Config'),
    ],
  },
]

export function getSrmdSheet(slug: string): SrmdSheetConfig | undefined {
  return SRMD_SHEETS.find(s => s.slug === slug)
}

// Sidebar order — mirrors the workbook's own tab order (00 through 13).
export const SRMD_NAV: { slug: string; label: string }[] = [
  { slug: 'readme', label: 'Read Me' },
  { slug: 'dashboard', label: 'Dashboard' },
  { slug: 'inventory', label: 'Inventory Master' },
  { slug: 'condition', label: 'Condition Assessment' },
  { slug: 'risk-priority', label: 'Risk & Priority' },
  { slug: 'location-storage', label: 'Location & Storage' },
  { slug: 'photo-log', label: 'Photo Log' },
  { slug: 'environment', label: 'Environment Summary' },
  { slug: 'treatments', label: 'Treatment Recommendations' },
  { slug: 'change-log', label: 'Change Log' },
  { slug: 'reports/monthly', label: 'Monthly Report' },
  { slug: 'reports/treatment-sheet', label: 'Treatment Sheet' },
  { slug: 'reports/handover', label: 'Handover Checklist' },
]
