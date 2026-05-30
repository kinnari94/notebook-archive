'use client'
import { useState, useEffect } from 'react'
import IncidentCard from '@/components/IncidentCard'

interface YearData {
  _id: number
  count: number
  categories: string[]
  incidents: { desc: string; cat: string; id: string }[]
}

const CATEGORY_COLORS: Record<string, string> = {
  daily_dateline: '#3B82F6', spiritual_exp: '#8B5CF6', teachings_guidance: '#F59E0B',
  people_encounters: '#14B8A6', travels_journeys: '#06B6D4', institutional_timeline: '#6366F1',
  seva_projects: '#10B981', awards_accreds: '#EAB308', physical_spaces: '#F97316',
  health_aahar_discipline: '#EC4899', social_contextual: '#6B7280',
  life_formation: '#F43F5E', artifacts: '#78716C',
}

export default function Timeline() {
  const [data, setData] = useState<YearData[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [yearFrom, setYearFrom] = useState<number | null>(null)
  const [yearTo, setYearTo] = useState<number | null>(null)
  const [yearIncidents, setYearIncidents] = useState<unknown[]>([])
  const [loadingYear, setLoadingYear] = useState(false)

  useEffect(() => {
    fetch('/api/timeline')
      .then(r => r.json())
      .then(d => {
        const t = d.timeline || []
        setData(t)
        if (t.length) {
          setYearFrom(t[0]._id)
          setYearTo(t[t.length - 1]._id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = data.filter(y => (!yearFrom || y._id >= yearFrom) && (!yearTo || y._id <= yearTo))
  const maxCount = Math.max(...filtered.map(y => y.count), 1)

  async function expandYear(year: number) {
    if (expanded === year) { setExpanded(null); return }
    setExpanded(year)
    setLoadingYear(true)
    try {
      const r = await fetch(`/api/incidents?year_from=${year}&year_to=${year}&limit=50`)
      const d = await r.json()
      setYearIncidents(d.incidents || [])
    } finally {
      setLoadingYear(false)
    }
  }

  const allYears = data.length ? { min: data[0]._id, max: data[data.length - 1]._id } : null

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-ink">Timeline</h1>
        <p className="text-muted text-sm mt-1">
          {filtered.length} years · {filtered.reduce((s, y) => s + y.count, 0).toLocaleString()} incidents
        </p>
      </div>

      {/* Year range filter */}
      {allYears && (
        <div className="bg-white border border-border rounded-2xl p-4 mb-6 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted font-medium">From</label>
            <input
              type="number"
              value={yearFrom ?? ''}
              min={allYears.min}
              max={allYears.max}
              onChange={e => setYearFrom(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-lg border border-border bg-cream text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted font-medium">To</label>
            <input
              type="number"
              value={yearTo ?? ''}
              min={allYears.min}
              max={allYears.max}
              onChange={e => setYearTo(Number(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-lg border border-border bg-cream text-sm focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Density bar chart */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <p className="text-sm font-medium text-muted mb-3">Incident density by year</p>
          <div className="flex items-end gap-0.5 h-16 overflow-x-auto pb-1">
            {filtered.map(y => {
              const topCat = y.categories[0]
              return (
                <button
                  key={y._id}
                  title={`${y._id}: ${y.count} incidents`}
                  onClick={() => expandYear(y._id)}
                  className="shrink-0 w-3 rounded-t-sm hover:opacity-80 transition-opacity"
                  style={{
                    height: `${Math.max(4, (y.count / maxCount) * 64)}px`,
                    backgroundColor: CATEGORY_COLORS[topCat] || '#9CA3AF',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Year list */}
      {loading ? (
        <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-white rounded-2xl border border-border animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(y => (
            <div key={y._id} className="bg-white rounded-2xl border border-border overflow-hidden">
              <button
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-cream/50 transition-colors"
                onClick={() => expandYear(y._id)}
              >
                <div className="flex items-center gap-4">
                  <span className="font-serif text-xl font-bold text-ink">{y._id}</span>
                  <span className="text-sm text-muted">{y.count} incidents</span>
                  <div className="flex gap-1 flex-wrap">
                    {y.categories.slice(0, 4).map(c => (
                      <span
                        key={c}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[c] || '#9CA3AF' }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
                <span className={`text-muted transition-transform ${expanded === y._id ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded === y._id && (
                <div className="border-t border-border px-6 py-5">
                  {loadingYear ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-cream rounded-xl animate-pulse" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {yearIncidents.map(inc => (
                        <IncidentCard key={(inc as { _id: string })._id} incident={inc as Parameters<typeof IncidentCard>[0]['incident']} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
