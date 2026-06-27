import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { spawn } from 'child_process'
import { join } from 'path'
import { isNlmConnected, setNlmConnected, clearNlmSession } from '@/lib/nlm-session'

const PYTHON = process.platform === 'win32' ? 'python' : 'python3'
const LOGIN_SCRIPT = join(process.cwd(), 'scripts', 'nlm_login_credentials.py')
const LIST_SCRIPT  = join(process.cwd(), 'scripts', 'nlm_list.py')

function runScript(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
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

// GET — check if this app session has an active NotebookLM connection
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ connected: false })

  // Not connected in this session → show login form
  if (!isNlmConnected(email)) return NextResponse.json({ connected: false })

  // Session says connected — verify credentials still work
  try {
    const stdout = await runScript([LIST_SCRIPT], 20000)
    const result = JSON.parse(stdout)
    if (Array.isArray(result)) return NextResponse.json({ connected: true })
    clearNlmSession(email)
    return NextResponse.json({ connected: false })
  } catch {
    clearNlmSession(email)
    return NextResponse.json({ connected: false })
  }
}

// POST — validate entered credentials against env vars, then connect
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })

  const nlmEmail    = process.env.NOTEBOOKLM_EMAIL?.trim()
  const nlmPassword = process.env.NOTEBOOKLM_PASSWORD?.trim()

  if (!nlmEmail || !nlmPassword) {
    return NextResponse.json({ ok: false, error: 'NotebookLM credentials are not configured on the server.' }, { status: 500 })
  }

  const { email: enteredEmail, password: enteredPassword } = await req.json()

  if (!enteredEmail?.trim() || !enteredPassword) {
    return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 })
  }

  if (enteredEmail.trim().toLowerCase() !== nlmEmail.toLowerCase()) {
    return NextResponse.json({ ok: false, error: 'Incorrect email.' }, { status: 403 })
  }

  if (enteredPassword !== nlmPassword) {
    return NextResponse.json({ ok: false, error: 'Incorrect password.' }, { status: 403 })
  }

  try {
    const stdout = await runScript([LOGIN_SCRIPT, nlmEmail, nlmPassword], 90000)
    const result = JSON.parse(stdout)
    if (result.ok) setNlmConnected(email)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
