import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
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
  daily_dateline:           'Extract all chronological dateline events — meetings, ceremonies, inaugurations, daily routines.',
  health_aahar_discipline:  'Extract all mentions of physical health, dietary practices, fasting, sleep patterns, physical discipline.',
  spiritual_exp:            'Extract mystical experiences, samadhi states, meditation milestones, divine visions, spiritual breakthroughs.',
  teachings_guidance:       'Extract satsangs, pravachans, philosophical discourses, spiritual instructions given to disciples.',
  people_encounters:        'Extract first meetings, dikshas, notable interactions with disciples, visitors, and public figures.',
  travels_journeys:         'Extract all travel — pilgrimages, yatras, national and international visits, journeys.',
  institutional_timeline:   'Extract founding dates, organizational milestones, governance events, institutional changes.',
  seva_projects:            'Extract community service, education, healthcare, disaster relief, and social welfare initiatives.',
  awards_accreds:           'Extract awards, honours, government recognition, honorary degrees, and public acknowledgements.',
  physical_spaces:          'Extract ashram construction, land acquisition, temple inaugurations, and infrastructure milestones.',
  social_contextual:        'Extract responses to national events, social issues, COVID-era activities, and historical context.',
  life_formation:           'Extract birth, childhood, family background, early education, and formative life events.',
  artifacts:                'Extract personal objects, manuscripts, gifts, sacred items, and notable photographs mentioned.',
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

const BK_BASE = `This is a Bapa Katha transcript — devotee interviews sharing personal experiences with Bapaji / Gurudev.
Be exhaustive. Extract every relevant moment. This transcript should not need to be re-run.`

const BK_PROMPTS: Record<string, string> = {
  bk_devotion: `${BK_BASE}

Extract ALL stories showing devotion to Param Krupalu Dev (Bapaji). Include:
- Deep love, reverence, or surrender toward Gurudev
- Moments where Gurudev's grace or presence was strongly felt
- Stories showing complete trust, faith, or inner connection
- How devotion to Gurudev transformed the devotee's life`,

  bk_bhakti: `${BK_BASE}

Extract ALL bhakti stories. Include:
- Devotional practices: bhajans, kirtan, puja, meditation
- Emotional or spiritual experiences of inner connection
- How bhakti developed or deepened through Gurudev's influence
- Love for God that Gurudev ignited or strengthened`,

  bk_satsang: `${BK_BASE}

Extract ALL general satsang stories. Include:
- Attending satsangs, pravachans, or discourses
- Key spiritual teachings received through satsang
- How satsang became a turning point in the devotee's life
- Changes in values, understanding, or behaviour after satsang`,

  bk_personal_guidance: `${BK_BASE}

Extract ALL stories of personal guidance or agna from Gurudev. Include:
- Direct instructions or advice given to the devotee
- Situations where Gurudev intervened or redirected someone's life
- Decisions made based on Gurudev's guidance
- Times when Gurudev addressed a specific personal situation`,

  bk_visionary: `${BK_BASE}

Extract ALL stories showing Gurudev's vision and spiritual infrastructure work. Include:
- Gurudev's long-term plans or foresight for the Mission
- Building of institutions, centres, or spiritual infrastructure
- Stories showing organisational leadership or broader vision
- Moments revealing how Gurudev shaped the direction of spiritual work`,

  bk_guiding_youth: `${BK_BASE}

Extract ALL stories of Gurudev guiding youth. Include:
- Direct interactions between Gurudev and young devotees
- How Gurudev connected with, inspired, or mentored youth
- Youth-specific teachings, examples, or guidance
- How young devotees' lives changed through Gurudev's influence
- Group meetings, camps, or youth satsangs`,

  bk_dasha: `${BK_BASE}

Extract ALL stories revealing Gurudev's inner state (dasha). Include:
- Moments showing Gurudev's equanimity, compassion, or inner peace
- Times when devotees glimpsed Gurudev's spiritual depth or awareness
- Stories showing Gurudev's patience, love, humility, or qualities beyond the ordinary
- Incidents revealing Gurudev's inner life`,

  bk_seva: `${BK_BASE}

Extract ALL seva stories. Include:
- Service done for Gurudev, the Mission, or the community
- How Gurudev inspired, assigned, or recognised seva
- Personal transformations through seva
- The meaning or value of seva as taught by Gurudev`,

  bk_children_legacy: `${BK_BASE}

Extract ALL stories about children and legacy. Include:
- Gurudev's interactions with children or young devotees
- How Gurudev shaped the next generation
- Legacy left in families, institutions, or communities
- Long-term impact across generations`,

  bk_tributes: `${BK_BASE}

Extract ALL tribute stories and external perspectives. Include:
- Recognition or praise of Gurudev from outsiders or public figures
- How Gurudev was perceived by non-devotees or institutions
- External recognition, awards, or respect received
- Any perspective from outside the immediate devotee community`,

  bk_satsang_deep: `${BK_BASE}

Extract ALL satsang-related moments from this transcript. A moment qualifies if it includes:
- A satsang, pravachan, shibir, swadhyay, class, discourse, or spiritual explanation
- A teaching, example, analogy, joke, metaphor, or practical explanation given by Gurudev
- A person's shift from worldly interest toward love for satsang
- A moment where someone felt "Gurudev was speaking directly to me"
- A spiritual doubt resolved through satsang
- A scriptural concept made simple through Gurudev's explanation
- A transformation in lifestyle, habits, understanding, values, or faith after listening to satsang
- A quote from Gurudev's satsang that can become a strong documentary moment
- Gurudev's command over shastras, language, examples, or audience connection

Known story leads to watch for: "From movies to love for satsang" (Vijay Uncle); Star Wars / dead body story (Vijay Uncle); Dead body story (Rekha Maa); Pista / pani puri playful bodh (Bharatbhai Jogani); Karma / washing plate (Vijay Uncle / Bipin Uncle); Figures of speech (Dakshaben); Paramshrutpanu; "Had not read granths yet speaking of shastras"; "Did not know Gujarati yet spoke fluently"; "Everyone feels He was talking to me"; Group meetings with youth; Spirituality while playing games (Jyoti Doshi).

Satsang Sub-Themes (tag each story with one or more):
1. From worldly interest to love for satsang
2. Scriptural clarity made simple
3. Practical spirituality for daily life
4. Playful bodh / humour with depth
5. Personal relevance — "He was speaking to me"
6. Transformation through one example
7. Youth receiving satsang in their language
8. Satsang leading to agna, discipline, or change in conduct
9. Satsang deepening bhakti or devotion
10. Satsang revealing Gurudev's dasha, compassion, awareness, or inner state
11. Early satsang atmosphere / old memories
12. Satsang as the foundation of Mission growth

Do not include general bhakti, seva, youth, tribute, or infrastructure stories unless satsang is central to the moment.`,
}

