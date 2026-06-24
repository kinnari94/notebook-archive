'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

const BK_CATEGORY_COLORS: Record<string, { label: string; icon: string; accent: string }> = {
  bk_line_that_changed_me:   { label: 'The Line That Changed Me',         icon: '💬', accent: '#F08030' },
  bk_shared_events:          { label: 'Shared Events',                    icon: '🤝', accent: '#2868C0' },
  bk_first_meeting:          { label: 'First Meeting',                    icon: '🌅', accent: '#D82030' },
  bk_humour:                 { label: 'Humorous Prasangs',                icon: '😄', accent: '#f040be' },
  bk_one_ajna:               { label: 'One Ajna / Guidance',              icon: '🧭', accent: '#5848A0' },
  bk_the_object:             { label: 'The Object',                       icon: '📿', accent: '#F0A040' },
  bk_discipline_training:    { label: 'Discipline / Training',            icon: '⚖️', accent: '#A01828' },
  bk_dasha_family:           { label: 'Dasha / Family Observations',      icon: '✨', accent: '#5848A0' },
  bk_non_jain:               { label: "Non-Jain in Bapa's Circle",        icon: '🌍', accent: '#50A870' },
  bk_he_found_me_first:      { label: 'He Found Me First',                icon: '🔍', accent: '#488020' },
  bk_he_doesnt_see_time:     { label: "He Doesn't See Time",              icon: '🌙', accent: '#2898A8' },
  bk_vision_behind_projects: { label: 'Vision Behind Projects',           icon: '🏛️', accent: '#2868C0' },
  bk_compassion_seva:        { label: 'Compassion / Seva',                icon: '🌱', accent: '#98a850' },
  bk_children_teaching:      { label: 'Children / Teaching Through Play', icon: '👶', accent: '#E05028' },
  bk_satsang_transformation: { label: 'Satsang / Transformation',         icon: '📖', accent: '#608800' },
  bk_love_for_pkd:           { label: 'Love for PKD / Bhakti',            icon: '🙏', accent: '#D82030' },
  bk_letters_mails:          { label: 'Letters / Mails',                  icon: '✉️', accent: '#2898A8' },
  bk_night_satsang:          { label: 'Night Satsang',                    icon: '🌙', accent: '#2868C0' },
  bk_question_answer:        { label: 'Question & Answer',                icon: '❓', accent: '#A09000' },
  bk_closing_accounts:       { label: 'Closing Accounts',                 icon: '🔐', accent: '#A01828' },
  bk_same_incident_diff_ajna:{ label: 'Same Incident, Different Ajna',    icon: '🔀', accent: '#E05028' },
  bk_gurudev_as_child:       { label: 'Gurudev as a Child',               icon: '🧒', accent: '#f030e6' },
  bk_meditation_inner_state: { label: 'Meditation & Inner State',         icon: '🧘', accent: '#2898A8' },
  bk_study_group:            { label: 'Study Group',                      icon: '📚', accent: '#608800' },
}

const SOURCE_PALETTE = [
  '#C2410C', '#1D4ED8', '#0F766E', '#7C3AED', '#B45309',
  '#0369A1', '#15803D', '#9D174D', '#4338CA', '#0E7490',
  '#92400E', '#6D28D9', '#065F46', '#1E3A5F', '#78350F',
  '#BE185D', '#166534', '#5B21B6', '#A21CAF', '#0284C7',
]

function sourceAccent(title: string | undefined): string {
  if (!title) return '#92400E'
  let h = 0
  for (let i = 0; i < title.length; i++) h = title.charCodeAt(i) + ((h << 5) - h)
  return SOURCE_PALETTE[Math.abs(h) % SOURCE_PALETTE.length]
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
}

