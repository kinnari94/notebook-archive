'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Plus, Filter, Archive, Edit2, Trash2, X, ChevronDown, ChevronUp, Loader2, BookMarked, Cpu, FlaskConical, Package, MapPin, Calendar, User, Folder, Ruler, Hash, Building2, Layers, Clock, ShieldCheck, Coins, BookOpen, Wrench, Leaf, AlertCircle, Lock, Image as ImageIcon, Shield, Check } from 'lucide-react'

type Mode = 'registrar' | 'dam' | 'conservator'

const MODES: { key: Mode; label: string; num: string; icon: React.ElementType }[] = [
  { key: 'registrar',   label: 'Physical Archives', num: '01', icon: BookMarked   },
  { key: 'dam',         label: 'Media Assets',       num: '02', icon: Cpu          },
  { key: 'conservator', label: 'Conservation Lab',   num: '03', icon: FlaskConical },
]

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  checked_in:   { label: 'Checked In',   dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cataloged:    { label: 'Cataloged',    dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  conservation: { label: 'Conservation', dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  displayed:    { label: 'Displayed',    dot: 'bg-purple-400',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  digitized:    { label: 'Digitized',    dot: 'bg-teal-400',    badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  on_loan:      { label: 'On Loan',      dot: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-700 border-orange-200' },
}

const MATERIAL_EMOJI_MAP: Array<[string[], string]> = [
  [['acrylic'],                                                              '✨'],
  [['box', 'carton', 'container'],                                           '📦'],
  [['glass', 'crystal', 'stained'],                                          '🫙'],
  [['metal', 'iron', 'steel', 'tin', 'zinc', 'alloy', 'pewter'],            '🔧'],
  [['brass', 'copper', 'bronze'],                                            '🔨'],
  [['gold', 'silver', 'gem', 'jewel', 'precious'],                          '💎'],
  [['organic', 'natural'],                                                   '🌿'],
  [['paper', 'document', 'parchment', 'palm leaf', 'scroll'],               '📄'],
  [['manuscript'],                                                           '📜'],
  [['plastic', 'resin', 'polymer', 'synthetic'],                            '♻️'],
  [['stone', 'rock', 'marble', 'granite', 'sandstone', 'limestone', 'slate'], '⛰️'],
  [['textile', 'fabric', 'cloth', 'cotton', 'silk', 'wool', 'linen', 'jute', 'velvet', 'satin'], '👕'],
  [['wood', 'wooden', 'timber', 'bamboo', 'cane', 'teak', 'rosewood'],     '🌲'],
  [['photo', 'photograph', 'negative', 'print', 'daguerreotype'],           '📷'],
  [['ceramic', 'clay', 'pottery', 'porcelain', 'terracotta', 'earthenware', 'stoneware'], '🏺'],
  [['leather', 'hide', 'skin'],                                              '🔖'],
  [['recording', 'audio', 'video', 'film', 'tape', 'reel'],                 '🎵'],
  [['furniture', 'chair', 'table', 'cabinet', 'chest', 'almirah'],         '🪑'],
  [['coin', 'medallion', 'stamp'],                                           '🪙'],
  [['paint', 'canvas', 'artwork', 'drawing', 'sketch'],                     '🎨'],
  [['bone', 'ivory', 'horn'],                                                '🦴'],
  [['shell', 'coral'],                                                       '🐚'],
  [['specimen', 'fossil', 'sample'],                                         '🔬'],
]

function materialIcon(mat: string): string {
  const lower = mat.toLowerCase()
  for (const [keywords, icon] of MATERIAL_EMOJI_MAP) {
    if (keywords.some(k => lower.includes(k))) return icon
  }
  return '📦'
}

const FALLBACK_EMOJIS = ['🗄️','📏','📍','🏢','⏰','🛡️','🔒','💻','⚠️','📁','📖','🗂️','🗿','⚗️','🪬','🧿','🏛️','🎭','🪆','🧩']

function buildPillIcons(mats: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  const used = new Set<string>()
  let fi = 0
  for (const mat of mats) {
    const lower = mat.toLowerCase()
    let emoji = '📦'
    for (const [keywords, e] of MATERIAL_EMOJI_MAP) {
      if (keywords.some(k => lower.includes(k))) { emoji = e; break }
    }
    if (!used.has(emoji)) {
      result[mat] = emoji
      used.add(emoji)
    } else {
      while (fi < FALLBACK_EMOJIS.length && used.has(FALLBACK_EMOJIS[fi])) fi++
      const fallback = fi < FALLBACK_EMOJIS.length ? FALLBACK_EMOJIS[fi++] : '📌'
      result[mat] = fallback
      used.add(fallback)
    }
  }
  return result
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
  material?: string
  accessionCode?: string
  newaccessionCode?: string
  legacy?: string
  title: string
  description?: string
  status: string
  qty?: string
  dimensions?: string
  packageDescription?: string
  location?: string
  conditionCategory?: string
  storageWarehouse?: string
  storageCupboard?: string
  receivedOn?: string
  givenBy?: string
  contactDetails?: string
  remarks?: string
  photoUrl?: string
  digitalizationStatus?: string
  digitalizationSewak?: string
  digitalizationFolderLink?: string
  conditionReportLink?: string
  treatmentDetails?: string
  treatmentAuthority?: string
  treatmentCategory?: string
  conservationStatus?: string
  conservationDeadline?: string
  conservationSewak?: string
  preservationCategory?: string
  preservationSolutions?: string
  preservationDeadline?: string
  preservationStatus?: string
  preservationSewak?: string
  omkarGuidance?: string
  inspectionFrequency?: string
}

const KNOWN_FIELDS = new Set([
  '_id', 'id', 'material', 'accessionCode', 'newaccessionCode', 'legacy', 'title', 'description', 'status',
  'qty', 'dimensions', 'packageDescription', 'location', 'conditionCategory',
  'storageWarehouse', 'storageCupboard', 'receivedOn', 'givenBy', 'contactDetails', 'remarks',
  'photoUrl',
  'digitalizationStatus', 'digitalizationSewak', 'digitalizationFolderLink',
  'conditionReportLink', 'treatmentDetails', 'treatmentAuthority', 'treatmentCategory',
  'conservationStatus', 'conservationDeadline', 'conservationSewak', 'preservationCategory',
  'preservationSolutions', 'preservationDeadline', 'preservationStatus', 'preservationSewak',
  'omkarGuidance', 'inspectionFrequency', 'createdAt', 'updatedAt',
])

const EMPTY: Omit<CollectionItem, '_id'> = {
  title: '', description: '', status: 'checked_in',
  qty: '', dimensions: '', location: '', conditionCategory: '',
  storageWarehouse: '', storageCupboard: '',
  receivedOn: '', givenBy: '', remarks: '', photoUrl: '',
  preservationCategory: '', preservationSolutions: '', preservationDeadline: '', preservationStatus: '',
}

export default function CollectionsPage() {
  const [items, setItems]               = useState<CollectionItem[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedStatus, setSelectedStatus]     = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState('')
  const [materials, setMaterials]               = useState<string[]>([])
  const pillIcons = React.useMemo(() => buildPillIcons(materials), [materials])
  const [filtersOpen, setFiltersOpen]   = useState(false)
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  const [formOpen, setFormOpen]         = useState(false)
  const [formData, setFormData]         = useState<Omit<CollectionItem, '_id'>>(EMPTY)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [mode, setMode]                 = useState<Mode>('registrar')
  const [page, setPage]                 = useState(1)
  const [previewImg, setPreviewImg]     = useState<string | null>(null)

  const PAGE_SIZE = 30

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQuery)      params.set('q', searchQuery)
    if (selectedStatus)   params.set('status', selectedStatus)
    if (selectedMaterial) params.set('material', selectedMaterial)
    params.set('limit', String(PAGE_SIZE))
    params.set('skip',  String((page - 1) * PAGE_SIZE))
    try {
      const d = await fetch(`/api/collections?${params}`).then(r => r.json())
      const fresh: CollectionItem[] = d.items || []
      setItems(fresh)
      setTotal(d.total || 0)
      setSelectedItem(prev => prev ? (fresh.find(i => i._id === prev._id) ?? prev) : null)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedStatus, selectedMaterial, page])

  useEffect(() => { setPage(1) }, [searchQuery, selectedStatus, selectedMaterial])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/collections?distinct=material').then(r => r.json()).then(setMaterials)
  }, [])


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
    const known: Partial<typeof rest> = {}
    for (const [k, v] of Object.entries(rest)) {
      if (KNOWN_FIELDS.has(k)) (known as Record<string, unknown>)[k] = v
    }
    setFormData({ ...EMPTY, ...known })
    setFormOpen(true)
  }

  const sm = (st: string) => STATUS_META[st] || { label: st, dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-700 border-gray-200' }
  const cond = (c?: string)  => CONDITION_META[c || ''] || null

  const BLANK_VALS = new Set(['na', 'n/a', 'none', 'nil', '-'])
  const isBlank = (v: unknown): boolean => {
    if (v == null) return true
    const s = String(v).trim()
    return s === '' || BLANK_VALS.has(s.toLowerCase())
  }

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
              {(selectedStatus || selectedMaterial) && <span className="w-1.5 h-1.5 rounded-full bg-[#E8673A]" />}
            </button>
          </div>

          {/* Material pills */}
          {materials.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedMaterial('')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
                  selectedMaterial === ''
                    ? 'bg-[#1B3A2E] text-white shadow-sm'
                    : 'bg-[#F7F3ED]/60 hover:bg-[#F7F3ED] text-[#1B3A2E]/60 border border-[#E8E3DB]/60'
                }`}
              >
                All Materials
              </button>
              {materials.map(mat => (
                <button
                  key={mat}
                  onClick={() => setSelectedMaterial(mat === selectedMaterial ? '' : mat)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 font-medium ${
                    selectedMaterial === mat
                      ? 'bg-[#1B3A2E] text-white shadow-sm'
                      : 'bg-[#F7F3ED]/60 hover:bg-[#F7F3ED] text-[#1B3A2E] border border-[#E8E3DB]/60'
                  }`}
                >
                  <span className="opacity-80">{pillIcons[mat]}</span>{mat}
                </button>
              ))}
            </div>
          )}

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
              onClick={() => { setSearchQuery(''); setSelectedStatus(''); setSelectedMaterial('') }}
              className="px-4 py-2 bg-[#1B3A2E] text-white text-xs font-bold rounded-lg hover:bg-[#2D5C45] transition-all"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(item => {
              const status = sm(item.status)
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
                  {/* Photo thumbnail — always rendered for uniform card height */}
                  <div className="h-36 w-full overflow-hidden bg-stone-100 shrink-0">
                    {item.photoUrl?.trim() ? (
                      <img
                        src={item.photoUrl.trim()}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={e => {
                          const img = e.target as HTMLImageElement
                          img.style.display = 'none'
                          img.parentElement!.classList.add('flex', 'items-center', 'justify-center')
                          const placeholder = document.createElement('div')
                          placeholder.className = 'flex flex-col items-center justify-center gap-1 text-stone-300 w-full h-full'
                          placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                          img.parentElement!.appendChild(placeholder)
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-stone-300">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Category + accession */}
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono mb-2">
                        {item.material && (
                          <span className="inline-flex items-center gap-1 text-stone-700 font-medium uppercase tracking-wider">
                            <span>{materialIcon(item.material)}</span>{item.material}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {item.newaccessionCode && (
                            <span className="text-stone-600 font-mono bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">
                              {item.newaccessionCode}
                            </span>
                          )}
                          {item.legacy && (
                            <span className="text-stone-400 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[9px]">
                              {item.legacy}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="font-serif font-normal text-stone-900 text-[13px] sm:text-sm leading-snug group-hover:text-stone-700 transition-colors">
                        {item.title}
                      </h4>

                      {/* Description */}
                      {item.description && (
                        <p className="text-stone-500 text-[11px] mt-1.5 leading-relaxed font-light">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Mode-aware meta row */}
                    <div className="pt-3 mt-2 border-t border-stone-100 flex items-start justify-between gap-2 text-[11px] font-mono text-stone-500">
                      {mode === 'registrar' && (
                        <>
                          <span className="text-stone-400 shrink-0">Vault Room:</span>
                          <span className="text-stone-800 font-semibold text-right">
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
                            ? <span className={`font-semibold ${condMeta.color}`}>{item.conditionCategory}{condMeta.label}</span>
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

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (() => {
          const totalPages = Math.ceil(total / PAGE_SIZE)
          const getPages = () => {
            const pages: (number | '…')[] = []
            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pages.push(i)
            } else {
              pages.push(1)
              if (page > 3) pages.push('…')
              for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
              if (page < totalPages - 2) pages.push('…')
              pages.push(totalPages)
            }
            return pages
          }
          return (
            <div className="flex items-center justify-between pt-2 pb-4">
              <span className="text-[10px] font-mono text-[#1B3A2E]/40">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} objects
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#E8E3DB] bg-white text-[#1B3A2E] hover:bg-[#F7F3ED] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  «
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#E8E3DB] bg-white text-[#1B3A2E] hover:bg-[#F7F3ED] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ←
                </button>
                {getPages().map((p, i) =>
                  p === '…'
                    ? <span key={`ellipsis-${i}`} className="px-1.5 text-[#1B3A2E]/30 text-xs font-mono select-none">…</span>
                    : <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          page === p
                            ? 'bg-[#1B3A2E] text-white shadow-sm'
                            : 'border border-[#E8E3DB] bg-white text-[#1B3A2E] hover:bg-[#F7F3ED]'
                        }`}
                      >
                        {p}
                      </button>
                )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#E8E3DB] bg-white text-[#1B3A2E] hover:bg-[#F7F3ED] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  →
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#E8E3DB] bg-white text-[#1B3A2E] hover:bg-[#F7F3ED] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  »
                </button>
              </div>
            </div>
          )
        })()}
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
                    className="w-full h-full object-cover cursor-zoom-in"
                    referrerPolicy="no-referrer"
                    onClick={() => setPreviewImg(selectedItem.photoUrl!.trim())}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden') }}
                  />
                ) : null}
                {!selectedItem.photoUrl?.trim() && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-300">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">No image</span>
                  </div>
                )}
                {selectedItem.newaccessionCode && (
                  <div className="absolute top-3 left-3 bg-[#1C3D27] text-white font-mono font-bold text-[10px] px-2.5 py-0.5 rounded shadow-sm">
                    {selectedItem.newaccessionCode}
                  </div>
                )}
              </div>

              {/* Category + title + description */}
              <div>
                {selectedItem.material && (
                  <span className="inline-flex items-center gap-1 bg-[#1C3D27]/5 text-[#1C3D27] border border-[#1C3D27]/15 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
                    {materialIcon(selectedItem.material)} {selectedItem.material}
                  </span>
                )}
                
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono">
                  {selectedItem.newaccessionCode && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">New: {selectedItem.newaccessionCode}</span>}
                  {selectedItem.legacy && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Legacy: {selectedItem.legacy}</span>}
                </div>

                <h3 className="font-serif text-lg font-bold text-[#1C3D27] mt-3 leading-snug">
                  {selectedItem.title}
                </h3>
                {selectedItem.description && (
                  <p className="text-stone-600 text-[12px] leading-relaxed mt-2 p-2 bg-[#FAF8F5] rounded-lg border border-stone-100 italic">
                    &ldquo;{selectedItem.description}&rdquo;
                  </p>
                )}
              </div>

              {/* Extra imported fields */}
              {(() => {
                const extra = Object.entries(selectedItem).filter(([k]) => !KNOWN_FIELDS.has(k))
                if (!extra.length) return null
                return (
                  <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                    <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">📋 Additional Fields</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {extra.map(([k, v]) => (
                        <div key={k} className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold truncate">{k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words">{String(v ?? '—')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* All fields — organized sections */}
              <div className="space-y-4">

                {/* Identification */}
                <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                  <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">🔖 Identification</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div className="min-w-0 overflow-hidden">
                      <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Catalog Status:</span>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider ${sm(selectedItem.status).badge}`}>
                        {sm(selectedItem.status).label}
                      </span>
                    </div>
                    {!isBlank(selectedItem.accessionCode) && (
                      <div className="min-w-0 overflow-hidden">
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Accession Code:</span>
                        <span className="font-medium text-stone-800 mt-0.5 block text-[11px]">{selectedItem.accessionCode}</span>
                      </div>
                    )}
                    {!isBlank(selectedItem.newaccessionCode) && (
                      <div className="min-w-0 overflow-hidden">
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">New Accession Code:</span>
                        <span className="font-medium text-stone-800 mt-0.5 block text-[11px]">{selectedItem.newaccessionCode}</span>
                      </div>
                    )}
                    {!isBlank(selectedItem.legacy) && (
                      <div className="min-w-0 overflow-hidden">
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Legacy Code:</span>
                        <span className="font-medium text-stone-800 mt-0.5 block text-[11px]">{selectedItem.legacy}</span>
                      </div>
                    )}
                    {selectedItem.qty != null && (
                      <div className="min-w-0 overflow-hidden">
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Quantity:</span>
                        <span className="font-medium text-stone-800 mt-0.5 block text-[11px]">{selectedItem.qty}</span>
                      </div>
                    )}
                    {!isBlank(selectedItem.material) && (
                      <div className="min-w-0 overflow-hidden">
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Material:</span>
                        <span className="font-medium text-stone-800 mt-0.5 block text-[11px]">{selectedItem.material}</span>
                      </div>
                    )}
                    {!isBlank(selectedItem.dimensions) && (
                      <div className="min-w-0 overflow-hidden">
                        <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Dimensions:</span>
                        <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.dimensions}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location & Storage */}
                {(!isBlank(selectedItem.storageWarehouse) || !isBlank(selectedItem.storageCupboard) || !isBlank(selectedItem.location) || !isBlank(selectedItem.packageDescription)) && (
                  <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                    <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">🗺️ Location & Storage</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      {!isBlank(selectedItem.storageWarehouse) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Vault / Warehouse:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.storageWarehouse}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.storageCupboard) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Cabinet / Drawer:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.storageCupboard}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.location) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Location / Gallery:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.location}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.packageDescription) && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Package Description:</span>
                          <p className="text-stone-600 text-[11px] leading-relaxed bg-white p-3 rounded-lg border border-stone-200 mt-1 break-words">{selectedItem.packageDescription}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Provenance & Acquisition */}
                {(!isBlank(selectedItem.receivedOn) || !isBlank(selectedItem.givenBy) || !isBlank(selectedItem.contactDetails) || !isBlank(selectedItem.remarks)) && (
                  <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                    <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">📜 Provenance & Acquisition</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      {!isBlank(selectedItem.receivedOn) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Date Received:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block text-[11px]">{selectedItem.receivedOn}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.givenBy) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Given By:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.givenBy}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.contactDetails) && (
                        <div className="col-span-2 min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Contact Details:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.contactDetails}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.remarks) && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Historical Record:</span>
                          <p className="text-stone-600 text-[11px] leading-relaxed bg-white p-3 rounded-lg border border-stone-200 mt-1 break-words">{selectedItem.remarks}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Digitalization */}
                {(!isBlank(selectedItem.digitalizationStatus) || !isBlank(selectedItem.digitalizationSewak) || selectedItem.digitalizationFolderLink) && (
                  <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                    <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">📸 Digitalization</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      {!isBlank(selectedItem.digitalizationStatus) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Status:</span>
                          <span className={`font-semibold mt-0.5 block text-[11px] ${
                            selectedItem.digitalizationStatus === 'Done' ? 'text-emerald-600' :
                            selectedItem.digitalizationStatus === 'In Progress' ? 'text-amber-600' : 'text-stone-700'
                          }`}>{selectedItem.digitalizationStatus}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.digitalizationSewak) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Sewak:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.digitalizationSewak}</span>
                        </div>
                      )}
                      {selectedItem.digitalizationFolderLink && (
                        <div className="col-span-2">
                          <a href={selectedItem.digitalizationFolderLink} target="_blank" rel="noopener noreferrer"
                            className="w-full bg-[#1C3D27] hover:bg-[#2D5C45] text-white text-[11px] font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                            <Folder className="w-3.5 h-3.5" /> Open Digital Assets Folder ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Conservation */}
                {(!isBlank(selectedItem.conditionCategory) || !isBlank(selectedItem.conservationStatus) || !isBlank(selectedItem.conservationDeadline) || !isBlank(selectedItem.conservationSewak) || !isBlank(selectedItem.inspectionFrequency) || !isBlank(selectedItem.treatmentCategory) || !isBlank(selectedItem.treatmentAuthority) || !isBlank(selectedItem.omkarGuidance) || !isBlank(selectedItem.treatmentDetails) || selectedItem.conditionReportLink) && (
                  <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                    <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">🔬 Conservation</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      {!isBlank(selectedItem.conditionCategory) && (
                        <div className="col-span-2 min-w-0">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Basic Condition:</span>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${CONDITION_META[selectedItem.conditionCategory!]?.badge || ''}`}>
                             {selectedItem.conditionCategory} {CONDITION_META[selectedItem.conditionCategory!]?.label}
                          </span>
                        </div>
                      )}
                      {!isBlank(selectedItem.conservationStatus) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Conservation Status:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.conservationStatus}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.conservationDeadline) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Conservation Deadline:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block text-[11px]">{selectedItem.conservationDeadline}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.conservationSewak) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Conservation Sewak:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.conservationSewak}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.inspectionFrequency) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Inspection Frequency:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.inspectionFrequency}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.treatmentCategory) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Treatment Category:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.treatmentCategory}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.treatmentAuthority) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Treatment Authority:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.treatmentAuthority}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.omkarGuidance) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Omkar Guidance:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.omkarGuidance}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.treatmentDetails) && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Treatment Details:</span>
                          <p className="text-stone-600 text-[11px] leading-relaxed bg-white p-3 rounded-lg border border-stone-200 mt-1 break-words">{selectedItem.treatmentDetails}</p>
                        </div>
                      )}
                      {selectedItem.conditionReportLink && (
                        <div className="col-span-2">
                          <a href={selectedItem.conditionReportLink} target="_blank" rel="noopener noreferrer"
                            className="w-full bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 text-[11px] font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                            Open Condition Report ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Preservation Plan */}
                {(!isBlank(selectedItem.preservationCategory) || !isBlank(selectedItem.preservationStatus) || !isBlank(selectedItem.preservationDeadline) || !isBlank(selectedItem.preservationSewak) || !isBlank(selectedItem.preservationSolutions)) && (
                  <div className="bg-[#FAF8F5]/90 border border-stone-200 rounded-xl p-4 space-y-3">
                    <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">🌿 Preservation Plan</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                      {!isBlank(selectedItem.preservationCategory) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Category:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.preservationCategory}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.preservationStatus) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Status:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.preservationStatus}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.preservationDeadline) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Deadline:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block text-[11px]">{selectedItem.preservationDeadline}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.preservationSewak) && (
                        <div className="min-w-0 overflow-hidden">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Sewak:</span>
                          <span className="font-medium text-stone-800 mt-0.5 block break-words text-[11px]">{selectedItem.preservationSewak}</span>
                        </div>
                      )}
                      {!isBlank(selectedItem.preservationSolutions) && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">Solutions:</span>
                          <p className="text-stone-600 text-[11px] leading-relaxed bg-white p-2.5 rounded-lg border border-stone-200 mt-1 break-words">{selectedItem.preservationSolutions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <button
                    onClick={e => { setSelectedItem(null); openEdit(selectedItem, e) }}
                    className="w-full bg-[#1C3D27] hover:bg-[#2D5C45] text-white text-[11px] font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Object
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
              onClick={e => e.stopPropagation()}
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

      {/* Accession / edit form */}
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
                    {editingId ? 'Edit Archival Asset Core File' : 'Accession New Digital Asset'}
                  </h3>
                  <p className="text-[9px] text-white/75 font-mono mt-0.5 uppercase tracking-widest">
                    {editingId ? `Holding Serial: ${items.find(i => i._id === editingId)?.accessionCode}` : 'Secures automatic generated asset code serial.'}
                  </p>
                </div>
                <button
                  onClick={() => setFormOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
                {/* Core fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-stone-600 block mb-1">Object Name / Descriptive Title *</label>
                    <input type="text" required value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold text-stone-600 block mb-1">Brief Exhibit Summary Description</label>
                    <textarea rows={2} value={formData.description || ''} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF]" />
                  </div>
                  <div>
                    <label className="font-bold text-stone-600 block mb-1">Initial Catalog Status</label>
                    <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF] cursor-pointer">
                      {Object.entries(STATUS_META).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold text-stone-600 block mb-1">Photo / Image</label>
                    <div className="flex flex-col gap-2">
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
                              setFormData(p => ({ ...p, photoUrl: json.url }))
                            } catch (err) {
                              alert(`Google Drive upload failed:\n${err instanceof Error ? err.message : String(err)}`)
                            } finally {
                              setUploading(false)
                            }
                          }}
                          className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1B3A2E] file:text-white hover:file:bg-[#2D5C45] cursor-pointer disabled:opacity-50"
                        />
                        {uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                            <Loader2 className="w-4 h-4 animate-spin text-[#1C3D27] mr-2" />
                            <span className="text-xs font-semibold text-[#1C3D27]">Uploading to Google Drive…</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400 whitespace-nowrap">or paste URL:</span>
                        <input type="text" value={formData.photoUrl || ''} onChange={e => setFormData(p => ({ ...p, photoUrl: e.target.value }))} placeholder="https://..." className="flex-1 w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF]" />
                      </div>
                    </div>
                  </div>
                  {formData.photoUrl?.trim() && (
                    <div className="sm:col-span-2">
                      <div className="rounded-xl overflow-hidden bg-stone-100 h-48 border border-stone-200">
                        <img src={formData.photoUrl.trim()} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={e => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-stone-400 text-xs font-mono">Could not load image</div>' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 🔖 Identification */}
                <div className="bg-[#FAF8F5]/80 border border-[#eae4da] p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono text-[#1C3D27] font-bold block uppercase tracking-wider">🔖 Identification</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormSectionField label="Accession Code"><FormInput value={formData.accessionCode || ''} onChange={e => setFormData(p => ({ ...p, accessionCode: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="New Accession Code"><FormInput value={formData.newaccessionCode || ''} onChange={e => setFormData(p => ({ ...p, newaccessionCode: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Legacy Code"><FormInput value={formData.legacy || ''} onChange={e => setFormData(p => ({ ...p, legacy: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Quantity"><FormInput value={formData.qty || ''} onChange={e => setFormData(p => ({ ...p, qty: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Material"><FormInput value={formData.material || ''} onChange={e => setFormData(p => ({ ...p, material: e.target.value }))} /></FormSectionField>
                  </div>
                </div>

                {/* 📦 Physical Details */}
                <div className="bg-[#FAF8F5]/80 border border-[#eae4da] p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono text-[#1C3D27] font-bold block uppercase tracking-wider">📦 Physical Details</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormSectionField label="Dimensions"><FormInput value={formData.dimensions || ''} onChange={e => setFormData(p => ({ ...p, dimensions: e.target.value }))} /></FormSectionField>
                    <div className="sm:col-span-2"><FormSectionField label="Package Description"><FormTextarea value={formData.packageDescription || ''} onChange={e => setFormData(p => ({ ...p, packageDescription: e.target.value }))} /></FormSectionField></div>
                  </div>
                </div>

                {/* 🗺️ Location & Storage */}
                <div className="bg-[#FAF8F5]/80 border border-[#eae4da] p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono text-[#1C3D27] font-bold block uppercase tracking-wider">🗺️ Location & Storage</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormSectionField label="Vault / Warehouse"><FormInput value={formData.storageWarehouse || ''} onChange={e => setFormData(p => ({ ...p, storageWarehouse: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Cabinet / Drawer ID"><FormInput value={formData.storageCupboard || ''} onChange={e => setFormData(p => ({ ...p, storageCupboard: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Location / Gallery"><FormInput value={formData.location || ''} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} /></FormSectionField>
                  </div>
                </div>

                {/* 📜 Provenance & Acquisition */}
                <div className="bg-[#FAF8F5]/80 border border-[#eae4da] p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono text-[#1C3D27] font-bold block uppercase tracking-wider">📜 Provenance & Acquisition</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormSectionField label="Date Received"><FormInput type="date" value={formData.receivedOn || ''} onChange={e => setFormData(p => ({ ...p, receivedOn: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Given By"><FormInput value={formData.givenBy || ''} onChange={e => setFormData(p => ({ ...p, givenBy: e.target.value }))} /></FormSectionField>
                    <div className="sm:col-span-2"><FormSectionField label="Contact Details"><FormInput value={formData.contactDetails || ''} onChange={e => setFormData(p => ({ ...p, contactDetails: e.target.value }))} /></FormSectionField></div>
                    <div className="sm:col-span-2"><FormSectionField label="Historical Record / Remarks"><FormTextarea value={formData.remarks || ''} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))} /></FormSectionField></div>
                  </div>
                </div>

                {/* 📸 Digitalization */}
                <div className="bg-[#FAF8F5]/80 border border-[#eae4da] p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono text-[#1C3D27] font-bold block uppercase tracking-wider">📸 Digitalization</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormSectionField label="Digitalization Status">
                      <FormInput value={formData.digitalizationStatus || ''} onChange={e => setFormData(p => ({ ...p, digitalizationStatus: e.target.value }))} placeholder="e.g. Not Started, In Progress, Done" />
                    </FormSectionField>
                    <FormSectionField label="Digitalization Sewak"><FormInput value={formData.digitalizationSewak || ''} onChange={e => setFormData(p => ({ ...p, digitalizationSewak: e.target.value }))} /></FormSectionField>
                    <div className="sm:col-span-2"><FormSectionField label="Digital Assets Folder Link"><FormInput value={formData.digitalizationFolderLink || ''} onChange={e => setFormData(p => ({ ...p, digitalizationFolderLink: e.target.value }))} /></FormSectionField></div>
                  </div>
                </div>

                {/* 🔬 Conservation */}
                <div className="bg-[#FAF8F5]/80 border border-[#eae4da] p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono text-amber-700 font-bold block uppercase tracking-wider">🔬 Conservation</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormSectionField label="Basic Condition">
                      <FormInput value={formData.conditionCategory || ''} onChange={e => setFormData(p => ({ ...p, conditionCategory: e.target.value }))}  />
                    </FormSectionField>
                    <FormSectionField label="Conservation Status"><FormInput value={formData.conservationStatus || ''} onChange={e => setFormData(p => ({ ...p, conservationStatus: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Conservation Deadline"><FormInput type="date" value={formData.conservationDeadline || ''} onChange={e => setFormData(p => ({ ...p, conservationDeadline: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Conservation Sewak"><FormInput value={formData.conservationSewak || ''} onChange={e => setFormData(p => ({ ...p, conservationSewak: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Inspection Frequency"><FormInput value={formData.inspectionFrequency || ''} onChange={e => setFormData(p => ({ ...p, inspectionFrequency: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Treatment Category"><FormInput value={formData.treatmentCategory || ''} onChange={e => setFormData(p => ({ ...p, treatmentCategory: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Treatment Authority"><FormInput value={formData.treatmentAuthority || ''} onChange={e => setFormData(p => ({ ...p, treatmentAuthority: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Omkar Guidance"><FormInput value={formData.omkarGuidance || ''} onChange={e => setFormData(p => ({ ...p, omkarGuidance: e.target.value }))} /></FormSectionField>
                    <div className="sm:col-span-2"><FormSectionField label="Treatment Details"><FormTextarea value={formData.treatmentDetails || ''} onChange={e => setFormData(p => ({ ...p, treatmentDetails: e.target.value }))} /></FormSectionField></div>
                    <div className="sm:col-span-2"><FormSectionField label="Condition Report Link"><FormInput value={formData.conditionReportLink || ''} onChange={e => setFormData(p => ({ ...p, conditionReportLink: e.target.value }))} /></FormSectionField></div>
                  </div>
                </div>

                {/* 🌿 Preservation Plan */}
                <div className="bg-[#FAF8F5]/80 border border-[#eae4da] p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono text-amber-700 font-bold block uppercase tracking-wider">🌿 Preservation Plan</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormSectionField label="Preservation Category"><FormInput value={formData.preservationCategory || ''} onChange={e => setFormData(p => ({ ...p, preservationCategory: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Preservation Status"><FormInput value={formData.preservationStatus || ''} onChange={e => setFormData(p => ({ ...p, preservationStatus: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Preservation Deadline"><FormInput type="date" value={formData.preservationDeadline || ''} onChange={e => setFormData(p => ({ ...p, preservationDeadline: e.target.value }))} /></FormSectionField>
                    <FormSectionField label="Preservation Sewak"><FormInput value={formData.preservationSewak || ''} onChange={e => setFormData(p => ({ ...p, preservationSewak: e.target.value }))} /></FormSectionField>
                    <div className="sm:col-span-2"><FormSectionField label="Preservation Solutions"><FormTextarea value={formData.preservationSolutions || ''} onChange={e => setFormData(p => ({ ...p, preservationSolutions: e.target.value }))} /></FormSectionField></div>
                  </div>
                </div>


                <div className="flex justify-end gap-2.5 pt-2 border-t border-stone-200">
                  <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-lg cursor-pointer transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={!formData.title || saving} className="px-4 py-2 bg-[#1C3D27] hover:bg-[#2A5136] text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{editingId ? 'Save Record' : 'Register Object'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

const FormSectionField = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="font-bold text-stone-500 text-xs">{label}</label>
    {children}
  </div>
);

const FormInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className="w-full bg-white text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-[#eae4da] focus:outline-none focus:ring-1 focus:ring-[#1C3D27]" />
);

const FormTextarea = ({ value, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      rows={2}
      className="w-full bg-white text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-[#eae4da] focus:outline-none focus:ring-1 focus:ring-[#1C3D27] resize-none overflow-hidden"
    />
  )
};

const FormSelect = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...props} className="w-full bg-white text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-[#eae4da] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#1C3D27]">
    {children}
  </select>
);
