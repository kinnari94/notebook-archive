'use client'
import { useState } from 'react'
import { Check, Copy, MapPin, User, BookOpen } from 'lucide-react'

// Accent colors drawn from the provided spectrum palette (crimson → red → coral →
// orange → amber → golden → olive → green → mint → teal → blue → purple)
const BK_CATEGORY_COLORS: Record<string, { label: string; icon: string; accent: string }> = {
  bk_line_that_changed_me:   { label: 'The Line That Changed Me',         icon: '💬', accent: '#F08030' }, // orange
  bk_shared_events:          { label: 'Shared Events',                    icon: '🤝', accent: '#2868C0' }, // blue
  bk_first_meeting:          { label: 'First Meeting',                    icon: '🌅', accent: '#D82030' }, // red
  bk_humour:                 { label: 'Humorous Prasangs',                icon: '😄', accent: '#f040be' }, // warm amber
  bk_one_ajna:               { label: 'One Ajna / Guidance',              icon: '🧭', accent: '#5848A0' }, // purple
  bk_the_object:             { label: 'The Object',                       icon: '📿', accent: '#F0A040' }, // warm amber
  bk_discipline_training:    { label: 'Discipline / Training',            icon: '⚖️', accent: '#A01828' }, // dark crimson
  bk_dasha_family:           { label: 'Dasha / Family Observations',      icon: '✨', accent: '#5848A0' }, // purple
  bk_non_jain:               { label: "Non-Jain in Bapa's Circle",        icon: '🌍', accent: '#50A870' }, // green
  bk_he_found_me_first:      { label: 'He Found Me First',                icon: '🔍', accent: '#488020' }, // deep green
  bk_he_doesnt_see_time:     { label: "He Doesn't See Time",              icon: '🌙', accent: '#2898A8' }, // teal
  bk_vision_behind_projects: { label: 'Vision Behind Projects',           icon: '🏛️', accent: '#2868C0' }, // blue
  bk_compassion_seva:        { label: 'Compassion / Seva',                icon: '🌱', accent: '#98a850' }, // green
  bk_children_teaching:      { label: 'Children / Teaching Through Play', icon: '👶', accent: '#E05028' }, // coral
  bk_satsang_transformation: { label: 'Satsang / Transformation',         icon: '📖', accent: '#608800' }, // olive
  bk_love_for_pkd:           { label: 'Love for PKD / Bhakti',            icon: '🙏', accent: '#D82030' }, // red
  bk_letters_mails:          { label: 'Letters / Mails',                  icon: '✉️', accent: '#2898A8' }, // teal
  bk_night_satsang:          { label: 'Night Satsang',                    icon: '🌙', accent: '#2868C0' }, // blue
  bk_question_answer:        { label: 'Question & Answer',                icon: '❓', accent: '#A09000' }, // golden
  bk_closing_accounts:       { label: 'Closing Accounts',                 icon: '🔐', accent: '#A01828' }, // dark crimson
  bk_same_incident_diff_ajna:{ label: 'Same Incident, Different Ajna',    icon: '🔀', accent: '#E05028' }, // coral
  bk_gurudev_as_child:       { label: 'Gurudev as a Child',               icon: '🧒', accent: '#f030e6' }, // orange
  bk_meditation_inner_state: { label: 'Meditation & Inner State',         icon: '🧘', accent: '#2898A8' }, // teal
  bk_study_group:            { label: 'Study Group',                      icon: '📚', accent: '#608800' }, // olive
}

const EMPTY_SENTINELS = new Set([
  'not specified', 'exact wording not available', 'none evident', 'none', 'n/a', 'unknown',
])

function hasValue(val: string | null | undefined): val is string {
  if (!val) return false
  const t = val.trim().toLowerCase()
  return t !== '' && !EMPTY_SENTINELS.has(t)
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
  person?: string
  other_people?: string[]
  people?: string[]
  categories?: string[]
  category?: string
  tags?: string[]
  source_notebook_title?: string
  nlm_source_links?: { source_id: string; cited_text: string; nlm_url: string }[]
}

interface Props {
  story: BKStory
  layout?: 'grid' | 'list'
  highlightQuery?: string
  activeCategoryFilter?: string
}

