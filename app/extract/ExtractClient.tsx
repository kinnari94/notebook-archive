'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Play, CheckCircle, AlertCircle, BookOpen, Loader2, Minimize2, KeyRound, XCircle } from 'lucide-react'
import { useExtraction } from '@/components/ExtractionContext'

const CATEGORIES = [
  { key: 'daily_dateline',          label: 'Daily Dateline',        icon: '📅' },
  { key: 'health_aahar_discipline', label: 'Health & Discipline',   icon: '🌿' },
  { key: 'spiritual_exp',           label: 'Spiritual Experiences', icon: '✨' },
  { key: 'teachings_guidance',      label: 'Teachings & Guidance',  icon: '📖' },
  { key: 'people_encounters',       label: 'People & Encounters',   icon: '🤝' },
  { key: 'travels_journeys',        label: 'Travels & Journeys',    icon: '🗺️' },
  { key: 'institutional_timeline',  label: 'Institutional',         icon: '🏛️' },
  { key: 'seva_projects',           label: 'Seva Projects',         icon: '🌱' },
  { key: 'awards_accreds',          label: 'Awards & Recognition',  icon: '🏆' },
  { key: 'physical_spaces',         label: 'Physical Spaces',       icon: '🏠' },
  { key: 'social_contextual',       label: 'Social & Contextual',   icon: '🌍' },
  { key: 'life_formation',          label: 'Life Formation',        icon: '🌸' },
  { key: 'artifacts',               label: 'Artifacts',             icon: '📿' },
]

function isBKNotebook(title: string): boolean {
  return /bapa\s*katha/i.test(title)
}

interface Notebook { id: string; title: string; source_count: number }

