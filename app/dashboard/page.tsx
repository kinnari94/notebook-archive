'use client'
import { useEffect, useState } from 'react'
import { BookOpen, Users, Zap, MapPin, Sprout, Building2, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Stats { incidents: number; people: number; extractions: number; seva_projects: number; physical_spaces: number }
interface Breakdown { category: string; count: number }
interface Extraction { notebook_title?: string; category?: string; status?: string; incidents_found?: number; started_at?: string }

const CATEGORY_ICONS: Record<string, string> = {
  daily_dateline: '📅', health_aahar_discipline: '🌿', spiritual_exp: '✨',
  teachings_guidance: '📖', people_encounters: '🤝', travels_journeys: '🗺️',
  institutional_timeline: '🏛️', seva_projects: '🌱', awards_accreds: '🏆',
  physical_spaces: '🏠', social_contextual: '🌍', life_formation: '🌸', artifacts: '📿',
}

export default function Dashboard() {
  const [data, setData] = useState<{ stats: Stats; breakdown: Breakdown[]; extractions: Extraction[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { setData(d); setConnected(true) })
      .catch(() => setConnected(false))
      .finally(() => setLoading(false))
  }, [])

  const maxCount = data?.breakdown?.[0]?.count || 1

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink mb-1">Archive Overview</h1>
          <p className="text-muted text-sm">Bapaji · SRMD Spiritual Biography</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          connected === null ? 'bg-gray-100 text-gray-500' :
          connected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
        }`}>
          {connected === null ? <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" /> :
           connected ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {connected === null ? 'Connecting…' : connected ? 'Connected' : 'Not connected'}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Incidents', value: data?.stats?.incidents, icon: BookOpen, color: 'bg-blue-50 text-blue-600' },
          { label: 'People', value: data?.stats?.people, icon: Users, color: 'bg-purple-50 text-purple-600' },
          { label: 'Extractions Run', value: data?.stats?.extractions, icon: Zap, color: 'bg-amber-50 text-amber-600' },
          { label: 'Seva Projects', value: data?.stats?.seva_projects, icon: Sprout, color: 'bg-emerald-50 text-emerald-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-border p-5">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold font-serif text-ink">
              {loading ? <span className="inline-block w-12 h-6 bg-gray-100 rounded animate-pulse" /> : (value ?? 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="font-serif text-lg font-bold text-ink mb-4">Category Breakdown</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-6 bg-gray-50 rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {(data?.breakdown || []).slice(0, 8).map(({ category, count }) => (
                <div key={category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink font-medium">
                      {CATEGORY_ICONS[category] || '📌'} {category?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-muted">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-cream rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ember rounded-full transition-all duration-500"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Extractions */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="font-serif text-lg font-bold text-ink mb-4">Recent Extractions</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}</div>
          ) : (data?.extractions || []).length === 0 ? (
            <div className="text-center py-8 text-muted">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No extractions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.extractions || []).map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${e.status === 'done' ? 'bg-emerald-400' : e.status === 'error' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{e.notebook_title || 'Unknown notebook'}</p>
                    <p className="text-xs text-muted">{e.category?.replace(/_/g, ' ')} · {e.incidents_found ?? 0} incidents</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions — Harbor-style feature cards */}
      <h2 className="font-serif text-lg font-bold text-ink mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/extract', label: 'Extract Content', desc: 'Pull incidents from NotebookLM', color: 'bg-ember', icon: Zap },
          { href: '/browse', label: 'Browse Archive', desc: 'Filter and explore incidents', color: 'bg-forest', icon: BookOpen },
          { href: '/search', label: 'Search', desc: 'Full-text across all content', color: 'bg-mint', icon: Users },
          { href: '/settings', label: 'Settings', desc: 'Configure MongoDB & tools', color: 'bg-sun', icon: Building2 },
        ].map(({ href, label, desc, color, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-all group"
          >
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="font-semibold text-ink text-sm">{label}</p>
            <p className="text-xs text-muted mt-0.5 mb-3">{desc}</p>
            <ArrowRight className="w-4 h-4 text-muted group-hover:text-ember group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </div>
  )
}
