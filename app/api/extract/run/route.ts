import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { createHash } from 'crypto'
import { getDb, COLLECTIONS } from '@/lib/db'

function contentHash(notebookId: string, category: string, key: string): string {
  return createHash('sha1')
    .update(`${notebookId}|${category}|${key.trim().toLowerCase()}`)
    .digest('hex')
}

const ASK_SCRIPT = join(process.cwd(), 'scripts', 'nlm_ask.py')
const PYTHON = process.platform === 'win32' ? 'python' : 'python3'

// ─── Standard extraction ────────────────────────────────────────────────────

// IMPORTANT SUBJECT CONTEXT — must be applied to ALL prompts:
// • Param Krupalu Dev (also known as Shrimad Rajchandra) lived 1867–1901. Any incident dated in
//   that range refers to HIM, not to Gurudevshri.
// • Pujya Gurudevshri (also known as Gurudev) was born in 1966. Incidents from 1966 onward
//   may refer to him. Never attribute a pre-1966 incident to Gurudevshri.
// • When the source text is ambiguous about who is being referred to, use the date to decide:
//   1867–1901 → Param Krupalu Dev. 1966–present → Pujya Gurudevshri.

const SUBJECT_CONTEXT = `IMPORTANT — Two distinct subjects appear in these sources:
1. Param Krupalu Dev (Shrimad Rajchandra): lived 1867–1901. Any incident, teaching, or event from that period refers to HIM.
2. Pujya Gurudevshri (Gurudev): born 1966. Incidents from 1966 onward may refer to Him.
Never attribute a pre-1966 incident to Pujya Gurudevshri. Use the year to decide who is the subject.`

const PROMPTS: Record<string, string> = {
  daily_dateline:           `${SUBJECT_CONTEXT}\n\nExtract all chronological dateline events — meetings, ceremonies, inaugurations, daily routines — of the correct subject (Param Krupalu Dev if 1867–1901, Pujya Gurudevshri if 1966–present). Do not include events of disciples, visitors, or other individuals.`,
  health_aahar_discipline:  `${SUBJECT_CONTEXT}\n\nExtract all mentions of the subject's physical health, dietary practices, fasting, sleep patterns, and physical discipline — attributing correctly to Param Krupalu Dev (1867–1901) or Pujya Gurudevshri (1966–present). Do not include health mentions of others.`,
  spiritual_exp:            `${SUBJECT_CONTEXT}\n\nExtract mystical experiences, samadhi states, meditation milestones, divine visions, and spiritual breakthroughs — attributing correctly to Param Krupalu Dev (1867–1901) or Pujya Gurudevshri (1966–present). Do not include experiences of disciples or devotees.`,
  teachings_guidance:       `${SUBJECT_CONTEXT}\n\nExtract satsangs, pravachans, philosophical discourses, and spiritual instructions — attributing correctly to Param Krupalu Dev (1867–1901) or Pujya Gurudevshri (1966–present). Do not include teachings by others.`,
  people_encounters:        `${SUBJECT_CONTEXT}\n\nExtract first meetings, dikshas, and notable interactions where the correct subject (Param Krupalu Dev if 1867–1901, Pujya Gurudevshri if 1966–present) is the central figure — with disciples, visitors, and public figures.`,
  travels_journeys:         `${SUBJECT_CONTEXT}\n\nExtract all travel — pilgrimages, yatras, national and international visits, journeys — undertaken by the correct subject (Param Krupalu Dev if 1867–1901, Pujya Gurudevshri if 1966–present). Do not include travel of others unless the subject was present.`,
  institutional_timeline:   `${SUBJECT_CONTEXT}\n\nExtract founding dates, organizational milestones, governance events, and institutional changes led or initiated by the correct subject or the Mission under their direction — attributing correctly by date.`,
  seva_projects:            `${SUBJECT_CONTEXT}\n\nExtract community service, education, healthcare, disaster relief, and social welfare initiatives undertaken by the correct subject (Param Krupalu Dev if 1867–1901, Pujya Gurudevshri if 1966–present) or the Mission under their leadership.`,
  awards_accreds:           `${SUBJECT_CONTEXT}\n\nExtract awards, honours, government recognition, honorary degrees, and public acknowledgements received by the correct subject — attributing correctly by date. Do not include awards given to others.`,
  physical_spaces:          `${SUBJECT_CONTEXT}\n\nExtract ashram construction, land acquisition, temple inaugurations, and infrastructure milestones directed or inaugurated by the correct subject (Param Krupalu Dev if 1867–1901, Pujya Gurudevshri if 1966–present).`,
  social_contextual:        `${SUBJECT_CONTEXT}\n\nExtract references to the prevailing social, political, or world conditions during a given time period — such as wars, pandemics (e.g. COVID 2019–2021), famines, political events, or major national/global circumstances — as context for the era in which the subject (Param Krupalu Dev 1867–1901, or Pujya Gurudevshri 1966–present) was active. Do not extract the subject's responses or actions — only the background conditions of the era.`,
  life_formation:           `${SUBJECT_CONTEXT}\n\nExtract birth, childhood, family background, early education, and formative life events — attributing correctly to Param Krupalu Dev (born 1867) or Pujya Gurudevshri (born 1966). Do not include biographical details of others.`,
  artifacts:                `${SUBJECT_CONTEXT}\n\nExtract personal objects, manuscripts, gifts, sacred items, and notable photographs belonging to or associated with the correct subject (Param Krupalu Dev if 1867–1901, Pujya Gurudevshri if 1966–present).`,
}

