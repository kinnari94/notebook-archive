import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { createHash } from 'crypto'
import { getDb, COLLECTIONS } from '@/lib/db'

function contentHash(notebookId: string, category: string, description: string): string {
  return createHash('sha1')
    .update(`${notebookId}|${category}|${description.trim().toLowerCase()}`)
    .digest('hex')
}

const ASK_SCRIPT = join(process.cwd(), 'scripts', 'nlm_ask.py')

const PROMPTS: Record<string, string> = {
  daily_dateline: 'Extract all chronological dateline events — meetings, ceremonies, inaugurations, daily routines. Each incident on its own INCIDENT [N] block.',
  health_aahar_discipline: 'Extract all mentions of physical health, dietary practices, fasting, sleep patterns, physical discipline.',
  spiritual_exp: 'Extract mystical experiences, samadhi states, meditation milestones, divine visions, spiritual breakthroughs.',
  teachings_guidance: 'Extract satsangs, pravachans, philosophical discourses, spiritual instructions given to disciples.',
  people_encounters: 'Extract first meetings, dikshas, notable interactions with disciples, visitors, and public figures.',
  travels_journeys: 'Extract all travel — pilgrimages, yatras, national and international visits, journeys.',
  institutional_timeline: 'Extract founding dates, organizational milestones, governance events, institutional changes.',
  seva_projects: 'Extract community service, education, healthcare, disaster relief, and social welfare initiatives.',
  awards_accreds: 'Extract awards, honours, government recognition, honorary degrees, and public acknowledgements.',
  physical_spaces: 'Extract ashram construction, land acquisition, temple inaugurations, and infrastructure milestones.',
  social_contextual: 'Extract responses to national events, social issues, COVID-era activities, and historical context.',
  life_formation: 'Extract birth, childhood, family background, early education, and formative life events.',
  artifacts: 'Extract personal objects, manuscripts, gifts, sacred items, and notable photographs mentioned.',
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
ACCESS_TIER: <1|2|3>
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
  access_tier: number
  source_chunk: string
  verified: boolean
  confidence: string
}

function field(block: string, name: string): string {
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

function parseResponse(text: string, category: string, tierDefault: number): ParsedIncident[] {
  if (!text || text.includes('NO_INCIDENTS_FOUND')) return []
  const blocks = text.split(/INCIDENT\s*\[\d+\]/i).slice(1)
  return blocks.flatMap(block => {
    const desc = field(block, 'DESCRIPTION')
    if (!desc) return []
    const dateRaw = field(block, 'DATE')
    const tierRaw = parseInt(field(block, 'ACCESS_TIER'))
    return [{
      description: desc,
      date: { year: parseYear(dateRaw), period: dateRaw, precision: field(block, 'DATE_PRECISION') || 'unknown' },
      people: parseList(field(block, 'PEOPLE')),
      locations: parseList(field(block, 'LOCATIONS')),
      category: field(block, 'CATEGORY') || category,
      access_tier: isNaN(tierRaw) ? tierDefault : tierRaw,
      source_chunk: field(block, 'SOURCE_CHUNK'),
      verified: false,
      confidence: 'auto_extracted',
    }]
  })
}

function askNotebook(notebookId: string, prompt: string, nlmCookie: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [ASK_SCRIPT, notebookId, prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NLM_COOKIE: nlmCookie },
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

export async function POST(req: NextRequest) {
  const { notebook_ids, categories, access_tier = 1 } = await req.json()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) => controller.enqueue(enc.encode(evt(data)))

      const total = notebook_ids.length * categories.length
      let done = 0

      try {
        const db = await getDb()

        for (const nbId of notebook_ids as string[]) {
          for (const cat of categories as string[]) {
            // Skip if this notebook+category combo already has data
            const existing = await db.collection(COLLECTIONS.incidents).countDocuments({
              source_notebook: nbId,
              category: cat,
            })
            if (existing > 0) {
              send({ msg: `  ⏭ [${cat}] already has ${existing} incidents for this notebook — skipped`, level: 'muted' })
              done++
              send({ progress: done, total })
              continue
            }

            const prompt = (PROMPTS[cat] || `Extract all ${cat} incidents.`) + PROMPT_SUFFIX
            send({ msg: `Querying [${cat}] from notebook ${nbId.slice(0, 8)}…`, level: 'info' })

            try {
              const answer = await askNotebook(nbId, prompt, '')
              const incidents = parseResponse(answer, cat, access_tier)
              send({ msg: `  → ${incidents.length} incident(s) parsed`, level: incidents.length ? 'success' : 'muted' })

              if (incidents.length > 0) {
                const now = new Date()
                const docs = incidents.map(inc => ({
                  ...inc,
                  extracted_at: now,
                  source_notebook: nbId,
                  source_type: 'notebooklm',
                }))
                await db.collection(COLLECTIONS.incidents).insertMany(docs)
                await db.collection(COLLECTIONS.extractions).insertOne({
                  notebook_id: nbId,
                  category: cat,
                  incidents_found: incidents.length,
                  status: 'done',
                  started_at: now,
                })
                send({ msg: `  ✓ Saved ${incidents.length} to MongoDB`, level: 'success' })
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
