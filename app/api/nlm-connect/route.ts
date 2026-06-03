import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { spawn } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import os from 'os'

const PYTHON = process.platform === 'win32' ? 'python' : 'python3'
const LOGIN_SCRIPT = join(process.cwd(), 'scripts', 'nlm_login_credentials.py')
const LIST_SCRIPT  = join(process.cwd(), 'scripts', 'nlm_list.py')

const STORAGE_PATHS = [
  join(os.homedir(), '.notebooklm', 'profiles', 'default', 'storage_state.json'),
  join(os.homedir(), '.notebooklm', 'storage_state.json'),
]

function runScript(args: string[], timeoutMs: number, env?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    const timer = setTimeout(() => { proc.kill(); reject(new Error('Script timed out')) }, timeoutMs)
    proc.on('close', () => {
      clearTimeout(timer)
      if (stdout.trim()) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || 'No output from script'))
    })
    proc.on('error', reject)
  })
}

// GET — check current NotebookLM auth status
// If the user has a Google session, try their access token first
export async function GET() {
  const session = await getServerSession()
  const accessToken = (session as any)?.access_token as string | undefined

  if (accessToken) {
    try {
      const stdout = await runScript([LIST_SCRIPT], 20000, { GOOGLE_ACCESS_TOKEN: accessToken })
      const result = JSON.parse(stdout)
      if (Array.isArray(result)) return NextResponse.json({ connected: true })
    } catch {
      // fall through to cookie-based check
    }
  }

  const hasFile = STORAGE_PATHS.some(p => existsSync(p))
  if (!hasFile && !process.env.NOTEBOOKLM_AUTH_JSON) {
    return NextResponse.json({ connected: false })
  }
  try {
    const stdout = await runScript([LIST_SCRIPT], 20000)
    const result = JSON.parse(stdout)
    if (Array.isArray(result)) return NextResponse.json({ connected: true })
    return NextResponse.json({ connected: false })
  } catch {
    return NextResponse.json({ connected: false })
  }
}

// POST — manual login with email + password (fallback)
export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email?.trim() || !password) {
    return NextResponse.json({ ok: false, error: 'Email and password are required' }, { status: 400 })
  }

  try {
    const stdout = await runScript([LOGIN_SCRIPT, email, password], 60000)
    const result = JSON.parse(stdout)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