const FIXED_CATEGORIES = [
  'daily_dateline', 'health_aahar_discipline', 'spiritual_exp', 'teachings_guidance',
  'people_encounters', 'travels_journeys', 'institutional_timeline', 'seva_projects',
  'awards_accreds', 'physical_spaces', 'social_contextual', 'life_formation', 'artifacts',
]

const PROMPT_SUFFIX = `
Return ONLY structured blocks in this exact format:

INCIDENT [1]
DESCRIPTION: <one sentence factual description>
DATE: <year, decade, or period>
DATE_PRECISION: year|decade|period|approximate|unknown
PEOPLE: <comma-separated names, or NONE>
LOCATIONS: <comma-separated places, or NONE>
CATEGORY: <choose exactly one from: daily_dateline | health_aahar_discipline | spiritual_exp | teachings_guidance | people_encounters | travels_journeys | institutional_timeline | seva_projects | awards_accreds | physical_spaces | social_contextual | life_formation | artifacts>
TAGS: <comma-separated specific descriptive tags for this incident, e.g. diksha, samadhi, pilgrimage, fasting — can be anything, multiple allowed, or NONE>
SOURCE_CHUNK: <exact short quote from source, max 150 chars>

INCIDENT [2]
...

If nothing found: NO_INCIDENTS_FOUND`

interface ParsedIncident {
  description: string
  date: { year?: number; period: string; precision: string }
  people: string[]
  locations: string[]
  category: string
  tags: string[]
  source_chunk: string
  verified: boolean
  confidence: string
}

