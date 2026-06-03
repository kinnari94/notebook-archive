import { MapPin, Clock, User, BookOpen } from 'lucide-react'

const BK_CATEGORY_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  bk_devotion:          { color: 'text-amber-800',   bg: 'bg-amber-50',   icon: '🙏', label: 'Devotion to PKD' },
  bk_bhakti:            { color: 'text-rose-700',    bg: 'bg-rose-50',    icon: '❤️', label: 'Bhakti' },
  bk_satsang:           { color: 'text-purple-700',  bg: 'bg-purple-50',  icon: '📿', label: 'Satsang' },
  bk_personal_guidance: { color: 'text-blue-700',    bg: 'bg-blue-50',    icon: '🧭', label: 'Personal Guidance' },
  bk_visionary:         { color: 'text-indigo-700',  bg: 'bg-indigo-50',  icon: '🏛️', label: 'Visionary' },
  bk_guiding_youth:     { color: 'text-green-700',   bg: 'bg-green-50',   icon: '🌟', label: 'Guiding Youth' },
  bk_dasha:             { color: 'text-violet-700',  bg: 'bg-violet-50',  icon: '✨', label: 'Dasha / Inner State' },
  bk_seva:              { color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '🌱', label: 'Seva' },
  bk_children_legacy:   { color: 'text-pink-700',    bg: 'bg-pink-50',    icon: '👶', label: 'Children & Legacy' },
  bk_tributes:          { color: 'text-yellow-700',  bg: 'bg-yellow-50',  icon: '🏆', label: 'Tributes' },
  bk_satsang_deep:      { color: 'text-cyan-700',    bg: 'bg-cyan-50',    icon: '🔍', label: 'Deep Satsang' },
}

interface BKStory {
  _id: string
  story_title?: string
  summary?: string
  what_happened?: string
  what_gurudev_said?: string
  transformation?: string
  theme_buckets?: string[]
  story_type?: string
  time_life_stage?: string
  location?: string
  category?: string
  person?: string
  satsang_insight?: string
  quote_clip_potential?: string
  satsang_sub_themes?: string[]
}

export default function BKStoryCard({ story }: { story: BKStory }) {
  const meta = BK_CATEGORY_META[story.category || ''] ?? { color: 'text-amber-800', bg: 'bg-amber-50', icon: '📖', label: story.category || 'Bapa Katha' }
  const hasGurudevWords = story.what_gurudev_said && story.what_gurudev_said !== 'exact wording not available'
  const hasTransformation = story.transformation && story.transformation !== 'none evident'

  return (
    <div className="bg-white rounded-2xl border border-amber-100 p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
            <span>{meta.icon}</span>{meta.label}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            Bapa Katha
          </span>
          {story.story_type && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-gray-600 bg-gray-100">
              {story.story_type}
            </span>
          )}
        </div>
        {story.quote_clip_potential && story.quote_clip_potential !== 'Low' && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
            story.quote_clip_potential === 'High' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {story.quote_clip_potential} clip
          </span>
        )}
      </div>

      {/* Title */}
      {story.story_title && (
        <h3 className="font-serif font-semibold text-ink text-sm mb-2 leading-snug">{story.story_title}</h3>
      )}

      {/* Summary */}
      {story.summary && (
        <p className="text-sm text-muted leading-relaxed mb-3">{story.summary}</p>
      )}

      {/* Gurudev's words */}
      {hasGurudevWords && (
        <blockquote className="border-l-2 border-amber-300 pl-3 text-xs text-ink italic mb-3 line-clamp-3">
          "{story.what_gurudev_said}"
        </blockquote>
      )}

      {/* Satsang insight */}
      {story.satsang_insight && (
        <div className="text-xs bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 mb-3 text-purple-800">
          <span className="font-medium">Insight: </span>{story.satsang_insight}
        </div>
      )}

      {/* Transformation */}
      {hasTransformation && (
        <div className="text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3 text-emerald-800">
          <span className="font-medium">Transformation: </span>{story.transformation}
        </div>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-xs text-muted mt-2">
        {story.person && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />{story.person}
          </span>
        )}
        {story.time_life_stage && story.time_life_stage !== 'not specified' && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />{story.time_life_stage}
          </span>
        )}
        {story.location && story.location !== 'not specified' && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />{story.location}
          </span>
        )}
        {story.satsang_sub_themes && story.satsang_sub_themes.length > 0 && (
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />{story.satsang_sub_themes[0]}{story.satsang_sub_themes.length > 1 ? ` +${story.satsang_sub_themes.length - 1}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
