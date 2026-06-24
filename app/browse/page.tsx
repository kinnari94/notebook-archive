'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, MapPin, Users, RotateCcw, Compass, X,
  ChevronDown, LayoutGrid, List, ArrowUpDown, Filter, BarChart3,
} from 'lucide-react'
import IncidentCard from '@/components/IncidentCard'
import BKStoryCard from '@/components/BKStoryCard'

type Source = 'standard' | 'bapa_katha'

const COLOR_PALETTE = [
  '#92400E','#1D4ED8','#BE185D','#B45309','#4338CA','#0F766E',
  '#B91C1C','#6D28D9','#065F46','#0E7490','#7C3AED','#15803D',
  '#C2410C','#A21CAF','#0369A1','#1E3A5F','#5B21B6','#374151',
  '#9D174D','#1C3D27','#78350F','#1e40af','#166534','#7e22ce',
]

function categoryColor(cat: string): string {
  let h = 0
  for (let i = 0; i < cat.length; i++) h = cat.charCodeAt(i) + ((h << 5) - h)
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length]
}

function categoryLabel(cat: string): string {
  return cat
    .replace(/^bk_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Browse page ──────────────────────────────────────────────────────────────

export default function Browse() {
  const [source,          setSource]          = useState<Source>('standard')
  const [allIncidents,    setAllIncidents]    = useState<any[]>([])
  const [people,          setPeople]          = useState<string[]>([])
  const [locations,       setLocations]       = useState<string[]>([])
  const [loading,         setLoading]         = useState(false)

  const [searchKeyword,   setSearchKeyword]   = useState('')
  const [selectedCategory,setSelectedCategory]= useState('')
  const [searchPerson,    setSearchPerson]    = useState('')
  const [searchLocation,  setSearchLocation]  = useState('')
  const [yearFrom,        setYearFrom]        = useState('')
  const [yearTo,          setYearTo]          = useState('')
  const [sortSequence,    setSortSequence]    = useState<'asc' | 'desc'>('asc')
  const [layoutMode,      setLayoutMode]      = useState<'grid' | 'list'>('grid')
  const [visibleCount,    setVisibleCount]    = useState(12)
  const [selectedTags,    setSelectedTags]    = useState<string[]>([])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)

  const fetchAll = useCallback(async (src: Source, filters: {
    category?: string, person?: string, location?: string,
    yearFrom?: string, yearTo?: string, q?: string
  } = {}) => {
    setLoading(true)
    setAllIncidents([])
    try {
      const PAGE = 500
      const buildParams = (skip: number) => {
        const params = new URLSearchParams({ limit: String(PAGE), skip: String(skip), source: src })
        if (filters.category) params.set('category', filters.category)
        if (filters.person)   params.set('person', filters.person)
        if (filters.location) params.set('location', filters.location)
        if (filters.yearFrom) params.set('year_from', filters.yearFrom)
        if (filters.yearTo)   params.set('year_to', filters.yearTo)
        if (filters.q)        params.set('q', filters.q)
        return params
      }
      const first = await fetch(`/api/incidents?${buildParams(0)}`).then(r => r.json())
      const collected: any[] = [...(first.incidents || [])]
      const total: number = first.total ?? collected.length
      let skip = PAGE
      while (collected.length < total) {
        const page = await fetch(`/api/incidents?${buildParams(skip)}`).then(r => r.json())
        const batch: any[] = page.incidents || []
        if (batch.length === 0) break
        collected.push(...batch)
        skip += PAGE
      }
      setAllIncidents(collected)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      fetchAll(source, {
        // category intentionally excluded — filtered client-side so counts stay accurate
        person: searchPerson,
        location: searchLocation,
        yearFrom,
        yearTo,
        q: searchKeyword,
      })
    }, searchKeyword ? 400 : 0)
    return () => clearTimeout(t)
  }, [source, searchPerson, searchLocation, yearFrom, yearTo, searchKeyword, fetchAll])

  useEffect(() => {
    fetch('/api/people').then(r => r.json()).then(d => setPeople(d.people || [])).catch(() => {})
    fetch('/api/locations').then(r => r.json()).then(d => setLocations(d.locations || [])).catch(() => {})
  }, [source])

  const CANONICAL_TAGS = [
    'train', 'bus', 'cycle', 'walking', 'running', 'boating', 'beach', 'snow',
    'dining_table', 'phone_call', 'night_satsang', 'games_playfulness', 'jeevdaya',
    'monument', 'visionary', 'seva', 'informal_youth', 'he_as_devotee', 'relation_pkd',
    'sadhana', 'family_member', 'study_group', 'closing_accounts', 'question_answer',
    'meditation', 'dhyan', 'bhedjnan', 'inner_state', 'same_incident_diff_ajna', 'gurudev_as_child',
  ]

  const clearFilters = () => {
    setSearchKeyword(''); setSelectedCategory(''); setSearchPerson('')
    setSearchLocation(''); setYearFrom(''); setYearTo(''); setSelectedTags([]); setVisibleCount(12)
  }

  const handleSourceChange = (s: Source) => { setSource(s); clearFilters() }

  // Category counts from loaded data — each record counted once (primary category only)
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {}
    allIncidents.forEach(inc => {
      const primary: string | undefined = inc.categories?.[0] ?? inc.category ?? undefined
      if (primary) stats[primary] = (stats[primary] || 0) + 1
    })
    return stats
  }, [allIncidents])

  const availableCategories = useMemo(() => Object.keys(categoryStats).sort(), [categoryStats])

  // Client-side filter + sort
  const filteredIncidents = useMemo(() => {
    let result = [...allIncidents]
    if (selectedCategory) {
      result = result.filter(i => {
        const primary: string | undefined = i.categories?.[0] ?? i.category ?? undefined
        return primary === selectedCategory
      })
    }
    if (selectedTags.length > 0)
      result = result.filter(i => selectedTags.every(t => i.tags?.includes(t)))
    result.sort((a, b) => {
      const ya = a.date?.year ?? 9999, yb = b.date?.year ?? 9999
      return sortSequence === 'asc' ? ya - yb : yb - ya
    })
    return result
  }, [allIncidents, sortSequence, selectedTags, selectedCategory])

  const visibleIncidents = useMemo(() => filteredIncidents.slice(0, visibleCount), [filteredIncidents, visibleCount])

  const hasActiveFilters = selectedCategory || searchKeyword || searchPerson || searchLocation || yearFrom || yearTo || selectedTags.length > 0

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1c1917] pb-24 px-4 sm:px-6 lg:px-8 pt-8">

      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-[#eae4da]/80">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#1C3D27] leading-none">
            Browse Archive
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {/* Source toggle */}
            <div className="bg-[#f3eee5] p-1 rounded-lg flex items-center border border-[#eae4da]">
              <button onClick={() => handleSourceChange('standard')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${source === 'standard' ? 'bg-white text-[#1c1917] shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
                Standard Records
              </button>
              <button onClick={() => handleSourceChange('bapa_katha')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${source === 'bapa_katha' ? 'bg-white text-[#1c1917] shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
                Bapa Katha
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Category pills */}
      <section className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-500 font-mono">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>CATEGORY</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3 bg-[#eae4da]/15 rounded-xl border border-[#eae4da]/50">
          <button onClick={() => { setSelectedCategory(''); setVisibleCount(12) }}
            className={`px-3.5 py-1 rounded-full text-[11px] font-semibold border transition-all uppercase tracking-wider ${
              selectedCategory === '' ? 'bg-[#564940] text-white border-[#564940]' : 'bg-white text-stone-600 hover:bg-[#FAF6F1] border-[#E9E4DF]'
            }`}>
            All ({allIncidents.length})
          </button>
          {availableCategories.map(cat => {
            const accent = categoryColor(cat)
            const label = categoryLabel(cat)
            const isSelected = selectedCategory === cat
            const count = categoryStats[cat] || 0
            return (
              <button key={cat} onClick={() => { setSelectedCategory(isSelected ? '' : cat); setVisibleCount(12) }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-all uppercase tracking-wider ${
                  isSelected ? 'font-bold scale-[1.02]' : 'bg-white hover:bg-stone-50 border-[#E9E4DF]'
                }`}
                style={isSelected
                  ? { backgroundColor: accent + '15', color: accent, borderColor: accent }
                  : { color: accent }
                }>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                {label}
                <span className={`text-[10px] font-mono px-1 rounded-sm ${isSelected ? 'bg-white/70 text-stone-800' : 'bg-stone-100/70 text-stone-400'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <main className="max-w-7xl mx-auto">

        {/* Filter panel */}
        <section className="bg-white rounded-2xl border border-[#eae4da] p-5 sm:p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#eae4da]/40">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#1C3D27]" />
              <h3 className="font-serif text-[#1C3D27] text-base font-bold">Filters</h3>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Keyword */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-stone-500 tracking-wide uppercase">Keyword Search</label>
              <div className="relative">
                <input type="text" placeholder="Search descriptions, transcripts…"
                  value={searchKeyword}
                  onChange={e => { setSearchKeyword(e.target.value); setVisibleCount(12) }}
                  className="w-full bg-[#fcfbfa] text-[#1c1917] placeholder-stone-400 rounded-lg pl-3 pr-8 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF]" />
                {searchKeyword
                  ? <button onClick={() => setSearchKeyword('')} className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700"><X className="w-3.5 h-3.5" /></button>
                  : <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-stone-400/80" />}
              </div>
            </div>

            {/* Person */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-stone-500 tracking-wide uppercase">Person</label>
              <div className="relative">
                <select value={searchPerson} onChange={e => { setSearchPerson(e.target.value); setVisibleCount(12) }}
                  className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] appearance-none pr-8 border border-[#E9E4DF]">
                  <option value="">All People</option>
                  {people.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 w-3.5 h-3.5 text-stone-400" />
              </div>
            </div>

            {/* Location */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-stone-500 tracking-wide uppercase">Location</label>
              <div className="relative">
                <select value={searchLocation} onChange={e => { setSearchLocation(e.target.value); setVisibleCount(12) }}
                  className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] appearance-none pr-8 border border-[#E9E4DF]">
                  <option value="">All Locations</option>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 w-3.5 h-3.5 text-stone-400" />
              </div>
            </div>

            {/* Year range */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-stone-500 tracking-wide uppercase">Year Range</label>
              <div className="flex items-center gap-1.5">
                <input type="number" placeholder="From" value={yearFrom}
                  onChange={e => { setYearFrom(e.target.value); setVisibleCount(12) }}
                  className="w-1/2 bg-[#fcfbfa] text-[#1c1917] placeholder-stone-400 text-center rounded-lg py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF] font-mono" />
                <span className="text-stone-400 text-[10px] font-bold">–</span>
                <input type="number" placeholder="To" value={yearTo}
                  onChange={e => { setYearTo(e.target.value); setVisibleCount(12) }}
                  className="w-1/2 bg-[#fcfbfa] text-[#1c1917] placeholder-stone-400 text-center rounded-lg py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF] font-mono" />
              </div>
            </div>
            {/* Tags multiselect */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-[11px] font-bold text-stone-500 tracking-wide uppercase">Tags</label>
              <button
                onClick={() => setTagDropdownOpen(v => !v)}
                className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF] flex items-center justify-between gap-2 text-left"
              >
                <span className="truncate text-stone-500">
                  {selectedTags.length === 0 ? 'Any tags' : selectedTags.map(t => t.replace(/_/g, ' ')).join(', ')}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {tagDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E9E4DF] rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto py-1">
                  {CANONICAL_TAGS.map(tag => {
                    const active = selectedTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          setSelectedTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])
                          setVisibleCount(12)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors ${active ? 'bg-[#1C3D27]/5 text-[#1C3D27] font-bold' : 'text-stone-600 hover:bg-stone-50'}`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? 'bg-[#1C3D27] border-[#1C3D27]' : 'border-stone-300'}`}>
                          {active && <span className="text-white text-[8px] font-bold">✓</span>}
                        </span>
                        {tag.replace(/_/g, ' ')}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Active filter tags */}
          {hasActiveFilters && (
            <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">Active:</span>
              {searchKeyword && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-indigo-100">
                  "{searchKeyword}" <button onClick={() => setSearchKeyword('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-800 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-stone-200">
                  {categoryLabel(selectedCategory)}
                  <button onClick={() => setSelectedCategory('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {searchPerson && (
                <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-sky-100">
                  <Users className="w-3 h-3" />{searchPerson} <button onClick={() => setSearchPerson('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {searchLocation && (
                <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-teal-100">
                  <MapPin className="w-3 h-3" />{searchLocation} <button onClick={() => setSearchLocation('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {(yearFrom || yearTo) && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border border-amber-100">
                  {yearFrom || '…'} – {yearTo || '…'}
                  <button onClick={() => { setYearFrom(''); setYearTo('') }}><X className="w-3 h-3" /></button>
                </span>
              )}
              {selectedTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border border-emerald-100">
                  #{tag.replace(/_/g, ' ')}
                  <button onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Results bar */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="font-serif text-xl sm:text-2xl font-bold italic text-stone-800">
            {loading ? 'Loading…' : filteredIncidents.length === 0 ? 'No results' : `${filteredIncidents.length} Records`}
            {hasActiveFilters && !loading && (
              <span className="ml-2 text-xs text-stone-400 bg-stone-100 py-0.5 px-2 rounded-full font-mono not-italic">filtered</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setSortSequence(p => p === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              {sortSequence === 'asc' ? 'Oldest First' : 'Newest First'}
            </button>
            <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5">
              <button onClick={() => setLayoutMode('grid')}
                className={`p-1.5 rounded transition-all ${layoutMode === 'grid' ? 'bg-stone-100 text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setLayoutMode('list')}
                className={`p-1.5 rounded transition-all ${layoutMode === 'list' ? 'bg-stone-100 text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-[#eae4da] h-48 animate-pulse" />)}
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="bg-white border border-[#eae4da]/90 rounded-2xl p-16 text-center max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#fdfaf2] text-stone-400 flex items-center justify-center mx-auto border border-[#eae4da]">
                <Compass className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h3 className="text-base font-serif font-bold text-stone-800">No records matched your filters</h3>
              <p className="text-stone-500 text-sm">Try removing one or more active filters.</p>
              <button onClick={clearFilters}
                className="px-4 py-2 bg-[#1c1917] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 hover:bg-stone-800">
                <RotateCcw className="w-3.5 h-3.5" /> Clear All
              </button>
            </div>
          ) : (
            <>
              <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-4'}>
                {visibleIncidents.map((inc: any) =>
                  inc.source_type === 'bapa_katha'
                    ? <BKStoryCard key={inc._id} story={inc} layout={layoutMode} highlightQuery={searchKeyword} activeCategoryFilter={selectedCategory || undefined} />
                    : <IncidentCard key={inc._id} incident={inc} layout={layoutMode} highlightQuery={searchKeyword} />
                )}
              </div>

              {filteredIncidents.length > visibleCount && (
                <div className="mt-12 text-center">
                  <div className="inline-block bg-white border border-stone-200 rounded-full px-4 py-2 mb-3">
                    <span className="text-xs text-stone-500">
                      Viewing <span className="font-bold font-mono text-stone-800">{visibleCount}</span> of{' '}
                      <span className="font-bold font-mono text-stone-800">{filteredIncidents.length}</span>
                    </span>
                  </div>
                  <div>
                    <button onClick={() => setVisibleCount(v => v + 12)}
                      className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-full text-xs font-bold inline-flex items-center gap-2">
                      Load more
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="max-w-7xl mx-auto mt-24 pt-8 border-t border-stone-200/60 text-center">
        <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">
          Pujya Gurudevshri Biographical Archive
        </p>
      </footer>
    </div>
  )
}
