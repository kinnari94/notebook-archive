import { NextResponse } from 'next/server'
import { rebuildTextIndex } from '@/lib/db'

export async function POST() {
  try {
    const result = await rebuildTextIndex()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, message: String(e) }, { status: 500 })
  }
}
