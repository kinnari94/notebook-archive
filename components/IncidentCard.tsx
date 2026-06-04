'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export const CATEGORY_COLORS: Record<string, { label: string; icon: string; accent: string }> = {
  // ── Core extraction categories ───────────────────────────────────────────
  daily_dateline:               { label: 'Daily Dateline',            icon: '📅', accent: '#2B6CB0' },
  health_aahar_discipline:      { label: 'Aahar Discipline',          icon: '🌿', accent: '#C53030' },
  spiritual_exp:                { label: 'Spiritual Experience',      icon: '✨', accent: '#6B46C1' },
  teachings_guidance:           { label: 'Teachings & Guidance',      icon: '📖', accent: '#744210' },
  people_encounters:            { label: 'Encounters',                icon: '🤝', accent: '#234E52' },
  travels_journeys:             { label: 'Travels & Journeys',        icon: '🗺️', accent: '#2B6CB0' },
  institutional_timeline:       { label: 'Institutional',             icon: '🏛️', accent: '#2C5282' },
  seva_projects:                { label: 'Seva Projects',             icon: '🌱', accent: '#22543D' },
  awards_accreds:               { label: 'Awards & Accreds',          icon: '🏆', accent: '#7B341E' },
  physical_spaces:              { label: 'Physical Spaces',           icon: '🏠', accent: '#2D3748' },
  social_contextual:            { label: 'Social Contextual',         icon: '🌍', accent: '#4A5568' },
  life_formation:               { label: 'Life Formation',            icon: '🌸', accent: '#9B2C2C' },
  artifacts:                    { label: 'Artifacts',                 icon: '📿', accent: '#78716c' },
  // ── All DB category values ───────────────────────────────────────────────
  academic_awards:              { label: 'Academic Awards',           icon: '🎓', accent: '#B45309' },
  academic_degree:              { label: 'Academic Degree',           icon: '🎓', accent: '#92400E' },
  disaster:                     { label: 'Disaster',                  icon: '🌪️', accent: '#7C2D12' },
  honours:                      { label: 'Honours',                   icon: '🏅', accent: '#B45309' },
  'major_national/global_circumstances': { label: 'National/Global Circumstances', icon: '🌐', accent: '#1E40AF' },
  major_national_global_circumstances:   { label: 'National/Global Circumstances', icon: '🌐', accent: '#1E40AF' },
  pandemic:                     { label: 'Pandemic',                  icon: '🦠', accent: '#7C3AED' },
  political_event:              { label: 'Political Event',           icon: '🏛️', accent: '#1E3A5F' },
  public_acknowledgements:      { label: 'Public Acknowledgements',   icon: '📣', accent: '#0369A1' },
  war:                          { label: 'War',                       icon: '⚔️', accent: '#991B1B' },
  ashram_construction:          { label: 'Ashram Construction',       icon: '🏗️', accent: '#78350F' },
  center_establishment:         { label: 'Center Establishment',      icon: '🏛️', accent: '#1D4ED8' },
  ceremony:                     { label: 'Ceremony',                  icon: '🪔', accent: '#7C3AED' },
  community_service:            { label: 'Community Service',         icon: '🤲', accent: '#065F46' },
  daily_routine:                { label: 'Daily Routine',             icon: '🌅', accent: '#0369A1' },
  dietary_practices:            { label: 'Dietary Practices',         icon: '🍽️', accent: '#15803D' },
  diksha:                       { label: 'Diksha',                    icon: '🔔', accent: '#6D28D9' },
  disaster_relief:              { label: 'Disaster Relief',           icon: '🤲', accent: '#0E7490' },
  divine_vision:                { label: 'Divine Vision',             icon: '🌟', accent: '#7C3AED' },
  education:                    { label: 'Education',                 icon: '📚', accent: '#1D4ED8' },
  fasting:                      { label: 'Fasting',                   icon: '🌙', accent: '#6D28D9' },
  first_meeting:                { label: 'First Meeting',             icon: '🌅', accent: '#BE185D' },
  founding_date:                { label: 'Founding Date',             icon: '📌', accent: '#1E40AF' },
  gifts:                        { label: 'Gifts',                     icon: '🎁', accent: '#B45309' },
  governance_event:             { label: 'Governance Event',          icon: '⚖️', accent: '#374151' },
  healthcare:                   { label: 'Healthcare',                icon: '🏥', accent: '#065F46' },
  infrastructure_milestone:     { label: 'Infrastructure Milestone',  icon: '🏗️', accent: '#0F766E' },
  institution_establishment:    { label: 'Institution Establishment', icon: '🏛️', accent: '#1E3A5F' },
  institutional_changes:        { label: 'Institutional Changes',     icon: '🔄', accent: '#4338CA' },
  international_visit:          { label: 'International Visit',       icon: '✈️', accent: '#0369A1' },
  journey:                      { label: 'Journey',                   icon: '🛤️', accent: '#0E7490' },
  land_acquisition:             { label: 'Land Acquisition',          icon: '🏡', accent: '#78350F' },
  manuscripts:                  { label: 'Manuscripts',               icon: '📜', accent: '#92400E' },
  meditation_milestone:         { label: 'Meditation Milestone',      icon: '🧘', accent: '#6D28D9' },
  meeting:                      { label: 'Meeting',                   icon: '🤝', accent: '#234E52' },
  mystical_experience:          { label: 'Mystical Experience',       icon: '✨', accent: '#7C3AED' },
  notable_interaction:          { label: 'Notable Interaction',       icon: '💬', accent: '#0F766E' },
  notable_photographs:          { label: 'Notable Photographs',       icon: '📷', accent: '#374151' },
  organizational_milestone:     { label: 'Org. Milestone',            icon: '🏆', accent: '#4338CA' },
  period:                       { label: 'Period',                    icon: '⏳', accent: '#4A5568' },
  personal_objects:             { label: 'Personal Objects',          icon: '📿', accent: '#78716c' },
  philosophical_discourse:      { label: 'Philosophical Discourse',   icon: '💭', accent: '#744210' },
  physical_discipline:          { label: 'Physical Discipline',       icon: '💪', accent: '#B45309' },
  physical_health:              { label: 'Physical Health',           icon: '🌿', accent: '#15803D' },
  pilgrimage:                   { label: 'Pilgrimage',                icon: '🚶', accent: '#92400E' },
  samadhi:                      { label: 'Samadhi',                   icon: '🌸', accent: '#6D28D9' },
  sleep_patterns:               { label: 'Sleep Patterns',            icon: '🌙', accent: '#1E3A5F' },
  social_welfare:               { label: 'Social Welfare',            icon: '🌱', accent: '#065F46' },
  spiritual_breakthrough:       { label: 'Spiritual Breakthrough',    icon: '⭐', accent: '#7C3AED' },
  spiritual_instruction:        { label: 'Spiritual Instruction',     icon: '📖', accent: '#744210' },
  temple_inauguration:          { label: 'Temple Inauguration',       icon: '🛕', accent: '#C2410C' },
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

