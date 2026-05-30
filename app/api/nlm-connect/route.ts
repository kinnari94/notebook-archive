import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { existsSync } from 'fs'
import os from 'os'

const execAsync = promisify(exec)
const LOGIN_SCRIPT = join(process.cwd(), 'scripts', 'nlm_login_credentials.py')
const LIST_SCRIPT  = join(process.cwd(), 'scripts', 'nlm_list.py')

const STORAGE_PATHS = [
  join(os.homedir(), '.notebooklm', 'profiles', 'default', 'storage_state.json'),
  join(os.homedir(), '.notebooklm', 'storage_state.json'),
]

// GET — check current NotebookLM auth status
export async function GET() {
  const hasFile = STORAGE_PATHS.some(p => existsSync(p))
  if (!hasFile && !process.env.NOTEBOOKLM_AUTH_JSON) {
    return NextResponse.json({ connected: false })
  }
  try {
    const { stdout } = await execAsync(`python3 "${LIST_SCRIPT}"`, { timeout: 20000 })
    const result = JSON.parse(stdout.trim())
    if (Array.isArray(result)) return NextResponse.json({ connected: true })
    return NextResponse.json({ connected: false })
  } catch {
    return NextResponse.json({ connected: false })
  }
}

// POST — login with email + password
export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email?.trim() || !password) {
    return NextResponse.json({ ok: false, error: 'Email and password are required' }, { status: 400 })
  }

  try {
    const { stdout } = await execAsync(
      `python3 "${LOGIN_SCRIPT}" ${JSON.stringify(email)} ${JSON.stringify(password)}`,
      { timeout: 60000 }
    )
    const result = JSON.parse(stdout.trim())
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
