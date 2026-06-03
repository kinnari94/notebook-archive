import { NextRequest, NextResponse } from 'next/server'
import { getTimelineData } from '@/lib/db'

export async function GET(req: NextRequest) {
  const source = (req.nextUrl.searchParams.get('source') as 'standard' | 'bapa_katha' | 'all') || 'all'
  try {
    const data = await getTimelineData(source)
    return NextResponse.json({ timeline: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