export default function BKStoryCard({ story, layout = 'grid', highlightQuery = '' }: Props) {
  const [isCopied, setIsCopied] = useState(false)
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [quoteExpanded, setQuoteExpanded] = useState(false)

  const allCats = story.categories?.length ? story.categories : story.category ? [story.category] : []

  // Accent color driven by source notebook so cards from the same source share a color
  const accent = sourceAccent(story.source_notebook_title)

  const allCatMetas = allCats.map(c => {
    const bkMeta = BK_CATEGORY_COLORS[c]
    return bkMeta
      ? { label: bkMeta.label, icon: bkMeta.icon }
      : { label: c.replace(/^bk_/, '').replace(/_/g, ' '), icon: '📖' }
  })

  const allPeople = [
    ...(story.people ?? (story.person && story.person !== 'not specified' ? [story.person] : [])),
    ...(story.other_people ?? []),
  ].filter((p, i, a) => p && p !== 'not specified' && a.indexOf(p) === i)

  const body = story.what_happened || story.summary || ''
  const copyText = [story.story_title, body].filter(Boolean).join('\n\n')
  const refId = 'BK-' + story._id.slice(-6).toUpperCase()

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(copyText)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // ── LIST layout ──────────────────────────────────────────────────────────
  if (layout === 'list') {
    return (
      <div className="group relative bg-[#FDFBF9] border border-[#E9E4DF] rounded-[14px] p-4 transition-all duration-150 flex flex-col md:flex-row md:items-start gap-4 hover:bg-[#FAF6F1] hover:border-[#D6CEC5]">
        {/* Date column */}
        <div className="shrink-0 md:w-28 select-none pt-0.5">
          {hasValue(story.time_life_stage)
            ? <span className="font-sans font-semibold text-xs px-2.5 py-1 rounded-full border block text-center"
                style={{ backgroundColor: accent + '12', color: accent, borderColor: accent + '30' }}>
                {story.time_life_stage}
              </span>
            : <span className="font-sans text-[11px] font-medium text-[#A6978C] bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E9E1D8] block text-center">Undated</span>
          }
        </div>

        <div className="flex-1 min-w-0">
          {/* Ref */}
          <div className="mb-1 select-none">
            <span className="text-[10px] font-mono text-[#B8ADA6]">{refId}</span>
          </div>

          {/* Title — prominent */}
          {story.story_title && (
            <p className="font-sans text-[#2C2117] text-[15px] leading-snug font-semibold tracking-wide mb-1.5">
              <HighlightText text={story.story_title} highlight={highlightQuery} />
            </p>
          )}

          {/* Body */}
          {body && (
            <p className="font-sans text-[#2C2117] text-[13px] leading-relaxed font-light tracking-wide line-clamp-2">
              <HighlightText text={body} highlight={highlightQuery} />
            </p>
          )}

          {/* Gurudev quote */}
          {hasValue(story.what_gurudev_said) && (
            <div className="mt-1.5 pl-3 border-l-2" style={{ borderColor: accent + '60' }}>
              <p className="text-[#645A51] text-[12.5px] leading-relaxed italic font-sans font-light line-clamp-1">
                "<HighlightText text={story.what_gurudev_said} highlight={highlightQuery} />"
              </p>
            </div>
          )}

          {/* Extra categories */}
          {allCatMetas.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 select-none">
              {allCatMetas.map((m, i) => (
                <span key={i} className="text-[10px] font-sans font-medium px-2 py-0.5 rounded border"
                  style={{ backgroundColor: accent + '10', color: accent, borderColor: accent + '25' }}>
                  {m.icon} {m.label}
                </span>
              ))}
            </div>
          )}

          {/* People & location */}
          {(allPeople.length > 0 || hasValue(story.location)) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 select-none">
              {allPeople.map((p, i) => (
                <span key={i} className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                  style={{ backgroundColor: accent + '10', color: accent, borderColor: accent + '25' }}>
                  @<HighlightText text={p} highlight={highlightQuery} />
                </span>
              ))}
              {hasValue(story.location) && (
                <span className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                  style={{ backgroundColor: accent + '10', color: accent, borderColor: accent + '25' }}>
                  📍{story.location}
                </span>
              )}
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
      <div className="absolute top-0 right-0 w-32 h-32 blur-[40px] opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-300 rounded-full pointer-events-none" style={{ backgroundColor: accent }} />

      <div>
        {/* Status bar: title left, date pill right */}
        <div className="flex items-start justify-between gap-3 mb-3 pb-2 border-b border-[#F2ECE6]">
          <h3 className="font-sans text-[#2C2117] text-[15px] leading-snug font-semibold tracking-wide">
            {story.story_title
              ? <HighlightText text={story.story_title} highlight={highlightQuery} />
              : <span className="text-[#A6978C] font-normal italic">Untitled</span>
            }
          </h3>
          <div className="shrink-0 mt-0.5">
            {hasValue(story.time_life_stage)
              ? <span className="text-[11px] font-sans font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap"
                  style={{ backgroundColor: accent + '12', color: accent, borderColor: accent + '30' }}>
                  {story.time_life_stage}
                </span>
              : <span className="text-[11px] font-sans font-medium text-[#A6978C] bg-[#FAF7F2] px-2.5 py-0.5 rounded-full border border-[#E9E1D8]">Undated</span>
            }
          </div>
        </div>

        {/* Category pills — all categories, below title */}
        {allCatMetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 select-none">
            {allCatMetas.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full border"
                style={{ backgroundColor: accent + '10', color: accent, borderColor: accent + '28' }}>
                {m.icon} {m.label}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        {body && (
          <div className="mb-4">
            <p className={`font-sans text-[#2C2117] text-[14px] leading-relaxed font-light tracking-wide ${bodyExpanded ? '' : 'line-clamp-3'}`}>
              <HighlightText text={body} highlight={highlightQuery} />
            </p>
            {body.length > 180 && (
              <button onClick={e => { e.stopPropagation(); setBodyExpanded(v => !v) }}
                className="mt-1 text-[11px] font-semibold transition-colors hover:underline"
                style={{ color: accent }}>
                {bodyExpanded ? 'Show Less' : 'Show Full Story'}
              </button>
            )}
          </div>
        )}

        {/* What Gurudev Said */}
        {hasValue(story.what_gurudev_said) && (
          <div className="mb-4 pl-3 border-l-2" style={{ borderColor: accent + '60' }}>
            <p className={`font-sans font-light text-[#645A51] text-[13px] leading-relaxed italic ${!quoteExpanded ? 'line-clamp-2' : ''}`}>
              "<HighlightText text={story.what_gurudev_said} highlight={highlightQuery} />"
            </p>
            {story.what_gurudev_said.length > 90 && (
              <button onClick={e => { e.stopPropagation(); setQuoteExpanded(v => !v) }}
                className="mt-1 text-[11px] font-semibold transition-colors hover:underline"
                style={{ color: accent }}>
                {quoteExpanded ? 'Collapse' : 'Show Full Quote'}
              </button>
            )}
          </div>
        )}

        {/* Transformation */}
        {hasValue(story.transformation) && (
          <div className="mb-4 pl-3 border-l-2 border-amber-200">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Transformation</p>
            <p className="font-sans font-light text-amber-900 text-[13px] leading-relaxed italic">
              <HighlightText text={story.transformation} highlight={highlightQuery} />
            </p>
          </div>
        )}
      </div>

      <div>
        {/* Tags */}
        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {story.tags.map((tag, i) => (
              <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200/60">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* People & location */}
        {(allPeople.length > 0 || hasValue(story.location)) && (
          <div className="flex flex-wrap gap-1.5 mb-4 select-none">
            {allPeople.map((p, i) => (
              <span key={i} className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                style={{ backgroundColor: accent + '10', color: accent, borderColor: accent + '25' }}>
                @<HighlightText text={p} highlight={highlightQuery} />
              </span>
            ))}
            {hasValue(story.location) && (
              <span className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                style={{ backgroundColor: accent + '10', color: accent, borderColor: accent + '25' }}>
                📍{story.location}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#F2ECE6] text-[11px] font-sans font-bold">
          <button onClick={handleCopy} className="text-[#645A51] hover:text-[#2C2117] transition-colors flex items-center gap-1 cursor-pointer select-none">
            {isCopied
              ? <><Check className="w-3 h-3 stroke-[2.5]" /> copied ✓</>
              : <><Copy className="w-3 h-3" /> copy</>
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