const BK_GENERAL_SUFFIX = `

Return ONLY structured blocks in this exact format:

STORY [1]
STORY_ID: <INITIALS>-<N>
STORY_TITLE: <short cinematic title>
THEME_BUCKET: <one or more: Devotion to Param Krupalu Dev | Bhakti | Satsang | Personal Guidance / Agna | Visionary / Spiritual Infrastructure | Guiding Youth | Dasha / Inner State | Seva | Children and Legacy | Tributes / External Perspective>
STORY_TYPE: <transformation | agna | satsang | bhakti | seva | youth | dasha | humour | crisis | family | mystical>
TIME_LIFE_STAGE: <year, decade, or life stage — "not specified" if unknown>
LOCATION: <place — "not specified" if unknown>
SUMMARY: <2-line editorial summary>
WHAT_HAPPENED: <concrete incident with specific details>
WHAT_GURUDEV_SAID: <exact words if available — "exact wording not available" if not>
TRANSFORMATION: <before state, inner shift, after state — "none evident" if not present>

STORY [2]
...

If nothing found: NO_STORIES_FOUND`

const BK_SAT_SUFFIX = `

Return ONLY structured blocks in this exact format:

STORY [1]
STORY_ID: <INITIALS>-SAT-<N>
PERSON: <speaker or person whose story this is>
STORY_TITLE: <short cinematic title>
MAIN_THEME_BUCKET: <one from: Devotion to Param Krupalu Dev | Bhakti | Satsang | Personal Guidance / Agna | Visionary / Spiritual Infrastructure | Guiding Youth | Dasha / Inner State | Seva | Children and Legacy | Tributes / External Perspective>
SATSANG_SUB_THEME: <one or more sub-themes from the list above>
STORY_TYPE: <transformation | satsang | teaching | humour | youth | agna | bhakti | dasha | practical wisdom | scriptural clarity>
TIME_LIFE_STAGE: <year, era, or life stage — "not specified" if unknown>
LOCATION: <place — "not specified" if unknown>
SUMMARY: <2-line editorial summary>
WHAT_HAPPENED: <concrete incident with specific details — avoid generic praise>
WHAT_GURUDEV_SAID: <exact words if available — "exact wording not available" if not>
SATSANG_INSIGHT: <the spiritual point, teaching, or understanding that emerged>
TRANSFORMATION: <before state, inner shift, after state — "none evident" if not present>
QUOTE_CLIP_POTENTIAL: <High | Medium | Low | Needs Review>

STORY [2]
...

If nothing found: NO_STORIES_FOUND`

