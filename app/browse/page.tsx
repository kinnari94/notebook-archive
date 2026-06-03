'use client'
import { useState, useEffect, useCallback } from 'react'
import { Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import IncidentCard from '@/components/IncidentCard'
import BKStoryCard from '@/components/BKStoryCard'

const STANDARD_CATEGORIES = [
  'daily_dateline', 'health_aahar_discipline', 'spiritual_exp', 'teachings_guidance',
  'people_encounters', 'travels_journeys', 'institutional_timeline', 'seva_projects',
  'awards_accreds', 'physical_spaces', 'social_contextual', 'life_formation', 'artifacts',
]

const BK_CATEGORIES = [
  { key: 'bk_devotion',          label: 'Devotion to PKD' },
  { key: 'bk_bhakti',            label: 'Bhakti' },
  { key: 'bk_satsang',           label: 'Satsang' },
  { key: 'bk_personal_guidance', label: 'Personal Guidance' },
  { key: 'bk_visionary',         label: 'Visionary' },
  { key: 'bk_guiding_youth',     label: 'Guiding Youth' },
  { key: 'bk_dasha',             label: 'Dasha / Inner State' },
  { key: 'bk_seva',              label: 'Seva' },
  { key: 'bk_children_legacy',   label: 'Children & Legacy' },
  { key: 'bk_tributes',          label: 'Tributes' },
  { key: 'bk_satsang_deep',      label: 'Deep Satsang' },
]

type Source = 'all' | 'standard' | 'bapa_katha'
const PAGE_SIZE = 20

export default function Browse() {
  const [source,   setSource]   = useState<Source>('all')
  const [category, setCategory] = useState('')
  const [person,   setPerson]   = useState('')
  const [location, setLocation] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo,   setYearTo]   = useState('')
  const [page,     setPage]     = useState(0)
  const [people,   setPeople]   = useState<string[]>([])
  const [locations,setLocations]= useState<string[]>([])
  const [results,  setResults]  = useState<{ total: number; incidents: unknown[] }>({ total: 0, incidents: [] })
  const [loading,  setLoading]  = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    fetch('/api/people').then(r => r.json()).then(d => setPeople(d.people || []))
    fetch('/api/locations').then(r => r.json()).then(d => setLocations(d.locations || []))
  }, [])

  const fetchIncidents = useCallback(async (p = 0) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), skip: String(p * PAGE_SIZE), source })
    if (category) params.set('category', category)
    if (person)   params.set('person',   person)
    if (location) params.set('location', location)
    if (yearFrom) params.set('year_from', yearFrom)
    if (yearTo)   params.set('year_to',   yearTo)
    try {
      const d = await fetch(`/api/incidents?${params}`).then(r => r.json())
      setResults({ total: 0, incidents: [], ...d })
    } finally {
      setLoading(false)
    }
  }, [source, category, person, location, yearFrom, yearTo])

  useEffect(() => { fetchIncidents(0); setPage(0) }, [fetchIncidents])

  // Reset category when source changes to avoid cross-mode category mismatch
  const handleSourceChange = (s: Source) => { setSource(s); setCategory('') }

  const totalPages = Math.ceil(results.total / PAGE_SIZE)
  const activeCategoryOptions = source === 'bapa_katha' ? BK_CATEGORIES.map(c => ({ key: c.key, label: c.label }))
    : source === 'standard' ? STANDARD_CATEGORIES.map(c => ({ key: c, label: c.replace(/_/g, ' ') }))
    : [
        ...STANDARD_CATEGORIES.map(c => ({ key: c, label: c.replace(/_/g, ' ') })),
        ...BK_CATEGORIES.map(c => ({ key: c.key, label: `BK: ${c.label}` })),
      ]

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Browse Archive</h1>
          <p className="text-muted text-sm mt-1">{results.total.toLocaleString()} incidents found</p>
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-xl text-sm font-medium hover:bg-cream transition-colors">
          <Filter className="w-4 h-4" />Filters
        </button>
      </div>

      {/* Source toggle */}
      <div className="flex gap-2 mb-4">
        {(['all', 'standard', 'bapa_katha'] as Source[]).map(s => (
          <button key={s} onClick={() => handleSourceChange(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              source === s
                ? s === 'bapa_katha' ? 'bg-amber-500 text-white' : 'bg-ink text-white'
                : 'bg-white border border-border text-muted hover:bg-cream'
            }`}>
            {s === 'all' ? 'Both' : s === 'standard' ? 'Standard' : 'Bapa Katha'}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="bg-white border border-border rounded-2xl p-5 mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-ember/30">
              <option value="">All categories</option>
              {activeCategoryOptions.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Person</label>
            <input list="people-list" value={person} onChange={e => setPerson(e.target.value)}
              placeholder="Search people…"
              className="w-full px-3 py-2 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-ember/30" />
            <datalist id="people-list">{people.map(p => <option key={p} value={p} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Location</label>
            <input list="loc-list" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Search locations…"
              className="w-full px-3 py-2 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-ember/30" />
            <datalist id="loc-list">{locations.map(l => <option key={l} value={l} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Year From</label>
            <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)}
              placeholder="e.g. 1940"
              className="w-full px-3 py-2 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-ember/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Year To</label>
            <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)}
              placeholder="e.g. 2024"
              className="w-full px-3 py-2 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-ember/30" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-border p-5 h-40 animate-pulse" />)}
        </div>
      ) : results.incidents.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No incidents match your filters</p>
          <p className="text-sm mt-1">Try removing some filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {results.incidents.map((inc) => {
              const item = inc as { _id: string; source_type?: string }
              return item.source_type === 'bapa_katha'
                ? <BKStoryCard key={item._id} story={item as any} />
                : <IncidentCard key={item._id} incident={item as any} />
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button disabled={page === 0}
                onClick={() => { const p = page - 1; setPage(p); fetchIncidents(p) }}
                className="p-2 rounded-xl border border-border bg-white hover:bg-cream disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted">Page {page + 1} of {totalPages}</span>
              <button disabled={page >= totalPages - 1}
                onClick={() => { const p = page + 1; setPage(p); fetchIncidents(p) }}
                className="p-2 rounded-xl border border-border bg-white hover:bg-cream disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
