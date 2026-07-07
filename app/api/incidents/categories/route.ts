import { NextRequest, NextResponse } from 'next/server'
import { getCategoryCounts } from '@/lib/db'

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams
  try {
    const tags = s.get('tags')
    const result = await getCategoryCounts({
      person:      s.get('person')    || undefined,
      location:    s.get('location')  || undefined,
      year_from:   s.get('year_from') ? Number(s.get('year_from')) : undefined,
      year_to:     s.get('year_to')   ? Number(s.get('year_to'))   : undefined,
      search_text: s.get('q')         || undefined,
      tags:        tags ? tags.split(',').filter(Boolean) : undefined,
      source:      (s.get('source') as 'standard' | 'bapa_katha' | 'all') || 'all',
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
