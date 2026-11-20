import { NextRequest, NextResponse } from 'next/server'
import { getSourceOptions } from '@/lib/db'

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get('source') === 'bapa_katha' ? 'bapa_katha' : 'standard'
  try {
    const notebooks = await getSourceOptions(source)
    return NextResponse.json({ notebooks })
  } catch (e) {
    console.error('GET /api/sources error:', e)
    return NextResponse.json({ error: String(e), notebooks: [] }, { status: 500 })
  }
}