interface Incident {
  _id: string
  description: string
  category?: string
  date?: { year?: number; period?: string; precision?: string }
  people?: string[]
  locations?: string[]
  source_chunk?: string
  verified?: boolean
  nlm_source_links?: { source_id: string; cited_text: string; nlm_url: string }[]
}

interface Props {
  incident: Incident
  layout?: 'grid' | 'list'
  highlightQuery?: string
}

export default function IncidentCard({ incident, layout = 'grid', highlightQuery = '' }: Props) {
  const [isCopied, setIsCopied] = useState(false)
  const [isQuoteExpanded, setIsQuoteExpanded] = useState(false)

  // Normalise: lowercase + spaces→underscores so "Daily Dateline" matches "daily_dateline"
  const normCat = (incident.category || '').toLowerCase().replace(/\s+/g, '_').trim()
const meta = CATEGORY_COLORS[normCat] ?? CATEGORY_COLORS[incident.category || ''] ?? {
    label: (incident.category || 'record').replace(/_/g, ' '),
    icon: '📌',
    accent: '#78716c',
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(incident.description)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const refId = 'REF-' + incident._id.slice(-6).toUpperCase()

  // ── LIST layout ──────────────────────────────────────────────────────────
  if (layout === 'list') {
    return (
      <div className="group relative bg-[#FDFBF9] border border-[#E9E4DF] rounded-[14px] p-4 transition-all duration-150 flex flex-col md:flex-row md:items-center gap-4 hover:bg-[#FAF6F1] hover:border-[#D6CEC5]">
        <div className="shrink-0 md:w-24 select-none">
          {incident.date?.year
            ? <span className="font-sans font-semibold text-xs px-2.5 py-1 rounded-full border"
                style={{ backgroundColor: meta.accent + '12', color: meta.accent, borderColor: meta.accent + '30' }}>
                {incident.date.year}
              </span>
            : <span className="font-sans text-[11px] font-medium text-[#A6978C] bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E9E1D8]">Undated</span>
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1 text-[11px] font-sans font-bold select-none text-[#564940]">
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: meta.accent }} />
            <span className="uppercase tracking-wide">{meta.label}</span>
            <span className="text-[#D0C0B4]">/</span>
            <span className="text-[#A1958C] font-normal font-mono">{refId}</span>
          </div>
          <p className="font-sans text-[#2C2117] text-[14.5px] leading-relaxed font-light tracking-wide">
            <HighlightText text={incident.description} highlight={highlightQuery} />
          </p>
          {incident.source_chunk && (
            <div className="mt-1.5 pl-3 border-l-2" style={{ borderColor: meta.accent + '60' }}>
              <p className="text-[#645A51] text-[12.5px] leading-relaxed italic font-sans font-light">
                "{incident.source_chunk}"
              </p>
            </div>
          )}
          {(incident.people?.length || incident.locations?.length) ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 select-none">
              {incident.people?.map((p, i) => (
                <span key={i} className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                  style={{ backgroundColor: meta.accent + '10', color: meta.accent, borderColor: meta.accent + '25' }}>
                  @<HighlightText text={p} highlight={highlightQuery} />
                </span>
              ))}
              {incident.locations?.map((l, i) => (
                <span key={i} className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                  style={{ backgroundColor: meta.accent + '10', color: meta.accent, borderColor: meta.accent + '25' }}>
                  📍<HighlightText text={l} highlight={highlightQuery} />
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-sans font-medium shrink-0 select-none">
          <button onClick={handleCopy} className="text-[#645A51] hover:text-[#2C2117] transition-colors cursor-pointer">
            {isCopied ? '[copied ✓]' : '[copy]'}
          </button>
          {incident.nlm_source_links?.[0] && (
            <a href={incident.nlm_source_links[0].nlm_url} target="_blank" rel="noopener noreferrer"
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
        {/* Status bar */}
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-[#F2ECE6]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: meta.accent }} />
            <span className="text-[11px] font-sans font-bold text-[#564940] uppercase tracking-widest">{meta.label}</span>
          </div>
          <span className="text-[10px] font-sans font-medium text-[#A1958C] tracking-wide">{refId}</span>
        </div>

        {/* Year */}
        {incident.date?.year && (
          <div className="mb-3">
            <span className="text-[11px] font-sans font-bold px-2.5 py-0.5 rounded border"
              style={{ backgroundColor: meta.accent + '12', color: meta.accent, borderColor: meta.accent + '30' }}>
              {incident.date.year}
              {incident.date.period && <span className="ml-1.5 text-[10px] font-normal opacity-70 uppercase tracking-wide">· {incident.date.period}</span>}
            </span>
          </div>
        )}

        {/* Description */}
        <div className="mb-4">
          <p className="font-sans text-[#2C2117] text-[14.5px] leading-relaxed antialiased font-light tracking-wide">
            <HighlightText text={incident.description} highlight={highlightQuery} />
          </p>
        </div>

        {/* Source quote — left border uses category accent */}
        {incident.source_chunk && (
          <div className="mb-4 pl-3 border-l-2" style={{ borderColor: meta.accent + '60' }}>
            <p className={`font-sans font-light text-[#645A51] text-[13px] leading-relaxed italic ${!isQuoteExpanded ? 'line-clamp-2' : ''}`}>
              "{incident.source_chunk}"
            </p>
            {incident.source_chunk.length > 90 && (
              <button onClick={e => { e.stopPropagation(); setIsQuoteExpanded(v => !v) }}
                className="mt-1 text-[11px] font-semibold transition-colors hover:underline"
                style={{ color: meta.accent }}>
                {isQuoteExpanded ? 'Collapse' : 'Show Full Quote'}
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        {/* People & location tags — tinted with category accent */}
        {(incident.people?.length || incident.locations?.length) ? (
          <div className="flex flex-wrap gap-1.5 mb-4 select-none">
            {incident.people?.map((p, i) => (
              <span key={i} className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                style={{ backgroundColor: meta.accent + '10', color: meta.accent, borderColor: meta.accent + '25' }}>
                @<HighlightText text={p} highlight={highlightQuery} />
              </span>
            ))}
            {incident.locations?.map((l, i) => (
              <span key={i} className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                style={{ backgroundColor: meta.accent + '10', color: meta.accent, borderColor: meta.accent + '25' }}>
                📍<HighlightText text={l} highlight={highlightQuery} />
              </span>
            ))}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#F2ECE6] text-[11px] font-sans font-bold">
          <button onClick={handleCopy} className="text-[#645A51] hover:text-[#2C2117] transition-colors flex items-center gap-1 cursor-pointer select-none">
            {isCopied
              ? <><Check className="w-3 h-3 stroke-[2.5]" /> copied ✓</>
              : <><Copy className="w-3 h-3" /> copy bio</>
            }
          </button>
          {incident.nlm_source_links?.[0]
            ? <a href={incident.nlm_source_links[0].nlm_url} target="_blank" rel="noopener noreferrer"
                className="text-[#794E2C] hover:text-[#533013] transition-colors flex items-center gap-1 hover:underline">
                source ↗
              </a>
            : <span className="text-[10px] text-[#A6978C] font-mono font-medium">local.db</span>
          }
        </div>
      </div>
    </div>
  )
}
