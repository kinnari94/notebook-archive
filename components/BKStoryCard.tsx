'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

const BK_CATEGORY_COLORS: Record<string, { label: string; icon: string; accent: string }> = {
  bk_line_that_changed_me:  { label: 'The Line That Changed Me',         icon: '💬', accent: '#92400E' },
  bk_shared_events:         { label: 'Shared Events',                    icon: '🤝', accent: '#1D4ED8' },
  bk_first_meeting:         { label: 'First Meeting',                    icon: '🌅', accent: '#BE185D' },
  bk_humour:                { label: 'Humorous Prasangs',                icon: '😄', accent: '#B45309' },
  bk_one_ajna:              { label: 'One Ajna / Guidance',              icon: '🧭', accent: '#4338CA' },
  bk_the_object:            { label: 'The Object',                       icon: '📿', accent: '#57534E' },
  bk_discipline_training:   { label: 'Discipline / Training',            icon: '⚖️', accent: '#B91C1C' },
  bk_dasha_family:          { label: 'Dasha / Family Observations',      icon: '✨', accent: '#6D28D9' },
  bk_non_jain:              { label: "Non-Jain in Bapa's Circle",        icon: '🌍', accent: '#0F766E' },
  bk_he_found_me_first:     { label: 'He Found Me First',                icon: '🔍', accent: '#065F46' },
  bk_he_doesnt_see_time:    { label: "He Doesn't See Time",              icon: '🌙', accent: '#0E7490' },
  bk_vision_behind_projects:{ label: 'Vision Behind Projects',           icon: '🏛️', accent: '#7C3AED' },
  bk_compassion_seva:       { label: 'Compassion / Seva',                icon: '🌱', accent: '#15803D' },
  bk_children_teaching:     { label: 'Children / Teaching Through Play', icon: '👶', accent: '#BE185D' },
  bk_satsang_transformation:{ label: 'Satsang / Transformation',         icon: '📖', accent: '#A21CAF' },
  bk_love_for_pkd:          { label: 'Love for PKD / Bhakti',            icon: '🙏', accent: '#C2410C' },
  bk_letters_mails:         { label: 'Letters / Mails',                  icon: '✉️', accent: '#0369A1' },
  bk_night_satsang:         { label: 'Night Satsang',                    icon: '🌙', accent: '#1E3A5F' },
  bk_question_answer:       { label: 'Question & Answer',                icon: '❓', accent: '#5B21B6' },
  bk_closing_accounts:      { label: 'Closing Accounts',                 icon: '🔐', accent: '#374151' },
  bk_same_incident_diff_ajna:{ label: 'Same Incident, Different Ajna',   icon: '🔀', accent: '#9D174D' },
  bk_gurudev_as_child:      { label: 'Gurudev as a Child',               icon: '🧒', accent: '#92400E' },
  bk_meditation_inner_state:{ label: 'Meditation & Inner State',         icon: '🧘', accent: '#065F46' },
  bk_study_group:           { label: 'Study Group',                      icon: '📚', accent: '#1D4ED8' },
}

function HighlightText({ text, highlight }: { text: string; highlight?: string }) {
  if (!text) return null
  if (!highlight?.trim()) return <>{text}</>
  const escaped = highlight.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-amber-200 text-stone-900 py-0.5 px-0.5 rounded font-semibold">{part}</mark>
          : part
      )}
    </>
  )
}

interface BKStory {
  _id: string
  story_id?: string
  story_title?: string
  summary?: string
  what_happened?: string
  what_gurudev_said?: string
  transformation?: string
  story_type?: string
  time_life_stage?: string
  location?: string
  category?: string
  tags?: string[]
  source_notebook_title?: string
  nlm_source_links?: { source_id: string; cited_text: string; nlm_url: string }[]
}

interface Props {
  story: BKStory
  layout?: 'grid' | 'list'
  highlightQuery?: string
}

