'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BookOpen, Users, Zap, MapPin, Sprout, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Stats { incidents: number; bk_stories: number; people: number; extractions: number; extraction_jobs: number; seva_projects: number; physical_spaces: number }
interface Breakdown { category: string; count: number }
interface Extraction { notebook_title?: string; notebook_type?: string; category?: string; status?: string; points_saved?: number; started_at?: string }

const CATEGORY_ICONS: Record<string, string> = {
  // Standard categories
  daily_dateline: '📅', health_aahar_discipline: '🌿', spiritual_exp: '✨',
  teachings_guidance: '📖', people_encounters: '🤝', travels_journeys: '🗺️',
  institutional_timeline: '🏛️', seva_projects: '🌱', awards_accreds: '🏆',
  physical_spaces: '🏠', social_contextual: '🌍', life_formation: '🌸', artifacts: '📿',
  // Bapa Katha categories
  bk_first_meeting: '🌟', bk_humour: '😄', bk_one_ajna: '🎯', bk_the_object: '🧿',
  bk_discipline_training: '🔥', bk_dasha_family: '👨‍👩‍👧', bk_non_jain: '🌐',
  bk_he_found_me_first: '💫', bk_he_doesnt_see_time: '⏳', bk_vision_behind_projects: '🔭',
  bk_compassion_seva: '🤲', bk_children_teaching: '👦', bk_satsang_transformation: '🙏',
  bk_love_for_pkd: '❤️', bk_letters_mails: '✉️', bk_night_satsang: '🌙',
  bk_question_answer: '💬', bk_closing_accounts: '⚖️', bk_same_incident_diff_ajna: '🔄',
  bk_gurudev_as_child: '🌱', bk_meditation_inner_state: '🧘', bk_study_group: '📚',
  bk_line_that_changed_me: '✍️', bk_shared_events: '👥',
}

export default function Dashboard() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const permissions = (session?.user as any)?.permissions as Record<string, string> | null | undefined
  const isAdmin = role === 'admin'

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
          <h1 className="font-serif text-3xl font-bold text-[#1C3D27] mb-1">Archive Overview</h1>
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
          { label: 'Total Incidents', value: (data?.stats?.incidents ?? 0) + (data?.stats?.bk_stories ?? 0), icon: BookOpen, color: 'bg-blue-50 text-blue-600' },
          { label: 'People', value: data?.stats?.people, icon: Users, color: 'bg-purple-50 text-purple-600' },
          { label: 'Extraction Jobs', value: data?.stats?.extraction_jobs, icon: Zap, color: 'bg-amber-50 text-amber-600' },
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
        <div className="bg-white rounded-2xl border border-border p-5 flex flex-col max-h-96">
          <h2 className="font-serif text-base font-bold text-ink mb-3 shrink-0">Category Breakdown</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-6 bg-gray-50 rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-scroll pr-1">
              {(data?.breakdown || []).map(({ category, count }) => (
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
        <div className="bg-white rounded-2xl border border-border p-5 flex flex-col max-h-96">
          <h2 className="font-serif text-base font-bold text-ink mb-3 shrink-0">Recent Extractions</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}</div>
          ) : (data?.extractions || []).length === 0 ? (
            <div className="text-center py-8 text-muted">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No extractions yet</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-scroll">
              {(data?.extractions || []).map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${e.status === 'done' ? 'bg-emerald-400' : e.status === 'error' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{e.notebook_title || (e.notebook_type === 'bapa_katha' ? 'Bapa Katha Notebook' : 'Notebook')}</p>
                    <p className="text-xs text-muted">{e.notebook_type === 'bapa_katha' ? 'Bapa Katha' : e.category?.replace(/_/g, ' ')} · {e.points_saved ?? 0} incidents</p>
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
          { href: '/extract', label: 'Extract Content', desc: 'Pull incidents from NotebookLM', color: 'bg-ember', icon: Zap, viewKey: 'extract' },
          { href: '/browse', label: 'Browse Archive', desc: 'Filter and explore incidents', color: 'bg-forest', icon: BookOpen, viewKey: 'browse' },
          { href: '/search', label: 'Search', desc: 'Full-text across all content', color: 'bg-mint', icon: Users, viewKey: 'search' },
        ].filter(({ viewKey }) => isAdmin || permissions?.[viewKey] !== 'no_access')
        .map(({ href, label, desc, color, icon: Icon }) => (
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
