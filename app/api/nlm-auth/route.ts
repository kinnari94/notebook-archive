import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'

const execAsync = promisify(exec)
const LIST_SCRIPT = join(process.cwd(), 'scripts', 'nlm_list.py')

export async function GET() {
  try {
    const { stdout } = await execAsync(`python3 "${LIST_SCRIPT}"`, { timeout: 20000 })
    const result = JSON.parse(stdout.trim())
    if (result.error === 'not_connected' || result.error) {
      return NextResponse.json({ configured: true, ok: false, message: 'Run notebooklm login in terminal' })
    }
    return NextResponse.json({ configured: true, ok: true, message: 'Connected via notebooklm login' })
  } catch {
    return NextResponse.json({ configured: false, ok: false })
  }
}