export default function BKStoryCard({ story, layout = 'grid', highlightQuery = '' }: Props) {
  const [isCopied, setIsCopied] = useState(false)
  const [isBodyExpanded, setIsBodyExpanded] = useState(false)

  const meta = BK_CATEGORY_COLORS[story.category || ''] ?? {
    label: (story.category || 'Bapa Katha').replace(/bk_/g, '').replace(/_/g, ' '),
    icon: '📖',
    accent: '#92400E',
  }

  const displayId = story.story_id ? `#${story.story_id}` : 'REF-' + story._id.slice(-6).toUpperCase()
  const body = story.what_happened || story.summary || ''
  const hasGurudevWords = story.what_gurudev_said && story.what_gurudev_said !== 'exact wording not available'
  const hasTransformation = story.transformation && story.transformation !== 'none evident'
  const copyText = [story.story_title, body].filter(Boolean).join('\n\n')

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(copyText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // ── LIST layout ──────────────────────────────────────────────────────────
  if (layout === 'list') {
    return (
      <div className="group relative bg-[#FDFBF9] border border-[#E9E4DF] rounded-[14px] p-4 transition-all duration-150 flex flex-col md:flex-row md:items-center gap-4 hover:bg-[#FAF6F1] hover:border-[#D6CEC5]">
        <div className="shrink-0 md:w-24 select-none">
          {story.time_life_stage && story.time_life_stage !== 'not specified'
            ? <span className="font-sans font-semibold text-xs text-[#564940] bg-[#F5EFEB] px-2.5 py-1 rounded-full border border-[#E6DAD1]">{story.time_life_stage}</span>
            : <span className="font-sans text-[11px] font-medium text-[#A6978C] bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E9E1D8]">Bapa Katha</span>
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1 text-[11px] font-sans font-bold select-none text-[#564940]">
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: meta.accent }} />
            <span className="uppercase tracking-wide">{meta.label}</span>
            <span className="text-[#D0C0B4]">/</span>
            <span className="text-[#A1958C] font-normal font-mono">{displayId}</span>
          </div>
          {story.story_title && (
            <p className="font-sans text-[#2C2117] text-[14.5px] leading-relaxed font-light tracking-wide mb-1">
              <HighlightText text={story.story_title} highlight={highlightQuery} />
            </p>
          )}
          {body && (
            <div className="pl-3 border-l-2 border-[#D4C3B5]">
              <p className="text-[#645A51] text-[12.5px] leading-relaxed italic font-sans font-light">
                "<HighlightText text={body} highlight={highlightQuery} />"
              </p>
            </div>
          )}
          {story.location && story.location !== 'not specified' && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-stone-500">
              📍{story.location}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-sans font-medium shrink-0 select-none">
          {story.source_notebook_title && (
            <span className="text-[10px] font-mono text-[#A1958C] truncate max-w-[100px]" title={story.source_notebook_title}>
              📓 {story.source_notebook_title}
            </span>
          )}
          <button onClick={handleCopy} className="text-[#645A51] hover:text-[#2C2117] transition-colors cursor-pointer">
            {isCopied ? '[copied ✓]' : '[copy]'}
          </button>
          {story.nlm_source_links?.[0] && (
            <a href={story.nlm_source_links[0].nlm_url} target="_blank" rel="noopener noreferrer"
              className="text-[#794E2C] hover:text-[#533013] hover:underline transition-colors">
              source ↗
            </a>
          )}
        </div>
      </div>
    )
  }

  // ── GRID layout ──────────────────────────────────────────────────────────
  return (
    <div className="group relative bg-[#FDFBF9] border border-[#E9E4DF] rounded-[24px] p-6 transition-all duration-300 hover:bg-[#FAF6F1] flex flex-col justify-between h-full hover:shadow-[0_12px_36px_rgba(118,91,73,0.06)] hover:border-[#D6CEC5] hover:-translate-y-1 overflow-hidden">
      {/* Accent glow */}
      <div className="absolute top-0 right-0 w-32 h-32 blur-[40px] opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-300 rounded-full pointer-events-none" style={{ backgroundColor: meta.accent }} />

      <div>
        {/* Status bar — category + time stage pill + clip badge + ref id */}
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-[#F2ECE6]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: meta.accent }} />
            <span className="text-[11px] font-sans font-bold text-[#564940] uppercase tracking-widest">{meta.label}</span>
            {story.time_life_stage && story.time_life_stage !== 'not specified' && (
              <span className="text-[11px] font-sans font-bold px-2 py-0.5 rounded border ml-1"
                style={{ backgroundColor: meta.accent + '12', color: meta.accent, borderColor: meta.accent + '30' }}>
                {story.time_life_stage}
              </span>
            )}
          </div>
          <span className="text-[10px] font-sans font-medium text-[#A1958C] tracking-wide shrink-0">{displayId}</span>
        </div>

        {/* Story title — primary description */}
        {story.story_title && (
          <div className="mb-4">
            <p className="font-sans text-[#2C2117] text-[14.5px] leading-relaxed antialiased font-light tracking-wide">
              <HighlightText text={story.story_title} highlight={highlightQuery} />
            </p>
          </div>
        )}

        {/* Body — source quote with accent border */}
        {body && (
          <div className="mb-4 pl-3 border-l-2" style={{ borderColor: meta.accent + '60' }}>
            <p className={`font-sans font-light text-[#645A51] text-[13px] leading-relaxed italic ${!isBodyExpanded ? 'line-clamp-2' : ''}`}>
              "<HighlightText text={body} highlight={highlightQuery} />"
            </p>
            {body.length > 90 && (
              <button onClick={e => { e.stopPropagation(); setIsBodyExpanded(v => !v) }}
                className="mt-1 text-[11px] font-semibold transition-colors hover:underline"
                style={{ color: meta.accent }}>
                {isBodyExpanded ? 'Collapse' : 'Show Full Story'}
              </button>
            )}
          </div>
        )}

        {/* Gurudev's words */}
        {hasGurudevWords && (
          <div className="mb-4 pl-3 border-l-2 border-[#C4A882] bg-[#FBF7F2] py-1.5 rounded-r-lg">
            <p className="font-sans font-normal text-[#3D2B1A] text-[13px] leading-relaxed italic">
              "{story.what_gurudev_said}"
            </p>
          </div>
        )}

        {/* Transformation */}
        {hasTransformation && (
          <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-[12px] text-emerald-800">
            <span className="font-bold">Transformation: </span>{story.transformation}
          </div>
        )}
      </div>

      <div>
        {/* Free-form tags */}
        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {story.tags.map((tag, i) => (
              <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200/60">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Location chip */}
        {story.location && story.location !== 'not specified' && (
          <div className="flex flex-wrap gap-1.5 mb-4 select-none">
            <span className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
              style={{ backgroundColor: meta.accent + '10', color: meta.accent, borderColor: meta.accent + '25' }}>
              📍<HighlightText text={story.location} highlight={highlightQuery} />
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#F2ECE6] text-[11px] font-sans font-bold">
          <button onClick={handleCopy} className="text-[#645A51] hover:text-[#2C2117] transition-colors flex items-center gap-1 cursor-pointer select-none">
            {isCopied
              ? <><Check className="w-3 h-3 stroke-[2.5]" /> copied ✓</>
              : <><Copy className="w-3 h-3" /> copy story</>
            }
          </button>
          <div className="flex items-center gap-3 ml-auto">
            {story.source_notebook_title && (
              <span className="text-[10px] font-mono text-[#A1958C] truncate max-w-[120px]" title={story.source_notebook_title}>
                📓 {story.source_notebook_title}
              </span>
            )}
            {story.nlm_source_links?.[0]
              ? <a href={story.nlm_source_links[0].nlm_url} target="_blank" rel="noopener noreferrer"
                  className="text-[#794E2C] hover:text-[#533013] transition-colors hover:underline">
                  source ↗
                </a>
              : <span className="text-[10px] text-[#A6978C] font-mono font-medium">local.db</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
