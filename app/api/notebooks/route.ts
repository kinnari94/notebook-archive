import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'

const PYTHON = process.platform === 'win32' ? 'python' : 'python3'
const LIST_SCRIPT = join(process.cwd(), 'scripts', 'nlm_list.py')

function runList(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [LIST_SCRIPT], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
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
    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(new Error(err.code === 'ENOENT'
        ? 'NotebookLM features require Python 3 and Playwright. Not available on serverless platforms.'
        : err.message))
    })
  })
}

export async function GET() {
  try {
    const stdout = await runList()
    const result = JSON.parse(stdout)
    if (result.error) return NextResponse.json({ error: result.error, notebooks: [] })
    return NextResponse.json({ notebooks: result })
  } catch {
    return NextResponse.json({ error: 'not_connected', notebooks: [] })
  }
}
