'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSession } from 'next-auth/react'
import { Search, Filter, Loader2, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Edit2, Trash2, Check, Archive, Image as ImageIcon, AlertTriangle, Calendar } from 'lucide-react'
import { getSrmdSheet, type SrmdField } from '@/lib/srmd-sheets'
import {
  OVERALL_CONDITION_META, PRIORITY_BAND_META, ACCESS_LEVEL_META, SURVEY_STATUS_META, PHOTO_VIEW_META,
} from '@/lib/srmdLists'
import { hasEditAccess, type ViewPermissions } from '@/lib/permissions'
import { useDropdownOptions } from '@/lib/useDropdownOptions'
import { APPROVAL_STATUS_META, ACTION_LEVEL_META, CHANGE_LOG_ACTION_TYPE_META, type Option } from '@/lib/dropdown-option-sets'
import SelectWithAdd from '@/components/SelectWithAdd'
import SearchableSelect from '@/components/SearchableSelect'

type Doc = Record<string, unknown> & { _id: string }

const HIDDEN_FIELDS = new Set(['_id', '_srmd_key', 'imported_at', 'updated_at'])

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// dd-mm-yyyy, always — not toLocaleDateString(), whose day/month order and
// separator depend on the browser/server locale (was showing dd/mm/yyyy for some,
// mm/dd/yyyy for others). Built from the date's own y/m/d parts, not by re-parsing
// a "yyyy-mm-dd" string through `new Date(...)`, which reinterprets it in local
// time and can roll the displayed day back/forward by one near midnight.
function formatDMY(y: number, m: number, day: number): string {
  return `${String(day).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`
}

function formatVal(v: unknown): string {
  if (v == null || v === '') return '—'
  if (v instanceof Date) return formatDMY(v.getFullYear(), v.getMonth() + 1, v.getDate())
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return formatDMY(Number(m[1]), Number(m[2]), Number(m[3]))
  }
  return String(v)
}

