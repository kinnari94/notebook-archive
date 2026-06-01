import { User, MapPin, Clock, Star } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  devotion_to_pkd:             'Devotion to PKD',
  bhakti:                      'Bhakti Stories',
  satsang_general:             'Spiritual Discourse Stories',
  personal_guidance_agna:      'Personal Guidance / Agna',
  visionary_infrastructure:    'Visionary / Infrastructure',
  guiding_youth:               'Guiding Youth',
  dasha_inner_state:           'Dasha / Inner State',
  seva_stories:                'Seva Stories',
  children_legacy:             'Children & Legacy',
  tributes_external:           'Tributes / External',
  satsang_focused:             'Spiritual Discourse Deep Dive',
  sat_worldly_to_satsang:      'Worldly → Love for Discourse',
  sat_scriptural_clarity:      'Scriptural Clarity',
  sat_practical_spirituality:  'Practical Spirituality',
  sat_playful_bodh:            'Playful Bodh / Humour',
  sat_personal_relevance:      '"He Was Speaking to Me"',
  sat_transformation_by_example:'One Example, One Change',
  sat_youth_satsang:           'Youth in Their Language',
  sat_agna_through_satsang:    'Discourse → Agna & Discipline',
  sat_bhakti_through_satsang:  'Discourse Deepening Bhakti',
  sat_reveals_dasha:           "Reveals Gurudev's Dasha",
  sat_early_memories:          'Early Discourse Memories',
  sat_mission_foundation:      'Discourse → Mission Growth',
}

const BUCKET_META: Record<string, { color: string; bg: string; icon: string }> = {
  devotion_to_pkd:          { color: 'text-purple-700', bg: 'bg-purple-50',  icon: '🙏' },
  bhakti:                   { color: 'text-pink-700',   bg: 'bg-pink-50',    icon: '💛' },
  satsang_general:          { color: 'text-amber-700',  bg: 'bg-amber-50',   icon: '📿' },
  personal_guidance_agna:   { color: 'text-blue-700',   bg: 'bg-blue-50',    icon: '🌟' },
  visionary_infrastructure: { color: 'text-indigo-700', bg: 'bg-indigo-50',  icon: '🏛️' },
  guiding_youth:            { color: 'text-green-700',  bg: 'bg-green-50',   icon: '🌱' },
  dasha_inner_state:        { color: 'text-violet-700', bg: 'bg-violet-50',  icon: '✨' },
  seva_stories:             { color: 'text-teal-700',   bg: 'bg-teal-50',    icon: '🤝' },
  children_legacy:          { color: 'text-rose-700',   bg: 'bg-rose-50',    icon: '👨‍👩‍👧' },
  tributes_external:        { color: 'text-yellow-700', bg: 'bg-yellow-50',  icon: '🏆' },
  satsang_focused:          { color: 'text-orange-700', bg: 'bg-orange-50',  icon: '🎯' },
  sat_worldly_to_satsang:       { color: 'text-cyan-700',   bg: 'bg-cyan-50',    icon: '🔄' },
  sat_scriptural_clarity:       { color: 'text-blue-700',   bg: 'bg-blue-50',    icon: '📖' },
  sat_practical_spirituality:   { color: 'text-green-700',  bg: 'bg-green-50',   icon: '🏠' },
  sat_playful_bodh:             { color: 'text-amber-700',  bg: 'bg-amber-50',   icon: '😄' },
  sat_personal_relevance:       { color: 'text-purple-700', bg: 'bg-purple-50',  icon: '🎯' },
  sat_transformation_by_example:{ color: 'text-orange-700', bg: 'bg-orange-50',  icon: '⚡' },
  sat_youth_satsang:            { color: 'text-green-700',  bg: 'bg-green-50',   icon: '🌱' },
  sat_agna_through_satsang:     { color: 'text-indigo-700', bg: 'bg-indigo-50',  icon: '🔑' },
  sat_bhakti_through_satsang:   { color: 'text-pink-700',   bg: 'bg-pink-50',    icon: '💛' },
  sat_reveals_dasha:            { color: 'text-violet-700', bg: 'bg-violet-50',  icon: '✨' },
  sat_early_memories:           { color: 'text-stone-700',  bg: 'bg-stone-50',   icon: '🕰️' },
  sat_mission_foundation:       { color: 'text-teal-700',   bg: 'bg-teal-50',    icon: '🏛️' },
}

const CLIP_COLORS: Record<string, string> = {
  High:         'bg-emerald-100 text-emerald-700',
  Medium:       'bg-amber-100 text-amber-700',
  Low:          'bg-gray-100 text-gray-600',
  'Needs Review': 'bg-blue-100 text-blue-700',
}

export interface DocumentaryStory {
  _id: string
  storyId?: string
  person?: string
  storyTitle?: string
  themeBucket?: string
  satsangSubtheme?: string
  storyType?: string
  timeLifeStage?: string
  location?: string
  summary?: string
  whatHappened?: string
  gurudevSaid?: string
  satsangInsight?: string
  transformation?: string
  quoteClipPotential?: string
  category?: string
}

export default function DocumentaryStoryCard({ story }: { story: DocumentaryStory }) {
  const meta = BUCKET_META[story.category || ''] ?? { color: 'text-gray-700', bg: 'bg-gray-50', icon: '📽️' }
  const clipColor = CLIP_COLORS[story.quoteClipPotential || ''] || 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
          <span>{meta.icon}</span>
          {CATEGORY_LABELS[story.category || ''] ?? (story.category || 'unknown').replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {story.quoteClipPotential && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${clipColor}`}>
              <Star className="w-3 h-3" />
              {story.quoteClipPotential}
            </span>
          )}
          {story.storyType && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-cream border border-border text-muted capitalize">
              {story.storyType}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      {story.storyTitle && (
        <h3 className="font-semibold text-ink text-sm mb-1 leading-snug">{story.storyTitle}</h3>
      )}

      {/* Summary */}
      {story.summary && (
        <p className="text-muted text-xs leading-relaxed mb-3 line-clamp-2">{story.summary}</p>
      )}

      {/* Gurudev said */}
      {story.gurudevSaid && story.gurudevSaid !== 'exact wording not available' && (
        <blockquote className="border-l-2 border-amber-300 pl-3 text-xs text-amber-800 italic mb-3 line-clamp-2">
          "{story.gurudevSaid}"
        </blockquote>
      )}

      {/* Transformation */}
      {story.transformation && story.transformation !== 'not specified' && (
        <div className="bg-cream rounded-xl px-3 py-2 text-xs text-muted mb-3 line-clamp-2">
          <span className="font-medium text-ink">Transformation: </span>{story.transformation}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap gap-3 text-xs text-muted mt-2">
        {story.person && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {story.person}
          </span>
        )}
        {story.timeLifeStage && story.timeLifeStage !== 'not specified' && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {story.timeLifeStage}
          </span>
        )}
        {story.location && story.location !== 'not specified' && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {story.location}
          </span>
        )}
        {story.storyId && (
          <span className="ml-auto font-mono text-xs opacity-50">{story.storyId}</span>
        )}
      </div>
    </div>
  )
}
