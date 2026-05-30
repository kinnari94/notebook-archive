import { NextResponse } from 'next/server'
import { getTimelineData } from '@/lib/db'

export async function GET() {
  try {
    const data = await getTimelineData()
    return NextResponse.json({ timeline: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
