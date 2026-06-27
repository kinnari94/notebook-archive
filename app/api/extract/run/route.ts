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

const ASK_SCRIPT        = join(process.cwd(), 'scripts', 'nlm_ask.py')
const ASK_SOURCE_SCRIPT = join(process.cwd(), 'scripts', 'nlm_ask_source.py')
const SOURCES_SCRIPT    = join(process.cwd(), 'scripts', 'nlm_sources.py')
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
IMPORTANT: Return a maximum of 30 incidents per response. If there are more, return only the 30 most significant ones.

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

const BK_ALL_PROMPT = `You are extracting incidents from a Bapa Katha transcript — recordings of devotees sharing personal experiences with Pujya Gurudevshri / Bapaji.

IMPORTANT: Always respond entirely in English, regardless of the language of the source material.

CRITICAL — DO NOT HALLUCINATE:
- Only extract incidents that are explicitly described in the source text. Do not infer, imagine, or elaborate beyond what is directly stated.
- Only use names of people that are explicitly mentioned in the text. If a person is unnamed, write "not specified" — do not guess or assign a generic name.
- Only use place names that are explicitly mentioned. If a location is not named, write "not specified" — do not infer it from context.
- For WHAT_GURUDEV_SAID: only quote words that the transcript explicitly attributes to Him. If not quoted directly, write "exact wording not available".
- If a field's information is not present in the source, always write "not specified" rather than guessing.

Go through every source in this notebook one by one. For each source, extract every distinct incident or moment the devotee describes. Each discrete incident gets its own STORY block — do not merge or skip any.

For CATEGORIES, assign one or more from this list (a single story may fit several):
bk_first_meeting | bk_humour | bk_one_ajna | bk_the_object | bk_discipline_training | bk_dasha_family | bk_non_jain | bk_he_found_me_first | bk_he_doesnt_see_time | bk_vision_behind_projects | bk_compassion_seva | bk_children_teaching | bk_satsang_transformation | bk_love_for_pkd | bk_letters_mails | bk_night_satsang | bk_question_answer | bk_closing_accounts | bk_same_incident_diff_ajna | bk_gurudev_as_child | bk_meditation_inner_state | bk_study_group | bk_line_that_changed_me | bk_shared_events

Category meanings:
- bk_first_meeting: devotee's very first encounter with Gurudevshri
- bk_humour: playful, witty, or teasing moments
- bk_one_ajna: a specific personal instruction given to an individual
- bk_the_object: a physical object central to the interaction
- bk_discipline_training: stern correction, rebuke, or difficult instruction
- bk_dasha_family: observations by family/childhood acquaintances of His inner state
- bk_non_jain: devotees from outside the Jain tradition
- bk_he_found_me_first: Gurudevshri reaching out to a soul before they sought Him
- bk_he_doesnt_see_time: His unusual relationship with time, sleep, and rest
- bk_vision_behind_projects: a vision He expressed for something before it existed
- bk_compassion_seva: acts of compassion toward anyone in distress
- bk_children_teaching: involving children, or teaching through play/games
- bk_satsang_transformation: attending satsang changed or resolved something
- bk_love_for_pkd: devotion to Param Krupalu Dev
- bk_letters_mails: letters or written communication
- bk_night_satsang: satsang or guidance given at night or unusual hours
- bk_question_answer: a specific question asked and answered
- bk_closing_accounts: settling a karmic or personal account
- bk_same_incident_diff_ajna: two devotees describe the same event differently
- bk_gurudev_as_child: accounts of His childhood or early youth
- bk_meditation_inner_state: His personal sadhana, dhyan, or inner experience
- bk_study_group: the intimate early circle of young seekers
- bk_line_that_changed_me: a single phrase that caused a lasting shift
- bk_shared_events: multiple devotees present at the same event

For TAGS, prefer these canonical values when they match:
train | bus | cycle | walking | running | boating | beach | snow | dining_table | phone_call | night_satsang | games_playfulness | jeevdaya | monument | visionary | seva | informal_youth | he_as_devotee | relation_pkd | sadhana | family_member | study_group | closing_accounts | question_answer | meditation | dhyan | bhedjnan | inner_state | same_incident_diff_ajna | gurudev_as_child
Use them exactly as written (snake_case). Add free-form tags for anything not covered above.

Keep WHAT_HAPPENED under 300 words per story.

Return ONLY structured blocks in this exact format:

STORY [1]
STORY_ID: <INITIALS>-<N>
STORY_TITLE: <short cinematic title>
CATEGORIES: <comma-separated category keys — one or more>
STORY_TYPE: <transformation | agna | satsang | bhakti | seva | youth | dasha | humour | crisis | family | mystical | vision | compassion | letter | object | correction>
TIME_LIFE_STAGE: <year, decade, or life stage — "not specified" if unknown>
LOCATION: <place name explicitly stated in source — "not specified" if not mentioned>
PERSON: <name of the devotee sharing this story — exactly as named in source, "not specified" if unnamed>
OTHER_PEOPLE: <comma-separated names of other people explicitly named in this incident — "not specified" if none>
TAGS: <comma-separated tags — NONE if none apply>
SUMMARY: <2-line editorial summary using only details from the source>
WHAT_HAPPENED: <concrete incident with specific details from the source — no elaboration beyond what is stated>
WHAT_GURUDEV_SAID: <exact words as quoted in source — "exact wording not available" if not directly quoted>
TRANSFORMATION: <before state, inner shift, after state as described in source — "none evident" if not present>
QUOTE_CLIP_POTENTIAL: <High | Medium | Low | Needs Review>

STORY [2]
...

If nothing found: NO_STORIES_FOUND`