export default function ExtractClient() {
  const { running, logs, progress, start, minimize, clear } = useExtraction()

  const [nlmConnected, setNlmConnected] = useState(false)
  const [nlmChecking, setNlmChecking]   = useState(true)
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading]   = useState(false)
  const [loginError, setLoginError]       = useState<string | null>(null)

  const [notebooks, setNotebooks]       = useState<Notebook[]>([])
  const [nbLoading, setNbLoading]       = useState(false)
  const [nbError, setNbError]           = useState<string | null>(null)
  const [selectedNbs, setSelectedNbs]   = useState<string[]>([])
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const logsRef = useRef<HTMLDivElement>(null)

  const bkIds = selectedNbs.filter(id => {
    const nb = notebooks.find(n => n.id === id)
    return nb ? isBKNotebook(nb.title) : false
  })
  const hasBK       = bkIds.length > 0
  const hasStandard = selectedNbs.length > bkIds.length

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs])

  const loadNotebooks = useCallback(async () => {
    setNbLoading(true); setNbError(null)
    try {
      const d = await fetch('/api/notebooks').then(r => r.json())
      if (d.error) setNbError(d.error)
      else setNotebooks(d.notebooks || [])
    } catch {
      setNbError('Network error')
    } finally {
      setNbLoading(false)
    }
  }, [])

  const checkConnection = useCallback(async () => {
    const d = await fetch('/api/nlm-connect').then(r => r.json())
    setNlmChecking(false)
    if (d.connected) { setNlmConnected(true); loadNotebooks() }
    return d.connected
  }, [loadNotebooks])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword) return
    setLoginLoading(true)
    setLoginError(null)
    try {
      const r = await fetch('/api/nlm-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      })
      const d = await r.json()
      if (d.ok) {
        setNlmConnected(true)
        loadNotebooks()
      } else {
        setLoginError(d.error || 'Connection failed.')
      }
    } catch {
      setLoginError('Network error. Please try again.')
    } finally {
      setLoginLoading(false)
    }
  }

  function runExtraction() {
    if (!selectedNbs.length) return
    if (hasStandard && !selectedCats.length) return
    start({
      notebook_ids: selectedNbs,
      categories:   selectedCats,
      bapa_katha_ids: bkIds,
      notebook_titles: Object.fromEntries(
        notebooks.filter(n => selectedNbs.includes(n.id)).map(n => [n.id, n.title])
      ),
    })
  }

  const toggleNb  = (id: string) => {
    setSelectedNbs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
    setSelectedCats([])
  }
  const toggleCat = (k: string) => setSelectedCats(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])

  const logColor: Record<string, string> = {
    info: 'text-green-300', error: 'text-red-400', success: 'text-mint', muted: 'text-gray-500',
  }

  const bkOnly = hasBK && !hasStandard

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-[#1C3D27]">Extract Content</h1>
        <p className="text-muted text-sm mt-1">Pull incidents from NotebookLM into the archive</p>
      </div>

      {nlmChecking && (
        <div className="flex items-center gap-3 text-muted text-sm mb-8">
          <Loader2 className="w-4 h-4 animate-spin" />Checking NotebookLM connection…
        </div>
      )}

      {!nlmChecking && !nlmConnected && (
        <div className="bg-white border border-amber-200 rounded-2xl p-8 mb-8 max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Connect NotebookLM</h2>
              <p className="text-xs text-muted">Sign in with your Google account</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">Google Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="you@gmail.com"
                disabled={loginLoading}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60 placeholder:text-muted/60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loginLoading}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
              />
            </div>

            {loginError && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading || !loginEmail.includes('@') || !loginPassword}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting… this may take up to 30s
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  Connect NotebookLM
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {nlmConnected && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">NotebookLM connected</span>
            </div>
            <button onClick={loadNotebooks} disabled={nbLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-ink border border-border rounded-lg bg-white hover:bg-cream transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${nbLoading ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>

          {nbError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />{nbError}
            </div>
          )}

          <div className={`grid grid-cols-1 ${bkOnly ? '' : 'lg:grid-cols-2'} gap-6 mb-6`}>
            {/* Notebooks */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <h2 className="font-serif text-lg font-bold text-ink mb-4">① Select Notebooks</h2>
              {nbLoading ? (
                <div className="flex items-center gap-2 text-muted text-sm py-6">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : notebooks.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notebooks found</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notebooks.map(nb => {
                    const bk = isBKNotebook(nb.title)
                    return (
                      <button key={nb.id} onClick={() => toggleNb(nb.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          selectedNbs.includes(nb.id) ? 'border-forest bg-forest/5' : 'border-border bg-cream hover:border-forest/50'
                        }`}>
                        <div className={`w-4 h-4 rounded border-2 shrink-0 ${selectedNbs.includes(nb.id) ? 'bg-forest border-forest' : 'border-border'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{nb.title}</p>
                          <p className="text-xs text-muted">
                            {nb.source_count} sources{bk ? ' · Bapa Katha' : ''}
                          </p>
                        </div>
                        {bk && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">BK</span>}
                      </button>
                    )
                  })}
                </div>
              )}
              {hasStandard && hasBK && (
                <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Mixed selection: standard categories apply to regular notebooks; BK prompt applies to Bapa Katha notebooks.
                </p>
              )}
            </div>

            {/* Categories — only shown for standard notebooks */}
            {!bkOnly && (
              <div className="bg-white border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-lg font-bold text-ink">② Categories</h2>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedCats(CATEGORIES.map(c => c.key))}
                      className="text-xs px-2.5 py-1 bg-cream border border-border rounded-lg hover:bg-border">All</button>
                    <button onClick={() => setSelectedCats([])}
                      className="text-xs px-2.5 py-1 bg-cream border border-border rounded-lg hover:bg-border">Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(({ key, label, icon }) => (
                    <button key={key} onClick={() => toggleCat(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                        selectedCats.includes(key)
                          ? 'border-ember bg-ember/10 text-ember font-medium'
                          : 'border-border bg-cream text-ink hover:border-ember/50'
                      }`}>
                      <span>{icon}</span>
                      <span className="truncate text-xs">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Run */}
          <div className="bg-white border border-border rounded-2xl p-6 mb-6">
            <h2 className="font-serif text-lg font-bold text-ink mb-4">{bkOnly ? '②' : '③'} Run</h2>
            <div className="flex flex-wrap items-center gap-6">
              <button onClick={runExtraction}
                disabled={running || !selectedNbs.length || (hasStandard && !selectedCats.length)}
                className="ml-auto flex items-center gap-2 px-7 py-3 bg-ember text-white rounded-2xl font-semibold text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {running ? <><RefreshCw className="w-4 h-4 animate-spin" />Running…</> : <><Play className="w-4 h-4" />Run Extraction</>}
              </button>
            </div>
            {selectedNbs.length > 0 && (
              <p className="text-xs text-muted mt-3">
                {hasStandard && <>{selectedNbs.length - bkIds.length} standard notebook{selectedNbs.length - bkIds.length !== 1 ? 's' : ''}{selectedCats.length > 0 ? ` × ${selectedCats.length} categor${selectedCats.length !== 1 ? 'ies' : 'y'}` : ''}</>}
                {hasStandard && hasBK && <span className="mx-1">·</span>}
                {hasBK && <>{bkIds.length} Bapa Katha notebook{bkIds.length !== 1 ? 's' : ''} — 1 query per source</>}
              </p>
            )}
          </div>

          {/* Log */}
          {(logs.length > 0 || running) && (
            <div className="bg-forest rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-forest-light">
                <span className="text-sm font-medium text-white">Extraction Log</span>
                {progress && (
                  <div className="flex items-center gap-3 ml-4">
                    <div className="h-1.5 w-32 bg-forest-light rounded-full overflow-hidden">
                      <div className="h-full bg-mint rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-green-300">{progress.done}/{progress.total}</span>
                  </div>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={minimize} title="Minimize — extraction continues in background"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors">
                    <Minimize2 className="w-3.5 h-3.5" /> Minimize
                  </button>
                  {!running && (
                    <button onClick={clear}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div ref={logsRef} className="p-5 h-64 overflow-y-auto font-mono text-xs space-y-1">
                {logs.map((l, i) => (
                  <div key={i} className={logColor[l.level] || 'text-green-300'}>
                    <span className="text-gray-600 mr-2">{l.ts}</span>{l.msg}
                  </div>
                ))}
                {running && <div className="text-gray-500 animate-pulse">▌</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
