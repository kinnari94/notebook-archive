'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, Database, RefreshCw, BarChart3, BookOpen, Terminal } from 'lucide-react'

export default function Settings() {
  const [uri, setUri] = useState('')
  const [dbName, setDbName] = useState('bapaji_archive')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [rebuildLoading, setRebuildLoading] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<{ ok: boolean; message?: string } | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [colStats, setColStats] = useState<Record<string, number> | null>(null)

  // NotebookLM auth status
  const [nlmStatus, setNlmStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [nlmChecking, setNlmChecking] = useState(true)

  async function checkNlmAuth() {
    setNlmChecking(true)
    try {
      const d = await fetch('/api/nlm-auth').then(r => r.json())
      if (d.configured && d.ok) {
        setNlmStatus({ ok: true, message: 'Connected' })
      } else if (d.configured) {
        setNlmStatus({ ok: false, message: 'Auth expired — run notebooklm login again' })
      } else {
        setNlmStatus({ ok: false, message: 'Not authenticated' })
      }
    } finally {
      setNlmChecking(false)
    }
  }

  useEffect(() => { checkNlmAuth() }, [])

  async function testConn() {
    setTesting(true); setTestResult(null)
    try {
      const r = await fetch('/api/test-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri }),
      })
      setTestResult(await r.json())
    } finally {
      setTesting(false)
    }
  }

  async function rebuildIdx() {
    setRebuildLoading(true); setRebuildResult(null)
    try {
      const r = await fetch('/api/rebuild-index', { method: 'POST' })
      setRebuildResult(await r.json())
    } finally {
      setRebuildLoading(false)
    }
  }

  async function loadStats() {
    setStatsLoading(true)
    try {
      const r = await fetch('/api/collection-stats')
      const d = await r.json()
      setColStats(d.stats)
    } finally {
      setStatsLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-ink">Settings</h1>
        <p className="text-muted text-sm mt-1">Configure your archive connection and tools</p>
      </div>

      {/* MongoDB Config */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Database className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-ink">MongoDB Atlas</h2>
            <p className="text-xs text-muted">Connection string for the archive database</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Connection URI</label>
            <input
              type="password"
              value={uri}
              onChange={e => setUri(e.target.value)}
              placeholder="mongodb+srv://…"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-cream text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ember/30"
            />
            <p className="text-xs text-muted mt-1">Current URI is set in .env.local — paste a new one to test a different connection</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Database Name</label>
            <input
              value={dbName}
              onChange={e => setDbName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-ember/30"
            />
          </div>
          <button
            onClick={testConn}
            disabled={testing || !uri}
            className="flex items-center gap-2 px-5 py-2.5 bg-forest text-white rounded-xl text-sm font-semibold hover:bg-forest-light disabled:opacity-50 transition-colors"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Test Connection
          </button>

          {testResult && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
              testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Database Tools */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-ink mb-4">Database Tools</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-cream rounded-xl">
            <div>
              <p className="text-sm font-medium text-ink">Rebuild Search Index</p>
              <p className="text-xs text-muted">Recreates full-text index on incidents collection</p>
            </div>
            <button
              onClick={rebuildIdx}
              disabled={rebuildLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-lg text-sm hover:bg-border transition-colors disabled:opacity-50"
            >
              {rebuildLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Rebuild
            </button>
          </div>
          {rebuildResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              rebuildResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
              {rebuildResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {rebuildResult.ok ? 'Index rebuilt successfully' : rebuildResult.message}
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-cream rounded-xl">
            <div>
              <p className="text-sm font-medium text-ink">Collection Stats</p>
              <p className="text-xs text-muted">Document counts per collection</p>
            </div>
            <button
              onClick={loadStats}
              disabled={statsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-lg text-sm hover:bg-border transition-colors disabled:opacity-50"
            >
              {statsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
              Load
            </button>
          </div>

          {colStats && (
            <div className="border border-border rounded-xl overflow-hidden">
              {Object.entries(colStats).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between px-4 py-2 border-b border-border last:border-0">
                  <span className="text-sm text-ink font-medium">{key.replace(/_/g, ' ')}</span>
                  <span className="text-sm text-muted">{(count as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NotebookLM */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-ink">NotebookLM</h2>
            <p className="text-xs text-muted">Authentication status</p>
          </div>
        </div>

        {/* Auth status */}
        <div className="mb-5">
          {nlmChecking ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking…
            </div>
          ) : nlmStatus?.ok ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              Authenticated — notebooklm login active
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-700">
              <XCircle className="w-4 h-4" />
              {nlmStatus?.message || 'Not authenticated'}
            </div>
          )}
        </div>

        {/* Terminal instructions */}
        <div className="bg-gray-950 rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-500 mb-2 font-mono uppercase tracking-widest">Terminal</p>
          <div className="space-y-1 font-mono text-sm text-green-400">
            <div>pip install &quot;notebooklm-py[browser]&quot;</div>
            <div>playwright install chromium</div>
            <div>notebooklm login</div>
          </div>
        </div>
        <p className="text-xs text-muted mb-4">
          Run <code className="bg-cream px-1.5 py-0.5 rounded text-xs font-mono">notebooklm login</code> once in your terminal.
          A browser opens — sign in to Google, press ENTER, and this app picks up the saved credentials automatically.
        </p>

        <button
          onClick={checkNlmAuth}
          disabled={nlmChecking}
          className="flex items-center gap-2 px-4 py-2 border border-border bg-cream rounded-xl text-sm hover:bg-border transition-colors disabled:opacity-50"
        >
          {nlmChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Re-check auth
        </button>
      </div>

      {/* About */}
      <div className="bg-forest rounded-2xl p-6 text-white">
        <h2 className="font-semibold mb-3">About</h2>
        <div className="space-y-1.5 text-sm text-green-200">
          <p>Next.js 14 + TypeScript</p>
          <p>MongoDB Atlas via native driver</p>
          <p>Tailwind CSS</p>
          <p>Bapaji Life Archive · SRMD</p>
        </div>
      </div>
    </div>
  )
}
