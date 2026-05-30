import { NextResponse } from 'next/server'
import { getArchiveStats, getCategoryBreakdown, getRecentExtractions } from '@/lib/db'

export async function GET() {
  try {
    const [stats, breakdown, extractions] = await Promise.all([
      getArchiveStats(),
      getCategoryBreakdown(),
      getRecentExtractions(8),
    ])
    return NextResponse.json({ stats, breakdown, extractions })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