function fieldValue(block: string, name: string): string {
  const m = block.match(new RegExp(`^${name}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 'im'))
  return m ? m[1].trim() : ''
}

function parseList(raw: string): string[] {
  if (!raw || /^none$/i.test(raw.trim())) return []
  return raw.split(/[,;]+/).map(s => s.trim()).filter(s => s && !/^none$/i.test(s))
}

function parseYear(raw: string): number | undefined {
  const m = raw.match(/\b(1[89]\d{2}|20[012]\d)\b/)
  if (m) return parseInt(m[1])
  const dec = raw.match(/\b(\d{4})s\b/)
  if (dec) return parseInt(dec[1])
  return undefined
}

function parseResponse(text: string, category: string): ParsedIncident[] {
  if (!text || text.includes('NO_INCIDENTS_FOUND')) return []
  const blocks = text.split(/INCIDENT\s*\[\d+\]/i).slice(1)
  return blocks.flatMap(block => {
    const desc = fieldValue(block, 'DESCRIPTION')
    if (!desc) return []
    const dateRaw = fieldValue(block, 'DATE')
    // Enforce fixed category — fall back to the extraction category key if model returned invalid
    const rawCat = fieldValue(block, 'CATEGORY')
    const resolvedCat = FIXED_CATEGORIES.includes(rawCat) ? rawCat : category
    return [{
      description: desc,
      date: { year: parseYear(dateRaw), period: dateRaw, precision: fieldValue(block, 'DATE_PRECISION') || 'unknown' },
      people: parseList(fieldValue(block, 'PEOPLE')),
      locations: parseList(fieldValue(block, 'LOCATIONS')),
      category: resolvedCat,
      tags: parseList(fieldValue(block, 'TAGS')),
      source_chunk: fieldValue(block, 'SOURCE_CHUNK'),
      verified: false,
      confidence: 'auto_extracted',
    }]
  })
}

// ─── Bapa Katha extraction ───────────────────────────────────────────────────

const BK_BASE = `This is a Bapa Katha transcript — devotee interviews sharing personal experiences with Gurudevshri / Bapaji.
Be exhaustive. Extract every relevant moment. This transcript should not need to be re-run.`

const BK_PROMPTS: Record<string, string> = {
  bk_line_that_changed_me: `${BK_BASE}

Find every instance where a devotee recalls a single sentence or phrase spoken by Gurudevshri that caused an immediate or lasting shift in their thinking, behavior, or life direction. For each instance, note: the exact words spoken, the situation in which it was said, the devotee's state before hearing it, and what changed after. Also find moments where a devotee brought a specific personal question to Gurudevshri and received an answer that redirected their inner life.`,

  bk_shared_events: `${BK_BASE}

Find all instances where multiple devotees describe being present at the same specific event — a yatra, a satsang, a pratishtha, a paryushan, a shibir. For each shared event, note: the location and approximate year, what each person remembers seeing or hearing, any differences in what each person noticed, and what made that specific gathering memorable or transformative.`,

  bk_first_meeting: `${BK_BASE}

Find every account of a devotee's very first encounter with Gurudevshri. For each first meeting, note: how the meeting happened (was it planned or accidental), what the devotee's attitude or state was before meeting Him, the first thing they noticed or felt, any words spoken, and how their life shifted from that moment onward.`,

  bk_humour: `${BK_BASE}

Find every instance of Gurudevshri being playful, witty, teasing, or using humor — with children, with devotees, in informal settings, in response to devotees' mistakes, or during games and outings. For each instance, note: the exact playful action or words, who was present, the devotee's reaction, and whether the humor carried a hidden teaching.`,

  bk_one_ajna: `${BK_BASE}

Find every instance where Gurudevshri gave a specific personal instruction — about career, marriage, diet, business, daily practice, relationships, or life decisions — to an individual devotee. For each instance, note: what the devotee's situation or dilemma was, the exact guidance given, how the guidance was delivered (direct, through a question, through a story), whether the devotee followed it, and what the outcome was.`,

  bk_the_object: `${BK_BASE}

Find every instance where a physical object plays a central role in an interaction with Gurudevshri — something He gave, received, refused, used, threw, or pointed to. For each instance, note: what the object was, the exact moment involving it, what He said or did with it, who received or witnessed it, and whether the object still exists with that person today.`,

  bk_discipline_training: `${BK_BASE}

Find every instance where Gurudevshri was visibly stern, corrective, or gave a difficult instruction — removing someone from a role, asking someone to leave, assigning a penance, refusing a request, or delivering a sharp rebuke. For each instance, note: what triggered the correction, the exact words or action used, the devotee's immediate reaction, and how the devotee understood or reframed that strictness in hindsight.`,

  bk_dasha_family: `${BK_BASE}

Find every instance where a blood relative, childhood neighbor, or person who knew Gurudevshri before He was publicly known describes an observation of His inner state or unusual behavior — in childhood, teenage years, or early youth. For each instance, note: the approximate age of Gurudevshri at the time, what was observed (stillness, unusual knowledge, detachment, spontaneous teaching), the setting, and the narrator's own understanding of what they were witnessing.`,

  bk_non_jain: `${BK_BASE}

Find every instance involving a devotee who came from outside the Jain tradition — a different religion, a different cultural background, a different country or language — and how Gurudevshri connected with or guided them. For each instance, note: who the person was and what their background was, how the connection was established, any specific words or actions by Gurudevshri toward them, and what drew or kept that person in His circle.`,

  bk_he_found_me_first: `${BK_BASE}

Find every instance where Gurudevshri initiated contact, waited for, traveled toward, or specifically reached out to a devotee who was not actively seeking — or a moment where He demonstrated He had been watching, waiting, or working for a soul before that soul was aware of Him. For each instance, note: what Gurudevshri did or said that was unexpected, the devotee's state or distance from spiritual seeking at that time, and the devotee's response on realizing they had been found first.`,

  bk_he_doesnt_see_time: `${BK_BASE}

Find every instance that reveals Gurudevshri's relationship with time — staying awake through the night, replying to letters or emails before sleeping, attending to individuals at unusual hours, being present at dawn for sadhana, continuing without rest across days of yatra or shibir. For each instance, note: the time of day or night, what He was doing, who witnessed it, and what it revealed about His inner state or commitment.`,

  bk_vision_behind_projects: `${BK_BASE}

Find every instance where Gurudevshri expressed a vision of what the mission, an ashram, a community, or a project would become — before it existed. For each instance, note: the exact words of the vision as spoken, the setting and approximate year, who was present, and what eventually came to pass that matched or exceeded what He described.`,

  bk_compassion_seva: `${BK_BASE}

Find every instance that reveals Gurudevshri's compassion — toward animals, the ill, the poor, children, strangers, or devotees in distress. For each instance, note: who or what was the recipient of the compassion, the specific action or words Gurudevshri used, whether He planted the impulse for seva in a devotee, and how that compassion extended beyond the moment into ongoing action or mission work.`,

  bk_children_teaching: `${BK_BASE}

Find every instance involving children — either Gurudevshri as a child teaching others, or Gurudevshri teaching children through games, play, stories, or informal settings in His later years. For each instance, note: the age of Gurudevshri or the children involved, the specific activity or game, the teaching that was woven into it, and whether the child grew up to carry that teaching forward.`,

  bk_satsang_transformation: `${BK_BASE}

Find every instance where a devotee describes how attending satsang — a single session or over time — changed them, answered an unspoken question, dissolved a habit or addiction, or resolved a life situation without the devotee explicitly asking for help. For each instance, note: what the devotee's inner state or outer situation was before the satsang, what was spoken in satsang, what shifted, and whether the transformation was immediate or gradual.`,

  bk_love_for_pkd: `${BK_BASE}

Find every instance that reveals the depth of Gurudevshri's personal devotion to Param Krupalu Dev — through bhakti, through how He speaks about Him, through the intensity of His practice, through how He transmitted that love to others. For each instance, note: the specific words, actions, or expressions of devotion, the setting, the devotee witnessing it, and what it conveyed about the nature of His relationship with Param Krupalu Dev.`,

  bk_letters_mails: `${BK_BASE}

Find every instance involving a letter or written communication — a letter written by Gurudevshri to a devotee, a letter a devotee received in a moment of crisis, a patrank being read aloud, or the practice of mail replies before sleep. For each instance, note: who the letter was to or from, the occasion or need that prompted it, any specific words quoted or remembered, and what the letter meant to the person who received it.`,

  bk_night_satsang: `${BK_BASE}

Find every instance of Gurudevshri conducting satsang, giving guidance, or attending to devotees at night — late evenings, after midnight, or early pre-dawn hours. For each instance, note: the approximate time, the setting, who was present, what was discussed or transmitted, and why night was chosen or simply when it happened. Also capture any stories of seekers who approached Him at unusual hours and received personal attention.`,

  bk_question_answer: `${BK_BASE}

Find every instance where a devotee posed a direct question to Gurudevshri — about life decisions, spiritual doubt, philosophical puzzles, personal struggles, or practical matters — and He gave a specific answer. For each instance, note: the exact question as asked, the context in which it was posed (private, public satsang, walk, dining), the exact or paraphrased answer He gave, and whether the answer resolved the devotee's doubt or opened a new direction of inquiry.`,

  bk_closing_accounts: `${BK_BASE}

Find every instance where Gurudevshri settled, resolved, or closed a karmic or personal account with someone — a past acquaintance, a family member, an adversary, or a devotee. This includes moments where He visited, forgave, reconciled with, or completed an unfinished connection with a person from His or another's past. Note: who the person was, the nature of the prior relationship or debt, what Gurudevshri said or did, and how the account was considered closed.`,

  bk_same_incident_diff_ajna: `${BK_BASE}

Find every instance where two or more devotees describe the same event, the same gathering, or the same interaction with Gurudevshri — but received different instructions, had different experiences, or noticed different things. For each such case, note: the shared event or moment, each person's account of what they observed or were told, and what the difference in ajna or experience reveals about how He works individually within a collective.`,

  bk_gurudev_as_child: `${BK_BASE}

Find every account of Gurudevshri's childhood and early youth — told by family members, childhood neighbors, schoolmates, or elders who knew Him before He was publicly recognized. For each account, note: the approximate age of Gurudevshri, what was observed (unusual stillness, early signs of detachment, early spiritual questioning, acts of compassion or unusual maturity), the narrator's relationship to Him at the time, and what that memory means to them now.`,

  bk_meditation_inner_state: `${BK_BASE}

Find every account of Gurudevshri's personal sadhana, meditation, or inner experience — either witnessed by a devotee or described in His own words. This includes: accounts of His dhyan practice, references to Bhedjnan (the distinction between Self and non-Self), descriptions of His inner state during or after meditation, unusual stillness or radiance noticed by observers, and moments where He pointed others toward their own inner state. Note: the setting, who was present, what was seen or said, and what stage of spiritual depth it pointed to.`,

  bk_study_group: `${BK_BASE}

Find every account related to the Study Group — the intimate group of young seekers from Gurudevshri's early years who received His personal attention through satsang, shared trips, study sessions, and informal time together. For each account, note: who was part of the group, the approximate era (early years of His teaching), the specific activity or setting (trip, study session, discussion), what He taught or transmitted in that context, and how that personal touch shaped the devotee's path. Look for references to group study, youth retreats, personal trips, and the closeness of that early circle.`,
}

const BK_CANONICAL_TAGS = `

When extracting tags, prefer these canonical tag values when the story context matches:
train | bus | cycle | walking | running | boating | beach | snow | dining_table | phone_call | night_satsang | games_playfulness | jeevdaya | monument | visionary | seva | informal_youth | he_as_devotee | relation_pkd | sadhana | family_member | study_group | closing_accounts | question_answer | meditation | dhyan | bhedjnan | inner_state | same_incident_diff_ajna | gurudev_as_child

Use them exactly as written above (snake_case). Add other free-form tags as needed for content not covered above.`

const BK_GENERAL_SUFFIX = `${BK_CANONICAL_TAGS}

Return ONLY structured blocks in this exact format:

STORY [1]
STORY_ID: <INITIALS>-<N>
STORY_TITLE: <short cinematic title>
CATEGORY: <category key — e.g. bk_first_meeting>
STORY_TYPE: <transformation | agna | satsang | bhakti | seva | youth | dasha | humour | crisis | family | mystical | vision | compassion | letter | object | correction>
TIME_LIFE_STAGE: <year, decade, or life stage — "not specified" if unknown>
LOCATION: <place — "not specified" if unknown>
SUMMARY: <2-line editorial summary>
WHAT_HAPPENED: <concrete incident with specific details — avoid generic praise>
WHAT_GURUDEV_SAID: <exact words if available — "exact wording not available" if not>
TRANSFORMATION: <before state, inner shift, after state — "none evident" if not present>
QUOTE_CLIP_POTENTIAL: <High | Medium | Low | Needs Review>

STORY [2]
...

If nothing found: NO_STORIES_FOUND`

interface ParsedBKStory {
  story_id: string
  story_title: string
  story_type: string
  time_life_stage: string
  location: string
  summary: string
  what_happened: string
  what_gurudev_said: string
  transformation: string
  quote_clip_potential: string
  category: string
  source_type: 'bapa_katha'
}

function parseBKResponse(text: string, category: string): ParsedBKStory[] {
  if (!text || text.includes('NO_STORIES_FOUND')) return []
  const blocks = text.split(/STORY\s*\[\d+\]/i).slice(1)
  return blocks.flatMap(block => {
    const title = fieldValue(block, 'STORY_TITLE')
    if (!title) return []
    const story: ParsedBKStory = {
      story_id:          fieldValue(block, 'STORY_ID'),
      story_title:       title,
      story_type:        fieldValue(block, 'STORY_TYPE'),
      time_life_stage:   fieldValue(block, 'TIME_LIFE_STAGE') || 'not specified',
      location:          fieldValue(block, 'LOCATION') || 'not specified',
      summary:           fieldValue(block, 'SUMMARY'),
      what_happened:     fieldValue(block, 'WHAT_HAPPENED'),
      what_gurudev_said: fieldValue(block, 'WHAT_GURUDEV_SAID') || 'exact wording not available',
      transformation:    fieldValue(block, 'TRANSFORMATION') || 'none evident',
      quote_clip_potential: fieldValue(block, 'QUOTE_CLIP_POTENTIAL') || 'Needs Review',
      category,
      source_type: 'bapa_katha',
    }
    return [story]
  })
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

interface AskResponse {
  answer: string
  references: { source_id: string; cited_text: string; citation_number: number | null }[]
}

function askNotebook(notebookId: string, prompt: string): Promise<AskResponse> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [ASK_SCRIPT, notebookId, prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let stdout = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.on('close', () => {
      try {
        const r = JSON.parse(stdout.trim())
        if (r.error) reject(new Error(r.error))
        else resolve({ answer: r.answer || '', references: r.references || [] })
      } catch {
        reject(new Error('Invalid response from nlm_ask.py'))
      }
    })
    proc.on('error', reject)
  })
}

function evt(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { notebook_ids, categories, bapa_katha_ids = [], notebook_titles = {} } = await req.json()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) => controller.enqueue(enc.encode(evt(data)))

      const total = notebook_ids.length * categories.length
      let done = 0

      try {
        const db = await getDb()

        for (const nbId of notebook_ids as string[]) {
          const isBK = (bapa_katha_ids as string[]).includes(nbId)
          const nbTitle: string = (notebook_titles as Record<string, string>)[nbId] || nbId.slice(0, 8)

          send({ msg: `━━ Notebook: ${nbTitle}${isBK ? ' [Bapa Katha]' : ''}`, level: 'info' })

          for (const cat of categories as string[]) {
            send({ msg: `  Querying [${cat}]…`, level: 'info' })

            try {
              let prompt: string
              if (isBK) {
                prompt = (BK_PROMPTS[cat] || `${BK_BASE}\n\nExtract all ${cat.replace('bk_', '')} stories.`) + BK_GENERAL_SUFFIX
              } else {
                prompt = (PROMPTS[cat] || `Extract all ${cat} incidents.`) + PROMPT_SUFFIX
              }

              const { answer, references } = await askNotebook(nbId, prompt)
              const now = new Date()

              // Build source links from references: { source_id → nlm_url }
              const nlmSourceLinks = references
                .filter(r => r.source_id)
                .map(r => ({
                  source_id: r.source_id,
                  cited_text: r.cited_text,
                  nlm_url: `https://notebooklm.google.com/notebook/${nbId}?source=${r.source_id}`,
                }))

              if (isBK) {
                const stories = parseBKResponse(answer, cat)
                if (stories.length === 0) {
                  send({ msg: `  → No stories found`, level: 'muted' })
                } else {
                  let saved = 0, skipped = 0
                  for (const story of stories) {
                    const hash = contentHash(nbId, cat, story.story_title + story.what_happened.slice(0, 80))
                    const result = await db.collection(COLLECTIONS.bk_stories).updateOne(
                      { contentHash: hash },
                      { $setOnInsert: { ...story, contentHash: hash, extracted_at: now, source_notebook: nbId, source_notebook_title: nbTitle, nlm_source_links: nlmSourceLinks } },
                      { upsert: true }
                    )
                    if (result.upsertedCount > 0) saved++
                    else skipped++
                  }
                  const msg = skipped > 0
                    ? `  ✓ ${saved} new stor${saved !== 1 ? 'ies' : 'y'} saved · ${skipped} already existed`
                    : `  ✓ ${saved} stor${saved !== 1 ? 'ies' : 'y'} saved`
                  send({ msg: saved > 0 ? msg : `  → No new stories — all ${skipped} already extracted`, level: saved > 0 ? 'success' : 'muted' })
                  if (saved > 0) {
                    await db.collection(COLLECTIONS.extractions).insertOne({
                      notebook_id: nbId, category: cat, notebook_type: 'bapa_katha',
                      points_saved: saved, points_skipped: skipped,
                      status: 'done', started_at: now,
                    })
                  }
                }
              } else {
                const incidents = parseResponse(answer, cat)
                if (incidents.length === 0) {
                  send({ msg: `  → No points found`, level: 'muted' })
                } else {
                  let saved = 0, skipped = 0
                  for (const inc of incidents) {
                    const hash = contentHash(nbId, cat, inc.description)
                    const result = await db.collection(COLLECTIONS.incidents).updateOne(
                      { contentHash: hash },
                      { $setOnInsert: { ...inc, contentHash: hash, extracted_at: now, source_notebook: nbId, source_notebook_title: nbTitle, source_type: 'notebooklm', nlm_source_links: nlmSourceLinks } },
                      { upsert: true }
                    )
                    if (result.upsertedCount > 0) saved++
                    else skipped++
                  }
                  const msg = skipped > 0
                    ? `  ✓ ${saved} new point(s) saved · ${skipped} already existed`
                    : `  ✓ ${saved} point(s) saved`
                  send({ msg: saved > 0 ? msg : `  → No new points — all ${skipped} already extracted`, level: saved > 0 ? 'success' : 'muted' })
                  if (saved > 0) {
                    await db.collection(COLLECTIONS.extractions).insertOne({
                      notebook_id: nbId, category: cat,
                      points_saved: saved, points_skipped: skipped,
                      status: 'done', started_at: now,
                    })
                  }
                }
              }
            } catch (e) {
              send({ msg: `  ✗ ${e}`, level: 'error' })
            }

            done++
            send({ progress: done, total })
          }
        }
      } catch (e) {
        send({ msg: `Fatal: ${e}`, level: 'error' })
      }

      send({ done: true })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
