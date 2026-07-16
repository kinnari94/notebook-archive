import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'

const ASK_SCRIPT = join(process.cwd(), 'scripts', 'nlm_ask.py')
const PYTHON = process.platform === 'win32' ? 'python' : 'python3'

function askNotebook(notebookId: string, prompt: string): Promise<{ answer: string; references: { source_id: string; cited_text: string }[] }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [ASK_SCRIPT, notebookId, prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let stdout = ''
    const timer = setTimeout(() => { proc.kill(); reject(new Error('timed out')) }, 150000)
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.on('close', () => {
      clearTimeout(timer)
      try {
        const r = JSON.parse(stdout.trim())
        if (r.error) reject(new Error(r.error))
        else resolve({ answer: r.answer || '', references: r.references || [] })
      } catch {
        reject(new Error('Invalid response'))
      }
    })
    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(new Error(err.code === 'ENOENT'
        ? 'NotebookLM features require Python 3 and Playwright. Not available on serverless platforms.'
        : err.message))
    })
  })
}

export async function POST(req: NextRequest) {
  const { query, notebook_ids, notebook_titles = {} } = await req.json()

  if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })
  if (!notebook_ids?.length) return NextResponse.json({ error: 'notebook_ids required' }, { status: 400 })

  const results = await Promise.allSettled(
    (notebook_ids as string[]).map(async (id: string) => {
      const { answer, references } = await askNotebook(id, query)
      return {
        notebook_id: id,
        notebook_title: (notebook_titles as Record<string, string>)[id] || id.slice(0, 8),
        answer,
        references,
      }
    })
  )

  const responses = results.map((r, i) => {
    const id = (notebook_ids as string[])[i]
    if (r.status === 'fulfilled') return r.value
    return {
      notebook_id: id,
      notebook_title: (notebook_titles as Record<string, string>)[id] || id.slice(0, 8),
      answer: '',
      references: [],
      error: r.reason?.message || 'failed',
    }
  })

  return NextResponse.json({ responses })
}