function toDateInputValue(v: unknown): string {
  if (v == null || v === '') return ''
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function isoToDMY(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

// Strict — rejects "31-02-2026" etc, not just malformed shape, by checking the
// constructed date's own fields round-trip back to what was typed.
function dmyToIso(dmy: string): string | null {
  const m = dmy.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null
  return `${y}-${mo}-${d}`
}

// Native <input type="date"> always renders in the browser/OS locale's own
// day/month order and separator, which can't be overridden with CSS or the
// value format — so this pairs a plain dd-mm-yyyy text field (typed directly,
// auto-inserting the dashes) with a hidden native date input driving a calendar
// icon button, for people who'd rather pick from a calendar than type it.
function DateInputDMY({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const iso = toDateInputValue(value)
  const [text, setText] = useState(isoToDMY(iso))
  const nativeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setText(isoToDMY(iso)) }, [iso])

  function handleTextChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const masked = digits.length > 4
      ? `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
      : digits.length > 2
        ? `${digits.slice(0, 2)}-${digits.slice(2)}`
        : digits
    setText(masked)
    if (masked === '') { onChange(''); return }
    const parsed = dmyToIso(masked)
    if (parsed) onChange(parsed)
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd-mm-yyyy"
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        className={`${className} pr-8`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => (nativeRef.current as (HTMLInputElement & { showPicker?: () => void }) | null)?.showPicker?.()}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
        title="Pick from calendar"
      >
        <Calendar className="w-3.5 h-3.5" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        value={iso}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}

function parseYearRange(v: string): { start: number; end: number } | null {
  const m = v.match(/^(\d{4})(?:-(\d{4}))?$/)
  if (!m) return null
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : start
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

// There's no native year-only <input>, so this pairs a numeric text field (typed
// digits auto-format as "yyyy" or, past the 4th digit, "yyyy-yyyy") with a
// calendar-icon button that opens a decade grid for picking by click instead:
// click one year for a single value, or two years to span a range — click the
// same year twice for a single-year value.
function YearPicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const [pendingStart, setPendingStart] = useState<number | null>(null)
  const [decadeStart, setDecadeStart] = useState(() => {
    const parsed = parseYearRange(value)
    return Math.floor((parsed ? parsed.start : new Date().getFullYear()) / 10) * 10
  })
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setPendingStart(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openPicker() {
    const parsed = parseYearRange(value)
    setDecadeStart(Math.floor((parsed ? parsed.start : new Date().getFullYear()) / 10) * 10)
    setPendingStart(null)
    setOpen(true)
  }

  function handleTextChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const masked = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits
    onChange(masked)
  }

  function pickYear(y: number) {
    if (pendingStart == null) { setPendingStart(y); return }
    const start = Math.min(pendingStart, y)
    const end = Math.max(pendingStart, y)
    onChange(start === end ? String(start) : `${start}-${end}`)
    setPendingStart(null)
    setOpen(false)
  }

  const committed = pendingStart == null ? parseYearRange(value) : null
  const years = Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i)

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="yyyy or yyyy-yyyy"
          value={value}
          onFocus={openPicker}
          onChange={e => handleTextChange(e.target.value)}
          className={`${className} pr-8`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
          title="Pick a year or year range"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-60 bg-white border border-[#eae4da] rounded-lg shadow-lg p-2">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <button
              type="button"
              onClick={() => setDecadeStart(dd => dd - 10)}
              className="p-1 rounded hover:bg-[#F7F3ED] text-stone-500 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-stone-600">{decadeStart}s</span>
            <button
              type="button"
              onClick={() => setDecadeStart(dd => dd + 10)}
              className="p-1 rounded hover:bg-[#F7F3ED] text-stone-500 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-stone-400 px-1 mb-1.5 leading-snug">
            {pendingStart != null
              ? `From ${pendingStart} — click an end year (or ${pendingStart} again for a single year)`
              : 'Click a year, or click two to make a range'}
          </p>
          <div className="grid grid-cols-3 gap-1">
            {years.map(y => {
              const inDecade = y >= decadeStart && y < decadeStart + 10
              const isPendingStart = pendingStart === y
              const inCommittedRange = !!committed && y >= committed.start && y <= committed.end
              const isCommittedEdge = !!committed && (y === committed.start || y === committed.end)
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => pickYear(y)}
                  className={`text-xs font-semibold py-1.5 rounded-md cursor-pointer ${
                    isPendingStart
                      ? 'bg-[#1B3A2E] text-white ring-2 ring-[#1B3A2E]/40'
                      : isCommittedEdge
                        ? 'bg-[#1B3A2E] text-white'
                        : inCommittedRange
                          ? 'bg-[#1B3A2E]/10 text-[#1B3A2E]'
                          : inDecade ? 'text-stone-700 hover:bg-[#F7F3ED]' : 'text-stone-300 hover:bg-[#F7F3ED]'
                  }`}
                >
                  {y}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// null for blank/non-numeric so callers can tell "not entered yet" apart from 0,
// mirroring Excel's own blank-propagates-blank behavior in these formulas.
function numOrNull(v: string | undefined): number | null {
  if (v === '' || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

// Priority_Band thresholds — mirrors the workbook's own nested IF formula.
function priorityBandFor(score: number): string {
  if (score >= 4.5) return 'A – Immediate'
  if (score >= 3.5) return 'B – High'
  if (score >= 2.5) return 'C – Moderate'
  return 'D – Monitor'
}

// Recomputes every field's derived value (Month_Key from its date field,
// weighted-sum/product totals, and Risk & Priority's Priority_Score/Priority_Band)
// after any form field changes — mirrors the workbook's own formulas. Fields must be
// listed in dependency order (a field can only derive from fields earlier in the
// array) since `next` threads forward through a single pass.
function withDerivedFields(data: Record<string, string>, fields: SrmdField[]): Record<string, string> {
  let next = data
  for (const f of fields) {
    if (f.deriveMonthFrom) {
      const src = toDateInputValue(next[f.deriveMonthFrom] ?? '')
      const derived = src ? src.slice(0, 7) : ''
      if (next[f.key] !== derived) next = { ...next, [f.key]: derived }
    }
    if (f.deriveWeightedFrom) {
      const nums = f.deriveWeightedFrom.map(w => numOrNull(next[w.key]))
      let derived = ''
      if (nums.every(n => n != null)) {
        const sum = f.deriveWeightedFrom.reduce((acc, w, i) => acc + (nums[i] as number) * w.weight, 0)
        const factor = Math.pow(10, f.deriveRound ?? 1)
        derived = String(Math.round(sum * factor) / factor)
      }
      if (next[f.key] !== derived) next = { ...next, [f.key]: derived }
    }
    if (f.deriveProductFrom) {
      const nums = f.deriveProductFrom.map(k => numOrNull(next[k]))
      const derived = nums.every(n => n != null) ? String(nums.reduce((a, b) => (a as number) * (b as number), 1)) : ''
      if (next[f.key] !== derived) next = { ...next, [f.key]: derived }
    }
    if (f.deriveCustom === 'priorityScore') {
      const [riskScoreKey, significanceTotalKey] = f.deriveCustomFrom!
      const risk = numOrNull(next[riskScoreKey])
      const sig = numOrNull(next[significanceTotalKey])
      let derived = ''
      if (risk != null && sig != null) {
        const val = Math.ceil(risk / 5) * 0.4 + sig * 0.6
        derived = String(Math.round(val * 10) / 10)
      }
      if (next[f.key] !== derived) next = { ...next, [f.key]: derived }
    }
    if (f.deriveCustom === 'priorityBand') {
      const [scoreKey] = f.deriveCustomFrom!
      const score = numOrNull(next[scoreKey])
      const derived = score != null ? priorityBandFor(score) : ''
      if (next[f.key] !== derived) next = { ...next, [f.key]: derived }
    }
  }
  return next
}

function badgeMetaFor(field: string | undefined, value: unknown) {
  if (!field || value == null || value === '') return null
  if (field === 'Overall_Condition') return OVERALL_CONDITION_META[String(value)] || null
  if (field === 'Priority_Band') return PRIORITY_BAND_META[String(value)] || null
  if (field === 'Approval_Status') return APPROVAL_STATUS_META[String(value)] || null
  if (field === 'View_Type') return PHOTO_VIEW_META[String(value)] || null
  return null
}

// Yes/No fields where "Yes" specifically signals something urgent/negative (vs. e.g.
// Photo Log's Scale_Present, where "Yes" is just neutral metadata) — colored so the
// alarming ones actually stand out in the chip grid instead of reading as plain text.
const URGENT_YES_NO_FIELDS = new Set(['Immediate_Stabilization_Needed', 'Quarantine_Flag', 'Alert_Flag'])

// Colors a chip's VALUE (not just the sheet's single designated badgeField) for any
// field whose values map to a known status/severity scale — gives cards highlights
// across the fields people actually scan for (access, survey progress, condition,
// priority, approval, urgency) instead of everything reading as flat gray/black text.
// Takes the sheet slug because "Action_Type" is reused with two unrelated value
// domains — Treatment Recommendations (Stabilize/Rehouse/…) vs. Change Log
// (create/Edit/Merge/…) — and shouldn't be resolved by key name alone.
function chipHighlight(key: string, value: unknown, slug: string): string | null {
  if (value == null || value === '') return null
  const v = String(value)
  if (key === 'Access_Level') return ACCESS_LEVEL_META[v]?.badge ?? null
  if (key === 'Survey_Status') return SURVEY_STATUS_META[v]?.badge ?? null
  if (key === 'Overall_Condition') return OVERALL_CONDITION_META[v]?.badge ?? null
  if (key === 'Priority_Band') return PRIORITY_BAND_META[v]?.badge ?? null
  if (key === 'Approval_Status') return APPROVAL_STATUS_META[v]?.badge ?? null
  if (key === 'Action_Level') return ACTION_LEVEL_META[v]?.badge ?? null
  if (key === 'View_Type') return PHOTO_VIEW_META[v]?.badge ?? null
  if (key === 'Action_Type' && slug === 'change-log') return CHANGE_LOG_ACTION_TYPE_META[v]?.badge ?? null
  if (URGENT_YES_NO_FIELDS.has(key)) {
    return v === 'Yes' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  return null
}

function FormField({
  field, value, onChange, optionSets, customValues, canAddOption, onAddOption, onDeleteOption, objectIdOptions,
}: {
  field: SrmdField
  value: string
  onChange: (v: string) => void
  optionSets: Record<string, Option[]>
  customValues: Record<string, string[]>
  canAddOption: boolean
  onAddOption: (optionSetKey: string, value: string) => Promise<Option[]>
  onDeleteOption: (optionSetKey: string, value: string) => Promise<Option[]>
  objectIdOptions: Option[]
}) {
  const cls = 'w-full bg-white text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-[#eae4da] focus:outline-none focus:ring-1 focus:ring-[#1C3D27]'
  switch (field.type) {
    case 'select': {
      const opts = (field.optionSetKey ? optionSets[field.optionSetKey] : undefined) ?? field.options ?? []
      if (field.optionSetKey) {
        return (
          <SelectWithAdd
            value={value}
            onChange={onChange}
            options={opts}
            canAdd={canAddOption}
            onAddOption={v => onAddOption(field.optionSetKey!, v)}
            customValues={customValues[field.optionSetKey]}
            onDeleteOption={v => onDeleteOption(field.optionSetKey!, v)}
            className={cls}
          />
        )
      }
      return (
        <select value={value} onChange={e => onChange(e.target.value)} className={`${cls} cursor-pointer`}>
          <option value="">—</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    case 'combo': {
      const opts = (field.optionSetKey ? optionSets[field.optionSetKey] : undefined) ?? field.options ?? []
      return (
        <>
          <input
            list={`dl-${field.key}`}
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={e => {
              const v = e.target.value.trim()
              if (!v || !field.optionSetKey || !canAddOption) return
              if (opts.some(o => o.value.toLowerCase() === v.toLowerCase())) return
              onAddOption(field.optionSetKey, v).catch(() => {})
            }}
            className={cls}
          />
          <datalist id={`dl-${field.key}`}>
            {opts.map(o => <option key={o.value} value={o.value} />)}
          </datalist>
        </>
      )
    }
    case 'object-lookup':
      return (
        <SearchableSelect
          value={value}
          onChange={onChange}
          options={objectIdOptions}
          placeholder="Search object ID or name…"
          notFoundLabel={v => `${v} (not found in Inventory Master)`}
          className={cls}
        />
      )
    case 'checkbox':
      return (
        <div className="inline-flex items-center gap-4 py-1.5">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value === 'Yes'}
              onChange={e => onChange(e.target.checked ? 'Yes' : '')}
              className="w-4 h-4 rounded border-[#eae4da] accent-red-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-red-600"
            />
            <span className="text-xs font-bold text-red-700">Yes</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value === 'No'}
              onChange={e => onChange(e.target.checked ? 'No' : '')}
              className="w-4 h-4 rounded border-[#eae4da] accent-emerald-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <span className="text-xs font-bold text-emerald-700">No</span>
          </label>
        </div>
      )
    case 'textarea':
      return <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className={`${cls} resize-none`} />
    case 'date':
      return <DateInputDMY value={value} onChange={onChange} className={cls} />
    case 'year':
      return <YearPicker value={value} onChange={onChange} className={cls} />
    case 'number': {
      const derivedFrom = field.deriveWeightedFrom?.map(w => w.key) ?? field.deriveProductFrom ?? (field.deriveCustom ? field.deriveCustomFrom : undefined)
      if (derivedFrom) {
        return (
          <input
            type="text"
            value={value}
            readOnly
            title={`Auto-calculated from ${derivedFrom.join(', ')} — not editable`}
            className={`${cls} bg-stone-100 text-stone-500 cursor-not-allowed`}
          />
        )
      }
      return (
        <input
          type="number"
          value={value}
          min={field.min}
          max={field.max}
          onChange={e => {
            const raw = e.target.value
            // min/max on <input type="number"> only style validity + the spinner
            // arrows — they don't stop the user from typing an out-of-range value,
            // so a value outside the field's range is rejected here instead (the
            // keystroke is dropped; the input just doesn't change).
            if (raw !== '' && raw !== '-') {
              const num = Number(raw)
              if (Number.isNaN(num)) return
              if (field.min != null && num < field.min) return
              if (field.max != null && num > field.max) return
            }
            onChange(raw)
          }}
          className={cls}
        />
      )
    }
    case 'hidden':
      return null
    default:
      if (field.deriveMonthFrom || field.deriveCustom === 'priorityBand') {
        return (
          <input
            type="text"
            value={value}
            readOnly
            title={`Auto-filled from ${field.deriveMonthFrom ?? field.deriveCustomFrom?.join(', ')} — not editable`}
            className={`${cls} bg-stone-100 text-stone-500 cursor-not-allowed`}
          />
        )
      }
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} />
  }
}

export interface SrmdSheetViewHandle {
  openAdd: () => void
}

const SrmdSheetView = React.forwardRef<SrmdSheetViewHandle, { slug: string }>(function SrmdSheetView({ slug }, ref) {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const permissions = (session?.user as { permissions?: ViewPermissions | null } | undefined)?.permissions
  const canEdit = hasEditAccess(role, permissions, 'collections')
  const { optionSets, customValues, addOption, deleteOption } = useDropdownOptions()

  const config = getSrmdSheet(slug)!
  const emptyFormData = React.useMemo(
    () => Object.fromEntries(config.fields.map(f => [f.key, ''])) as Record<string, string>,
    [config]
  )

  const [items, setItems]   = useState<Doc[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ]           = useState('')
  const [page, setPage]     = useState(1)
  const [selected, setSelected] = useState<Doc | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>(emptyFormData)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [objectIdOptions, setObjectIdOptions] = useState<Option[]>([])
  const PAGE_SIZE = 30

  const selectFields = config.fields.filter(f => f.type === 'select')
  const activeFilterCount = Object.values(filterValues).filter(Boolean).length

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    for (const [k, v] of Object.entries(filterValues)) if (v) params.set(k, v)
    params.set('limit', String(PAGE_SIZE))
    params.set('skip', String((page - 1) * PAGE_SIZE))
    try {
      const d = await fetch(`/api/srmd/${slug}?${params}`).then(r => r.json())
      const fresh: Doc[] = d.items || []
      setItems(fresh)
      setTotal(d.total || 0)
      setSelected(prev => prev ? (fresh.find(i => i._id === prev._id) ?? prev) : null)
    } finally {
      setLoading(false)
    }
  }, [slug, q, filterValues, page])

  useEffect(() => { setPage(1) }, [q, filterValues])
  useEffect(() => { load() }, [load])
  useEffect(() => { setFilterValues({}); setQ(''); setSelected(null) }, [slug])

  useEffect(() => {
    if (!config.fields.some(f => f.type === 'object-lookup')) return
    fetch('/api/srmd/inventory/object-ids').then(r => r.json()).then(d => setObjectIdOptions(d.options || [])).catch(() => {})
  }, [config])

  function openAdd() {
    setEditingId(null)
    const today = new Date().toISOString().slice(0, 10)
    const withToday = {
      ...emptyFormData,
      ...Object.fromEntries(config.fields.filter(f => f.defaultToday).map(f => [f.key, today])),
    }
    setFormData(withDerivedFields(withToday, config.fields))
    setFormError(null)
    setFormOpen(true)
  }

  React.useImperativeHandle(ref, () => ({ openAdd }), [emptyFormData])

  function openEdit(item: Doc) {
    setEditingId(item._id)
    const fromItem = Object.fromEntries(config.fields.map(f => [f.key, item[f.key] != null ? String(item[f.key]) : '']))
    setFormData(withDerivedFields(fromItem, config.fields))
    setFormError(null)
    setFormOpen(true)
  }

  // Pics.io generates thumbnails asynchronously (~20s after upload), so right after
  // an upload finishes there's usually nothing to fetch yet. Poll a few times in the
  // background — by the time the user finishes filling out the rest of the form and
  // hits Save, the thumbnail has almost always arrived, ready to store on the record.
  function pollForThumbnail(assetId: string, attempt = 0) {
    if (attempt > 8) return
    fetch(`/api/picsio-thumbnail/${assetId}`)
      .then(r => r.json())
      .then(json => {
        if (json.thumbnail) {
          setFormData(p => ({ ...p, Photo_Thumbnail: json.thumbnail }))
        } else {
          setTimeout(() => pollForThumbnail(assetId, attempt + 1), 3000)
        }
      })
      .catch(() => setTimeout(() => pollForThumbnail(assetId, attempt + 1), 3000))
  }

  async function handleSave() {
    if (uploading) return
    setSaving(true)
    setFormError(null)
    const payload: Record<string, unknown> = {}
    for (const f of config.fields) {
      const raw = formData[f.key]
      if (raw === undefined) continue
      // When editing, an emptied field must still be sent so the clear actually
      // persists (e.g. removing a photo) — only skip truly-blank fields when
      // creating a new record, where there's nothing to clear yet.
      if (raw === '' && !editingId) continue
      payload[f.key] = f.type === 'number' ? (raw === '' ? null : Number(raw)) : raw
    }
    try {
      const res = editingId
        ? await fetch(`/api/srmd/${slug}?id=${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch(`/api/srmd/${slug}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setFormError(json?.error || 'Failed to save. Please try again.')
        return
      }
      setFormOpen(false)
      setEditingId(null)
      setFormData(emptyFormData)
      load()
    } catch (err) {
      setFormError('Failed to save. Check your connection and try again.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/srmd/${slug}?id=${id}`, { method: 'DELETE' })
    if (selected?._id === id) setSelected(null)
    load()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const chipColumns = config.columns.filter(c => c.key !== config.titleField && c.key !== config.subtitleField)

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#1B3A2E] pb-16 font-sans">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">

        {/* Search + filters */}
        <div className="bg-gradient-to-b from-white to-[#FBF9F5] border border-[#E8E3DB]/60 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-[0_1px_3px_rgba(27,58,46,0.06),0_1px_2px_rgba(27,58,46,0.04)]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#1B3A2E]/40" />
              <input
                type="text"
                placeholder={`Search ${config.label.toLowerCase()}…`}
                value={q}
                onChange={e => setQ(e.target.value)}
                className="w-full bg-[#F7F3ED]/60 text-xs font-medium py-2.5 pl-9 pr-4 rounded-lg border border-[#E8E3DB] focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 focus:bg-white transition-all text-[#1B3A2E]"
              />
            </div>
            {selectFields.length > 0 && (
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  filtersOpen || activeFilterCount
                    ? 'bg-[#1B3A2E] border-[#1B3A2E] text-white'
                    : 'bg-[#F7F3ED] border-[#E8E3DB] text-[#1B3A2E]/70 hover:bg-[#E8E3DB]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {filtersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {activeFilterCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#E8673A]" />}
              </button>
            )}
          </div>

          {filtersOpen && selectFields.length > 0 && (
            <div className="pt-3.5 border-t border-[#E8E3DB] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {selectFields.map(f => {
                const opts = (f.optionSetKey ? optionSets[f.optionSetKey] : undefined) ?? f.options ?? []
                return (
                  <div key={f.key} className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-[#1B3A2E]/50 font-mono uppercase tracking-wider">{f.label}</span>
                    <select
                      className="bg-[#F7F3ED]/60 border border-[#E8E3DB] text-xs font-semibold py-2 px-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 text-[#1B3A2E]"
                      value={filterValues[f.key] || ''}
                      onChange={e => setFilterValues(p => ({ ...p, [f.key]: e.target.value }))}
                    >
                      <option value="">All {f.label}</option>
                      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Card grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#1B3A2E]/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-[#E8E3DB] rounded-2xl p-8 sm:p-16 text-center space-y-4">
            <div className="w-12 h-12 bg-[#F7F3ED] rounded-full border border-[#E8E3DB] flex items-center justify-center mx-auto">
              <Archive className="w-5 h-5 text-[#1B3A2E]/30" />
            </div>
            <h3 className="text-sm font-bold text-[#1B3A2E]">No records found</h3>
            <p className="text-[#1B3A2E]/50 text-xs max-w-sm mx-auto leading-relaxed">
              Refine your search or filters, or add a new entry.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {items.map(item => {
              const focused = selected?._id === item._id
              const badgeVal = config.badgeField ? item[config.badgeField] : null
              const bMeta = badgeMetaFor(config.badgeField, badgeVal)
              return (
                <motion.div
                  key={item._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 0.4, ease: 'circInOut', type: 'spring' }}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelected(focused ? null : item)}
                  className={`bg-white rounded-xl border transition-shadow duration-200 cursor-pointer overflow-hidden group flex flex-col justify-between shadow-[0_1px_3px_rgba(27,58,46,0.08),0_1px_2px_rgba(27,58,46,0.05)] ${
                    focused
                      ? 'border-[#1B3A2E] ring-1 ring-[#1B3A2E] shadow-[0_8px_24px_rgba(27,58,46,0.16)]'
                      : 'border-[#E8E3DB] hover:border-[#1B3A2E]/40 hover:shadow-[0_10px_28px_rgba(27,58,46,0.14)]'
                  }`}
                >
                  {config.imageField && (
                    <div className="h-36 w-full overflow-hidden bg-stone-100 shrink-0">
                      {String(item.Photo_Thumbnail || item[config.imageField] || '').trim() ? (
                        <img
                          src={String(item.Photo_Thumbnail || item[config.imageField]).trim()}
                          alt={formatVal(item[config.titleField])}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-5 space-y-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-serif font-semibold text-stone-900 text-base sm:text-lg leading-snug group-hover:text-[#1B3A2E] transition-colors">
                        {formatVal(item[config.titleField])}
                      </h4>
                      {badgeVal != null && badgeVal !== '' && (
                        <span className={`shrink-0 px-2.5 py-1 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider border ${bMeta?.badge || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {String(badgeVal)}
                        </span>
                      )}
                    </div>
                    {config.subtitleField && (
                      <p className="text-stone-600 text-sm font-mono font-medium">{formatVal(item[config.subtitleField])}</p>
                    )}
                    {chipColumns.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-3 mt-1 border-t border-stone-200 text-sm">
                        {chipColumns.map(c => {
                          const raw = item[c.key]
                          const hi = chipHighlight(c.key, raw, slug)
                          return (
                            <div key={c.key} className="min-w-0 overflow-hidden">
                              <span className="text-stone-500 text-[11px] uppercase font-mono font-semibold tracking-wide block mb-0.5">{c.label}</span>
                              {hi ? (
                                <span className={`inline-block max-w-full truncate px-1.5 py-0.5 rounded font-bold text-[11px] uppercase tracking-wide border ${hi}`}>
                                  {formatVal(raw)}
                                </span>
                              ) : (
                                <span className="text-stone-800 font-semibold truncate block">{formatVal(raw)}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="bg-stone-50 border-t border-stone-200 py-2 px-4 flex items-center justify-end gap-1.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); openEdit(item) }} className="p-1.5 hover:bg-stone-200 text-stone-500 hover:text-stone-900 rounded-md transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => handleDelete(item._id, e)} className="p-1.5 hover:bg-red-50 text-stone-500 hover:text-red-600 rounded-md transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-xs font-mono font-medium text-[#1B3A2E]/70">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-[#E8E3DB] bg-white hover:bg-[#F7F3ED] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-[#E8E3DB] bg-white hover:bg-[#F7F3ED] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-stone-900/10 backdrop-blur-[2px] z-40 cursor-pointer" onClick={() => setSelected(null)} />
          <div className="fixed top-0 right-0 h-screen w-full max-w-[460px] bg-white border-l border-[#eae4da] shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-150 bg-[#FAF8F5]">
              <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-widest">{config.label} · Record</span>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-stone-200/50 text-stone-400 hover:text-stone-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {config.imageField && (
                <div className="relative rounded-xl overflow-hidden bg-stone-100 h-48 border border-stone-200/80 shadow-[0_4px_14px_rgba(27,58,46,0.10)]">
                  {String(selected[config.imageField] ?? '').trim() ? (
                    <img
                      src={String(selected[config.imageField]).trim()}
                      alt={formatVal(selected[config.titleField])}
                      className="w-full h-full object-cover cursor-zoom-in"
                      referrerPolicy="no-referrer"
                      onClick={() => setPreviewImg(String(selected[config.imageField!]).trim())}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-300">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-[10px] font-mono uppercase tracking-wider">No image</span>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3 shadow-[0_1px_3px_rgba(27,58,46,0.05)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {config.fields.filter(f => f.type !== 'image' && f.type !== 'hidden' && selected[f.key] != null && selected[f.key] !== '').map(f => (
                    <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : 'min-w-0 overflow-hidden'}>
                      <span className="text-[11px] font-mono text-stone-500 block uppercase font-bold">{f.label}:</span>
                      {f.type === 'textarea' ? (
                        <p className="text-stone-600 text-sm leading-relaxed bg-white p-2.5 rounded-lg border border-stone-200 mt-1 break-words">{formatVal(selected[f.key])}</p>
                      ) : (
                        <span className="font-medium text-stone-800 mt-0.5 block break-words text-sm">{formatVal(selected[f.key])}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const knownKeys = new Set(config.fields.map(f => f.key))
                const extra = Object.entries(selected).filter(([k]) => !HIDDEN_FIELDS.has(k) && !knownKeys.has(k))
                if (!extra.length) return null
                return (
                  <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3 shadow-[0_1px_3px_rgba(27,58,46,0.05)]">
                    <span className="text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider block">📋 Additional Fields</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {extra.map(([k, v]) => (
                        <div key={k} className="min-w-0 overflow-hidden">
                          <span className="text-[11px] font-mono text-stone-500 block uppercase font-bold truncate">{humanize(k)}:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words">{formatVal(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {canEdit && (
                <button
                  onClick={() => { const s = selected; setSelected(null); openEdit(s) }}
                  className="w-full bg-[#1C3D27] hover:bg-[#2D5C45] text-white text-[11px] font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Edit Entry
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add / edit form */}
      <AnimatePresence>
        {formOpen && (
          <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-xl w-full max-w-3xl border border-[#eae4da] shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-[#1C3D27] p-4 text-white flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif font-bold text-base sm:text-lg truncate">
                    {editingId ? `Edit ${config.label} Entry` : `Add ${config.label} Entry`}
                  </h3>
                  <p className="text-[9px] text-white/75 font-mono mt-0.5 uppercase tracking-widest">
                    {config.sheetTab}
                  </p>
                </div>
                <button onClick={() => { setFormOpen(false); setFormError(null) }} className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors text-white shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={e => { e.preventDefault(); handleSave() }} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
                {formError && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3.5 py-3 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {config.fields.map(f => {
                    if (f.type === 'hidden') return null
                    if (f.type === 'image') {
                      const url = formData[f.key] ?? ''
                      return (
                        <div key={f.key} className="sm:col-span-2 flex flex-col gap-2">
                          <label className="font-bold text-stone-600 block mb-1">{f.label}</label>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploading}
                              onChange={async e => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                if (file.size > 20 * 1024 * 1024) { alert('Image too large (max 20 MB)'); return }
                                setUploading(true)
                                try {
                                  const fd = new FormData()
                                  fd.append('file', file)
                                  const res = await fetch('/api/upload', { method: 'POST', body: fd })
                                  const json = await res.json()
                                  if (!res.ok) throw new Error(json.error || 'Upload failed')
                                  setFormData(p => ({ ...p, [f.key]: json.url }))
                                  if (json.fileId) pollForThumbnail(json.fileId)
                                } catch (err) {
                                  alert(`Pics.io upload failed:\n${err instanceof Error ? err.message : String(err)}`)
                                } finally {
                                  setUploading(false)
                                }
                              }}
                              className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1B3A2E] file:text-white hover:file:bg-[#2D5C45] cursor-pointer disabled:opacity-50"
                            />
                            {uploading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                                <Loader2 className="w-4 h-4 animate-spin text-[#1C3D27] mr-2" />
                                <span className="text-xs font-semibold text-[#1C3D27]">Uploading to Pics.io…</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <span className="text-xs text-stone-400 whitespace-nowrap">or paste URL:</span>
                            <input
                              type="text"
                              value={url}
                              onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                              placeholder="https://..."
                              className="flex-1 w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF]"
                            />
                          </div>
                          {url.trim() && (
                            <div className="relative rounded-xl overflow-hidden bg-stone-100 h-48 border border-stone-200">
                              <img
                                src={url.trim()}
                                alt="Preview"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={e => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-stone-400 text-xs font-mono">Could not load image</div>' }}
                              />
                              <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, [f.key]: '', Photo_Thumbnail: '' }))}
                                title="Remove image"
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-stone-900/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    }
                    if (f.type === 'checkbox') {
                      return (
                        <div key={f.key} className="flex items-center gap-2.5">
                          <span className="font-bold text-stone-600">{f.label}</span>
                          <FormField
                            field={f}
                            value={formData[f.key] ?? ''}
                            onChange={val => setFormData(p => ({ ...p, [f.key]: val }))}
                            optionSets={optionSets}
                            customValues={customValues}
                            canAddOption={canEdit}
                            onAddOption={addOption}
                            onDeleteOption={deleteOption}
                            objectIdOptions={objectIdOptions}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2 flex flex-col gap-1' : 'flex flex-col gap-1'}>
                        <label className="font-bold text-stone-600 block mb-1">
                          {f.label}{f.key === config.titleField ? ' *' : ''}
                        </label>
                        <FormField
                          field={f}
                          value={formData[f.key] ?? ''}
                          onChange={val => setFormData(p => withDerivedFields({ ...p, [f.key]: val }, config.fields))}
                          optionSets={optionSets}
                          customValues={customValues}
                          canAddOption={canEdit}
                          onAddOption={addOption}
                          onDeleteOption={deleteOption}
                          objectIdOptions={objectIdOptions}
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-stone-200">
                  <button type="button" onClick={() => { setFormOpen(false); setFormError(null) }} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-lg cursor-pointer transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formData[config.titleField] || saving || uploading}
                    title={uploading ? 'Wait for the photo upload to finish' : undefined}
                    className="px-4 py-2 bg-[#1C3D27] hover:bg-[#2A5136] text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{uploading ? 'Uploading photo…' : editingId ? 'Save Entry' : 'Add Entry'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image lightbox */}
      <AnimatePresence>
        {previewImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setPreviewImg(null)}
          >
            <motion.img
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              src={previewImg}
              alt="Preview"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

export default SrmdSheetView
