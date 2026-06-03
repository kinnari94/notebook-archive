'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import IncidentCard from '@/components/IncidentCard'
import BKStoryCard from '@/components/BKStoryCard'

const STANDARD_CATEGORIES = [
  { key: 'daily_dateline',          label: 'Daily Dateline' },
  { key: 'health_aahar_discipline', label: 'Health & Discipline' },
  { key: 'spiritual_exp',           label: 'Spiritual Experiences' },
  { key: 'teachings_guidance',      label: 'Teachings & Guidance' },
  { key: 'people_encounters',       label: 'People & Encounters' },
  { key: 'travels_journeys',        label: 'Travels & Journeys' },
  { key: 'institutional_timeline',  label: 'Institutional' },
  { key: 'seva_projects',           label: 'Seva Projects' },
  { key: 'awards_accreds',          label: 'Awards & Recognition' },
  { key: 'physical_spaces',         label: 'Physical Spaces' },
  { key: 'social_contextual',       label: 'Social & Contextual' },
  { key: 'life_formation',          label: 'Life Formation' },
  { key: 'artifacts',               label: 'Artifacts' },
]

const BK_CATEGORIES = [
  { key: 'bk_line_that_changed_me',   label: 'The Line That Changed Me' },
  { key: 'bk_shared_events',          label: 'Shared Events' },
  { key: 'bk_first_meeting',          label: 'First Meeting' },
  { key: 'bk_humour',                 label: 'Humorous Prasangs' },
  { key: 'bk_one_ajna',               label: 'One Ajna / Guidance' },
  { key: 'bk_the_object',             label: 'The Object' },
  { key: 'bk_discipline_training',    label: 'Discipline / Training' },
  { key: 'bk_dasha_family',           label: 'Dasha / Family Observations' },
  { key: 'bk_non_jain',               label: "Non-Jain in Bapa's Circle" },
  { key: 'bk_he_found_me_first',      label: 'He Found Me First' },
  { key: 'bk_he_doesnt_see_time',     label: "He Doesn't See Time" },
  { key: 'bk_vision_behind_projects', label: 'Vision Behind Projects' },
  { key: 'bk_compassion_seva',        label: 'Compassion / Seva' },
  { key: 'bk_children_teaching',      label: 'Children / Teaching Through Play' },
  { key: 'bk_satsang_transformation', label: 'Satsang / Transformation' },
  { key: 'bk_love_for_pkd',           label: 'Love for PKD / Bhakti' },
  { key: 'bk_letters_mails',          label: 'Letters / Mails' },
]

type Source = 'standard' | 'bapa_katha'
const PAGE_SIZE = 20

export default function Browse() {
  const [source,   setSource]   = useState<Source>('standard')
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

  const activeCategoryOptions = source === 'bapa_katha' ? BK_CATEGORIES : STANDARD_CATEGORIES

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

  const handleSourceChange = (s: Source) => { setSource(s); setCategory('') }

  const totalPages = Math.ceil(results.total / PAGE_SIZE)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-ink">Browse Archive</h1>
        <p className="text-muted text-sm mt-1">{results.total.toLocaleString()} incidents found</p>
      </div>

      {/* Source toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => handleSourceChange('standard')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            source === 'standard' ? 'bg-ink text-white' : 'bg-white border border-border text-muted hover:bg-cream'
          }`}>
          Standard
        </button>
        <button onClick={() => handleSourceChange('bapa_katha')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            source === 'bapa_katha' ? 'bg-amber-500 text-white' : 'bg-white border border-border text-muted hover:bg-cream'
          }`}>
          Bapa Katha
        </button>
      </div>

      {/* Filters */}
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