interface ParsedBKStory {
  story_id: string
  story_title: string
  theme_buckets: string[]
  story_type: string
  time_life_stage: string
  location: string
  summary: string
  what_happened: string
  what_gurudev_said: string
  transformation: string
  // satsang-deep only
  person?: string
  main_theme_bucket?: string
  satsang_sub_themes?: string[]
  satsang_insight?: string
  quote_clip_potential?: string
  // meta
  category: string
  source_type: 'bapa_katha'
}

function parseBKResponse(text: string, category: string): ParsedBKStory[] {
  if (!text || text.includes('NO_STORIES_FOUND')) return []
  const isSatDeep = category === 'bk_satsang_deep'
  const blocks = text.split(/STORY\s*\[\d+\]/i).slice(1)
  return blocks.flatMap(block => {
    const title = fieldValue(block, 'STORY_TITLE')
    if (!title) return []
    const story: ParsedBKStory = {
      story_id:         fieldValue(block, 'STORY_ID'),
      story_title:      title,
      theme_buckets:    parseList(fieldValue(block, 'THEME_BUCKET')),
      story_type:       fieldValue(block, 'STORY_TYPE'),
      time_life_stage:  fieldValue(block, 'TIME_LIFE_STAGE') || 'not specified',
      location:         fieldValue(block, 'LOCATION') || 'not specified',
      summary:          fieldValue(block, 'SUMMARY'),
      what_happened:    fieldValue(block, 'WHAT_HAPPENED'),
      what_gurudev_said: fieldValue(block, 'WHAT_GURUDEV_SAID') || 'exact wording not available',
      transformation:   fieldValue(block, 'TRANSFORMATION') || 'none evident',
      category,
      source_type: 'bapa_katha',
    }
    if (isSatDeep) {
      story.person               = fieldValue(block, 'PERSON')
      story.main_theme_bucket    = fieldValue(block, 'MAIN_THEME_BUCKET')
      story.satsang_sub_themes   = parseList(fieldValue(block, 'SATSANG_SUB_THEME'))
      story.satsang_insight      = fieldValue(block, 'SATSANG_INSIGHT')
      story.quote_clip_potential = fieldValue(block, 'QUOTE_CLIP_POTENTIAL')
    }
    return [story]
  })
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function askNotebook(notebookId: string, prompt: string, googleAccessToken?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [ASK_SCRIPT, notebookId, prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(googleAccessToken ? { GOOGLE_ACCESS_TOKEN: googleAccessToken } : {}),
      },
    })
    let stdout = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.on('close', () => {
      try {
        const r = JSON.parse(stdout.trim())
        if (r.error) reject(new Error(r.error))
        else resolve(r.answer || '')
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
  const session = await getServerSession()
  const googleAccessToken = (session as any)?.access_token as string | undefined

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
                const suffix = cat === 'bk_satsang_deep' ? BK_SAT_SUFFIX : BK_GENERAL_SUFFIX
                prompt = (BK_PROMPTS[cat] || `${BK_BASE}\n\nExtract all ${cat.replace('bk_', '')} stories.`) + suffix
              } else {
                prompt = (PROMPTS[cat] || `Extract all ${cat} incidents.`) + PROMPT_SUFFIX
              }

              const answer = await askNotebook(nbId, prompt, googleAccessToken)
              const now = new Date()

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
                      { $setOnInsert: { ...story, contentHash: hash, extracted_at: now, source_notebook: nbId } },
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
                      { $setOnInsert: { ...inc, contentHash: hash, extracted_at: now, source_notebook: nbId, source_type: 'notebooklm' } },
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
