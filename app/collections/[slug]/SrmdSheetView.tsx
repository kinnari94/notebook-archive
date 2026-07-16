'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSession } from 'next-auth/react'
import { Search, Filter, Loader2, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Edit2, Trash2, Check, Archive, Image as ImageIcon } from 'lucide-react'
import { getSrmdSheet, type SrmdField } from '@/lib/srmd-sheets'
import { OVERALL_CONDITION_META, PRIORITY_BAND_META } from '@/lib/srmdLists'
import { hasEditAccess, type ViewPermissions } from '@/lib/permissions'
import { useDropdownOptions } from '@/lib/useDropdownOptions'
import type { Option } from '@/lib/dropdown-option-sets'
import SelectWithAdd from '@/components/SelectWithAdd'

type Doc = Record<string, unknown> & { _id: string }

const HIDDEN_FIELDS = new Set(['_id', '_srmd_key', 'imported_at', 'updated_at'])

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatVal(v: unknown): string {
  if (v == null || v === '') return '—'
  if (v instanceof Date) return new Date(v).toLocaleDateString()
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d.toLocaleDateString()
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

function badgeMetaFor(field: string | undefined, value: unknown) {
  if (!field || value == null || value === '') return null
  if (field === 'Overall_Condition') return OVERALL_CONDITION_META[String(value)] || null
  if (field === 'Priority_Band') return PRIORITY_BAND_META[String(value)] || null
  return null
}

function FormField({
  field, value, onChange, optionSets, customValues, canAddOption, onAddOption, onDeleteOption,
}: {
  field: SrmdField
  value: string
  onChange: (v: string) => void
  optionSets: Record<string, Option[]>
  customValues: Record<string, string[]>
  canAddOption: boolean
  onAddOption: (optionSetKey: string, value: string) => Promise<Option[]>
  onDeleteOption: (optionSetKey: string, value: string) => Promise<Option[]>
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
    case 'textarea':
      return <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className={`${cls} resize-none`} />
    case 'date':
      return <input type="date" value={toDateInputValue(value)} onChange={e => onChange(e.target.value)} className={cls} />
    case 'number':
      return <input type="number" value={value} onChange={e => onChange(e.target.value)} className={cls} />
    case 'hidden':
      return null
    default:
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
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
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

  function openAdd() {
    setEditingId(null)
    setFormData(emptyFormData)
    setFormOpen(true)
  }

  React.useImperativeHandle(ref, () => ({ openAdd }), [emptyFormData])

  function openEdit(item: Doc) {
    setEditingId(item._id)
    setFormData(Object.fromEntries(config.fields.map(f => [f.key, item[f.key] != null ? String(item[f.key]) : ''])))
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
      if (editingId) {
        await fetch(`/api/srmd/${slug}?id=${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      } else {
        await fetch(`/api/srmd/${slug}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      }
      setFormOpen(false)
      setEditingId(null)
      setFormData(emptyFormData)
      load()
    } catch (err) {
      alert('Failed to save. Check your connection and try again.')
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
      <div className="px-6 lg:px-8 py-6 space-y-8">

        {/* Search + filters */}
        <div className="bg-white border border-[#E8E3DB]/60 rounded-xl p-5 space-y-3.5">
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
          <div className="bg-white border border-[#E8E3DB] rounded-2xl p-16 text-center space-y-4">
            <div className="w-12 h-12 bg-[#F7F3ED] rounded-full border border-[#E8E3DB] flex items-center justify-center mx-auto">
              <Archive className="w-5 h-5 text-[#1B3A2E]/30" />
            </div>
            <h3 className="text-sm font-bold text-[#1B3A2E]">No records found</h3>
            <p className="text-[#1B3A2E]/50 text-xs max-w-sm mx-auto leading-relaxed">
              Refine your search or filters, or add a new entry.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(item => {
              const focused = selected?._id === item._id
              const badgeVal = config.badgeField ? item[config.badgeField] : null
              const bMeta = badgeMetaFor(config.badgeField, badgeVal)
              return (
                <div
                  key={item._id}
                  onClick={() => setSelected(focused ? null : item)}
                  className={`bg-white rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden group flex flex-col justify-between ${
                    focused ? 'border-[#1B3A2E] ring-1 ring-[#1B3A2E] shadow-sm' : 'border-[#E8E3DB]/70 hover:border-[#1B3A2E]/30 hover:shadow-sm'
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
                  <div className="p-4 space-y-2.5 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-serif font-normal text-stone-900 text-[13px] sm:text-sm leading-snug group-hover:text-stone-700 transition-colors">
                        {formatVal(item[config.titleField])}
                      </h4>
                      {badgeVal != null && badgeVal !== '' && (
                        <span className={`shrink-0 px-2 py-0.5 rounded font-mono text-[9px] font-semibold uppercase tracking-wider border ${bMeta?.badge || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {String(badgeVal)}
                        </span>
                      )}
                    </div>
                    {config.subtitleField && (
                      <p className="text-stone-500 text-[11px] font-mono">{formatVal(item[config.subtitleField])}</p>
                    )}
                    {chipColumns.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2.5 mt-1 border-t border-stone-100 text-[11px]">
                        {chipColumns.map(c => (
                          <div key={c.key} className="min-w-0 overflow-hidden">
                            <span className="text-stone-400 text-[9px] uppercase font-mono block">{c.label}</span>
                            <span className="text-stone-700 font-medium truncate block">{formatVal(item[c.key])}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="bg-stone-50/80 border-t border-stone-100 py-2 px-4 flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); openEdit(item) }} className="p-1 hover:bg-stone-100 text-stone-400 hover:text-stone-800 rounded transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => handleDelete(item._id, e)} className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-[#1B3A2E]/40">
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
                <div className="relative rounded-xl overflow-hidden bg-stone-100 h-48 border border-stone-200/80">
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
              <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  {config.fields.filter(f => f.type !== 'image' && f.type !== 'hidden' && selected[f.key] != null && selected[f.key] !== '').map(f => (
                    <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : 'min-w-0 overflow-hidden'}>
                      <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">{f.label}:</span>
                      {f.type === 'textarea' ? (
                        <p className="text-stone-600 text-[11px] leading-relaxed bg-white p-2.5 rounded-lg border border-stone-200 mt-1 break-words">{formatVal(selected[f.key])}</p>
                      ) : (
                        <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{formatVal(selected[f.key])}</span>
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
                  <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                    <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">📋 Additional Fields</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {extra.map(([k, v]) => (
                        <div key={k} className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold truncate">{humanize(k)}:</span>
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
              <div className="bg-[#1C3D27] p-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg">
                    {editingId ? `Edit ${config.label} Entry` : `Add ${config.label} Entry`}
                  </h3>
                  <p className="text-[9px] text-white/75 font-mono mt-0.5 uppercase tracking-widest">
                    {config.sheetTab}
                  </p>
                </div>
                <button onClick={() => setFormOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={e => { e.preventDefault(); handleSave() }} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
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
                          <div className="flex items-center gap-2">
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
                    return (
                      <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2 flex flex-col gap-1' : 'flex flex-col gap-1'}>
                        <label className="font-bold text-stone-600 block mb-1">
                          {f.label}{f.key === config.titleField ? ' *' : ''}
                        </label>
                        <FormField
                          field={f}
                          value={formData[f.key] ?? ''}
                          onChange={val => setFormData(p => ({ ...p, [f.key]: val }))}
                          optionSets={optionSets}
                          customValues={customValues}
                          canAddOption={canEdit}
                          onAddOption={addOption}
                          onDeleteOption={deleteOption}
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-stone-200">
                  <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-lg cursor-pointer transition-colors">
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
