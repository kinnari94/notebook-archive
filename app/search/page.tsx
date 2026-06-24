'use client'
import { useState, useEffect } from 'react'
import { Search as SearchIcon, ChevronLeft, ChevronRight, BookOpen, Loader2, Sparkles, FileText } from 'lucide-react'
import IncidentCard from '@/components/IncidentCard'

const ARCHIVE_EXAMPLES = ['maun vrat', 'flood relief', 'diksha', 'COVID response', 'ashram construction', 'samadhi']
const NLM_EXAMPLES = ['teachings on meditation', 'humorous moments with Bapaji', 'quotes about surrender', 'guidance on diet and discipline']
const PAGE_SIZE = 30

interface Notebook { id: string; title: string; source_count: number }

interface NLMResult {
  notebook_id: string
  notebook_title: string
  answer: string
  references: { source_id: string; cited_text: string }[]
  error?: string
}

export default function Search() {
  const [mode, setMode] = useState<'archive' | 'nlm'>('archive')

  // Archive search state
  const [query, setQuery]       = useState('')
  const [input, setInput]       = useState('')
  const [results, setResults]   = useState<{ total: number; incidents: unknown[] }>({ total: 0, incidents: [] })
  const [page, setPage]         = useState(0)
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)

  // NLM search state
  const [nlmInput,       setNlmInput]       = useState('')
  const [notebooks,      setNotebooks]      = useState<Notebook[]>([])
  const [nbLoading,      setNbLoading]      = useState(false)
  const [selectedNbs,    setSelectedNbs]    = useState<string[]>([])
  const [nlmResults,     setNlmResults]     = useState<NLMResult[]>([])
  const [nlmLoading,     setNlmLoading]     = useState(false)
  const [nlmSearched,    setNlmSearched]    = useState(false)
  const [nlmQuery,       setNlmQuery]       = useState('')

  useEffect(() => {
    if (mode === 'nlm' && notebooks.length === 0) {
      setNbLoading(true)
      fetch('/api/notebooks').then(r => r.json()).then(d => {
        setNotebooks(d.notebooks || [])
      }).finally(() => setNbLoading(false))
    }
  }, [mode, notebooks.length])

  // Archive search
  async function doSearch(q: string, p = 0) {
    if (!q.trim()) return
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ q, limit: String(PAGE_SIZE), skip: String(p * PAGE_SIZE) })
      const d = await fetch(`/api/incidents?${params}`).then(r => r.json())
      setResults(d); setPage(p); setQuery(q)
    } finally { setLoading(false) }
  }

  // NLM search
  async function doNlmSearch(q: string) {
    if (!q.trim() || !selectedNbs.length) return
    setNlmLoading(true); setNlmSearched(true); setNlmQuery(q)
    const titleMap = Object.fromEntries(notebooks.map(n => [n.id, n.title]))
    try {
      const d = await fetch('/api/nlm-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, notebook_ids: selectedNbs, notebook_titles: titleMap }),
      }).then(r => r.json())
      setNlmResults(d.responses || [])
    } finally { setNlmLoading(false) }
  }

  const toggleNb = (id: string) => setSelectedNbs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const totalPages = Math.ceil(results.total / PAGE_SIZE)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[#1C3D27] mb-1">Search Archive</h1>
        <p className="text-muted text-sm">Search extracted records or query notebooks directly</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-cream border border-border rounded-xl p-1 w-fit mb-8">
        <button onClick={() => setMode('archive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'archive' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
          <FileText className="w-3.5 h-3.5" /> Archive Records
        </button>
        <button onClick={() => setMode('nlm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'nlm' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
          <Sparkles className="w-3.5 h-3.5" /> Ask NotebookLM
        </button>
      </div>

      {/* ── Archive mode ── */}
      {mode === 'archive' && (
        <>
          <form onSubmit={e => { e.preventDefault(); doSearch(input) }} className="mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input value={input} onChange={e => setInput(e.target.value)}
                  placeholder="Search incidents, people, places…"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ember/30 shadow-sm" />
              </div>
              <button type="submit"
                className="px-6 py-3 bg-ember text-white rounded-2xl text-sm font-semibold hover:bg-orange-600 transition-colors">
                Search
              </button>
            </div>
          </form>

          {!searched && (
            <div className="mb-8">
              <p className="text-xs text-muted font-medium mb-3 uppercase tracking-wide">Try searching for</p>
              <div className="flex flex-wrap gap-2">
                {ARCHIVE_EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => { setInput(ex); doSearch(ex) }}
                    className="px-3 py-1.5 bg-white border border-border rounded-full text-sm text-ink hover:border-ember hover:text-ember transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-border p-5 h-40 animate-pulse" />)}
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
                      <button disabled={page === 0} onClick={() => doSearch(query, page - 1)}
                        className="p-2 rounded-xl border border-border bg-white hover:bg-cream disabled:opacity-40">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-muted">Page {page + 1} of {totalPages}</span>
                      <button disabled={page >= totalPages - 1} onClick={() => doSearch(query, page + 1)}
                        className="p-2 rounded-xl border border-border bg-white hover:bg-cream disabled:opacity-40">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── Ask NotebookLM mode ── */}
      {mode === 'nlm' && (
        <>
          {/* Notebook selector */}
          <div className="bg-white border border-border rounded-2xl p-6 mb-6">
            <h2 className="font-serif text-base font-bold text-ink mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Select Notebooks to Query
            </h2>
            {nbLoading ? (
              <div className="flex items-center gap-2 text-muted text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading notebooks…
              </div>
            ) : notebooks.length === 0 ? (
              <p className="text-sm text-muted">No notebooks found. Make sure NotebookLM is connected.</p>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setSelectedNbs(notebooks.map(n => n.id))}
                    className="text-xs px-2.5 py-1 bg-cream border border-border rounded-lg hover:bg-border">All</button>
                  <button onClick={() => setSelectedNbs([])}
                    className="text-xs px-2.5 py-1 bg-cream border border-border rounded-lg hover:bg-border">None</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {notebooks.map(nb => (
                    <button key={nb.id} onClick={() => toggleNb(nb.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                        selectedNbs.includes(nb.id) ? 'border-forest bg-forest/5' : 'border-border bg-cream hover:border-forest/50'
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded border-2 shrink-0 ${selectedNbs.includes(nb.id) ? 'bg-forest border-forest' : 'border-border'}`} />
                      <span className="text-xs font-medium text-ink truncate">{nb.title}</span>
                      <span className="text-xs text-muted ml-auto shrink-0">{nb.source_count}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Query input */}
          <form onSubmit={e => { e.preventDefault(); doNlmSearch(nlmInput) }} className="mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input value={nlmInput} onChange={e => setNlmInput(e.target.value)}
                  placeholder="Ask a question or describe what you're looking for…"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-forest/30 shadow-sm" />
              </div>
              <button type="submit"
                disabled={!selectedNbs.length || !nlmInput.trim() || nlmLoading}
                className="px-6 py-3 bg-forest text-white rounded-2xl text-sm font-semibold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {nlmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
              </button>
            </div>
            {!selectedNbs.length && <p className="text-xs text-amber-600 mt-2">Select at least one notebook above</p>}
          </form>

          {!nlmSearched && (
            <div className="mb-8">
              <p className="text-xs text-muted font-medium mb-3 uppercase tracking-wide">Example queries</p>
              <div className="flex flex-wrap gap-2">
                {NLM_EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => { setNlmInput(ex); doNlmSearch(ex) }}
                    disabled={!selectedNbs.length}
                    className="px-3 py-1.5 bg-white border border-border rounded-full text-sm text-ink hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nlmLoading && (
            <div className="space-y-4">
              {selectedNbs.map(id => (
                <div key={id} className="bg-white rounded-2xl border border-border p-6 animate-pulse h-32" />
              ))}
            </div>
          )}

          {!nlmLoading && nlmSearched && (
            <>
              <p className="text-sm text-muted mb-4">
                Results for <span className="font-semibold text-ink">"{nlmQuery}"</span> across {nlmResults.length} notebook{nlmResults.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-4">
                {nlmResults.map(r => (
                  <div key={r.notebook_id} className="bg-white border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-cream/50">
                      <BookOpen className="w-4 h-4 text-forest shrink-0" />
                      <span className="font-semibold text-sm text-ink">{r.notebook_title}</span>
                      {r.error && <span className="ml-auto text-xs text-red-500">Error: {r.error}</span>}
                    </div>
                    <div className="px-6 py-5">
                      {r.error ? (
                        <p className="text-sm text-muted italic">Could not retrieve a response from this notebook.</p>
                      ) : !r.answer ? (
                        <p className="text-sm text-muted italic">No relevant content found.</p>
                      ) : (
                        <>
                          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{r.answer}</p>
                          {r.references.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-border space-y-2">
                              <p className="text-xs font-bold text-muted uppercase tracking-wide">Source excerpts</p>
                              {r.references.map((ref, i) => (
                                <p key={i} className="text-xs text-muted bg-cream rounded-lg px-3 py-2 italic">"{ref.cited_text}"</p>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
