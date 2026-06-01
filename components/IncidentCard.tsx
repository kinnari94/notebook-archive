import { MapPin, Users, Calendar } from 'lucide-react'

const CATEGORY_META: Record<string, { color: string; bg: string; icon: string }> = {
  daily_dateline:       { color: 'text-blue-700',   bg: 'bg-blue-50',   icon: '📅' },
  health_aahar_discipline: { color: 'text-rose-700', bg: 'bg-rose-50',  icon: '🌿' },
  spiritual_exp:        { color: 'text-purple-700',  bg: 'bg-purple-50', icon: '✨' },
  teachings_guidance:   { color: 'text-amber-700',   bg: 'bg-amber-50',  icon: '📖' },
  people_encounters:    { color: 'text-teal-700',    bg: 'bg-teal-50',   icon: '🤝' },
  travels_journeys:     { color: 'text-cyan-700',    bg: 'bg-cyan-50',   icon: '🗺️' },
  institutional_timeline:{ color: 'text-indigo-700', bg: 'bg-indigo-50', icon: '🏛️' },
  seva_projects:        { color: 'text-green-700',   bg: 'bg-green-50',  icon: '🌱' },
  awards_accreds:       { color: 'text-yellow-700',  bg: 'bg-yellow-50', icon: '🏆' },
  physical_spaces:      { color: 'text-orange-700',  bg: 'bg-orange-50', icon: '🏠' },
  social_contextual:    { color: 'text-gray-700',    bg: 'bg-gray-50',   icon: '🌍' },
  life_formation:       { color: 'text-pink-700',    bg: 'bg-pink-50',   icon: '🌸' },
  artifacts:            { color: 'text-stone-700',   bg: 'bg-stone-50',  icon: '📿' },
}

interface Incident {
  _id: string
  description: string
  category?: string
  date?: { year?: number; month?: number; period?: string; precision?: string }
  people?: string[]
  locations?: string[]
  source_chunk?: string
  verified?: boolean
  extracted_at?: string
}

export default function IncidentCard({ incident }: { incident: Incident }) {
  const meta = CATEGORY_META[incident.category || ''] ?? { color: 'text-gray-700', bg: 'bg-gray-50', icon: '📌' }

  return (
    <div className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
          <span>{meta.icon}</span>
          {(incident.category || 'unknown').replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {incident.date?.year && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Calendar className="w-3 h-3" />
              {incident.date.year}
            </span>
          )}
        </div>
      </div>

      <p className="text-ink text-sm leading-relaxed mb-3">{incident.description}</p>

      {incident.source_chunk && (
        <blockquote className="border-l-2 border-border pl-3 text-xs text-muted italic mb-3 line-clamp-2">
          {incident.source_chunk}
        </blockquote>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {incident.people && incident.people.length > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {incident.people.slice(0, 3).join(', ')}
            {incident.people.length > 3 && ` +${incident.people.length - 3}`}
          </span>
        )}
        {incident.locations && incident.locations.length > 0 && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {incident.locations.slice(0, 2).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}
