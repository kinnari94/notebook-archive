'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Filter, Archive, Edit2, Trash2, X, ChevronDown, ChevronUp, Loader2, BookMarked, Cpu, FlaskConical, Package, MapPin, Calendar, User, Folder, Ruler, Hash, Building2, Layers, Clock, ShieldCheck, Coins, BookOpen, Wrench, Leaf, Settings2, AlertCircle, Lock, Image as ImageIcon, Shield } from 'lucide-react'

type Mode = 'registrar' | 'dam' | 'conservator'

const MODES: { key: Mode; label: string; num: string; icon: React.ElementType }[] = [
  { key: 'registrar',   label: 'Physical Archives', num: '01', icon: BookMarked   },
  { key: 'dam',         label: 'Media Assets',       num: '02', icon: Cpu          },
  { key: 'conservator', label: 'Conservation Lab',   num: '03', icon: FlaskConical },
]

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  textiles:    { label: 'Textiles',      icon: '🧵' },
  relics:      { label: 'Relics',        icon: '📿' },
  manuscripts: { label: 'Manuscripts',   icon: '📜' },
  photographs: { label: 'Photographs',   icon: '📷' },
  recordings:  { label: 'Recordings',    icon: '🎙️' },
  furniture:   { label: 'Furniture',     icon: '🪑' },
  metal_stone: { label: 'Metal / Stone', icon: '⛏️' },
  other:       { label: 'Other',         icon: '📦' },
}

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  checked_in:   { label: 'Checked In',   dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cataloged:    { label: 'Cataloged',    dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  conservation: { label: 'Conservation', dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  displayed:    { label: 'Displayed',    dot: 'bg-purple-400',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  digitized:    { label: 'Digitized',    dot: 'bg-teal-400',    badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  on_loan:      { label: 'On Loan',      dot: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-700 border-orange-200' },
}

const CONDITION_META: Record<string, { label: string; color: string; badge: string }> = {
  A: { label: 'Needs Immediate Attention', color: 'text-red-600',     badge: 'bg-red-50 text-red-700 border-red-200' },
  B: { label: 'Can wait 1 year',           color: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  C: { label: 'Can wait 5 years',          color: 'text-yellow-600',  badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  D: { label: 'As and when required',      color: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

interface CollectionItem {
  _id?: string
  id?: string
  accessionCode?: string
  title: string
  description?: string
  category: string
  status: string
  qty?: number
  dimensions?: string
  location?: string
  conditionCategory?: string
  conservationHealth?: string
  storageWarehouse?: string
  storageCupboard?: string
  receivedOn?: string
  givenBy?: string
  remarks?: string
  photoUrl?: string
  clearance?: string
  appraisalValuation?: string
  inceptionYear?: string
  digitalizationStatus?: string
  digitalizationSewak?: string
  digitalizationFolderLink?: string
  conditionReportLink?: string
  treatmentDetails?: string
  treatmentAuthority?: string
  treatmentCategory?: string
  conservationStatus?: string
  conservationDeadline?: string
  preservationCategory?: string
  preservationSolutions?: string
  preservationDeadline?: string
  preservationStatus?: string
  omkarGuidance?: string
  inspectionFrequency?: string
}

const EMPTY: Omit<CollectionItem, '_id'> = {
  title: '', description: '', category: 'textiles', status: 'checked_in',
  qty: 1, dimensions: '', location: '', conditionCategory: 'D',
  conservationHealth: '', storageWarehouse: '', storageCupboard: '',
  receivedOn: '', givenBy: '', remarks: '', photoUrl: '',
  clearance: '', appraisalValuation: '', inceptionYear: '',
}

export default function CollectionsPage() {
  const [items, setItems]               = useState<CollectionItem[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus]     = useState('')
  const [filtersOpen, setFiltersOpen]   = useState(false)
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  const [formOpen, setFormOpen]         = useState(false)
  const [formData, setFormData]         = useState<Omit<CollectionItem, '_id'>>(EMPTY)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [mode, setMode]                 = useState<Mode>('registrar')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQuery)      params.set('q', searchQuery)
    if (selectedCategory) params.set('category', selectedCategory)
    if (selectedStatus)   params.set('status', selectedStatus)
    try {
      const d = await fetch(`/api/collections?${params}`).then(r => r.json())
      const fresh: CollectionItem[] = d.items || []
      setItems(fresh)
      setTotal(d.total || 0)
      // Keep the drawer in sync with the freshly loaded data
      setSelectedItem(prev => prev ? (fresh.find(i => i._id === prev._id) ?? prev) : null)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedCategory, selectedStatus])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    const payload = { ...formData, photoUrl: formData.photoUrl?.trim() || '' }
    try {
      if (editingId) {
        const res = await fetch(`/api/collections?id=${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Save failed: ${res.status} — ${text}`)
        }
        // Update selectedItem immediately so the drawer reflects the new data
        if (selectedItem?._id === editingId) {
          setSelectedItem({ ...selectedItem, ...payload })
        }
      } else {
        const res = await fetch('/api/collections', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Save failed')
      }
      setFormOpen(false)
      setEditingId(null)
      setFormData(EMPTY)
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
    if (!confirm('Remove this item from the collection?')) return
    await fetch(`/api/collections?id=${id}`, { method: 'DELETE' })
    if (selectedItem?._id === id) setSelectedItem(null)
    load()
  }

  function openEdit(item: CollectionItem, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(item._id!)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = item
    setFormData({ ...EMPTY, ...rest })
    setFormOpen(true)
  }

  function field(key: keyof Omit<CollectionItem, '_id'>, label: string, type = 'text', opts?: string[]) {
    return (
      <div>
        <label className="block text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider mb-1.5">{label}</label>
        {opts ? (
          <select
            value={String(formData[key] ?? '')}
            onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
          >
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={String(formData[key] ?? '')}
            onChange={e => setFormData(p => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
          />
        )}
      </div>
    )
  }

  const cm   = (cat: string) => CATEGORY_META[cat] || CATEGORY_META.other
  const sm   = (st: string)  => STATUS_META[st]     || { label: st, dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-700 border-gray-200' }
  const cond = (c?: string)  => CONDITION_META[c || ''] || null

  const statsByStatus = (key: string) => items.filter(i => i.status === key).length

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#1B3A2E] pb-16 font-sans">

      {/* Sticky header */}
      <header className="bg-white py-4 px-6 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#E8E3DB]">
          <div className="flex items-center gap-3">
            <div className="bg-[#1B3A2E] text-white p-2 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
            <h1 className="font-serif text-3xl font-bold text-[#1C3D27] tracking-tight leading-none">
              Collections Vault
            </h1>
          </div>

          <button
            onClick={() => { setFormData(EMPTY); setEditingId(null); setFormOpen(true) }}
            className="px-3.5 py-1.5 bg-[#1B3A2E] hover:bg-[#2D5C45] text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Accession New Object
          </button>
        </div>
      </header>

      {/* Stats strip + mode switcher */}
      <div className="border-b border-[#E8E3DB]/60 py-5 px-6 bg-white/60">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">

          {/* Quick stats */}
          <div className="flex items-center gap-5 text-xs">
            <div>
              <span className="text-[#1B3A2E]/40 block text-[9px] uppercase tracking-wider font-mono">Total Objects</span>
              <span className="text-sm font-semibold font-mono text-[#1B3A2E]">{total}</span>
            </div>
            <div className="w-px h-6 bg-[#E8E3DB]" />
            <div>
              <span className="text-[#1B3A2E]/40 block text-[9px] uppercase tracking-wider font-mono">On Display</span>
              <span className="text-sm font-semibold font-mono text-[#1B3A2E]">{statsByStatus('displayed')}</span>
            </div>
            <div className="w-px h-6 bg-[#E8E3DB]" />
            <div>
              <span className="text-[#1B3A2E]/40 block text-[9px] uppercase tracking-wider font-mono">In Conservation</span>
              <span className="text-sm font-semibold font-mono text-[#1B3A2E]">{statsByStatus('conservation')}</span>
            </div>
            <div className="w-px h-6 bg-[#E8E3DB]" />
            <div>
              <span className="text-[#1B3A2E]/40 block text-[9px] uppercase tracking-wider font-mono">Digitized</span>
              <span className="text-sm font-semibold font-mono text-[#1B3A2E]">{statsByStatus('digitized')}</span>
            </div>
          </div>

          {/* Mode switcher */}
          <div className="flex items-center gap-1 bg-[#F7F3ED] p-1 rounded-xl border border-[#E8E3DB]">
            {MODES.map(({ key, label, num }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${
                  mode === key
                    ? 'bg-[#1B3A2E] text-white shadow-sm'
                    : 'text-[#1B3A2E]/60 hover:bg-white/70 hover:text-[#1B3A2E]'
                }`}
              >
                <span className={`text-[10px] font-mono font-normal ${mode === key ? 'opacity-50' : 'opacity-30'}`}>{num}</span>
                <span>{label}</span>
                {mode === key && <span className="w-1.5 h-1.5 rounded-full bg-[#3ECBA0] shrink-0 animate-pulse" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6 space-y-5">

        {/* Search + filters */}
        <div className="bg-white border border-[#E8E3DB]/60 rounded-xl p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#1B3A2E]/40" />
              <input
                type="text"
                placeholder="Search by title, accession code, donor, location…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F7F3ED]/60 text-xs font-medium py-2.5 pl-9 pr-4 rounded-lg border border-[#E8E3DB] focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 focus:bg-white transition-all text-[#1B3A2E]"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(v => !v)}
              className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                filtersOpen || selectedStatus
                  ? 'bg-[#1B3A2E] border-[#1B3A2E] text-white'
                  : 'bg-[#F7F3ED] border-[#E8E3DB] text-[#1B3A2E]/70 hover:bg-[#E8E3DB]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {filtersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {selectedStatus && <span className="w-1.5 h-1.5 rounded-full bg-[#E8673A]" />}
            </button>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
                selectedCategory === ''
                  ? 'bg-[#1B3A2E] text-white shadow-sm'
                  : 'bg-[#F7F3ED]/60 hover:bg-[#F7F3ED] text-[#1B3A2E]/60 border border-[#E8E3DB]/60'
              }`}
            >
              All Artifacts
            </button>
            {Object.entries(CATEGORY_META).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key === selectedCategory ? '' : key)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 font-medium ${
                  selectedCategory === key
                    ? 'bg-[#1B3A2E] text-white shadow-sm'
                    : 'bg-[#F7F3ED]/60 hover:bg-[#F7F3ED] text-[#1B3A2E]/60 border border-[#E8E3DB]/60'
                }`}
              >
                <span className="opacity-80">{val.icon}</span>{val.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          {filtersOpen && (
            <div className="pt-3.5 border-t border-[#E8E3DB] grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-[#1B3A2E]/50 font-mono uppercase tracking-wider">Museum Holding & Asset Status</span>
                <select
                  className="bg-[#F7F3ED]/60 border border-[#E8E3DB] text-xs font-semibold py-2 px-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 text-[#1B3A2E]"
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  {Object.entries(STATUS_META).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Grid header */}
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base sm:text-lg font-normal text-[#1B3A2E] tracking-tight">
            {loading ? 'Loading…' : items.length === 0 ? 'No Catalog Records' : `Vault Objects (${total})`}
          </h2>
          <span className="text-[10px] font-mono text-[#1B3A2E]/40">
            {!loading && `${items.length} shown`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#1B3A2E]/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading collection…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-[#E8E3DB] rounded-2xl p-16 text-center space-y-4">
            <div className="w-12 h-12 bg-[#F7F3ED] rounded-full border border-[#E8E3DB] flex items-center justify-center mx-auto">
              <Archive className="w-5 h-5 text-[#1B3A2E]/30" />
            </div>
            <h3 className="text-sm font-bold text-[#1B3A2E]">No objects match selected criteria</h3>
            <p className="text-[#1B3A2E]/50 text-xs max-w-sm mx-auto leading-relaxed">
              Refine your keywords or reset filters to restore catalog access.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory(''); setSelectedStatus('') }}
              className="px-4 py-2 bg-[#1B3A2E] text-white text-xs font-bold rounded-lg hover:bg-[#2D5C45] transition-all"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(item => {
              const meta     = cm(item.category)
              const status   = sm(item.status)
              const condMeta = cond(item.conditionCategory)
              const focused  = selectedItem?._id === item._id

              return (
                <div
                  key={item._id}
                  onClick={() => setSelectedItem(focused ? null : item)}
                  className={`bg-white rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden group flex flex-col justify-between ${
                    focused
                      ? 'border-[#1B3A2E] ring-1 ring-[#1B3A2E] shadow-sm'
                      : 'border-[#E8E3DB]/70 hover:border-[#1B3A2E]/30 hover:shadow-sm'
                  }`}
                >
                  {/* Photo thumbnail */}
                  {item.photoUrl?.trim() && (
                    <div className="h-36 w-full overflow-hidden bg-stone-100">
                      <img
                        src={item.photoUrl.trim()}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                      />
                    </div>
                  )}

                  {/* Card body */}
                  <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Category + accession */}
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono mb-2">
                        <span className="inline-flex items-center gap-1">
                          <span>{meta.icon}</span>
                          <span className="text-stone-500 font-medium uppercase tracking-wider">{meta.label}</span>
                        </span>
                        {item.accessionCode && (
                          <span className="text-stone-400 font-mono bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">
                            {item.accessionCode}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="font-serif font-normal text-stone-900 text-[13px] sm:text-sm leading-snug line-clamp-2 group-hover:text-stone-700 transition-colors">
                        {item.title}
                      </h4>

                      {/* Description */}
                      {item.description && (
                        <p className="text-stone-500 text-[11px] line-clamp-2 mt-1.5 leading-relaxed font-light">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Mode-aware meta row */}
                    <div className="pt-3 mt-2 border-t border-stone-100 flex items-center justify-between text-[11px] font-mono text-stone-500">
                      {mode === 'registrar' && (
                        <>
                          <span className="text-stone-400">Vault Room:</span>
                          <span className="text-stone-800 font-semibold truncate max-w-[160px]">
                            {item.storageWarehouse || item.location || '—'}
                          </span>
                        </>
                      )}
                      {mode === 'dam' && (
                        <>
                          <span className="text-stone-400">Digitalization:</span>
                          <span className={`font-semibold ${
                            item.digitalizationStatus === 'Done'        ? 'text-emerald-600' :
                            item.digitalizationStatus === 'In Progress' ? 'text-amber-600'   :
                            'text-stone-400 italic font-normal'
                          }`}>
                            {item.digitalizationStatus || 'Not started'}
                          </span>
                        </>
                      )}
                      {mode === 'conservator' && (
                        <>
                          <span className="text-stone-400">Condition:</span>
                          {condMeta
                            ? <span className={`font-semibold ${condMeta.color}`}>Cat {item.conditionCategory} — {condMeta.label}</span>
                            : <span className="text-stone-400 italic font-normal">Not assessed</span>
                          }
                        </>
                      )}
                    </div>
                  </div>

                  {/* Footer status stripe */}
                  <div className="bg-stone-50/80 border-t border-stone-100 py-2 px-4 flex items-center justify-between text-[10px]">
                    <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-semibold uppercase tracking-wider border ${status.badge}`}>
                      {status.label}
                    </span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => openEdit(item, e)}
                        className="p-1 hover:bg-stone-100 text-stone-400 hover:text-stone-800 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => handleDelete(item._id!, e)}
                        className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedItem && (
        <>
          <div
            className="fixed inset-0 bg-stone-900/10 backdrop-blur-[2px] z-40 cursor-pointer"
            onClick={() => setSelectedItem(null)}
          />
          <div className="fixed top-0 right-0 h-screen w-full max-w-[460px] bg-white border-l border-[#eae4da] shadow-2xl z-50 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-150 bg-[#FAF8F5]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1C3D27]" />
                <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-widest leading-none">Vault Object Details</span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 hover:bg-stone-200/50 text-stone-400 hover:text-stone-700 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Photo */}
              <div className="relative rounded-xl overflow-hidden bg-stone-100 h-48 border border-stone-200/80">
                {selectedItem.photoUrl?.trim() ? (
                  <img
                    src={selectedItem.photoUrl.trim()}
                    alt={selectedItem.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden') }}
                  />
                ) : null}
                {!selectedItem.photoUrl?.trim() && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-300">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">No image</span>
                  </div>
                )}
                {selectedItem.accessionCode && (
                  <div className="absolute top-3 left-3 bg-[#1C3D27] text-white font-mono font-bold text-[10px] px-2.5 py-0.5 rounded shadow-sm">
                    {selectedItem.accessionCode}
                  </div>
                )}
              </div>

              {/* Category + title + description */}
              <div>
                <span className="inline-flex items-center gap-1 bg-[#1C3D27]/5 text-[#1C3D27] border border-[#1C3D27]/15 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
                  {cm(selectedItem.category).icon} {cm(selectedItem.category).label}
                </span>
                <h3 className="font-serif text-lg font-bold text-[#1C3D27] mt-3 leading-snug">
                  {selectedItem.title}
                </h3>
                {selectedItem.description && (
                  <p className="text-stone-600 text-[12px] leading-relaxed mt-2 p-2 bg-[#FAF8F5] rounded-lg border border-stone-100 italic">
                    &ldquo;{selectedItem.description}&rdquo;
                  </p>
                )}
              </div>

              {/* Metadata panel */}
              <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2.5 border-b border-stone-200 text-stone-800">
                  <Settings2 className="w-4 h-4 text-[#1C3D27]" />
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider">
                    {mode === 'registrar'   && '🏛️ Physical Archives Metadata'}
                    {mode === 'dam'         && '📸 Media Asset Specifications'}
                    {mode === 'conservator' && '🔬 Preservation Condition & State'}
                  </span>
                </div>

                {/* ── Registrar ── */}
                {mode === 'registrar' && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Secure Storage Location:</span>
                        <span className="font-semibold text-stone-800 flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">{selectedItem.storageWarehouse || selectedItem.location || '—'}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Cabinet / Drawer ID:</span>
                        <span className="font-semibold text-stone-800 flex items-center gap-1.5 mt-1">
                          <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{selectedItem.storageCupboard || 'Unassigned / Vault Row'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Inception Historical Year:</span>
                        <span className="font-medium text-stone-800 flex items-center gap-1.5 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          {selectedItem.inceptionYear ? `circa ${selectedItem.inceptionYear} AD` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Date Received:</span>
                        <span className="font-medium text-stone-800 flex items-center gap-1.5 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          {selectedItem.receivedOn || 'Legacy accession'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Clearance &amp; Security:</span>
                        <span className="font-semibold flex items-center gap-1.5 mt-1 text-[11px]">
                          <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 uppercase font-mono text-[9px]">
                            {selectedItem.clearance || 'Public'}
                          </span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Appraisal Valuation:</span>
                        <span className="font-semibold text-stone-800 flex items-center gap-1.5 mt-1">
                          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{selectedItem.appraisalValuation || 'Heritage Valued'}</span>
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Entrustee / Original Owner:</span>
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5 mt-1">
                        <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>{selectedItem.givenBy || 'Archival Legacy Acquisition'}</span>
                      </span>
                    </div>

                    {selectedItem.remarks && (
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Historical Provenance Record:</span>
                        <span className="font-sans text-[11px] text-stone-600 block mt-1 leading-relaxed bg-white p-3 rounded-lg border border-stone-200">
                          {selectedItem.remarks}
                        </span>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={e => { setSelectedItem(null); openEdit(selectedItem, e) }}
                        className="w-full bg-[#1C3D27] hover:bg-[#2D5C45] text-white text-[11px] font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit Object
                      </button>
                    </div>
                  </div>
                )}

                {/* ── DAM ── */}
                {mode === 'dam' && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Digitalization Status:</span>
                        <span className={`font-semibold mt-1 block ${
                          selectedItem.digitalizationStatus === 'Done' ? 'text-emerald-600' :
                          selectedItem.digitalizationStatus === 'In Progress' ? 'text-amber-600' : 'text-stone-500'
                        }`}>{selectedItem.digitalizationStatus || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Digitalization Sewak:</span>
                        <span className="font-medium text-stone-800 flex items-center gap-1.5 mt-1">
                          <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          {selectedItem.digitalizationSewak || '—'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Given By:</span>
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5 mt-1">
                        <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        {selectedItem.givenBy || '—'}
                      </span>
                    </div>
                    {selectedItem.digitalizationFolderLink && (
                      <div className="pt-2 border-t border-stone-200">
                        <a href={selectedItem.digitalizationFolderLink} target="_blank" rel="noopener noreferrer"
                          className="w-full bg-[#1C3D27] hover:bg-[#2D5C45] text-white text-[11px] font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                          <Folder className="w-4 h-4" /> Open Digital Assets Folder ↗
                        </a>
                      </div>
                    )}
                    <div className="pt-2">
                      <button
                        onClick={e => { setSelectedItem(null); openEdit(selectedItem, e) }}
                        className="w-full bg-[#1C3D27] hover:bg-[#2D5C45] text-white text-[11px] font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit Object
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Conservator ── */}
                {mode === 'conservator' && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Condition Category:</span>
                        <div className="mt-1">
                          {selectedItem.conditionCategory ? (
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${CONDITION_META[selectedItem.conditionCategory]?.badge || ''}`}>
                              Cat {selectedItem.conditionCategory} — {CONDITION_META[selectedItem.conditionCategory]?.label}
                            </span>
                          ) : <span className="text-stone-400">—</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Conservation Health:</span>
                        <span className="font-semibold text-stone-800 mt-1 block">{selectedItem.conservationHealth || '—'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Conservation Status:</span>
                        <span className="font-medium text-stone-800 mt-1 block">{selectedItem.conservationStatus || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Conservation Deadline:</span>
                        <span className="font-medium text-stone-800 flex items-center gap-1.5 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          {selectedItem.conservationDeadline || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-stone-200">
                      <div>
                        <span className="text-[8.5px] font-mono text-stone-400 uppercase font-bold block">Inspection Freq:</span>
                        <span className="text-stone-800 font-semibold mt-0.5 block text-[10.5px]">{selectedItem.inspectionFrequency || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] font-mono text-stone-400 uppercase font-bold block">Treatment:</span>
                        <span className="text-stone-800 font-semibold mt-0.5 block text-[10.5px]">{selectedItem.treatmentCategory || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] font-mono text-stone-400 uppercase font-bold block">Authority:</span>
                        <span className="text-stone-800 font-semibold mt-0.5 block truncate text-[10.5px]" title={selectedItem.treatmentAuthority}>{selectedItem.treatmentAuthority || '—'}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Omkar Guidance:</span>
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5 mt-1">
                        <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        {selectedItem.omkarGuidance || '—'}
                      </span>
                    </div>

                    {selectedItem.treatmentDetails && (
                      <div>
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Treatment Details:</span>
                        <p className="text-stone-600 text-[11px] leading-relaxed bg-white p-3 rounded-lg border border-stone-200 mt-1 italic">
                          &ldquo;{selectedItem.treatmentDetails}&rdquo;
                        </p>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col gap-2">
                      {selectedItem.conditionReportLink && (
                        <a href={selectedItem.conditionReportLink} target="_blank" rel="noopener noreferrer"
                          className="w-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 text-[11px] font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                          Open Condition Report ↗
                        </a>
                      )}
                      <button
                        onClick={e => { setSelectedItem(null); openEdit(selectedItem, e) }}
                        className="w-full bg-[#1C3D27] hover:bg-[#2D5C45] text-white text-[11px] font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit Object
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Accession / edit form */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setFormOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-serif text-lg font-semibold text-stone-900">
                  {editingId ? 'Edit Object' : 'Accession New Object'}
                </h2>
                <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mt-0.5">
                  {mode === 'registrar' ? '🏛️ Physical Archives' : mode === 'dam' ? '📸 Media Assets' : '🔬 Conservation Lab'}
                </p>
              </div>
              <button onClick={() => setFormOpen(false)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Always-present core fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">{field('title', 'Title *')}</div>
                <div className="sm:col-span-2">{field('description', 'Description')}</div>
                {field('category', 'Category', 'text', Object.keys(CATEGORY_META))}
                {field('status', 'Status', 'text', Object.keys(STATUS_META))}
                {field('accessionCode', 'Accession Code')}
                {field('qty', 'Quantity', 'number')}
                <div className="sm:col-span-2">{field('photoUrl', 'Photo URL')}</div>
                {formData.photoUrl?.trim() && (
                  <div className="sm:col-span-2">
                    <div className="rounded-xl overflow-hidden bg-stone-100 h-48 border border-stone-200">
                      <img
                        src={formData.photoUrl.trim()}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={e => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-stone-400 text-xs font-mono">Could not load image</div>' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Registrar fields */}
              {mode === 'registrar' && (
                <>
                  <div className="pt-1 border-t border-stone-100">
                    <p className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider mb-3">Physical Archives</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {field('storageWarehouse', 'Secure Storage Location')}
                      {field('storageCupboard', 'Cabinet / Drawer ID')}
                      {field('location', 'Location')}
                      {field('inceptionYear', 'Inception Historical Year')}
                      {field('receivedOn', 'Date Received')}
                      {field('clearance', 'Clearance & Security')}
                      {field('appraisalValuation', 'Appraisal Valuation')}
                      {field('dimensions', 'Dimensions (cm)')}
                      <div className="sm:col-span-2">{field('givenBy', 'Entrustee / Original Owner')}</div>
                      <div className="sm:col-span-2">{field('remarks', 'Historical Provenance Record')}</div>
                    </div>
                  </div>
                </>
              )}

              {/* DAM fields */}
              {mode === 'dam' && (
                <div className="pt-1 border-t border-stone-100">
                  <p className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider mb-3">Media Assets</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {field('digitalizationStatus', 'Digitalization Status', 'text', ['Not Started', 'In Progress', 'Done'])}
                    {field('digitalizationSewak', 'Digitalization Sewak')}
                    <div className="sm:col-span-2">{field('digitalizationFolderLink', 'Digital Assets Folder Link')}</div>
                    <div className="sm:col-span-2">{field('givenBy', 'Given By')}</div>
                  </div>
                </div>
              )}

              {/* Conservator fields */}
              {mode === 'conservator' && (
                <div className="pt-1 border-t border-stone-100">
                  <p className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider mb-3">Conservation Lab</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {field('conditionCategory', 'Condition Category', 'text', ['A', 'B', 'C', 'D'])}
                    {field('conservationHealth', 'Conservation Health')}
                    {field('conservationStatus', 'Conservation Status')}
                    {field('conservationDeadline', 'Conservation Deadline')}
                    {field('inspectionFrequency', 'Inspection Frequency')}
                    {field('treatmentCategory', 'Treatment Category')}
                    {field('treatmentAuthority', 'Treatment Authority')}
                    {field('omkarGuidance', 'Omkar Guidance')}
                    <div className="sm:col-span-2">{field('treatmentDetails', 'Treatment Details')}</div>
                    <div className="sm:col-span-2">{field('conditionReportLink', 'Condition Report Link')}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-stone-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setFormOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.title || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1B3A2E] text-white rounded-xl text-sm font-semibold hover:bg-[#2D5C45] disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Save Changes' : 'Accession Object'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

