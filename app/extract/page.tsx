'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Play, CheckCircle, AlertCircle, BookOpen, Loader2, LogOut } from 'lucide-react'

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

interface Notebook { id: string; title: string; source_count: number }
interface LogLine  { msg: string; level: string; ts: string }

export default function Extract() {
  // NotebookLM connection state
  const [nlmConnected, setNlmConnected]   = useState(false)
  const [nlmChecking, setNlmChecking]     = useState(true)
  const [nlmEmail, setNlmEmail]           = useState('')
  const [nlmPassword, setNlmPassword]     = useState('')
  const [nlmLogging, setNlmLogging]       = useState(false)
  const [nlmError, setNlmError]           = useState<string | null>(null)

  // Notebooks / extraction state
  const [notebooks, setNotebooks]         = useState<Notebook[]>([])
  const [nbLoading, setNbLoading]         = useState(false)
  const [nbError, setNbError]             = useState<string | null>(null)
  const [selectedNbs, setSelectedNbs]     = useState<string[]>([])
  const [selectedCats, setSelectedCats]   = useState<string[]>([])
  const [tier, setTier]                   = useState(1)
  const [running, setRunning]             = useState(false)
  const [logs, setLogs]                   = useState<LogLine[]>([])
  const [progress, setProgress]           = useState<{ done: number; total: number } | null>(null)
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs])

  // Check if NotebookLM is already authenticated
  useEffect(() => {
    fetch('/api/nlm-connect').then(r => r.json()).then(d => {
      setNlmChecking(false)
      if (d.connected) {
        setNlmConnected(true)
        loadNotebooks()
      }
    })
  }, [])

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

  async function connectNotebookLM(e: React.FormEvent) {
    e.preventDefault()
    setNlmLogging(true); setNlmError(null)
    try {
      const r = await fetch('/api/nlm-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nlmEmail, password: nlmPassword }),
      })
      const d = await r.json()
      if (d.ok) {
        setNlmConnected(true)
        setNlmPassword('')
        loadNotebooks()
      } else {
        setNlmError(d.error || 'Login failed')
      }
    } finally {
      setNlmLogging(false)
    }
  }

  async function runExtraction() {
    if (!selectedNbs.length || !selectedCats.length) return
    setRunning(true); setLogs([]); setProgress(null)
    try {
      const res = await fetch('/api/extract/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebook_ids: selectedNbs, categories: selectedCats, access_tier: tier }),
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.replace(/^data:\s*/, '').trim()
          if (!line) continue
          try {
            const ev = JSON.parse(line)
            if (ev.msg) setLogs(p => [...p, { msg: ev.msg, level: ev.level || 'info', ts: new Date().toLocaleTimeString() }])
            if (ev.progress !== undefined) setProgress({ done: ev.progress, total: ev.total })
          } catch { /* skip */ }
        }
      }
    } finally { setRunning(false) }
  }

  const toggleNb  = (id: string) => setSelectedNbs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleCat = (k: string)  => setSelectedCats(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])

  const logColor: Record<string, string> = {
    info: 'text-green-300', error: 'text-red-400', success: 'text-mint', muted: 'text-gray-500',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-ink">Extract Content</h1>
        <p className="text-muted text-sm mt-1">Pull incidents from NotebookLM into the archive</p>
      </div>

      {/* NotebookLM login form */}
      {!nlmChecking && !nlmConnected && (
        <div className="bg-white border border-border rounded-2xl p-8 mb-8 max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Connect NotebookLM</h2>
              <p className="text-xs text-muted">Sign in with your Google account</p>
            </div>
          </div>

          <form onSubmit={connectNotebookLM} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
              <input
                type="email"
                value={nlmEmail}
                onChange={e => setNlmEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@gmail.com"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
              <input
                type="password"
                value={nlmPassword}
                onChange={e => setNlmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {nlmError && (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {nlmError}
              </div>
            )}

            <button
              type="submit"
              disabled={nlmLogging}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {nlmLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              {nlmLogging ? 'Signing in…' : 'Sign in to NotebookLM'}
            </button>
          </form>

          {nlmLogging && (
            <p className="text-xs text-muted mt-3 text-center">
              Authenticating with Google — this may take up to 30 seconds…
            </p>
          )}
        </div>
      )}

      {/* Checking state */}
      {nlmChecking && (
        <div className="flex items-center gap-3 text-muted text-sm mb-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking NotebookLM connection…
        </div>
      )}

      {/* Connected */}
      {nlmConnected && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">NotebookLM connected</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadNotebooks} disabled={nbLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-ink border border-border rounded-lg bg-white hover:bg-cream transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${nbLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button onClick={() => setNlmConnected(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-ink border border-border rounded-lg bg-white hover:bg-cream transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          </div>

          {nbError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {nbError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
                  {notebooks.map(nb => (
                    <button key={nb.id} onClick={() => toggleNb(nb.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        selectedNbs.includes(nb.id) ? 'border-forest bg-forest/5' : 'border-border bg-cream hover:border-forest/50'
                      }`}>
                      <div className={`w-4 h-4 rounded border-2 shrink-0 ${selectedNbs.includes(nb.id) ? 'bg-forest border-forest' : 'border-border'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{nb.title}</p>
                        <p className="text-xs text-muted">{nb.source_count} sources</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Categories */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-bold text-ink">② Categories</h2>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedCats(CATEGORIES.map(c => c.key))} className="text-xs px-2.5 py-1 bg-cream border border-border rounded-lg hover:bg-border">All</button>
                  <button onClick={() => setSelectedCats([])} className="text-xs px-2.5 py-1 bg-cream border border-border rounded-lg hover:bg-border">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ key, label, icon }) => (
                  <button key={key} onClick={() => toggleCat(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                      selectedCats.includes(key) ? 'border-ember bg-ember/10 text-ember font-medium' : 'border-border bg-cream text-ink hover:border-ember/50'
                    }`}>
                    <span>{icon}</span>
                    <span className="truncate text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Run */}
          <div className="bg-white border border-border rounded-2xl p-6 mb-6">
            <h2 className="font-serif text-lg font-bold text-ink mb-4">③ Access Tier & Run</h2>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex gap-2">
                {[1, 2, 3].map(t => (
                  <button key={t} onClick={() => setTier(t)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${tier === t ? 'bg-forest text-white border-forest' : 'bg-cream border-border text-ink hover:border-forest/50'}`}>
                    {t === 1 ? '🟢 Public' : t === 2 ? '🟡 Controlled' : '🔴 Restricted'}
                  </button>
                ))}
              </div>
              <button onClick={runExtraction}
                disabled={running || !selectedNbs.length || !selectedCats.length}
                className="ml-auto flex items-center gap-2 px-7 py-3 bg-ember text-white rounded-2xl font-semibold text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {running ? <><RefreshCw className="w-4 h-4 animate-spin" />Running…</> : <><Play className="w-4 h-4" />Run Extraction</>}
              </button>
            </div>
            {(selectedNbs.length > 0 || selectedCats.length > 0) && (
              <p className="text-xs text-muted mt-3">
                {selectedNbs.length} notebook{selectedNbs.length !== 1 ? 's' : ''} × {selectedCats.length} categor{selectedCats.length !== 1 ? 'ies' : 'y'} = {selectedNbs.length * selectedCats.length} queries
              </p>
            )}
          </div>

          {/* Log */}
          {(logs.length > 0 || running) && (
            <div className="bg-forest rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-forest-light">
                <span className="text-sm font-medium text-white">Extraction Log</span>
                {progress && (
                  <div className="ml-auto flex items-center gap-3">
                    <div className="h-1.5 w-32 bg-forest-light rounded-full overflow-hidden">
                      <div className="h-full bg-mint rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-green-300">{progress.done}/{progress.total}</span>
                  </div>
                )}
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
