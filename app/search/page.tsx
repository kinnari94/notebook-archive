'use client'
import { useState } from 'react'
import { Search as SearchIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import IncidentCard from '@/components/IncidentCard'

const EXAMPLES = ['maun vrat', 'flood relief', 'diksha', 'COVID response', 'ashram construction', 'samadhi']
const PAGE_SIZE = 30

export default function Search() {
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const [results, setResults] = useState<{ total: number; incidents: unknown[] }>({ total: 0, incidents: [] })
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function doSearch(q: string, p = 0) {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ q, limit: String(PAGE_SIZE), skip: String(p * PAGE_SIZE) })
      const r = await fetch(`/api/incidents?${params}`)
      const d = await r.json()
      setResults(d)
      setPage(p)
      setQuery(q)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(results.total / PAGE_SIZE)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[#1C3D27] mb-1">Search Archive</h1>
        <p className="text-muted text-sm">Full-text search across all incidents</p>
      </div>

      {/* Search bar */}
      <form
        onSubmit={e => { e.preventDefault(); doSearch(input) }}
        className="mb-6"
      >
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Search incidents, people, places…"
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ember/30 shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-ember text-white rounded-2xl text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Example queries */}
      {!searched && (
        <div className="mb-8">
          <p className="text-xs text-muted font-medium mb-3 uppercase tracking-wide">Try searching for</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setInput(ex); doSearch(ex) }}
                className="px-3 py-1.5 bg-white border border-border rounded-full text-sm text-ink hover:border-ember hover:text-ember transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : searched && (
        <>
          <p className="text-sm text-muted mb-4">
            {results.total === 0 ? 'No results found' : `${results.total.toLocaleString()} results for "${query}"`}
          </p>
          {results.incidents.length === 0 ? (
            <div className="text-center py-20 text-muted">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium">No results found</p>
              <p className="text-sm mt-1">Try different keywords</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {results.incidents.map(inc => (
                  <IncidentCard key={(inc as { _id: string })._id} incident={inc as Parameters<typeof IncidentCard>[0]['incident']} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    disabled={page === 0}
                    onClick={() => doSearch(query, page - 1)}
                    className="p-2 rounded-xl border border-border bg-white hover:bg-cream disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-muted">Page {page + 1} of {totalPages}</span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => doSearch(query, page + 1)}
                    className="p-2 rounded-xl border border-border bg-white hover:bg-cream disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