export default function BKStoryCard({ story, layout = 'grid', highlightQuery = '', activeCategoryFilter }: Props) {
  const [isCopied, setIsCopied] = useState(false)
  const [bodyExpanded, setBodyExpanded] = useState(false)

  const allCats = story.categories?.length ? story.categories : story.category ? [story.category] : []
  const primaryCat = activeCategoryFilter && allCats.includes(activeCategoryFilter)
    ? activeCategoryFilter
    : allCats[0]

  const meta: { label: string; icon: string; accent: string } =
    (primaryCat && BK_CATEGORY_COLORS[primaryCat])
      ? BK_CATEGORY_COLORS[primaryCat]
      : {
          label: primaryCat?.replace(/^bk_/, '').replace(/_/g, ' ') ?? 'Bapa Katha',
          icon: '📖',
          accent: '#92400E',
        }

  // All category metas — primary drives the stripe, all are shown as badges
  const catMetas = allCats.map(c =>
    BK_CATEGORY_COLORS[c] ?? {
      label: c.replace(/^bk_/, '').replace(/_/g, ' '),
      icon: '📖',
      accent: '#92400E',
    }
  )

  const allPeople = [
    ...(story.people ?? (story.person && story.person !== 'not specified' ? [story.person] : [])),
    ...(story.other_people ?? []),
  ].filter((p, i, a) => p && p !== 'not specified' && a.indexOf(p) === i)

  const body = story.what_happened || story.summary || ''
  const copyText = [story.story_title, body].filter(Boolean).join('\n\n')

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(copyText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const hasLocation = hasValue(story.location)
  const displayPeople = allPeople

  // ── LIST layout ──────────────────────────────────────────────────────────
  if (layout === 'list') {
    return (
      <div className="group flex items-start gap-0 bg-white border border-[#E9E4DF] rounded-2xl overflow-hidden hover:border-[#D0C8C0] hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200" style={{ '--accent': meta.accent } as React.CSSProperties}>
        {/* Left accent stripe — widens + brightens on hover */}
        <div className="w-1 group-hover:w-1.5 self-stretch shrink-0 transition-all duration-200" style={{ backgroundColor: meta.accent }} />

        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-3.5">
          {/* Category pills — all categories */}
          <div className="flex flex-wrap gap-1 shrink-0 self-start">
            {catMetas.map((m, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                style={{ backgroundColor: m.accent + '12', color: m.accent, borderColor: m.accent + '28' }}
              >
                <span className="text-[10px]">{m.icon}</span>
                <span className="truncate max-w-[130px]">{m.label}</span>
              </span>
            ))}
          </div>

          {/* Title + body */}
          <div className="flex-1 min-w-0">
            {story.story_title && (
              <p className="text-[13.5px] font-semibold text-[#1C2018] leading-snug truncate">
                <HighlightText text={story.story_title} highlight={highlightQuery} />
              </p>
            )}
            {body && (
              <p className="text-[12px] text-stone-400 leading-relaxed mt-0.5 italic">
                <HighlightText text={body} highlight={highlightQuery} />
              </p>
            )}
            {hasValue(story.what_gurudev_said) && (
              <div className="mt-2 px-2.5 py-2 rounded-lg border" style={{ backgroundColor: meta.accent + '08', borderColor: meta.accent + '25' }}>

                <p className="text-[11px] leading-relaxed font-medium" style={{ color: meta.accent + 'cc' }}>
                  <HighlightText text={story.what_gurudev_said} highlight={highlightQuery} />
                </p>
              </div>
            )}
            {hasValue(story.transformation) && (
              <div className="mt-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Transformation</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <HighlightText text={story.transformation} highlight={highlightQuery} />
                </p>
              </div>
            )}
            {story.tags && story.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {story.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] text-stone-400 bg-stone-50 border border-stone-100 px-1.5 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Meta + actions */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 text-[11px] text-stone-400">
            <div className="flex items-center gap-3">
              {hasValue(story.time_life_stage) && (
                <span className="hidden md:inline font-mono text-[10px] bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-full text-stone-500">
                  {story.time_life_stage}
                </span>
              )}
              {hasLocation && (
                <span className="hidden sm:flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{story.location}
                </span>
              )}
              {displayPeople[0] && (
                <span className="hidden sm:flex items-center gap-1">
                  <User className="w-3 h-3" />{displayPeople[0]}
                </span>
              )}
              <button onClick={handleCopy} className="hover:text-stone-600 transition-colors">
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {story.nlm_source_links?.[0] && (
                <a href={story.nlm_source_links[0].nlm_url} target="_blank" rel="noopener noreferrer"
                  className="font-medium hover:underline" style={{ color: meta.accent }}>
                  ↗
                </a>
              )}
            </div>
            {story.source_notebook_title && (
              <div className="flex items-center gap-1 text-[10px] italic text-stone-400">
                <BookOpen className="w-3 h-3 shrink-0" />
                <span>{story.source_notebook_title}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── GRID layout ──────────────────────────────────────────────────────────
  return (
    <div className="group relative flex h-full bg-white border border-[#E9E4DF] rounded-2xl overflow-hidden hover:border-[#D0C8C0] hover:-translate-y-0.5 transition-all duration-200"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.03)' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 10px 28px ${meta.accent}1A, 0 2px 8px rgba(0,0,0,0.04)`)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.03)')}
    >
      {/* Accent glow overlay */}
      <div className="absolute top-0 right-0 w-40 h-40 blur-[56px] opacity-0 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${meta.accent}22 0%, transparent 70%)` }} />
      {/* Left accent stripe — widens on hover */}
      <div className="w-1.5 shrink-0" style={{ backgroundColor: meta.accent }} />

      <div className="flex-1 flex flex-col px-3.5 pt-3 pb-3 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-1.5 mb-2">
          <div className="flex flex-wrap gap-1">
            {catMetas.map((m, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border leading-none"
                style={{ backgroundColor: m.accent + '12', color: m.accent, borderColor: m.accent + '28' }}
              >
                <span className="text-[9px]">{m.icon}</span>
                <span>{m.label}</span>
              </span>
            ))}
          </div>
          {hasValue(story.time_life_stage) && (
            <span className="text-[9px] font-mono text-stone-400 shrink-0 mt-0.5 bg-stone-50 border border-stone-100 px-1.5 py-0.5 rounded-full">
              {story.time_life_stage}
            </span>
          )}
        </div>

        {/* Title */}
        {story.story_title && (
          <p className="text-sm font-semibold text-stone-800 leading-snug mb-1.5">
            <HighlightText text={story.story_title} highlight={highlightQuery} />
          </p>
        )}

        {/* Body */}
        {body && (
          <div>
            <p className={`text-xs text-stone-600 leading-relaxed ${bodyExpanded ? '' : 'line-clamp-3'}`}>
              <HighlightText text={body} highlight={highlightQuery} />
            </p>
            {body.length > 180 && (
              <button
                onClick={e => { e.stopPropagation(); setBodyExpanded(v => !v) }}
                className="mt-0.5 text-[10px] font-medium hover:underline"
                style={{ color: meta.accent }}
              >
                {bodyExpanded ? 'Show Less' : 'Show Full Story'}
              </button>
            )}
          </div>
        )}

        {/* What Gurudev Said */}
        {hasValue(story.what_gurudev_said) && (
          <div className="mt-2 pl-2.5 border-l-2" style={{ borderColor: meta.accent + '80' }}>
            <p className="text-xs leading-relaxed font-medium italic" style={{ color: meta.accent }}>
              <HighlightText text={story.what_gurudev_said} highlight={highlightQuery} />
            </p>
          </div>
        )}

        {/* Transformation */}
        {hasValue(story.transformation) && (
          <div className="mt-1.5 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-100">
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5">Transformation</p>
            <p className="text-xs text-amber-900 leading-relaxed">
              <HighlightText text={story.transformation} highlight={highlightQuery} />
            </p>
          </div>
        )}

        {/* Tags */}
        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {story.tags.map((tag, i) => (
              <span key={i} className="text-[10px] text-stone-400 bg-stone-50 border border-stone-100 px-1.5 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-stone-100 flex flex-col gap-1.5">
          {/* Location + People */}
          {(hasLocation || displayPeople.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              {hasLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>{story.location}</span>
                </span>
              )}
              {displayPeople.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  <User className="w-3 h-3 shrink-0" />
                  <span>{p}</span>
                </span>
              ))}
            </div>
          )}

          {/* Bottom row: copy (left) | notebook + source (right) */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-stone-400 hover:text-stone-600 transition-colors"
            >
              {isCopied ? (
                <><Check className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500 font-medium">Copied</span></>
              ) : (
                <><Copy className="w-3 h-3" /><span>Copy</span></>
              )}
            </button>
            <div className="flex items-center gap-2">
              {hasValue(story.source_notebook_title) && (
                <div className="flex items-center gap-1 text-stone-400 text-[11px] italic">
                  <BookOpen className="w-3 h-3 shrink-0" />
                  <span>{story.source_notebook_title}</span>
                </div>
              )}
              {story.nlm_source_links?.[0] && (
                <a
                  href={story.nlm_source_links[0].nlm_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:underline transition-colors"
                  style={{ color: meta.accent }}
                >
                  Source ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