const BK_VALID_CATEGORIES = new Set([
  'bk_first_meeting', 'bk_humour', 'bk_one_ajna', 'bk_the_object', 'bk_discipline_training',
  'bk_dasha_family', 'bk_non_jain', 'bk_he_found_me_first', 'bk_he_doesnt_see_time',
  'bk_vision_behind_projects', 'bk_compassion_seva', 'bk_children_teaching',
  'bk_satsang_transformation', 'bk_love_for_pkd', 'bk_letters_mails', 'bk_night_satsang',
  'bk_question_answer', 'bk_closing_accounts', 'bk_same_incident_diff_ajna',
  'bk_gurudev_as_child', 'bk_meditation_inner_state', 'bk_study_group',
  'bk_line_that_changed_me', 'bk_shared_events',
])

interface ParsedBKStory {
  story_id: string
  story_title: string
  story_type: string
  time_life_stage: string
  location: string
  person: string
  other_people: string[]
  tags: string[]
  summary: string
  what_happened: string
  what_gurudev_said: string
  transformation: string
  quote_clip_potential: string
  categories: string[]
  source_type: 'bapa_katha'
}

function parseBKResponse(text: string): ParsedBKStory[] {
  if (!text || text.includes('NO_STORIES_FOUND')) return []
  const blocks = text.split(/STORY\s*\[\d+\]/i).slice(1)
  return blocks.flatMap(block => {
    const title = fieldValue(block, 'STORY_TITLE')
    if (!title) return []
    const rawCats = parseList(fieldValue(block, 'CATEGORIES'))
    const categories = rawCats.filter(c => BK_VALID_CATEGORIES.has(c))
    const story: ParsedBKStory = {
      story_id:          fieldValue(block, 'STORY_ID'),
      story_title:       title,
      story_type:        fieldValue(block, 'STORY_TYPE'),
      time_life_stage:   fieldValue(block, 'TIME_LIFE_STAGE') || 'not specified',
      location:          fieldValue(block, 'LOCATION') || 'not specified',
      person:            fieldValue(block, 'PERSON') || 'not specified',
      other_people:      parseList(fieldValue(block, 'OTHER_PEOPLE')),
      tags:              parseList(fieldValue(block, 'TAGS')),
      summary:           fieldValue(block, 'SUMMARY'),
      what_happened:     fieldValue(block, 'WHAT_HAPPENED'),
      what_gurudev_said: fieldValue(block, 'WHAT_GURUDEV_SAID') || 'exact wording not available',
      transformation:    fieldValue(block, 'TRANSFORMATION') || 'none evident',
      quote_clip_potential: fieldValue(block, 'QUOTE_CLIP_POTENTIAL') || 'Needs Review',
      categories,
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

function listSources(notebookId: string): Promise<{ id: string; title: string }[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SOURCES_SCRIPT, notebookId], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let stdout = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.on('close', () => {
      try {
        const r = JSON.parse(stdout.trim())
        if (r.error) reject(new Error(r.error))
        else resolve(r as { id: string; title: string }[])
      } catch {
        reject(new Error('Invalid response from nlm_sources.py'))
      }
    })
    proc.on('error', reject)
  })
}

function askSource(notebookId: string, sourceId: string, prompt: string): Promise<AskResponse> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [ASK_SOURCE_SCRIPT, notebookId, sourceId, prompt], {
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
        reject(new Error('Invalid response from nlm_ask_source.py'))
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

      const bkIds = new Set(bapa_katha_ids as string[])
      const standardNbs = (notebook_ids as string[]).filter(id => !bkIds.has(id))
      const bkNbs       = (notebook_ids as string[]).filter(id => bkIds.has(id))
      const total = standardNbs.length * (categories as string[]).length + bkNbs.length
      let done = 0

      try {
        const db = await getDb()

        // ── Standard notebooks: one query per category ───────────────────────
        for (const nbId of standardNbs) {
          const nbTitle: string = (notebook_titles as Record<string, string>)[nbId] || nbId.slice(0, 8)
          send({ msg: `━━ Notebook: ${nbTitle}`, level: 'info' })

          for (const cat of categories as string[]) {
            if (done > 0) await new Promise(r => setTimeout(r, 15000))
            send({ msg: `  Querying [${cat}]…`, level: 'info' })

            try {
              const prompt = (PROMPTS[cat] || `Extract all ${cat} incidents.`) + PROMPT_SUFFIX

              let askResult: AskResponse
              try {
                askResult = await askNotebook(nbId, prompt)
              } catch (retryErr: any) {
                if (/rate limit|rejected/i.test(String(retryErr))) {
                  send({ msg: `  ⏳ Rate limited — waiting 30s before retry…`, level: 'muted' })
                  await new Promise(r => setTimeout(r, 30000))
                  askResult = await askNotebook(nbId, prompt)
                } else {
                  throw retryErr
                }
              }
              const { answer, references } = askResult
              const now = new Date()
              const nlmSourceLinks = references
                .filter(r => r.source_id)
                .map(r => ({
                  source_id: r.source_id,
                  cited_text: r.cited_text,
                  nlm_url: `https://notebooklm.google.com/notebook/${nbId}?source=${r.source_id}`,
                }))

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
                    notebook_id: nbId, notebook_title: nbTitle, category: cat,
                    points_saved: saved, points_skipped: skipped,
                    status: 'done', started_at: now,
                  })
                }
              }
            } catch (e) {
              send({ msg: `  ✗ ${e}`, level: 'error' })
            }

            done++
            send({ progress: done, total })
          }
        }

        // ── Bapa Katha notebooks: one query per source ───────────────────────
        for (const nbId of bkNbs) {
          const nbTitle: string = (notebook_titles as Record<string, string>)[nbId] || nbId.slice(0, 8)
          send({ msg: `━━ Notebook: ${nbTitle} [Bapa Katha]`, level: 'info' })

          // List sources first
          let sources: { id: string; title: string }[] = []
          try {
            sources = await listSources(nbId)
            send({ msg: `  Found ${sources.length} source${sources.length !== 1 ? 's' : ''} — querying each…`, level: 'info' })
          } catch (e) {
            send({ msg: `  ✗ Could not list sources: ${e}`, level: 'error' })
            done++
            send({ progress: done, total })
            continue
          }

          // Update total now that we know the real source count
          // (we reserved 1 slot for this notebook; expand to actual source count)
          const extraSlots = sources.length - 1
          // send updated total so progress bar stays accurate
          send({ totalDelta: extraSlots })

          let nbSaved = 0, nbSkipped = 0

          for (let si = 0; si < sources.length; si++) {
            const src = sources[si]
            if (done > 0 || si > 0) await new Promise(r => setTimeout(r, 15000))
            send({ msg: `  [${si + 1}/${sources.length}] ${src.title || src.id}…`, level: 'info' })

            try {
              let askResult: AskResponse
              try {
                askResult = await askSource(nbId, src.id, BK_ALL_PROMPT)
              } catch (retryErr: any) {
                if (/rate limit|rejected/i.test(String(retryErr))) {
                  send({ msg: `  ⏳ Rate limited — waiting 30s before retry…`, level: 'muted' })
                  await new Promise(r => setTimeout(r, 30000))
                  askResult = await askSource(nbId, src.id, BK_ALL_PROMPT)
                } else {
                  throw retryErr
                }
              }
              const { answer, references } = askResult
              const now = new Date()
              const nlmSourceLinks = references
                .filter(r => r.source_id)
                .map(r => ({
                  source_id: r.source_id,
                  cited_text: r.cited_text,
                  nlm_url: `https://notebooklm.google.com/notebook/${nbId}?source=${r.source_id}`,
                }))

              const stories = parseBKResponse(answer)
              if (stories.length === 0) {
                send({ msg: `    → No stories found`, level: 'muted' })
              } else {
                let saved = 0, skipped = 0
                for (const story of stories) {
                  const hash = contentHash(nbId, src.id, story.story_title + story.what_happened.slice(0, 80))
                  const result = await db.collection(COLLECTIONS.bk_stories).updateOne(
                    { contentHash: hash },
                    { $setOnInsert: { ...story, contentHash: hash, extracted_at: now, source_notebook: nbId, source_notebook_title: nbTitle, source_id: src.id, source_title: src.title, nlm_source_links: nlmSourceLinks } },
                    { upsert: true }
                  )
                  if (result.upsertedCount > 0) saved++
                  else skipped++
                }
                nbSaved += saved
                nbSkipped += skipped
                const msg = skipped > 0
                  ? `    ✓ ${saved} new · ${skipped} existed`
                  : `    ✓ ${saved} stor${saved !== 1 ? 'ies' : 'y'} saved`
                send({ msg: saved > 0 ? msg : `    → All ${skipped} already extracted`, level: saved > 0 ? 'success' : 'muted' })
              }
            } catch (e) {
              send({ msg: `    ✗ ${e}`, level: 'error' })
            }

            done++
            send({ progress: done, total })
          }

          if (nbSaved > 0) {
            await db.collection(COLLECTIONS.extractions).insertOne({
              notebook_id: nbId, notebook_title: nbTitle, notebook_type: 'bapa_katha',
              points_saved: nbSaved, points_skipped: nbSkipped,
              status: 'done', started_at: new Date(),
            })
          }

          send({ msg: `  ━ Done: ${nbSaved} new stories across ${sources.length} sources`, level: 'success' })
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
