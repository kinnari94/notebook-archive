// Shared config for the SRMD Collection Assessment Workbook views — one entry per
// sheet that's backed by its own Mongo collection (see scripts/import-srmd-workbook.mjs).
// Imported by both the API route (app/api/srmd/[sheet]/route.ts) and the generic
// card-based list page (app/collections/[slug]/SrmdSheetView.tsx), so column/label/
// dropdown changes stay in sync across the API, the card grid, and the add/edit form.

import {
  RECORD_LEVEL_OPTIONS, COLLECTION_TYPE_OPTIONS, ACCESS_LEVEL_OPTIONS, SURVEY_STATUS_OPTIONS,
  OVERALL_CONDITION_OPTIONS, RISK_TYPE_OPTIONS, PRIORITY_BAND_OPTIONS,
  USER_OPTIONS, PHOTO_VIEW_OPTIONS, ALL_DAMAGE_TERMS, type Option,
} from '@/lib/srmdLists'
import {
  THRESHOLD_PROFILE_OPTIONS, ASSESSMENT_TYPE_OPTIONS, BACKGROUND_OPTIONS, SHOT_PURPOSE_OPTIONS,
  PHOTO_RIGHTS_OPTIONS, APPROVAL_STATUS_OPTIONS, ACTION_LEVEL_OPTIONS, ACTION_TYPE_OPTIONS,
  CHANGE_LOG_ACTION_TYPE_OPTIONS, SHEET_NAME_OPTIONS,
} from '@/lib/dropdown-option-sets'

export interface SrmdColumn {
  key: string
  label: string
}

// 'select'  → rigid <select> from a closed option list
// 'combo'   → free-text input with a <datalist> of suggestions (workbook explicitly
//             allows free text in these — e.g. "type any name, dropdowns don't block it")
// 'textarea', 'date', 'number', 'text' → plain inputs
export interface SrmdField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'number' | 'select' | 'combo' | 'image' | 'hidden' | 'checkbox'
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
const n = (key: string, label: string): SrmdField => ({ key, label, type: 'number' })
const sel = (key: string, label: string, options: Option[], optionSetKey?: string): SrmdField =>
  ({ key, label, type: 'select', options, optionSetKey })
const combo = (key: string, label: string, options: Option[], optionSetKey?: string): SrmdField =>
  ({ key, label, type: 'combo', options, optionSetKey })
const yesNo = (key: string, label: string): SrmdField => ({ key, label, type: 'checkbox' })
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
      t('Object_ID', 'Object ID'), t('Parent_ID', 'Parent ID'),
      sel('Record_Level', 'Record Level', RECORD_LEVEL_OPTIONS, 'RECORD_LEVEL'),
      sel('Collection_Type', 'Collection Type', COLLECTION_TYPE_OPTIONS, 'COLLECTION_TYPE'),
      t('Object_Name', 'Object Name'), t('Alternate_Title', 'Alternate Title'),
      ta('Brief_Description', 'Brief Description'),
      t('Material_Primary', 'Material (Primary)'), t('Material_Secondary', 'Material (Secondary)'),
      t('Technique_or_Process', 'Technique / Process'), t('Date_or_Period', 'Date / Period'),
      t('Existing_Accession_No', 'Existing Accession No.'), t('Legacy_or_Previous_No', 'Legacy / Previous No.'),
      n('Quantity', 'Quantity'), n('Part_Count', 'Part Count'),
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
    columns: [
      { key: 'Condition_ID', label: 'Condition ID' },
      { key: 'Object_ID', label: 'Object ID' },
      { key: 'Assessment_Date', label: 'Date' },
      { key: 'Assessor', label: 'Assessor' },
      { key: 'Overall_Condition', label: 'Overall' },
      { key: 'Immediate_Stabilization_Needed', label: 'Urgent?' },
    ],
    fields: [
      t('Condition_ID', 'Condition ID'), t('Object_ID', 'Object ID'),
      d('Assessment_Date', 'Assessment Date', { defaultToday: true }), sel('Assessor', 'Assessor', USER_OPTIONS, 'USERS'),
      sel('Assessment_Type', 'Assessment Type', ASSESSMENT_TYPE_OPTIONS, 'ASSESSMENT_TYPE'),
      n('Support_Structure_Score', 'Support Structure Score'), n('Surface_Soil_Score', 'Surface Soil Score'),
      n('Tear_Split_Loss_Score', 'Tear/Split/Loss Score'), n('Discoloration_Stain_Score', 'Discoloration/Stain Score'),
      n('Biological_Activity_Score', 'Biological Activity Score'), n('Chemical_Deterioration_Score', 'Chemical Deterioration Score'),
      n('Handling_Vulnerability_Score', 'Handling Vulnerability Score'),
      combo('Primary_Damage_Term_1', 'Primary Damage Term 1', ALL_DAMAGE_TERMS.map(v => ({ value: v, label: v })), 'DAMAGE_TERMS'),
      combo('Primary_Damage_Term_2', 'Primary Damage Term 2', ALL_DAMAGE_TERMS.map(v => ({ value: v, label: v })), 'DAMAGE_TERMS'),
      combo('Primary_Damage_Term_3', 'Primary Damage Term 3', ALL_DAMAGE_TERMS.map(v => ({ value: v, label: v })), 'DAMAGE_TERMS'),
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
    columns: [
      { key: 'Object_ID', label: 'Object ID' },
      { key: 'Primary_Risk_Type', label: 'Risk Type' },
      { key: 'Risk_Score', label: 'Risk Score' },
      { key: 'Priority_Score', label: 'Priority Score' },
      { key: 'Priority_Band', label: 'Priority Band' },
      { key: 'Recommended_Action_Window', label: 'Action Window' },
    ],
    fields: [
      t('Risk_ID', 'Risk ID'), t('Object_ID', 'Object ID'),
      d('Assessment_Date', 'Assessment Date', { defaultToday: true }), sel('Assessor', 'Assessor', USER_OPTIONS, 'USERS'),
      n('Spiritual_Significance', 'Spiritual Significance (1–5)'), n('Historical_Significance', 'Historical Significance (1–5)'),
      n('Research_Value', 'Research Value (1–5)'), n('Display_Value', 'Display Value (1–5)'),
      n('Significance_Total', 'Significance Total'),
      sel('Primary_Risk_Type', 'Primary Risk Type', RISK_TYPE_OPTIONS, 'RISK_TYPE'),
      n('Severity', 'Severity (1–5)'), n('Likelihood', 'Likelihood (1–5)'),
      n('Risk_Score', 'Risk Score'), n('Priority_Score', 'Priority Score'),
      sel('Priority_Band', 'Priority Band', PRIORITY_BAND_OPTIONS, 'PRIORITY_BAND'),
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
