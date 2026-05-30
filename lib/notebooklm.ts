/**
 * NotebookLM TypeScript client — reverse-engineered from teng-lin/notebooklm-py
 * Uses Google's internal batchexecute RPC and streaming chat endpoints.
 */

const BASE = 'https://notebooklm.google.com'
const BATCH_URL = `${BASE}/_/LabsTailwindUi/data/batchexecute`
const STREAM_URL = `${BASE}/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed`

const RPC = {
  LIST_NOTEBOOKS: 'wXbhsf',
  GET_NOTEBOOK: 'rLM1Ne',
}

export interface NLMNotebook {
  id: string
  title: string
  source_count: number
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getTokens(cookie: string): Promise<{ csrf: string; sid: string }> {
  const res = await fetch(`${BASE}/`, {
    headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    redirect: 'follow',
  })
  const html = await res.text()

  if (html.includes('accounts.google.com')) {
    throw new Error('Not authenticated — cookie is expired or invalid')
  }

  const csrf = html.match(/SNlM0e":"([^"]+)"/)?.[1]
  const sid  = html.match(/FdrFJe":"([^"]+)"/)?.[1]

  if (!csrf || !sid) {
    throw new Error('Could not extract auth tokens from NotebookLM. Check your cookie.')
  }
  return { csrf, sid }
}

// ── RPC helpers ───────────────────────────────────────────────────────────────

function parseChunked(text: string, rpcId: string): unknown {
  // Response format: byte_count\njson\nbyte_count\njson\n...
  // Each JSON line may contain wrb.fr entries
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^\d+$/.test(trimmed)) continue
    try {
      const parsed = JSON.parse(trimmed)
      if (!Array.isArray(parsed)) continue
      for (const item of parsed) {
        if (Array.isArray(item) && item[0] === 'wrb.fr' && item[1] === rpcId && item[2]) {
          const data = item[2]
          return typeof data === 'string' ? JSON.parse(data) : data
        }
      }
    } catch { /* skip malformed chunks */ }
  }
  throw new Error(`No response found for RPC ${rpcId}`)
}

async function rpcCall(cookie: string, rpcId: string, params: unknown): Promise<unknown> {
  const { csrf, sid } = await getTokens(cookie)
  const paramsStr = JSON.stringify(params)
  const fReq = JSON.stringify([[[rpcId, paramsStr, null, 'generic']]])
  const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(csrf)}&`

  const res = await fetch(
    `${BATCH_URL}?f.sid=${encodeURIComponent(sid)}&hl=en&authuser=0`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': BASE,
        'Referer': `${BASE}/`,
      },
      body,
    }
  )

  if (!res.ok) throw new Error(`RPC HTTP error ${res.status}`)
  const text = await res.text()
  return parseChunked(text, rpcId)
}

// ── Chat (streaming, buffered) ────────────────────────────────────────────────

async function streamAsk(cookie: string, notebookId: string, question: string): Promise<string> {
  const { csrf, sid } = await getTokens(cookie)

  const params = [
    [],             // sources ([] = all)
    question,       // question
    [],             // conversation history ([] = new)
    [2, null, [1], [1]], // static metadata
    null,           // conversation_id (null = new)
    null,
    null,
    notebookId,
    1,
  ]
  const paramsStr = JSON.stringify(params)
  const fReq = JSON.stringify([null, paramsStr])
  const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(csrf)}&`

  const reqId = Math.floor(Math.random() * 900000) + 100000
  const res = await fetch(
    `${STREAM_URL}?f.sid=${encodeURIComponent(sid)}&hl=en&authuser=0&_reqid=${reqId}&rt=c`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': BASE,
        'Referer': `${BASE}/`,
      },
      body,
    }
  )

  if (!res.ok) throw new Error(`Chat HTTP error ${res.status}`)
  const text = await res.text()

  // Parse chunked streaming response — find the final marked answer
  const RPC_KEY = 'GenerateFreeFormStreamed'
  let bestAnswer = ''
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^\d+$/.test(trimmed)) continue
    try {
      const parsed = JSON.parse(trimmed)
      if (!Array.isArray(parsed)) continue
      for (const item of parsed) {
        if (!Array.isArray(item) || item[0] !== 'wrb.fr') continue
        if (typeof item[1] === 'string' && !item[1].includes(RPC_KEY)) continue
        const data = typeof item[2] === 'string' ? JSON.parse(item[2]) : item[2]
        if (!Array.isArray(data)) continue

        // Answer is at data[0][0][0]
        const answer = data?.[0]?.[0]?.[0]
        if (typeof answer === 'string' && answer.length > bestAnswer.length) {
          bestAnswer = answer
        }
      }
    } catch { /* skip malformed */ }
  }

  if (!bestAnswer) throw new Error('No answer in response — notebook may be empty or unreachable')
  return bestAnswer
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listNotebooks(cookie: string): Promise<NLMNotebook[]> {
  const data = await rpcCall(cookie, RPC.LIST_NOTEBOOKS, [null]) as unknown[][]
  if (!Array.isArray(data)) return []

  // Response is an array of notebook entries
  const notebooks: NLMNotebook[] = []
  for (const entry of data) {
    if (!Array.isArray(entry)) continue
    // entry[0] = id, entry[1] = title, entry[2] = ??, entry sources count varies
    const id    = entry[0]
    const title = entry[1]
    if (typeof id === 'string' && typeof title === 'string') {
      notebooks.push({ id, title, source_count: Array.isArray(entry[3]) ? entry[3].length : 0 })
    }
  }
  return notebooks
}

export async function askNotebook(cookie: string, notebookId: string, question: string): Promise<string> {
  return streamAsk(cookie, notebookId, question)
}

export async function testAuth(cookie: string): Promise<{ ok: boolean; message: string }> {
  try {
    await getTokens(cookie)
    return { ok: true, message: 'Connected to NotebookLM' }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

// ── Cookie file helpers ───────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

const COOKIE_FILE = join(process.cwd(), '.notebooklm_cookie')

// Paths where `notebooklm login` saves its Playwright storage state
const NLM_STORAGE_PATHS = [
  join(os.homedir(), '.notebooklm', 'profiles', 'default', 'storage_state.json'),
  join(os.homedir(), '.notebooklm', 'storage_state.json'),
]

// Exact domains notebooklm-py allows (must match, not substring)
const NLM_ALLOWED_DOMAINS = new Set(['.google.com', 'notebooklm.google.com', '.googleusercontent.com'])

function cookiesFromStorageState(path: string): string {
  try {
    const state = JSON.parse(readFileSync(path, 'utf8'))
    return (state.cookies as Array<{ name: string; value: string; domain?: string }>)
      .filter(c => c.domain && NLM_ALLOWED_DOMAINS.has(c.domain))
      .map(c => `${c.name}=${c.value}`)
      .join('; ')
  } catch {
    return ''
  }
}

export function saveCookie(cookie: string) {
  writeFileSync(COOKIE_FILE, cookie.trim(), 'utf8')
}

export function loadCookie(): string {
  // 1. Storage state written by `notebooklm login` — same source as old Streamlit project
  for (const p of NLM_STORAGE_PATHS) {
    if (existsSync(p)) {
      const cookie = cookiesFromStorageState(p)
      if (cookie) return cookie
    }
  }

  // 2. Manual cookie string (pasted in Settings or set by env var)
  if (existsSync(COOKIE_FILE)) return readFileSync(COOKIE_FILE, 'utf8').trim()
  if (process.env.NOTEBOOKLM_COOKIE) return process.env.NOTEBOOKLM_COOKIE

  return ''
}
