// Fixed 13-item checklist from the workbook's "13_Handover_Checklist_Print" sheet.
// Unlike the other sub-views, this isn't a user-created grid of rows — it's always
// exactly these 13 items; only their Status/Date/Notes are editable per item.

export interface Option { value: string; label: string }

export const HANDOVER_STATUS_OPTIONS: Option[] = [
  { value: 'Not Started', label: 'Not Started' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Done',        label: 'Done' },
  { value: 'N/A',         label: 'N/A' },
]

export const HANDOVER_CHECKLIST_ITEMS: string[] = [
  'Final master workbook delivered to SRMD',
  'Frozen monthly workbook snapshots delivered (all months)',
  'Master photo folder (TIFF) delivered',
  'Access photo folder (JPG) delivered',
  'Logger exports and summaries folder delivered',
  'Controlled vocabulary and threshold sheet reviewed with SRMD',
  'Immediate-priority object list reviewed with SRMD management',
  'Treatment recommendations reviewed with SRMD lead',
  'Folder structure explained to designated SRMD staff',
  'Passwords and workbook permissions transferred to authorised SRMD user',
  'Final dashboard reviewed with SRMD management',
  'Open issues, unresolved items, and follow-up actions documented',
  'Post-engagement support period agreed and documented',
]
