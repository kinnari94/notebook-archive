import { MapPin, Clock } from 'lucide-react'

const BK_CATEGORY_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  bk_line_that_changed_me:  { color: 'text-amber-800',   bg: 'bg-amber-50',   icon: '💬', label: 'The Line That Changed Me' },
  bk_shared_events:         { color: 'text-blue-700',    bg: 'bg-blue-50',    icon: '🤝', label: 'Shared Events' },
  bk_first_meeting:         { color: 'text-rose-700',    bg: 'bg-rose-50',    icon: '🌅', label: 'First Meeting' },
  bk_humour:                { color: 'text-yellow-700',  bg: 'bg-yellow-50',  icon: '😄', label: 'Humorous Prasangs' },
  bk_one_ajna:              { color: 'text-indigo-700',  bg: 'bg-indigo-50',  icon: '🧭', label: 'One Ajna / Guidance' },
  bk_the_object:            { color: 'text-stone-700',   bg: 'bg-stone-50',   icon: '📿', label: 'The Object' },
  bk_discipline_training:   { color: 'text-red-700',     bg: 'bg-red-50',     icon: '⚖️', label: 'Discipline / Training' },
  bk_dasha_family:          { color: 'text-violet-700',  bg: 'bg-violet-50',  icon: '✨', label: 'Dasha / Family Observations' },
  bk_non_jain:              { color: 'text-teal-700',    bg: 'bg-teal-50',    icon: '🌍', label: 'Non-Jain in Bapa\'s Circle' },
  bk_he_found_me_first:     { color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '🔍', label: 'He Found Me First' },
  bk_he_doesnt_see_time:    { color: 'text-cyan-700',    bg: 'bg-cyan-50',    icon: '🌙', label: 'He Doesn\'t See Time' },
  bk_vision_behind_projects:{ color: 'text-purple-700',  bg: 'bg-purple-50',  icon: '🏛️', label: 'Vision Behind Projects' },
  bk_compassion_seva:       { color: 'text-green-700',   bg: 'bg-green-50',   icon: '🌱', label: 'Compassion / Seva' },
  bk_children_teaching:     { color: 'text-pink-700',    bg: 'bg-pink-50',    icon: '👶', label: 'Children / Teaching Through Play' },
  bk_satsang_transformation:{ color: 'text-fuchsia-700', bg: 'bg-fuchsia-50', icon: '📖', label: 'Satsang / Transformation' },
  bk_love_for_pkd:          { color: 'text-orange-700',  bg: 'bg-orange-50',  icon: '🙏', label: 'Love for PKD / Bhakti' },
  bk_letters_mails:         { color: 'text-sky-700',     bg: 'bg-sky-50',     icon: '✉️', label: 'Letters / Mails' },
}

interface BKStory {
  _id: string
  story_title?: string
  summary?: string
  what_happened?: string
  what_gurudev_said?: string
  transformation?: string
  story_type?: string
  time_life_stage?: string
  location?: string
  category?: string
  quote_clip_potential?: string
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

      {/* Transformation */}
      {hasTransformation && (
        <div className="text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3 text-emerald-800">
          <span className="font-medium">Transformation: </span>{story.transformation}
        </div>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-xs text-muted mt-2">
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
      </div>
    </div>
  )
}
