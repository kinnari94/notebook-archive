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

const PROMPTS: Record<string, string> = {
  daily_dateline:           'Extract all chronological dateline events — meetings, ceremonies, inaugurations, daily routines — of Gurudev / Pujya Gurudevshri only. Do not include events of disciples, visitors, or other individuals.',
  health_aahar_discipline:  'Extract all mentions of Gurudev\'s / Pujya Gurudevshri\'s physical health, dietary practices, fasting, sleep patterns, and physical discipline. Do not include health mentions of others.',
  spiritual_exp:            'Extract Gurudev\'s / Pujya Gurudevshri\'s mystical experiences, samadhi states, meditation milestones, divine visions, and spiritual breakthroughs. Do not include experiences attributed to disciples or devotees.',
  teachings_guidance:       'Extract satsangs, pravachans, philosophical discourses, and spiritual instructions given by Gurudev / Pujya Gurudevshri to disciples. Do not include teachings by others.',
  people_encounters:        'Extract first meetings, dikshas, and notable interactions where Gurudev / Pujya Gurudevshri is the central figure — with disciples, visitors, and public figures.',
  travels_journeys:         'Extract all travel — pilgrimages, yatras, national and international visits, journeys — undertaken by Gurudev / Pujya Gurudevshri. Do not include travel of others unless Gurudev was present.',
  institutional_timeline:   'Extract founding dates, organizational milestones, governance events, and institutional changes led or initiated by Gurudev / Pujya Gurudevshri or the Mission under his direction.',
  seva_projects:            'Extract community service, education, healthcare, disaster relief, and social welfare initiatives undertaken by Gurudev / Pujya Gurudevshri or the Mission under his leadership.',
  awards_accreds:           'Extract awards, honours, government recognition, honorary degrees, and public acknowledgements received by Gurudev / Pujya Gurudevshri. Do not include awards given to others.',
  physical_spaces:          'Extract ashram construction, land acquisition, temple inaugurations, and infrastructure milestones directed or inaugurated by Gurudev / Pujya Gurudevshri.',
  social_contextual:        'Extract references to the prevailing social, political, or world conditions during a given time period — such as wars, pandemics (e.g. COVID 2019–2021), famines, political events, or major national/global circumstances — as context for the period in which Gurudev / Pujya Gurudevshri was active. Do not extract Gurudev\'s responses or actions — only the background conditions of the era.',
  life_formation:           'Extract Gurudev\'s / Pujya Gurudevshri\'s birth, childhood, family background, early education, and formative life events. Do not include biographical details of others.',
  artifacts:                'Extract personal objects, manuscripts, gifts, sacred items, and notable photographs belonging to or associated with Gurudev / Pujya Gurudevshri.',
}

const PROMPT_SUFFIX = `
Return ONLY structured blocks in this exact format:

INCIDENT [1]
DESCRIPTION: <one sentence factual description>
DATE: <year, decade, or period>
DATE_PRECISION: year|decade|period|approximate|unknown
PEOPLE: <comma-separated names, or NONE>
LOCATIONS: <comma-separated places, or NONE>
CATEGORY: <category_key>
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
    return [{
      description: desc,
      date: { year: parseYear(dateRaw), period: dateRaw, precision: fieldValue(block, 'DATE_PRECISION') || 'unknown' },
      people: parseList(fieldValue(block, 'PEOPLE')),
      locations: parseList(fieldValue(block, 'LOCATIONS')),
      category: fieldValue(block, 'CATEGORY') || category,
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
}

const BK_GENERAL_SUFFIX = `

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
  const { notebook_ids, categories, bapa_katha_ids = [] } = await req.json()

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

          for (const cat of categories as string[]) {
            send({ msg: `Querying [${cat}] from notebook ${nbId.slice(0, 8)}…`, level: 'info' })

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
                      { $setOnInsert: { ...story, contentHash: hash, extracted_at: now, source_notebook: nbId, nlm_source_links: nlmSourceLinks } },
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
                      { $setOnInsert: { ...inc, contentHash: hash, extracted_at: now, source_notebook: nbId, source_type: 'notebooklm', nlm_source_links: nlmSourceLinks } },
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
