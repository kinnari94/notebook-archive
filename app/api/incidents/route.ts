import { NextRequest, NextResponse } from 'next/server'
import { queryIncidents } from '@/lib/db'

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams
  try {
    const result = await queryIncidents({
      category: s.get('category') || undefined,
      person: s.get('person') || undefined,
      location: s.get('location') || undefined,
      year_from: s.get('year_from') ? Number(s.get('year_from')) : undefined,
      year_to: s.get('year_to') ? Number(s.get('year_to')) : undefined,
      search_text: s.get('q') || undefined,
      limit: s.get('limit') ? Number(s.get('limit')) : 20,
      skip: s.get('skip') ? Number(s.get('skip')) : 0,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
