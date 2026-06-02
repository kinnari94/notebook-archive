import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { spawn } from 'child_process'
import { join } from 'path'

const PYTHON = process.platform === 'win32' ? 'python' : 'python3'
const LIST_SCRIPT = join(process.cwd(), 'scripts', 'nlm_list.py')

function runList(env?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [LIST_SCRIPT], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    const timer = setTimeout(() => { proc.kill(); reject(new Error('timed out')) }, 30000)
    proc.on('close', () => {
      clearTimeout(timer)
      if (stdout.trim()) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || 'no output'))
    })
    proc.on('error', reject)
  })
}

export async function GET() {
  const session = await getServerSession()
  const accessToken = (session as any)?.access_token as string | undefined

  try {
    const stdout = await runList(accessToken ? { GOOGLE_ACCESS_TOKEN: accessToken } : undefined)
    const result = JSON.parse(stdout)
    if (result.error) return NextResponse.json({ error: result.error, notebooks: [] })
    return NextResponse.json({ notebooks: result })
  } catch {
    return NextResponse.json({ error: 'not_connected', notebooks: [] })
  }
}
